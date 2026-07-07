import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)

    const limit = Math.min(100, Number(request.nextUrl.searchParams.get('limit')) || 50)
    const provider = request.nextUrl.searchParams.get('provider') || null
    const status = request.nextUrl.searchParams.get('status') || null

    let whereClause = 'WHERE 1=1'
    if (provider) whereClause += ` AND "providerName" = '${provider.replace(/'/g, "''")}'`
    if (status) whereClause += ` AND "status" = '${status.replace(/'/g, "''")}'`

    const logs = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "requestId", "apiKeyId", "apiKeyName", "model", "providerName", "providerUrl", "status", "statusCode", "errorMessage", "latencyMs", "isFinal", "createdAt"
       FROM "provider_logs"
       ${whereClause}
       ORDER BY "createdAt" DESC
       LIMIT ${limit}`
    )

    // Stats summary
    const stats = await prisma.$queryRaw<Array<{ providerName: string; status: string; cnt: bigint }>>`
      SELECT "providerName", "status", COUNT(*)::bigint as cnt
      FROM "provider_logs"
      WHERE "createdAt" >= NOW() - INTERVAL '1 hour'
      GROUP BY "providerName", "status"
      ORDER BY "providerName", "status"
    `

    const summary: Record<string, { success: number; failed: number; total: number }> = {}
    for (const row of stats) {
      if (!summary[row.providerName]) summary[row.providerName] = { success: 0, failed: 0, total: 0 }
      const count = Number(row.cnt)
      summary[row.providerName]!.total += count
      if (row.status === 'SUCCESS') summary[row.providerName]!.success += count
      else summary[row.providerName]!.failed += count
    }

    return NextResponse.json({ logs, summary })
  } catch (error) {
    console.error('[provider-logs] Error:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch logs', 500)
  }
}
