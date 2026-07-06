/**
 * Latency statistics calculation from stored metrics.
 * Used by the admin latency API to compute percentiles, baselines, and diagnostics.
 */

import { prisma } from '@/lib/prisma'

export type TimeRange = '15m' | '1h' | '24h' | '7d'

function rangeToMs(range: TimeRange): number {
  switch (range) {
    case '15m': return 15 * 60 * 1000
    case '1h': return 60 * 60 * 1000
    case '24h': return 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
  }
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.ceil(sorted.length * (p / 100)) - 1
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? null
}

export interface ServiceStats {
  status: 'operational' | 'degraded' | 'major_outage' | 'monitoring_unavailable'
  current: {
    headersMs: number | null
    firstByteMs: number | null
    firstTokenMs: number | null
    totalMs: number | null
  }
  statistics: {
    p50FirstTokenMs: number | null
    p95FirstTokenMs: number | null
    p99FirstTokenMs: number | null
    p50TotalMs: number | null
    p95TotalMs: number | null
    successRate: number | null
    sampleCount: number
  }
}

export interface WrapperStats {
  current: {
    preVendorMs: number | null
    authMs: number | null
    quotaMs: number | null
    routingMs: number | null
    firstTokenOverheadMs: number | null
    postVendorFirstTokenOverheadMs: number | null
  }
  statistics: {
    p50OverheadMs: number | null
    p95OverheadMs: number | null
    sampleCount: number
  }
  status: string
}

export type DiagnosticCode =
  | 'HEALTHY'
  | 'VENDOR_SLOW'
  | 'VENDOR_AI_SLOW'
  | 'VENDOR_NETWORK_PATH_SLOW'
  | 'OPUSX_PREPROCESSING_SLOW'
  | 'OPUSX_AUTH_SLOW'
  | 'OPUSX_QUOTA_SLOW'
  | 'OPUSX_ROUTING_SLOW'
  | 'OPUSX_STREAM_OVERHEAD_HIGH'
  | 'REGION_MISMATCH'
  | 'BOTH_DEGRADED'
  | 'MONITOR_DATA_INSUFFICIENT'
  | 'MONITOR_OFFLINE'

export interface Diagnostic {
  code: DiagnosticCode
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
}

export interface LatencyHistoryPoint {
  time: string
  vendorFirstTokenMs: number | null
  opusxFirstTokenMs: number | null
  overheadMs: number | null
}

export async function getLatencyStats(range: TimeRange = '15m') {
  const since = new Date(Date.now() - rangeToMs(range))

  const metrics = await prisma.apiLatencyMetric.findMany({
    where: {
      createdAt: { gte: since },
      sourceType: 'REAL_TRAFFIC',
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      vendorHeadersMs: true,
      vendorFirstByteMs: true,
      vendorFirstTokenMs: true,
      vendorTotalMs: true,
      opusxFirstTokenMs: true,
      opusxTotalMs: true,
      preVendorMs: true,
      authMs: true,
      quotaMs: true,
      routingMs: true,
      firstTokenOverheadMs: true,
      postVendorFirstTokenOverheadMs: true,
      statusCode: true,
      success: true,
      createdAt: true,
    },
  })

  const total = metrics.length
  const successCount = metrics.filter((m) => m.success).length
  const successRate = total > 0 ? Math.round((successCount / total) * 10000) / 100 : null

  // Extract sorted arrays for percentile calculations (successful requests only)
  const successful = metrics.filter((m) => m.success)
  const vendorFirstTokenValues = successful
    .map((m) => m.vendorFirstTokenMs)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  const vendorTotalValues = successful
    .map((m) => m.vendorTotalMs)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  const opusxFirstTokenValues = successful
    .map((m) => m.opusxFirstTokenMs)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  const opusxTotalValues = successful
    .map((m) => m.opusxTotalMs)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  const overheadValues = successful
    .map((m) => m.firstTokenOverheadMs)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)

  const latest = metrics[0] ?? null

  const opusmax: ServiceStats = {
    status: deriveServiceStatus(successRate, percentile(vendorFirstTokenValues, 95)),
    current: {
      headersMs: latest?.vendorHeadersMs ?? null,
      firstByteMs: latest?.vendorFirstByteMs ?? null,
      firstTokenMs: latest?.vendorFirstTokenMs ?? null,
      totalMs: latest?.vendorTotalMs ?? null,
    },
    statistics: {
      p50FirstTokenMs: percentile(vendorFirstTokenValues, 50),
      p95FirstTokenMs: percentile(vendorFirstTokenValues, 95),
      p99FirstTokenMs: percentile(vendorFirstTokenValues, 99),
      p50TotalMs: percentile(vendorTotalValues, 50),
      p95TotalMs: percentile(vendorTotalValues, 95),
      successRate,
      sampleCount: total,
    },
  }

  const opusx: ServiceStats = {
    status: deriveServiceStatus(successRate, percentile(opusxFirstTokenValues, 95)),
    current: {
      headersMs: null,
      firstByteMs: null,
      firstTokenMs: latest?.opusxFirstTokenMs ?? null,
      totalMs: latest?.opusxTotalMs ?? null,
    },
    statistics: {
      p50FirstTokenMs: percentile(opusxFirstTokenValues, 50),
      p95FirstTokenMs: percentile(opusxFirstTokenValues, 95),
      p99FirstTokenMs: percentile(opusxFirstTokenValues, 99),
      p50TotalMs: percentile(opusxTotalValues, 50),
      p95TotalMs: percentile(opusxTotalValues, 95),
      successRate,
      sampleCount: total,
    },
  }

  const p50Overhead = percentile(overheadValues, 50)
  const p95Overhead = percentile(overheadValues, 95)
  const wrapper: WrapperStats = {
    current: {
      preVendorMs: latest?.preVendorMs ?? null,
      authMs: latest?.authMs ?? null,
      quotaMs: latest?.quotaMs ?? null,
      routingMs: latest?.routingMs ?? null,
      firstTokenOverheadMs: latest?.firstTokenOverheadMs ?? null,
      postVendorFirstTokenOverheadMs: latest?.postVendorFirstTokenOverheadMs ?? null,
    },
    statistics: {
      p50OverheadMs: p50Overhead,
      p95OverheadMs: p95Overhead,
      sampleCount: overheadValues.length,
    },
    status: deriveOverheadStatus(p50Overhead),
  }

  const diagnostic = deriveDiagnostic(opusmax, opusx, wrapper, total)

  // History points for charting (newest first → reverse for time series)
  const history: LatencyHistoryPoint[] = metrics
    .slice(0, 100)
    .reverse()
    .map((m) => ({
      time: m.createdAt.toISOString(),
      vendorFirstTokenMs: m.vendorFirstTokenMs,
      opusxFirstTokenMs: m.opusxFirstTokenMs,
      overheadMs: m.firstTokenOverheadMs,
    }))

  return { opusmax, opusx, wrapper, diagnostic, history }
}

function deriveServiceStatus(successRate: number | null, p95: number | null): ServiceStats['status'] {
  if (successRate == null) return 'monitoring_unavailable'
  if (successRate < 90) return 'major_outage'
  if (successRate < 98 || (p95 != null && p95 > 5000)) return 'degraded'
  return 'operational'
}

function deriveOverheadStatus(p50: number | null): string {
  if (p50 == null) return 'No Data'
  if (p50 <= 100) return 'Excellent'
  if (p50 <= 250) return 'Good'
  if (p50 <= 500) return 'Moderate'
  if (p50 <= 1000) return 'Slow'
  return 'Critical'
}

function deriveDiagnostic(
  opusmax: ServiceStats,
  _opusx: ServiceStats,
  wrapper: WrapperStats,
  sampleCount: number
): Diagnostic {
  if (sampleCount === 0) {
    return {
      code: 'MONITOR_DATA_INSUFFICIENT',
      title: 'Collecting Data',
      message: 'No latency samples available yet. Send requests through OpusX to begin collecting metrics.',
      severity: 'info',
    }
  }

  if (sampleCount < 5) {
    return {
      code: 'MONITOR_DATA_INSUFFICIENT',
      title: 'Collecting Data',
      message: `Only ${sampleCount} sample(s) collected. Need at least 5 for reliable diagnostics.`,
      severity: 'info',
    }
  }

  const p95Vendor = opusmax.statistics.p95FirstTokenMs
  const p50Overhead = wrapper.statistics.p50OverheadMs
  const preVendor = wrapper.current.preVendorMs

  // Check for OpusX internal issues first
  if (preVendor != null && preVendor > 500) {
    const authMs = wrapper.current.authMs
    const quotaMs = wrapper.current.quotaMs
    const routingMs = wrapper.current.routingMs

    if (authMs != null && authMs > 200) {
      return {
        code: 'OPUSX_AUTH_SLOW',
        title: 'Auth Slow',
        message: `OpusX authentication is taking ${Math.round(authMs)}ms. Check database connection and API key lookup indexes.`,
        severity: 'warning',
      }
    }
    if (quotaMs != null && quotaMs > 200) {
      return {
        code: 'OPUSX_QUOTA_SLOW',
        title: 'Quota Check Slow',
        message: `Quota validation is taking ${Math.round(quotaMs)}ms. Check database/Redis performance.`,
        severity: 'warning',
      }
    }
    if (routingMs != null && routingMs > 100) {
      return {
        code: 'OPUSX_ROUTING_SLOW',
        title: 'Routing Slow',
        message: `Model routing is taking ${Math.round(routingMs)}ms. Check Bifrost connectivity.`,
        severity: 'warning',
      }
    }

    return {
      code: 'OPUSX_PREPROCESSING_SLOW',
      title: 'OpusX Preprocessing Slow',
      message: `OpusX pre-vendor processing is ${Math.round(preVendor)}ms. This adds directly to user-perceived latency.`,
      severity: 'warning',
    }
  }

  // Check stream overhead
  if (p50Overhead != null && p50Overhead > 250 && p95Vendor != null && p95Vendor < 2000) {
    return {
      code: 'OPUSX_STREAM_OVERHEAD_HIGH',
      title: 'Stream Overhead High',
      message: `OpusX adds ${Math.round(p50Overhead)}ms P50 overhead on top of vendor latency. Streaming forwarding may be delayed.`,
      severity: 'warning',
    }
  }

  // Vendor issues
  if (p95Vendor != null && p95Vendor > 3000) {
    const headersMs = opusmax.current.headersMs
    if (headersMs != null && headersMs > 1000) {
      return {
        code: 'VENDOR_NETWORK_PATH_SLOW',
        title: 'Vendor Network Path Slow',
        message: `OpusMax response headers take ${Math.round(headersMs)}ms. The network path to the vendor is adding latency.`,
        severity: 'warning',
      }
    }

    return {
      code: 'VENDOR_AI_SLOW',
      title: 'Vendor AI Slow',
      message: `OpusMax P95 first-token latency is ${Math.round(p95Vendor)}ms. AI generation at the vendor is slow.`,
      severity: 'warning',
    }
  }

  if (p95Vendor != null && p95Vendor > 2000 && p50Overhead != null && p50Overhead > 200) {
    return {
      code: 'BOTH_DEGRADED',
      title: 'Both Degraded',
      message: `Both vendor (P95: ${Math.round(p95Vendor)}ms) and OpusX overhead (P50: ${Math.round(p50Overhead)}ms) are elevated.`,
      severity: 'critical',
    }
  }

  return {
    code: 'HEALTHY',
    title: 'Healthy',
    message: 'All latency metrics are within normal ranges. OpusMax vendor and OpusX wrapper are performing well.',
    severity: 'info',
  }
}
