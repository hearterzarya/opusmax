import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { validateActiveApiKeyFromRequest } from '@/lib/api-key-auth'
import { checkRateLimit } from '@/lib/redis'
import { QUOTA_WINDOW_SECONDS, reserveRollingWindowQuota, settleRollingWindowQuota } from '@/lib/quota'
import { upstreamFetch } from '@/lib/upstream-fetch'
import { createTimingContext, isFirstTextToken } from '@/lib/latency-timing'
import { persistLatencyMetric } from '@/lib/latency-persist'
import { resolveAllProviders } from '@/lib/provider-resolver'
import { anthropicToOpenAIRequest, openAIToAnthropicResponse, createOpenAIToAnthropicSSETransform } from '@/lib/format-converter'
import { z } from 'zod'

import type { ResolvedProvider } from '@/lib/provider-resolver'

/** Fire-and-forget provider routing log */
function logProviderAttempt(
  requestId: string,
  apiKeyId: string,
  _apiKeyName: string | undefined,
  model: string,
  provider: ResolvedProvider,
  status: string,
  statusCode: number | null,
  errorMessage: string | null,
  latencyMs: number,
  isFinal: boolean
): void {
  prisma.$executeRaw`
    INSERT INTO "provider_logs" ("id", "requestId", "apiKeyId", "apiKeyName", "model", "providerName", "providerUrl", "status", "statusCode", "errorMessage", "latencyMs", "isFinal", "createdAt")
    VALUES (${`pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`}, ${requestId}, ${apiKeyId}, ${null}, ${model}, ${provider.name}, ${provider.baseUrl}, ${status}, ${statusCode}, ${errorMessage}, ${Math.round(latencyMs)}, ${isFinal}, NOW())
  `.catch((err) => console.error('[provider-log] Write failed:', (err as Error).message?.slice(0, 100)))
}

const messageSchema = z
  .object({
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
    system: z.union([z.string(), z.array(z.any())]).optional(),
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
  .passthrough()

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

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface TokenEstimate {
  raw: number
  weighted: number
}

function estimateTokens(requestBody: z.infer<typeof messageSchema>): TokenEstimate {
  let raw = 0
  for (const message of requestBody.messages) {
    const content =
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    raw += Math.ceil(String(content).length / 4)
  }
  if (requestBody.system !== undefined) {
    const sys =
      typeof requestBody.system === 'string'
        ? requestBody.system
        : JSON.stringify(requestBody.system)
    raw += Math.ceil(sys.length / 4)
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
  const timing = createTimingContext()

  try {
    // --- AUTH ---
    timing.hrAuthStartedAt = performance.now()
    const [auth, requestBody] = await Promise.all([
      validateActiveApiKeyFromRequest(request),
      request.json(),
    ])
    timing.hrAuthCompletedAt = performance.now()
    if (!auth.ok) return auth.response

    const key = auth.key

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

    const validatedBody = messageSchema.parse(requestBody)
    const tokens = estimateTokens(validatedBody)
    timing.requestedModel = validatedBody.model

    // 5-hour rolling token window (hard limit) — enforced per API key id.
    const hourlyBudget = key.hourlyTokenBudget
    let projectedRaw = 0
    if (hourlyBudget && hourlyBudget > BigInt(0)) {
      timing.hrQuotaStartedAt = performance.now()
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
      timing.hrQuotaCompletedAt = performance.now()
    }

    // Forward upstream
    timing.hrRoutingStartedAt = performance.now()

    // Model mapping — keep the original model name (no prefixing)
    // Each provider accepts the model as-is; if a provider doesn't support it,
    // the fallback chain will try the next provider automatically.

    // Strip ALL fields not in the official Anthropic API spec.
    // Claude Code sends newer/experimental fields (context_management, mcpServers, etc.)
    // that cause 400 errors on providers that strictly validate.
    const KNOWN_ANTHROPIC_FIELDS = new Set([
      'model', 'messages', 'max_tokens', 'stream', 'system', 'temperature',
      'top_p', 'top_k', 'metadata', 'stop_sequences', 'tools', 'tool_choice',
      'thinking', 'betas', 'top_level_thinking',
    ])
    const upstreamBody: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(validatedBody)) {
      if (KNOWN_ANTHROPIC_FIELDS.has(key)) {
        upstreamBody[key] = value
      }
    }
    // Anthropic API requires max_tokens — add default if not provided
    if (!upstreamBody.max_tokens) {
      upstreamBody.max_tokens = 8192
    }
    const originalModel = validatedBody.model

    // ─── GLOBAL MODEL OVERRIDE ───
    // Admin can force all requests to a cheaper model from the admin panel
    let effectiveModel = originalModel
    let overrideProviderName: string | null = null
    try {
      const overrideSettings = await prisma.$queryRaw<Array<{ key: string; value: string }>>`
        SELECT "key", "value" FROM "gateway_settings" WHERE "key" IN ('model_override_enabled', 'model_override_target', 'model_override_provider')
      `
      const settingsMap = new Map(overrideSettings.map(s => [s.key, s.value]))
      if (settingsMap.get('model_override_enabled') === 'true') {
        const target = settingsMap.get('model_override_target')
        if (target) {
          effectiveModel = target
          overrideProviderName = settingsMap.get('model_override_provider') || null
        }
      }
    } catch {
      // Settings table might not exist — use original model
    }

    // Model alias mapping — translate proxy-specific names to real Anthropic IDs
    // Some providers (OpusMax) accept custom names, but direct Anthropic needs real IDs
    const MODEL_ALIASES: Record<string, string> = {
      'claude-sonnet-4-6': 'claude-sonnet-4-5-20250514',
      'claude-opus-4-8': 'claude-opus-4-20250514',
      'claude-haiku-4-5': 'claude-haiku-4-5-20250514',
      'claude-sonnet-4-5': 'claude-sonnet-4-5-20250514',
    }
    // Apply alias only for the effective model (providers with modelOverride won't use this)
    const resolvedModel = MODEL_ALIASES[effectiveModel] || effectiveModel

    // ─── PROVIDER FALLBACK CHAIN ───
    // Try each active provider in order (default first). If one fails with
    // 4xx/5xx or network error, automatically try the next provider.
    // This ensures the user never sees an error if any provider is available.
    timing.hrRoutingCompletedAt = performance.now()

    let upstreamResponse: Response | null = null
    let allProviders = await resolveAllProviders()

    // If admin specified a specific provider for the override, prioritize it
    if (overrideProviderName) {
      const prioritized = allProviders.filter(p => p.name === overrideProviderName)
      const rest = allProviders.filter(p => p.name !== overrideProviderName)
      allProviders = [...prioritized, ...rest]
    }

    if (allProviders.length === 0) {
      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        'No upstream provider configured. Add a provider in Admin → Providers, or set ANTHROPIC_API_KEY.',
        500
      )
    }

    let lastError: string | null = null
    let usedProviderFormat: 'anthropic' | 'openai' = 'anthropic'
    for (const provider of allProviders) {
      const providerStartMs = Date.now()
      try {
        const resolvedUrl = `${provider.baseUrl}${provider.messagesPath}`

        // Prepare body based on provider format
        let bodyForProvider: Record<string, unknown>
        const modelName = provider.modelOverride || resolvedModel

        if (provider.format === 'openai') {
          // Convert Anthropic request → OpenAI format
          bodyForProvider = anthropicToOpenAIRequest({ ...upstreamBody, model: modelName })
        } else {
          bodyForProvider = { ...upstreamBody, model: modelName }
        }

        // Build headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...provider.authHeaders,
        }
        if (provider.format === 'anthropic' && provider.anthropicVersion && provider.anthropicVersion !== 'none') {
          headers['anthropic-version'] = provider.anthropicVersion
        }

        timing.hrVendorRequestStartedAt = performance.now()
        const response = await upstreamFetch(resolvedUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyForProvider),
          signal: AbortSignal.timeout(60000),
        } as RequestInit)
        timing.hrVendorResponseHeadersAt = performance.now()
        const providerLatency = Date.now() - providerStartMs

        // If we got a client error (400/401/403/404), try next provider
        if (response.status >= 400 && response.status < 500) {
          let errorMsg = `${response.status}`
          try {
            const errBody = await response.text()
            errorMsg = errBody.slice(0, 500)
          } catch {}
          console.warn(`[fallback] Provider "${provider.name}" returned ${response.status}: ${errorMsg.slice(0, 200)}`)
          console.warn(`[fallback] Request body keys sent:`, Object.keys(bodyForProvider).join(', '))
          lastError = `${provider.name}: ${errorMsg}`
          // Log failure
          logProviderAttempt(timing.requestId, key.id, key.rpmLimit ? undefined : undefined, originalModel, provider, 'FAILED_4XX', response.status, errorMsg.slice(0, 300), providerLatency, false)
          continue
        }

        // If we got a server error (500+), try next provider
        if (response.status >= 500) {
          console.warn(`[fallback] Provider "${provider.name}" returned ${response.status}`)
          lastError = `${provider.name}: ${response.status}`
          logProviderAttempt(timing.requestId, key.id, undefined, originalModel, provider, 'FAILED_5XX', response.status, null, providerLatency, false)
          continue
        }

        // Success — use this response
        upstreamResponse = response
        usedProviderFormat = provider.format
        timing.returnedModel = originalModel
        logProviderAttempt(timing.requestId, key.id, undefined, originalModel, provider, 'SUCCESS', response.status, null, providerLatency, true)
        break
      } catch (err) {
        const providerLatency = Date.now() - providerStartMs
        const errMsg = (err as Error).message?.slice(0, 200) || 'Unknown'
        const status = errMsg.includes('timeout') ? 'FAILED_TIMEOUT' : 'FAILED_NETWORK'
        console.warn(`[fallback] Provider "${provider.name}" failed:`, errMsg.slice(0, 100))
        lastError = `${provider.name}: ${errMsg}`
        logProviderAttempt(timing.requestId, key.id, undefined, originalModel, provider, status, null, errMsg, providerLatency, false)
        continue
      }
    }

    if (!upstreamResponse) {
      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        `All providers failed. Last error: ${lastError?.slice(0, 500) || 'Unknown'}`,
        502
      )
    }

    // Streaming branch: proxy SSE while observing usage events to settle quota.
    if (validatedBody.stream && upstreamResponse.body) {
      // If provider uses OpenAI format, transform the SSE stream back to Anthropic format
      if (usedProviderFormat === 'openai') {
        const transform = createOpenAIToAnthropicSSETransform()
        const transformedStream = upstreamResponse.body.pipeThrough(transform)

        timing.hrOpusxResponseCompletedAt = performance.now()
        timing.statusCode = upstreamResponse.status
        timing.success = true
        persistLatencyMetric(timing)

        const latencyMs = Date.now() - startTime
        prisma.usageLog.create({
          data: { apiKeyId: key.id, model: effectiveModel, inputTokens: tokens.raw, outputTokens: 0, totalTokens: tokens.raw, latencyMs, statusCode: 200 },
        }).catch(() => {})
        prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

        return new Response(transformedStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        })
      }

      // Standard Anthropic SSE passthrough
      const reader = upstreamResponse.body.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ''
      let observedInputTokens: number | null = null
      let observedOutputTokens: number | null = null
      let observedOutputChars = 0
      let finalized = false
      let firstByteRecorded = false

      const processSseChunk = (chunkText: string) => {
        // Record first byte timing
        if (!firstByteRecorded) {
          firstByteRecorded = true
          timing.hrVendorFirstByteAt = performance.now()
        }

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

                // Detect first AI text token
                if (timing.hrVendorFirstTextTokenAt == null && isFirstTextToken(event)) {
                  timing.hrVendorFirstTextTokenAt = performance.now()
                }
              } catch {
                // ignore non-JSON data lines
              }
            }
          }
          newlineIndex = sseBuffer.indexOf('\n')
        }
      }

      const finalizeStreamingMetrics = (statusCode: number, provider: string = 'direct') => {
        if (finalized) return
        finalized = true
        timing.hrVendorStreamCompletedAt = performance.now()
        timing.hrOpusxResponseCompletedAt = performance.now()
        timing.statusCode = statusCode
        timing.success = statusCode >= 200 && statusCode < 400

        // Persist latency metric (fire-and-forget)
        persistLatencyMetric(timing)

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
              model: upstreamBody.model,
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
              const providerLabel = 'direct'
              finalizeStreamingMetrics(upstreamResponse.status, providerLabel)
              controller.close()
              return
            }
            if (value) {
              processSseChunk(decoder.decode(value, { stream: true }))
              // Record when first text token is forwarded to the user
              if (timing.hrOpusxFirstTextTokenForwardedAt == null && timing.hrVendorFirstTextTokenAt != null) {
                timing.hrOpusxFirstTextTokenForwardedAt = performance.now()
              }
              controller.enqueue(value)
            }
          } catch (error) {
            const providerLabel = 'direct'
            finalizeStreamingMetrics(499, providerLabel)
            controller.error(error)
          }
        },
        cancel() {
          const providerLabel = 'direct'
          finalizeStreamingMetrics(499, providerLabel)
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

    // If response came from an OpenAI-format provider, convert to Anthropic format
    if (usedProviderFormat === 'openai' && responseData && typeof responseData === 'object') {
      responseData = openAIToAnthropicResponse(responseData as Record<string, unknown>)
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
          model: upstreamBody.model,
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

    // Persist latency metric for non-streaming requests
    timing.hrOpusxResponseCompletedAt = performance.now()
    timing.statusCode = upstreamResponse.status
    timing.success = upstreamResponse.status >= 200 && upstreamResponse.status < 400
    persistLatencyMetric(timing)

    return NextResponse.json(responseData, { status: upstreamResponse.status })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid JSON body', 400)
    }
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
