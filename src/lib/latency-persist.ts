/**
 * Persist latency metrics to the database asynchronously.
 * This module must NEVER block or delay user responses.
 */

import { prisma } from '@/lib/prisma'
import { type LatencyTimingContext, calculateMetrics } from '@/lib/latency-timing'

export type LatencySourceType = 'REAL_TRAFFIC' | 'SYNTHETIC_VENDOR' | 'SYNTHETIC_OPUSX' | 'REGION_PROBE'

/**
 * Save a latency metric record. Runs fire-and-forget — errors are logged but
 * never propagated to the caller.
 */
export function persistLatencyMetric(
  ctx: LatencyTimingContext,
  sourceType: LatencySourceType = 'REAL_TRAFFIC'
): void {
  const metrics = calculateMetrics(ctx)

  prisma.apiLatencyMetric
    .create({
      data: {
        requestId: ctx.requestId,
        sourceType,
        probeRegion: null,
        requestedModel: ctx.requestedModel,
        returnedModel: ctx.returnedModel,
        authMs: metrics.authMs,
        quotaMs: metrics.quotaMs,
        routingMs: metrics.routingMs,
        preVendorMs: metrics.preVendorMs,
        vendorHeadersMs: metrics.vendorHeadersMs,
        vendorFirstByteMs: metrics.vendorFirstByteMs,
        vendorFirstTokenMs: metrics.vendorFirstTokenMs,
        vendorTotalMs: metrics.vendorTotalMs,
        opusxFirstTokenMs: metrics.opusxFirstTokenMs,
        opusxTotalMs: metrics.opusxTotalMs,
        firstTokenOverheadMs: metrics.firstTokenOverheadMs,
        postVendorFirstTokenOverheadMs: metrics.postVendorFirstTokenOverheadMs,
        streamCompletionOverheadMs: metrics.streamCompletionOverheadMs,
        statusCode: ctx.statusCode,
        success: ctx.success ?? false,
        errorType: ctx.errorType,
        errorMessage: ctx.errorMessage?.slice(0, 500) ?? null,
      },
    })
    .catch((err) => {
      console.error('[latency-persist] Failed to save metric:', err)
    })
}
