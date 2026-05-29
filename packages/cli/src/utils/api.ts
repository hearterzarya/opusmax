import { z } from 'zod'
import { normalizeBaseUrl } from './config.js'

const keyStatusSchema = z.object({
  exists: z.boolean(),
  status: z.string().optional(),
  name: z.string().optional(),
  quotaBlocked: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
  error: z.object({ message: z.string() }).optional(),
})

export type KeyCheckResult = {
  valid: true
  status?: string
  name?: string
  active?: boolean
  quotaBlocked?: boolean
  expiresAt?: string | null
}

const modelsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      display_name: z.string().optional(),
    })
  ),
})

const messageResponseSchema = z.object({
  content: z
    .array(
      z.object({
        type: z.string().optional(),
        text: z.string().optional(),
      })
    )
    .optional(),
  error: z.object({ message: z.string().optional() }).optional(),
})

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl)
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export async function checkApiKey(baseUrl: string, apiKey: string): Promise<KeyCheckResult> {
  const url = `${joinUrl(baseUrl, '/key-status')}?key=${encodeURIComponent(apiKey.trim())}`
  let res: Response
  try {
    res = await fetch(url, { method: 'GET' })
  } catch {
    throw new ApiError(
      `Could not reach ${url}. Check the base URL and your network connection.`
    )
  }

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    const hint =
      res.status === 404 && text.includes('<!DOCTYPE')
        ? 'Gateway route not found — check ANTHROPIC_BASE_URL ends with /api'
        : 'Response was not JSON'
    throw new ApiError(`${hint} (${url})`, res.status)
  }

  const parsed = keyStatusSchema.safeParse(json)
  if (!parsed.success) {
    throw new ApiError('Unexpected response from key-status endpoint', res.status, json)
  }

  const data = parsed.data
  if (!data.exists) {
    throw new ApiError(
      data.error?.message ?? 'API key was not found on this gateway.',
      res.status,
      json
    )
  }

  if (data.expiresAt) {
    const expires = new Date(data.expiresAt).getTime()
    if (!Number.isNaN(expires) && expires <= Date.now()) {
      throw new ApiError('API key has expired.', res.status, json)
    }
  }

  if (data.status && data.status !== 'ACTIVE') {
    throw new ApiError(`API key is not active (${data.status}).`, res.status, json)
  }

  if (data.quotaBlocked) {
    throw new ApiError('API key has exceeded its rolling token window.', res.status, json)
  }

  return {
    valid: true,
    status: data.status,
    name: data.name,
    active: true,
    quotaBlocked: data.quotaBlocked ?? false,
    expiresAt: data.expiresAt ?? null,
  }
}

export async function fetchModels(baseUrl: string, apiKey?: string) {
  const url = joinUrl(baseUrl, '/v1/models')
  const headers: Record<string, string> = {}
  if (apiKey) headers['x-api-key'] = apiKey

  let res: Response
  try {
    res = await fetch(url, { headers })
  } catch {
    throw new ApiError(`Could not reach ${url}`)
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof json === 'object' &&
      json &&
      'error' in json &&
      typeof (json as { error?: { message?: string } }).error?.message === 'string'
        ? (json as { error: { message: string } }).error.message
        : `Models request failed (${res.status})`
    throw new ApiError(msg, res.status, json)
  }

  return modelsSchema.parse(json)
}

export async function testMessage(baseUrl: string, apiKey: string, model: string) {
  const url = joinUrl(baseUrl, '/v1/messages')
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Say OpusMax is working.' }],
      }),
    })
  } catch {
    throw new ApiError(`Could not reach ${url}`)
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof json === 'object' &&
      json &&
      'error' in json &&
      typeof (json as { error?: { message?: string } }).error?.message === 'string'
        ? (json as { error: { message: string } }).error.message
        : `Test request failed (${res.status})`
    throw new ApiError(msg, res.status, json)
  }

  const parsed = messageResponseSchema.parse(json)
  const text =
    parsed.content?.find((b) => b.text)?.text?.trim() ??
    '(empty response)'
  return text
}

export async function pingBaseUrl(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(joinUrl(baseUrl, '/v1/models'), { method: 'GET' })
    return res.ok || res.status === 401
  } catch {
    return false
  }
}
