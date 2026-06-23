import { prisma } from '@/lib/prisma'
import { redis, shouldUseDistributedRedis } from '@/lib/redis'

export const QUOTA_WINDOW_SECONDS = 5 * 60 * 60
const QUOTA_WINDOW_MS = QUOTA_WINDOW_SECONDS * 1000
/** Kept for compatibility with any external imports / Redis remnant cleanup. */
export const RESET_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60
const RESET_MARKER_PREFIX = 'token_budget_reset:'

export type ReserveQuotaResult = {
  allowed: boolean
  used: number
  remaining: number
  /** Absolute reset timestamp in epoch ms. FIXED for the lifetime of a window. */
  resetAt: number
}

export type QuotaWindowState = {
  used: number
  remaining: number
  resetAt: string | null
  blocked: boolean
  windowStartedAt: string | null
}

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

// ---------------------------------------------------------------------------
// Pure, side-effect-free helpers (unit tested in quota.test.ts)
// ---------------------------------------------------------------------------

/**
 * Given a fixed window anchor, compute its absolute reset timestamp and whether
 * it has expired at `nowMs`. resetAt is ALWAYS windowStartMs + 5h — it is never
 * derived from "now + remaining", which is what caused the extending-countdown
 * bug.
 */
export function computeWindowBoundaries(
  windowStartMs: number,
  nowMs: number
): { resetAtMs: number; expired: boolean } {
  const resetAtMs = windowStartMs + QUOTA_WINDOW_MS
  return { resetAtMs, expired: nowMs >= resetAtMs }
}

/** Decide whether a request fits the remaining budget for the current window. */
export function decideReservation(
  usedBefore: number,
  requestedTokens: number,
  budget: number
): { allowed: boolean; usedAfter: number; remaining: number } {
  const req = Math.max(0, Math.floor(requestedTokens))
  const allowed = usedBefore + req <= budget
  const usedAfter = allowed ? usedBefore + req : usedBefore
  return { allowed, usedAfter, remaining: clampNonNegative(budget - usedAfter) }
}

// ---------------------------------------------------------------------------
// Fixed 5-hour window — single source of truth lives in api_keys.quotaWindowStartAt
//
// The window is [windowStartAt, windowStartAt + 5h]. resetAt is computed ONCE
// from windowStartAt and never recalculated from "now + remaining". When the
// window expires, the next request opens a brand-new window anchored at that
// moment. This removes the sliding-window bug where resetAt kept extending by
// 5/10/15 minutes as old usage-log rows aged out of a rolling lookback.
// ---------------------------------------------------------------------------

type FixedWindow = {
  windowStartMs: number
  resetAtMs: number
  didReset: boolean
}

/**
 * Atomically resolve (and if needed roll) the fixed window for a key.
 *
 * The conditional UPDATE only matches when the stored window is missing or has
 * already expired. Postgres takes a row lock for the UPDATE, so when several
 * requests arrive at the same instant after expiry they serialize: the first
 * opens the new window, the rest re-evaluate the WHERE against the freshly
 * committed value, match zero rows, and read the same window. The window is
 * therefore reset exactly once per expiry — no double reset, works across
 * multiple serverless instances because the state is in the database.
 */
async function resolveFixedWindow(keyId: string, nowMs: number): Promise<FixedWindow> {
  const nowDate = new Date(nowMs)
  const expiryThreshold = new Date(nowMs - QUOTA_WINDOW_MS)

  const rolled = await prisma.$queryRaw<Array<{ quotaWindowStartAt: Date }>>`
    UPDATE "api_keys"
    SET "quotaWindowStartAt" = ${nowDate}
    WHERE "id" = ${keyId}
      AND ("quotaWindowStartAt" IS NULL OR "quotaWindowStartAt" <= ${expiryThreshold})
    RETURNING "quotaWindowStartAt"
  `

  if (rolled.length > 0) {
    return { windowStartMs: nowMs, resetAtMs: nowMs + QUOTA_WINDOW_MS, didReset: true }
  }

  const row = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: { quotaWindowStartAt: true },
  })
  const windowStartMs = row?.quotaWindowStartAt ? row.quotaWindowStartAt.getTime() : nowMs
  return { windowStartMs, resetAtMs: windowStartMs + QUOTA_WINDOW_MS, didReset: false }
}

/**
 * Read-only window view for status endpoints. Never mutates.
 * An expired window is reported as inactive (fresh) so the UI shows a clean
 * "awaiting first request" state until the next real request opens a window.
 */
async function readFixedWindow(
  keyId: string,
  nowMs: number
): Promise<{ windowStartMs: number | null; resetAtMs: number | null }> {
  const row = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: { quotaWindowStartAt: true },
  })
  if (!row?.quotaWindowStartAt) return { windowStartMs: null, resetAtMs: null }

  const windowStartMs = row.quotaWindowStartAt.getTime()
  const resetAtMs = windowStartMs + QUOTA_WINDOW_MS
  if (nowMs >= resetAtMs) return { windowStartMs: null, resetAtMs: null }
  return { windowStartMs, resetAtMs }
}

/** Sum of completed-request tokens since the window opened. */
async function sumTokensSince(keyId: string, sinceMs: number): Promise<number> {
  const agg = await prisma.usageLog.aggregate({
    where: { apiKeyId: keyId, timestamp: { gte: new Date(sinceMs) } },
    _sum: { totalTokens: true },
  })
  return agg._sum.totalTokens ?? 0
}

/**
 * Enforce the fixed 5-hour token budget for a key and return the decision.
 * Called before forwarding a request upstream.
 */
export async function reserveRollingWindowQuota(
  keyId: string,
  budget: bigint,
  requestedTokens: number,
  nowMs: number = Date.now()
): Promise<ReserveQuotaResult> {
  const normalizedRequest = Math.max(0, Math.floor(requestedTokens))
  const numericBudget = Number(budget)

  const win = await resolveFixedWindow(keyId, nowMs)
  const usedBefore = win.didReset ? 0 : await sumTokensSince(keyId, win.windowStartMs)

  const allowed = usedBefore + normalizedRequest <= numericBudget
  const usedAfter = allowed ? usedBefore + normalizedRequest : usedBefore
  const remaining = clampNonNegative(numericBudget - usedAfter)

  console.log(
    '[QUOTA] reserve ' +
      JSON.stringify({
        keyId,
        now: new Date(nowMs).toISOString(),
        windowStartAt: new Date(win.windowStartMs).toISOString(),
        resetAt: new Date(win.resetAtMs).toISOString(),
        usedBeforeReset: usedBefore,
        resetTriggered: win.didReset,
        requested: normalizedRequest,
        allowed,
        remaining,
      })
  )

  return {
    allowed,
    used: clampNonNegative(usedAfter),
    remaining,
    resetAt: win.resetAtMs,
  }
}

/**
 * No-op in the fixed-window model.
 *
 * Actual token consumption is recorded in usage_logs after each completed
 * request, and reserveRollingWindowQuota reads those rows directly. There is no
 * separate reservation ledger to reconcile, so projected-vs-actual settlement
 * is unnecessary. Kept for call-site compatibility.
 */
export async function settleRollingWindowQuota(
  _keyId: string,
  _budget: bigint,
  _projectedTokens: number,
  _actualTokens: number,
  _nowMs: number = Date.now()
): Promise<void> {
  return
}

/**
 * Admin action: open a fresh window starting now. Because used tokens are
 * counted as usage_logs since windowStartAt, moving the anchor to "now"
 * instantly zeroes the used count while preserving historical logs.
 */
export async function resetRollingWindowQuota(keyId: string, nowMs: number = Date.now()): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { quotaWindowStartAt: new Date(nowMs) },
  })

  // Clear any Redis remnants if a distributed Redis is configured.
  if (shouldUseDistributedRedis()) {
    try {
      await redis.zremrangebyscore(`token_budget:${keyId}`, 0, nowMs)
      await redis.setex(`${RESET_MARKER_PREFIX}${keyId}`, RESET_MARKER_TTL_SECONDS, String(nowMs))
    } catch {
      /* best-effort cleanup */
    }
  }

  console.log(
    '[QUOTA] manual reset ' +
      JSON.stringify({
        keyId,
        newWindowStartAt: new Date(nowMs).toISOString(),
        newResetAt: new Date(nowMs + QUOTA_WINDOW_MS).toISOString(),
      })
  )
}

/**
 * Quota snapshot for internal checks (key-check). Read-only.
 */
export async function getRollingWindowQuotaState(
  keyId: string,
  budget: bigint,
  nowMs: number = Date.now()
): Promise<{ used: number; remaining: number; resetAt: string | null; blocked: boolean }> {
  const numericBudget = Number(budget)
  const { windowStartMs, resetAtMs } = await readFixedWindow(keyId, nowMs)
  const used = windowStartMs === null ? 0 : await sumTokensSince(keyId, windowStartMs)

  const normalizedUsed = Math.min(clampNonNegative(used), numericBudget)
  const remaining = clampNonNegative(numericBudget - normalizedUsed)

  return {
    used: normalizedUsed,
    remaining,
    resetAt: resetAtMs ? new Date(resetAtMs).toISOString() : null,
    blocked: normalizedUsed >= numericBudget,
  }
}

/**
 * Dashboard-friendly window snapshot for the public key-status UI. Read-only.
 * Uses the fixed window anchor — resetAt is stable for the whole window.
 */
export async function getRollingWindowUsageFromUsageLogs(
  keyId: string,
  budget: bigint,
  nowMs: number = Date.now()
): Promise<QuotaWindowState> {
  const numericBudget = Number(budget)
  if (!Number.isFinite(numericBudget) || numericBudget <= 0) {
    return { used: 0, remaining: 0, resetAt: null, blocked: false, windowStartedAt: null }
  }

  const { windowStartMs, resetAtMs } = await readFixedWindow(keyId, nowMs)
  const used = windowStartMs === null ? 0 : await sumTokensSince(keyId, windowStartMs)

  const normalizedUsed = Math.min(clampNonNegative(used), numericBudget)
  const remaining = clampNonNegative(numericBudget - normalizedUsed)

  return {
    used: normalizedUsed,
    remaining,
    resetAt: resetAtMs ? new Date(resetAtMs).toISOString() : null,
    blocked: normalizedUsed >= numericBudget,
    windowStartedAt: windowStartMs ? new Date(windowStartMs).toISOString() : null,
  }
}
