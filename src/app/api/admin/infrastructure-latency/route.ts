import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'
import { getLatencyStats, type TimeRange } from '@/lib/latency-stats'

const VALID_RANGES: TimeRange[] = ['15m', '1h', '24h', '7d']

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)
    }

    const rangeParam = request.nextUrl.searchParams.get('range') || '15m'
    const range = VALID_RANGES.includes(rangeParam as TimeRange)
      ? (rangeParam as TimeRange)
      : '15m'

    const stats = await getLatencyStats(range)

    return NextResponse.json({
      monitor: {
        status: stats.opusmax.statistics.sampleCount > 0 ? 'live' : 'no_data',
        lastCheckedAt: new Date().toISOString(),
        region: process.env.VERCEL_REGION || process.env.RAILWAY_REGION || 'unknown',
        sampleCount: stats.opusmax.statistics.sampleCount,
      },
      services: {
        opusmax: stats.opusmax,
        opusx: stats.opusx,
      },
      wrapper: stats.wrapper,
      diagnostic: stats.diagnostic,
      history: stats.history,
      serverNow: new Date().toISOString(),
      range,
    })
  } catch (error) {
    console.error('[infrastructure-latency] Error:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch latency data', 500)
  }
}
