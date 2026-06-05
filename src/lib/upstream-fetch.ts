import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici'

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
