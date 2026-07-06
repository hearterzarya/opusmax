import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'
import { getVendorStatusLatency, startVendorStatusPolling } from '@/lib/vendor-status-mirror'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Start background polling when this module is first loaded on the server.
// On Vercel serverless this runs per cold-start; the polling interval keeps
// the cache warm for the lifetime of that instance (~5-15 min).
startVendorStatusPolling(30_000)

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)
    }

    const data = getVendorStatusLatency()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[vendor-status-latency] Error:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch vendor status', 500)
  }
}
