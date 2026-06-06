import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici'
import { upstreamFetch } from './upstream-fetch'

const agents = new Map<string, Agent>()

function agentForOrigin(origin: string): Agent {
  let agent = agents.get(origin)
  if (!agent) {
    agent = new Agent({
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 120_000,
      connections: 32,
      pipelining: 0,
    })
    agents.set(origin, agent)
  }
  return agent
}

/**
 * Model mapping for Bifrost Gateway
 * Maps OpusX-friendly model names to Bifrost provider-prefixed names
 */
export const MODEL_MAP: Record<string, string> = {
  // Anthropic models
  'claude-opus-4-8': 'anthropic/claude-opus-4-8',
  'claude-opus-4-7': 'anthropic/claude-opus-4-7',
  'claude-sonnet-4-6': 'anthropic/claude-sonnet-4-6',
  'claude-haiku-4-5': 'anthropic/claude-haiku-4-5',

  // OpenAI models
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4-turbo': 'openai/gpt-4-turbo',
  'gpt-4': 'openai/gpt-4',
  'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',

  // Google models
  'gemini-1.5-pro': 'google/gemini-1.5-pro',
  'gemini-1.5-flash': 'google/gemini-1.5-flash',
  'gemini-1.0-pro': 'google/gemini-1.0-pro',

  // Groq models
  'llama-3.1-70b': 'groq/llama-3.1-70b',
  'llama-3.1-8b': 'groq/llama-3.1-8b',
  'mixtral-8x7b': 'groq/mixtral-8x7b',

  // Default fallback for already-prefixed models
  'default': 'default'
}

/**
 * Map a model name to Bifrost's format
 * If the model is already prefixed (anthropic/, openai/, etc.), it's returned as-is
 */
export function mapModelToBifrost(model: string): string {
  // If already has a provider prefix, return as-is
  if (model.includes('/') && MODEL_MAP[model]) {
    return model
  }

  // Look up in model map
  const mappedModel = MODEL_MAP[model]
  if (mappedModel && mappedModel !== 'default') {
    return mappedModel
  }

  // If no mapping found and no prefix, default to adding 'anthropic/' prefix
  if (!model.includes('/')) {
    return `anthropic/${model}`
  }

  return model
}

/**
 * Forward an Anthropic-compatible request to Bifrost Gateway
 */
export async function forwardAnthropicMessages(
  requestBody: unknown,
  options: {
    bifrostBaseUrl?: string
    bifrostApiKey?: string
    timeout?: number
    signal?: AbortSignal
  } = {}
): Promise<Response> {
  const bifrostBaseUrl = options.bifrostBaseUrl || process.env.BIFROST_BASE_URL
  const bifrostApiKey = options.bifrostApiKey || process.env.BIFROST_INTERNAL_KEY

  if (!bifrostBaseUrl) {
    throw new Error('BIFROST_BASE_URL is not configured')
  }

  const url = `${bifrostBaseUrl}/anthropic/v1/messages`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  }

  // Add Bifrost API key if provided
  if (options.bifrostApiKey) {
    headers['x-api-key'] = options.bifrostApiKey
  }

  // Map model in the request body if it exists
  if (typeof requestBody === 'object' && requestBody !== null && 'model' in requestBody) {
    const model = (requestBody as any).model
    if (typeof model === 'string') {
      (requestBody as any).model = mapModelToBifrost(model)
    }
  }

  const response = await upstreamFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: options.signal,
    // Configure timeout
    ...(options.timeout && {
      signal: AbortSignal.timeout(options.timeout)
    })
  })

  return response
}

/**
 * Forward an OpenAI-compatible request to Bifrost Gateway
 */
export async function forwardOpenAIChatCompletion(
  requestBody: unknown,
  options: {
    bifrostBaseUrl?: string
    bifrostApiKey?: string
    timeout?: number
    signal?: AbortSignal
  } = {}
): Promise<Response> {
  const bifrostBaseUrl = options.bifrostBaseUrl || process.env.BIFROST_BASE_URL
  const bifrostApiKey = options.bifrostApiKey || process.env.BIFROST_INTERNAL_KEY

  if (!bifrostBaseUrl) {
    throw new Error('BIFROST_BASE_URL is not configured')
  }

  const url = `${bifrostBaseUrl}/openai/v1/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Add Bifrost API key if provided
  if (options.bifrostApiKey || process.env.BIFROST_INTERNAL_KEY) {
    headers['authorization'] = `Bearer ${bifrostApiKey}`
  }

  // Map model in the request body if it exists
  if (typeof requestBody === 'object' && requestBody !== null && 'model' in requestBody) {
    const model = (requestBody as any).model
    if (typeof model === 'string') {
      (requestBody as any).model = mapModelToBifrost(model)
    }
  }

  const response = await upstreamFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: options.signal,
    // Configure timeout
    ...(options.timeout && {
      signal: AbortSignal.timeout(options.timeout)
    })
  })

  return response
}

/**
 * Get models from Bifrost Gateway
 */
export async function getBifrostModels(
  options: {
    bifrostBaseUrl?: string
    bifrostApiKey?: string
    timeout?: number
    signal?: AbortSignal
  } = {}
): Promise<Response> {
  const bifrostBaseUrl = options.bifrostBaseUrl || process.env.BIFROST_BASE_URL
  const bifrostApiKey = options.bifrostApiKey || process.env.BIFROST_INTERNAL_KEY

  if (!bifrostBaseUrl) {
    throw new Error('BIFROST_BASE_URL is not configured')
  }

  // Try common Bifrost model endpoints
  const possibleUrls = [
    `${bifrostBaseUrl}/openai/v1/models`,
    `${bifrostBaseUrl}/anthropic/v1/models`,
    `${bifrostBaseUrl}/v1/models`
  ]

  let lastError: Error | null = null

  for (const url of possibleUrls) {
    try {
      const headers: Record<string, string> = {}

      // Add Bifrost API key if provided
      const apiKey = options.bifrostApiKey || process.env.BIFROST_INTERNAL_KEY
      if (apiKey) {
        if (url.includes('/openai/')) {
          headers['authorization'] = `Bearer ${apiKey}`
        } else if (url.includes('/anthropic/')) {
          headers['x-api-key'] = apiKey
          headers['anthropic-version'] = '2023-06-01'
        }
      }

      const response = await upstreamFetch(url, {
        method: 'GET',
        headers,
        signal: options.signal,
        ...(options.timeout && {
          signal: AbortSignal.timeout(options.timeout)
        })
      })

      if (response.status === 200) {
        return response
      }
    } catch (error) {
      lastError = error as Error
      continue
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('All model endpoints failed')
}

/**
 * Check if Bifrost is configured and available
 */
export async function checkBifrostConnection(
  options: {
    bifrostBaseUrl?: string
    bifroseApiKey?: string
    timeout?: number
  } = {}
): Promise<{ available: boolean; error?: string }> {
  try {
    await getBifrostModels({
      ...options,
      timeout: options.timeout || 5000
    })
    return { available: true }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Pre-warm connections to Bifrost on server boot
 */
export function prewarmBifrostConnection(): void {
  const bifrostBaseUrl = process.env.BIFROST_BASE_URL
  const bifrostApiKey = process.env.BIFROST_INTERNAL_KEY

  if (!bifrostBaseUrl) {
    return
  }

  // Try to pre-warm a connection to Bifrost
  void getBifrostModels({
    bifrostBaseUrl,
    bifrostApiKey,
    timeout: 8000,
  })
    .then(async (response) => {
      try {
        await response.arrayBuffer()
      } catch {
        /* ignore drain errors */
      }
    })
    .catch(() => {
      /* non-fatal — first client request will connect if prewarm fails */
    })
}