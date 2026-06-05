import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { upstreamModelsListUrl } from '@/lib/upstream-anthropic'
import { upstreamFetch } from '@/lib/upstream-fetch'

async function checkRedisHealth(): Promise<{ status: string; latencyMs: number | null }> {
  const start = Date.now()
  try {
    // The singleton in lib/redis.ts already handles the missing/placeholder
    // URL case by returning a mock client whose ping() returns 'PONG'.
    const reply = await redis.ping()
    if (reply !== 'PONG') {
      return { status: 'degraded', latencyMs: Date.now() - start }
    }
    return { status: 'healthy', latencyMs: Date.now() - start }
  } catch {
    return { status: 'degraded', latencyMs: null }
  }
}

async function checkDatabaseHealth(): Promise<{ status: string; latencyMs: number | null }> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy', latencyMs: Date.now() - start }
  } catch {
    return { status: 'down', latencyMs: null }
  }
}

async function checkUpstreamHealth(): Promise<{ status: string; latencyMs: number | null }> {
  const start = Date.now()
  try {
    const url = upstreamModelsListUrl(process.env.UPSTREAM_ANTHROPIC_BASE_URL)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const headers: Record<string, string> = { 'anthropic-version': '2023-06-01' }
    if (process.env.ANTHROPIC_API_KEY) headers['x-api-key'] = process.env.ANTHROPIC_API_KEY
    const response = await upstreamFetch(url, { method: 'GET', headers, signal: controller.signal })
    clearTimeout(timeoutId)

    // Any 2xx OR 4xx ⇒ upstream is reachable & responsive (auth/quota issues
    // are NOT a service health problem). Only 5xx counts as degraded.
    if (response.status >= 500) {
      return { status: 'degraded', latencyMs: Date.now() - start }
    }
    return { status: 'healthy', latencyMs: Date.now() - start }
  } catch {
    return { status: 'down', latencyMs: null }
  }
}

export async function GET() {
  const [redisHealth, database, upstream] = await Promise.all([
    checkRedisHealth(),
    checkDatabaseHealth(),
    checkUpstreamHealth(),
  ])

  const services = [
    { name: 'Proxy Service', status: 'healthy', latencyMs: null },
    { name: 'API Gateway', status: 'healthy', latencyMs: null },
    { name: 'Key Management', status: 'healthy', latencyMs: null },
    { name: 'Database', ...database },
    { name: 'Upstream Anthropic', ...upstream },
    { name: 'Redis Cache', ...redisHealth },
  ]

  const anyDegraded = services.some((s) => s.status === 'degraded')
  const anyDown = services.some((s) => s.status === 'down')
  const status = anyDown ? 'down' : anyDegraded ? 'degraded' : 'healthy'

  if (!anyDown) {
    prisma.systemHealthLog
      .create({
        data: {
          service: 'health_check',
          status: status === 'healthy' ? 'HEALTHY' : status === 'degraded' ? 'DEGRADED' : 'DOWN',
          latencyMs: services.reduce((acc, s) => acc + (s.latencyMs || 0), 0),
        },
      })
      .catch(() => {})
  }

  return NextResponse.json({
    status,
    services,
    timestamp: new Date().toISOString(),
  })
}
