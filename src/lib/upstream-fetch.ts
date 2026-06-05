import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici'
import { upstreamModelsListUrl } from '@/lib/upstream-anthropic'

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

/** Upstream fetch with per-origin HTTP keep-alive (reuses TCP/TLS to OpusMax Pro / Anthropic). */
export async function upstreamFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  const parsed = typeof url === 'string' ? new URL(url) : url
  const response = await undiciFetch(url, {
    ...(init as UndiciRequestInit),
    dispatcher: agentForOrigin(parsed.origin),
  })
  return response as unknown as Response
}

export function getUpstreamApiKey(): string | null {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim()
  return key || null
}

/** Open a warm TCP/TLS connection to upstream on server boot (Railway always-on). */
export function prewarmUpstreamConnection(): void {
  const url = upstreamModelsListUrl(process.env.UPSTREAM_ANTHROPIC_BASE_URL)
  const apiKey = getUpstreamApiKey()
  const headers: Record<string, string> = { 'anthropic-version': '2023-06-01' }
  if (apiKey) headers['x-api-key'] = apiKey

  void upstreamFetch(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(8_000),
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
