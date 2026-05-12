import { NextRequest, NextResponse } from 'next/server'
import { hashApiKey } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { getRollingWindowUsageFromUsageLogs } from '@/lib/quota'

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function GET(request: NextRequest) {
  try {
    // 120 req/min per IP — smooth refresh UX while still throttling abuse.
    const ip = getClientIp(request)
    const rl = await checkRateLimit(`keystatus_ip:${ip}`, 120, 60)
    if (!rl.allowed) {
      const retryIn = Math.max(0, Math.ceil((rl.resetAt - Date.now()) / 1000))
      return NextResponse.json(
        { error: { message: `Too many requests. Try again in ${retryIn}s` } },
        { status: 429 }
      )
    }

    const keyParam = request.nextUrl.searchParams.get('key')

    if (!keyParam) {
      return NextResponse.json(
        { error: { message: 'API key parameter required' } },
        { status: 400 }
      )
    }

    const keyHash = await hashApiKey(keyParam)
    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        status: true,
        name: true,
        createdAt: true,
        expiresAt: true,
        hourlyTokenBudget: true,
        lastUsedAt: true,
        rpmLimit: true,
      },
    })

    if (!key) {
      return NextResponse.json(
        { exists: false, error: { message: 'API key not found' } },
        { status: 404 }
      )
    }

    const quotaState =
      key.hourlyTokenBudget && key.hourlyTokenBudget > 0n
        ? await getRollingWindowUsageFromUsageLogs(key.id, key.hourlyTokenBudget)
        : {
            used: 0,
            remaining: 0,
            resetAt: null,
            blocked: false,
            windowStartedAt: null,
          }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [requests24h, allTimeRequests, lastLog, recentActivity] = await Promise.all([
      prisma.usageLog.count({
        where: {
          apiKeyId: key.id,
          timestamp: { gte: dayAgo },
        },
      }),
      prisma.usageLog.count({
        where: { apiKeyId: key.id },
      }),
      key.lastUsedAt
        ? Promise.resolve(null)
        : prisma.usageLog.findFirst({
            where: { apiKeyId: key.id },
            orderBy: { timestamp: 'desc' },
            select: { timestamp: true },
          }),
      prisma.usageLog.findMany({
        where: { apiKeyId: key.id },
        orderBy: { timestamp: 'desc' },
        take: 50,
        select: {
          timestamp: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          statusCode: true,
          latencyMs: true,
          errorType: true,
        },
      }),
    ])

    return NextResponse.json({
      exists: true,
      status: key.status,
      quotaBlocked: quotaState.blocked,
      name: key.name,
      createdAt: key.createdAt.toISOString(),
      expiresAt: key.expiresAt?.toISOString() || null,
      hourlyUsage: quotaState.used,
      hourlyBudget: Number(key.hourlyTokenBudget) || null,
      hourlyRemaining: key.hourlyTokenBudget ? quotaState.remaining : null,
      windowStartedAt: quotaState.windowStartedAt,
      windowResetAt: quotaState.resetAt,
      lastUsed: key.lastUsedAt?.toISOString() || lastLog?.timestamp.toISOString() || null,
      rpmLimit: key.rpmLimit,
      requests24h,
      allTimeRequests,
      usageSource: 'usage_logs',
      activity: recentActivity.map((row) => ({
        at: row.timestamp.toISOString(),
        model: row.model,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        totalTokens: row.totalTokens,
        statusCode: row.statusCode,
        latencyMs: row.latencyMs,
        errorType: row.errorType,
      })),
    })

  } catch (error) {
    console.error('Key status error:', error)
    return NextResponse.json(
      { error: { message: 'Internal error' } },
      { status: 500 }
    )
  }
}