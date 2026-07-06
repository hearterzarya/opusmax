/**
 * Request-level latency timing context.
 *
 * All timestamps are high-resolution (performance.now for duration calculation,
 * Date.now for absolute wallclock). Values are null until measured — NEVER
 * replaced with 0 for missing measurements.
 *
 * This module is the single source of truth for all timing instrumentation
 * in the OpusX proxy. It is a passive observer — it must never delay the
 * user's SSE stream or block the request lifecycle.
 */

export interface LatencyTimingContext {
  requestId: string

  // Absolute wallclock (for storage)
  requestReceivedAt: number

  // High-resolution relative (for duration calculation)
  hrRequestReceivedAt: number
  hrAuthStartedAt: number | null
  hrAuthCompletedAt: number | null
  hrQuotaStartedAt: number | null
  hrQuotaCompletedAt: number | null
  hrRoutingStartedAt: number | null
  hrRoutingCompletedAt: number | null
  hrVendorRequestStartedAt: number | null
  hrVendorResponseHeadersAt: number | null
  hrVendorFirstByteAt: number | null
  hrVendorFirstTextTokenAt: number | null
  hrOpusxFirstTextTokenForwardedAt: number | null
  hrVendorStreamCompletedAt: number | null
  hrOpusxResponseCompletedAt: number | null

  // Metadata
  requestedModel: string | null
  returnedModel: string | null
  statusCode: number | null
  success: boolean | null
  errorType: string | null
  errorMessage: string | null
}

export function createTimingContext(requestId?: string): LatencyTimingContext {
  return {
    requestId: requestId || generateRequestId(),
    requestReceivedAt: Date.now(),
    hrRequestReceivedAt: performance.now(),
    hrAuthStartedAt: null,
    hrAuthCompletedAt: null,
    hrQuotaStartedAt: null,
    hrQuotaCompletedAt: null,
    hrRoutingStartedAt: null,
    hrRoutingCompletedAt: null,
    hrVendorRequestStartedAt: null,
    hrVendorResponseHeadersAt: null,
    hrVendorFirstByteAt: null,
    hrVendorFirstTextTokenAt: null,
    hrOpusxFirstTextTokenForwardedAt: null,
    hrVendorStreamCompletedAt: null,
    hrOpusxResponseCompletedAt: null,
    requestedModel: null,
    returnedModel: null,
    statusCode: null,
    success: null,
    errorType: null,
    errorMessage: null,
  }
}

export interface CalculatedLatencyMetrics {
  authMs: number | null
  quotaMs: number | null
  routingMs: number | null
  preVendorMs: number | null
  vendorHeadersMs: number | null
  vendorFirstByteMs: number | null
  vendorFirstTokenMs: number | null
  vendorTotalMs: number | null
  opusxFirstTokenMs: number | null
  opusxTotalMs: number | null
  firstTokenOverheadMs: number | null
  postVendorFirstTokenOverheadMs: number | null
  streamCompletionOverheadMs: number | null
}

function elapsed(start: number | null, end: number | null): number | null {
  if (start == null || end == null) return null
  const diff = end - start
  return diff >= 0 ? Math.round(diff * 100) / 100 : null
}

export function calculateMetrics(ctx: LatencyTimingContext): CalculatedLatencyMetrics {
  const authMs = elapsed(ctx.hrAuthStartedAt, ctx.hrAuthCompletedAt)
  const quotaMs = elapsed(ctx.hrQuotaStartedAt, ctx.hrQuotaCompletedAt)
  const routingMs = elapsed(ctx.hrRoutingStartedAt, ctx.hrRoutingCompletedAt)

  const preVendorMs = elapsed(ctx.hrRequestReceivedAt, ctx.hrVendorRequestStartedAt)
  const vendorHeadersMs = elapsed(ctx.hrVendorRequestStartedAt, ctx.hrVendorResponseHeadersAt)
  const vendorFirstByteMs = elapsed(ctx.hrVendorRequestStartedAt, ctx.hrVendorFirstByteAt)
  const vendorFirstTokenMs = elapsed(ctx.hrVendorRequestStartedAt, ctx.hrVendorFirstTextTokenAt)
  const vendorTotalMs = elapsed(ctx.hrVendorRequestStartedAt, ctx.hrVendorStreamCompletedAt ?? ctx.hrOpusxResponseCompletedAt)

  const opusxFirstTokenMs = elapsed(ctx.hrRequestReceivedAt, ctx.hrOpusxFirstTextTokenForwardedAt)
  const opusxTotalMs = elapsed(ctx.hrRequestReceivedAt, ctx.hrOpusxResponseCompletedAt)

  // Overhead = how much OpusX adds on top of the vendor's first token time
  let firstTokenOverheadMs: number | null = null
  if (opusxFirstTokenMs != null && vendorFirstTokenMs != null) {
    const diff = opusxFirstTokenMs - vendorFirstTokenMs
    firstTokenOverheadMs = diff >= 0 ? Math.round(diff * 100) / 100 : null
  }

  // Post-vendor overhead = opusxFirstToken - preVendor - vendorFirstToken
  let postVendorFirstTokenOverheadMs: number | null = null
  if (opusxFirstTokenMs != null && preVendorMs != null && vendorFirstTokenMs != null) {
    const diff = opusxFirstTokenMs - preVendorMs - vendorFirstTokenMs
    postVendorFirstTokenOverheadMs = diff >= 0 ? Math.round(diff * 100) / 100 : null
  }

  // Stream completion overhead
  let streamCompletionOverheadMs: number | null = null
  if (opusxTotalMs != null && vendorTotalMs != null && preVendorMs != null) {
    const diff = opusxTotalMs - preVendorMs - vendorTotalMs
    streamCompletionOverheadMs = diff >= 0 ? Math.round(diff * 100) / 100 : null
  }

  return {
    authMs,
    quotaMs,
    routingMs,
    preVendorMs,
    vendorHeadersMs,
    vendorFirstByteMs,
    vendorFirstTokenMs,
    vendorTotalMs,
    opusxFirstTokenMs,
    opusxTotalMs,
    firstTokenOverheadMs,
    postVendorFirstTokenOverheadMs,
    streamCompletionOverheadMs,
  }
}

function generateRequestId(): string {
  const now = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `req_${now}_${random}`
}

/**
 * SSE text-token detector.
 * Returns true ONLY for content_block_delta with text_delta containing non-empty text.
 * Ignores message_start, content_block_start, ping, message_delta, message_stop,
 * input_json_delta, and thinking_delta.
 */
export function isFirstTextToken(event: unknown): boolean {
  if (!event || typeof event !== 'object') return false
  const obj = event as { type?: string; delta?: { type?: string; text?: unknown } }
  return (
    obj.type === 'content_block_delta' &&
    obj.delta?.type === 'text_delta' &&
    typeof obj.delta.text === 'string' &&
    obj.delta.text.length > 0
  )
}
