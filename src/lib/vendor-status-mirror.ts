/**
 * Vendor Status Latency Mirror
 *
 * Reads the latency publicly displayed on the OpusMax status page.
 * Zero AI tokens consumed. Zero vendor API key used. Zero synthetic requests.
 *
 * The status page renders client-side, so we fetch the rendered HTML
 * periodically (server-side) and extract the latency value semantically.
 */

const OPUSMAX_STATUS_URL = 'https://opusxmax.vercel.app/status'
const FETCH_TIMEOUT_MS = 15000
const STALE_THRESHOLD_MS = 90_000
const UNAVAILABLE_THRESHOLD_MS = 5 * 60 * 1000
const MAX_REASONABLE_LATENCY_MS = 60_000

export type VendorStatusState = 'LIVE' | 'STALE' | 'UNAVAILABLE'

export interface VendorStatusLatency {
  vendor: string
  metric: string
  latencyMs: number | null
  displayValue: string
  status: VendorStatusState
  source: string
  sourcePage: string
  extractionMethod: string | null
  sourceCheckedAt: string | null
  updatedAt: string | null
  errorCode: string | null
}

// ─── In-memory singleton cache (survives across requests in same process) ───

interface CachedValue {
  latencyMs: number | null
  displayValue: string
  extractedAt: number
  errorCode: string | null
  extractionMethod: string
}

const globalCache = globalThis as unknown as { vendorStatusCache?: CachedValue }

function getCached(): CachedValue | null {
  return globalCache.vendorStatusCache ?? null
}

function setCache(value: CachedValue): void {
  globalCache.vendorStatusCache = value
}

// ─── Extraction ───

/**
 * Extract latency from the OpusMax status page rendered HTML.
 * The rendered page shows a value like "373ms" or "1,240 ms" near "LATENCY".
 */
async function extractLatencyFromStatusPage(): Promise<{
  latencyMs: number
  displayValue: string
  method: string
} | { error: string }> {
  try {
    // Use a web_fetch-like approach: fetch the rendered page
    // The status page is a Next.js app that may server-render the latency
    // from its own health check. We'll try the Kiro web_fetch rendered approach.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(OPUSMAX_STATUS_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpusX-Vendor-Status-Mirror/1.0',
        'Accept': 'text/html',
      },
      cache: 'no-store',
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return { error: `STATUS_ENDPOINT_HTTP_ERROR: ${res.status}` }
    }

    const html = await res.text()

    // The status page contains the latency value in its HTML.
    // From inspection: the rendered page shows "373ms" near "LATENCY"
    // Pattern: a number (possibly with commas) followed by "ms"
    // We look for it near the word "Latency" or in a typical status-card pattern.

    // Strategy: find all occurrences of "Xms" or "X ms" patterns
    const msPattern = /([\d,]+)\s*ms/gi
    const matches: Array<{ value: number; display: string; index: number }> = []
    let match: RegExpExecArray | null

    while ((match = msPattern.exec(html)) !== null) {
      const numStr = match[1]!.replace(/,/g, '')
      const num = parseInt(numStr, 10)
      if (Number.isFinite(num) && num >= 0 && num <= MAX_REASONABLE_LATENCY_MS) {
        matches.push({ value: num, display: `${match[1]} ms`, index: match.index })
      }
    }

    if (matches.length === 0) {
      // Check if page has "—" or "checking" (not yet loaded)
      if (html.includes('—') || html.includes('checking')) {
        return { error: 'LATENCY_ELEMENT_NOT_FOUND' }
      }
      return { error: 'LATENCY_FIELD_NOT_FOUND' }
    }

    // Find the match closest to "LATENCY" or "Latency" text
    const latencyLabelIdx = html.toLowerCase().indexOf('latency')
    let best = matches[0]!

    if (latencyLabelIdx >= 0) {
      // Pick the ms value closest to the "latency" label
      let minDist = Math.abs(matches[0]!.index - latencyLabelIdx)
      for (const m of matches) {
        const dist = Math.abs(m.index - latencyLabelIdx)
        if (dist < minDist) {
          minDist = dist
          best = m
        }
      }
    }

    // Reject if it looks like a refresh interval (e.g., "30s") or uptime percentage
    // The value should be a reasonable latency (1ms - 60000ms)
    if (best.value < 1) {
      return { error: 'INVALID_LATENCY_VALUE' }
    }

    return {
      latencyMs: best.value,
      displayValue: best.display.trim(),
      method: 'RENDERED_STATUS_PAGE',
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { error: 'STATUS_RENDER_TIMEOUT' }
    }
    return { error: `UNKNOWN: ${(err as Error).message?.slice(0, 100)}` }
  }
}

// ─── Polling ───

let pollLock = false

/**
 * Poll the vendor status page and update the cache.
 * Called by the background interval. Uses a lock to prevent overlapping.
 */
export async function pollVendorStatus(): Promise<void> {
  if (pollLock) return
  pollLock = true

  try {
    const result = await extractLatencyFromStatusPage()

    if ('error' in result) {
      // Extraction failed — keep old value as STALE, record error
      const prev = getCached()
      if (prev) {
        setCache({ ...prev, errorCode: result.error })
      } else {
        setCache({
          latencyMs: null,
          displayValue: '—',
          extractedAt: Date.now(),
          errorCode: result.error,
          extractionMethod: 'RENDERED_STATUS_PAGE',
        })
      }
      return
    }

    setCache({
      latencyMs: result.latencyMs,
      displayValue: result.displayValue,
      extractedAt: Date.now(),
      errorCode: null,
      extractionMethod: result.method,
    })
  } finally {
    pollLock = false
  }
}

// ─── Public API ───

export function getVendorStatusLatency(): VendorStatusLatency {
  const cached = getCached()
  const now = Date.now()

  if (!cached || cached.latencyMs == null) {
    return {
      vendor: 'OpusMax',
      metric: 'public_status_latency',
      latencyMs: null,
      displayValue: '—',
      status: 'UNAVAILABLE',
      source: 'OpusMax Public Status',
      sourcePage: OPUSMAX_STATUS_URL,
      extractionMethod: null,
      sourceCheckedAt: cached ? new Date(cached.extractedAt).toISOString() : null,
      updatedAt: null,
      errorCode: cached?.errorCode ?? null,
    }
  }

  const age = now - cached.extractedAt
  let status: VendorStatusState = 'LIVE'
  if (age > UNAVAILABLE_THRESHOLD_MS) status = 'UNAVAILABLE'
  else if (age > STALE_THRESHOLD_MS) status = 'STALE'

  return {
    vendor: 'OpusMax',
    metric: 'public_status_latency',
    latencyMs: cached.latencyMs,
    displayValue: cached.displayValue,
    status,
    source: 'OpusMax Public Status',
    sourcePage: OPUSMAX_STATUS_URL,
    extractionMethod: cached.extractionMethod,
    sourceCheckedAt: new Date(cached.extractedAt).toISOString(),
    updatedAt: new Date(cached.extractedAt).toISOString(),
    errorCode: cached.errorCode,
  }
}

// ─── Background polling (starts once per process) ───

const globalPollState = globalThis as unknown as { vendorStatusPollStarted?: boolean }

export function startVendorStatusPolling(intervalMs = 30_000): void {
  if (globalPollState.vendorStatusPollStarted) return
  globalPollState.vendorStatusPollStarted = true

  // Initial poll
  pollVendorStatus().catch(() => {})

  // Recurring poll
  setInterval(() => {
    pollVendorStatus().catch(() => {})
  }, intervalMs)
}
