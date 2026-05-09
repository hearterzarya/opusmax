import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hashApiKey, ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { checkRateLimit } from '@/lib/redis'
import { QUOTA_WINDOW_SECONDS, reserveRollingWindowQuota, settleRollingWindowQuota } from '@/lib/quota'
import { z } from 'zod'

const messageSchema = z.object({
  model: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.union([z.string(), z.array(z.any())]),
      })
    )
    .min(1),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  system: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().positive().optional(),
  metadata: z
    .object({
      user_id: z.string().optional(),
    })
    .optional()
    .nullable(),
})

// Cost weighting for budget enforcement only — NOT for raw token counts.
const HAIKU_COST_MULTIPLIER = 0.25
const SONNET_COST_MULTIPLIER = 1
const OPUS_COST_MULTIPLIER = 5

function getModelMultiplier(model: string): number {
  if (model.includes('haiku')) return HAIKU_COST_MULTIPLIER
  if (model.includes('sonnet')) return SONNET_COST_MULTIPLIER
  if (model.includes('opus')) return OPUS_COST_MULTIPLIER
  return SONNET_COST_MULTIPLIER
}

function buildUpstreamMessagesUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '')
  if (normalizedBase.endsWith('/v1')) {
    return `${normalizedBase}/messages`
  }
  return `${normalizedBase}/v1/messages`
}

function getUpstreamApiKey(): string | null {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim()
  return key || null
}

function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P1001'
  }
  return (
    error instanceof Error &&
    (error.message.includes("Can't reach database server") || error.message.includes('P1001'))
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function validateApiKey(apiKey: string) {
  const keyHash = await hashApiKey(apiKey)

  let key: Awaited<ReturnType<typeof prisma.apiKey.findUnique>> | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      key = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { plan: true },
      })
      lastError = null
      break
    } catch (error) {
      lastError = error
      if (!isDatabaseUnavailableError(error) || attempt === 1) {
        throw error
      }
      await sleep(300)
    }
  }

  if (lastError) throw lastError

  if (!key) {
    return { valid: false, error: createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key not found', 401) }
  }
  if (key.status === 'REVOKED') {
    return { valid: false, error: createErrorResponse(ErrorCodes.KEY_INACTIVE, 'API key has been revoked', 403) }
  }
  if (key.status === 'PAUSED') {
    return { valid: false, error: createErrorResponse(ErrorCodes.KEY_INACTIVE, 'API key is paused', 403) }
  }
  if (key.status === 'EXPIRED' || (key.expiresAt && new Date(key.expiresAt) < new Date())) {
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { status: 'EXPIRED' },
    })
    return { valid: false, error: createErrorResponse(ErrorCodes.KEY_EXPIRED, 'API key has expired', 403) }
  }

  return { valid: true, key }
}

function extractAuthKey(request: NextRequest): string | null {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) return apiKey

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)

  return null
}

interface TokenEstimate {
  raw: number      // raw character-based estimate
  weighted: number // weighted by model multiplier (used for budget enforcement)
}

function estimateTokens(requestBody: z.infer<typeof messageSchema>): TokenEstimate {
  let raw = 0
  for (const message of requestBody.messages) {
    const content =
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    raw += Math.ceil(String(content).length / 4)
  }
  if (requestBody.system) {
    raw += Math.ceil(requestBody.system.length / 4)
  }
  const multiplier = getModelMultiplier(requestBody.model)
  return { raw, weighted: Math.ceil(raw * multiplier) }
}

function getNumericField(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function extractUsageFromEvent(event: unknown): { inputTokens: number | null; outputTokens: number | null } {
  if (!event || typeof event !== 'object') return { inputTokens: null, outputTokens: null }
  const obj = event as {
    usage?: unknown
    message?: { usage?: unknown }
    delta?: { usage?: unknown }
  }

  const candidates = [obj.usage, obj.message?.usage, obj.delta?.usage]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const usageObj = candidate as { input_tokens?: unknown; output_tokens?: unknown }
    const inputTokens = getNumericField(usageObj.input_tokens)
    const outputTokens = getNumericField(usageObj.output_tokens)
    if (inputTokens !== null || outputTokens !== null) {
      return { inputTokens, outputTokens }
    }
  }

  return { inputTokens: null, outputTokens: null }
}

function extractOutputDeltaChars(event: unknown): number {
  if (!event || typeof event !== 'object') return 0
  const obj = event as { delta?: { text?: unknown } }
  return typeof obj.delta?.text === 'string' ? obj.delta.text.length : 0
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const apiKey = extractAuthKey(request)
    if (!apiKey) {
      return createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key required', 401)
    }

    const validation = await validateApiKey(apiKey)
    if (!validation.valid) return validation.error

    const key = validation.key!

    // RPM rate limit
    const rpmLimit = key.rpmLimit || 60
    const rateLimitResult = await checkRateLimit(`rpm:${key.id}`, rpmLimit, 60)
    if (!rateLimitResult.allowed) {
      const retryIn = Math.max(0, Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))
      return createErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${retryIn} seconds`,
        429
      )
    }

    const requestBody = await request.clone().json()
    const validatedBody = messageSchema.parse(requestBody)
    const tokens = estimateTokens(validatedBody)

    // 5-hour rolling token window (hard limit) — enforced per API key id.
    const hourlyBudget = key.hourlyTokenBudget
    let projectedRaw = 0
    if (hourlyBudget && hourlyBudget > BigInt(0)) {
      const projectedTokens = validatedBody.max_tokens
        ? tokens.raw + validatedBody.max_tokens
        : tokens.raw
      const numericBudget = Number(hourlyBudget)

      // Guardrail: if a single request projection exceeds the entire window budget,
      // reject as invalid request sizing instead of treating the key as "window blocked".
      if (projectedTokens > numericBudget) {
        return NextResponse.json(
          {
            error: {
              type: ErrorCodes.VALIDATION_ERROR,
              message:
                'Requested token allocation exceeds this key\'s 5-hour budget. Reduce input size or max_tokens.',
              code: 400,
            },
            quota: {
              blocked: false,
              resetAt: null,
              retryAfterSeconds: 0,
              used: 0,
              remaining: numericBudget,
              requested: projectedTokens,
            },
          },
          { status: 400 }
        )
      }

      const tokenCheck = await reserveRollingWindowQuota(
        key.id,
        hourlyBudget,
        projectedTokens
      )
      if (!tokenCheck.allowed) {
        const resetInMs = Math.max(0, tokenCheck.resetAt - Date.now())
        const response = NextResponse.json(
          {
            error: {
              type: ErrorCodes.TOKEN_BUDGET_EXCEEDED,
              message: `5-hour window limit reached. Try again in ${formatDuration(resetInMs)}`,
              code: 429,
            },
            quota: {
              blocked: true,
              resetAt: new Date(tokenCheck.resetAt).toISOString(),
              retryAfterSeconds: Math.ceil(resetInMs / 1000),
              used: tokenCheck.used,
              remaining: tokenCheck.remaining,
            },
          },
          { status: 429 }
        )
        response.headers.set('Retry-After', String(Math.ceil(resetInMs / 1000)))
        response.headers.set('X-Quota-Reset-At', new Date(tokenCheck.resetAt).toISOString())
        response.headers.set('X-Quota-Window-Seconds', String(QUOTA_WINDOW_SECONDS))
        return response
      }
      projectedRaw = projectedTokens
    }

    // Forward upstream
    const upstreamUrl = process.env.UPSTREAM_ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
    const upstreamMessagesUrl = buildUpstreamMessagesUrl(upstreamUrl)
    const upstreamApiKey = getUpstreamApiKey()
    if (!upstreamApiKey) {
      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        'Server misconfigured: ANTHROPIC_API_KEY is missing',
        500
      )
    }

    const upstreamResponse = await fetch(upstreamMessagesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': upstreamApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(validatedBody),
    })

    // Streaming branch: proxy SSE while observing usage events to settle quota.
    if (validatedBody.stream && upstreamResponse.body) {
      const reader = upstreamResponse.body.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ''
      let observedInputTokens: number | null = null
      let observedOutputTokens: number | null = null
      let observedOutputChars = 0
      let finalized = false

      const processSseChunk = (chunkText: string) => {
        sseBuffer += chunkText
        let newlineIndex = sseBuffer.indexOf('\n')
        while (newlineIndex !== -1) {
          const line = sseBuffer.slice(0, newlineIndex).trim()
          sseBuffer = sseBuffer.slice(newlineIndex + 1)
          if (line.startsWith('data:')) {
            const dataPart = line.slice(5).trim()
            if (dataPart && dataPart !== '[DONE]') {
              try {
                const event = JSON.parse(dataPart)
                const usage = extractUsageFromEvent(event)
                if (usage.inputTokens !== null) observedInputTokens = usage.inputTokens
                if (usage.outputTokens !== null) observedOutputTokens = usage.outputTokens
                observedOutputChars += extractOutputDeltaChars(event)
              } catch {
                // ignore non-JSON data lines
              }
            }
          }
          newlineIndex = sseBuffer.indexOf('\n')
        }
      }

      const finalizeStreamingMetrics = (statusCode: number) => {
        if (finalized) return
        finalized = true
        const latencyMs = Date.now() - startTime
        const inputTokens = observedInputTokens ?? tokens.raw
        const estimatedOutputFromChars = Math.ceil(observedOutputChars / 4)
        const outputTokens = observedOutputTokens ?? estimatedOutputFromChars
        const actualTotalTokens = Math.max(0, inputTokens + outputTokens)

        if (hourlyBudget && hourlyBudget > BigInt(0) && projectedRaw > 0) {
          settleRollingWindowQuota(key.id, hourlyBudget, projectedRaw, actualTotalTokens).catch((err) =>
            console.error('quota settle failed (stream):', err)
          )
        }

        prisma.usageLog
          .create({
            data: {
              apiKeyId: key.id,
              model: validatedBody.model,
              inputTokens,
              outputTokens,
              totalTokens: actualTotalTokens,
              latencyMs,
              statusCode,
              errorType: statusCode >= 400 ? 'stream_error' : null,
              errorMessage: statusCode >= 400 ? 'Upstream streaming request failed' : null,
            },
          })
          .catch((err) => console.error('usageLog write failed:', err))

        prisma.apiKey
          .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
          .catch((err) => console.error('lastUsedAt update failed:', err))
      }

      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read()
            if (done) {
              finalizeStreamingMetrics(upstreamResponse.status)
              controller.close()
              return
            }
            if (value) {
              processSseChunk(decoder.decode(value, { stream: true }))
              controller.enqueue(value)
            }
          } catch (error) {
            finalizeStreamingMetrics(499)
            controller.error(error)
          }
        },
        cancel() {
          finalizeStreamingMetrics(499)
          reader.cancel().catch(() => undefined)
        },
      })

      return new Response(stream, {
        status: upstreamResponse.status,
        headers: {
          'Content-Type': upstreamResponse.headers.get('content-type') || 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const latencyMs = Date.now() - startTime
    const contentType = upstreamResponse.headers.get('content-type') || ''
    let responseData: unknown = null

    if (contentType.includes('application/json')) {
      responseData = await upstreamResponse.json()
    } else {
      const textBody = await upstreamResponse.text()
      try {
        responseData = JSON.parse(textBody)
      } catch {
        responseData = { text: textBody }
      }
    }

    const usage =
      typeof responseData === 'object' && responseData !== null && 'usage' in responseData
        ? (responseData as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
        : undefined
    const errorInfo =
      typeof responseData === 'object' && responseData !== null && 'error' in responseData
        ? (responseData as { error?: { type?: string; message?: string } }).error
        : undefined

    if (upstreamResponse.status === 401 && errorInfo?.type === 'authentication_error') {
      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        'Upstream authentication failed: check ANTHROPIC_API_KEY in server .env',
        502
      )
    }

    const inputTokens = usage?.input_tokens || 0
    const outputTokens = usage?.output_tokens || 0
    const actualTotalTokens = inputTokens + outputTokens

    if (hourlyBudget && hourlyBudget > BigInt(0) && projectedRaw > 0) {
      settleRollingWindowQuota(key.id, hourlyBudget, projectedRaw, actualTotalTokens).catch((err) =>
        console.error('quota settle failed:', err)
      )
    }

    prisma.usageLog
      .create({
        data: {
          apiKeyId: key.id,
          model: validatedBody.model,
          inputTokens,
          outputTokens,
          totalTokens: actualTotalTokens,
          latencyMs,
          statusCode: upstreamResponse.status,
          errorType: upstreamResponse.status >= 400 ? String(errorInfo?.type || 'unknown') : null,
          errorMessage:
            upstreamResponse.status >= 400 ? String(errorInfo?.message || 'Upstream request failed') : null,
        },
      })
      .catch((err) => console.error('usageLog write failed:', err))

    prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch((err) => console.error('lastUsedAt update failed:', err))

    return NextResponse.json(responseData, { status: upstreamResponse.status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((e) => e.message).join(', ')
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Invalid request body: ${message}`,
        400
      )
    }

    if (isDatabaseUnavailableError(error)) {
      console.error('Database unavailable during /api/v1/messages:', error)
      return createErrorResponse(
        ErrorCodes.DATABASE_UNAVAILABLE,
        'Database is temporarily unavailable. Please try again shortly.',
        503
      )
    }

    console.error('Proxy error:', error)
    return createErrorResponse(ErrorCodes.UPSTREAM_ERROR, 'An error occurred while processing your request', 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  })
}
