/**
 * Centralised API-key status, remaining-days, and plan helpers.
 *
 * Pure functions (no DB / IO) so they can run on the server, in the client,
 * and in unit tests. Time is always handled in absolute epoch ms / UTC to
 * avoid timezone bugs — callers pass `Date` or ISO strings and we normalise.
 */

export const ONE_DAY_MS = 24 * 60 * 60 * 1000
/** Keys within this many days of expiry are flagged "expiring soon". */
export const EXPIRING_SOON_DAYS = 3

/** Per-key 5-hour rolling token budgets that define each plan. */
export const PLAN_BUDGETS = {
  '5X': 5_000_000n,
  '20X': 20_000_000n,
} as const

export type PlanName = keyof typeof PLAN_BUDGETS
export type ApiKeyStatusValue =
  | 'active'
  | 'expired'
  | 'expiring_soon'
  | 'lifetime'
  | 'paused'
  | 'revoked'

export interface ApiKeyStatusInfo {
  status: ApiKeyStatusValue
  label: string
  remainingDays: number | null
  remainingLabel: string
  isExpired: boolean
  isLifetime: boolean
}

function toMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * Whole days remaining until expiry, rounded up.
 * - null  → lifetime (no expiry)
 * - 0     → expired OR expires within the current day (use status to disambiguate)
 */
export function calculateRemainingDays(
  expiresAt: Date | string | null | undefined,
  now: number = Date.now()
): number | null {
  const ms = toMs(expiresAt)
  if (ms == null) return null
  const diff = ms - now
  if (diff <= 0) return 0
  return Math.ceil(diff / ONE_DAY_MS)
}

/**
 * Resolve the full display status for a key from its stored expiry and the
 * persisted db status (ACTIVE / PAUSED / REVOKED / EXPIRED).
 */
export function getApiKeyStatus(
  expiresAt: Date | string | null | undefined,
  dbStatus: string | null | undefined,
  now: number = Date.now()
): ApiKeyStatusInfo {
  const normalizedDb = (dbStatus ?? 'ACTIVE').toUpperCase()

  if (normalizedDb === 'REVOKED') {
    return {
      status: 'revoked',
      label: 'Revoked',
      remainingDays: calculateRemainingDays(expiresAt, now),
      remainingLabel: 'Revoked',
      isExpired: false,
      isLifetime: expiresAt == null,
    }
  }

  if (normalizedDb === 'PAUSED') {
    return {
      status: 'paused',
      label: 'Paused',
      remainingDays: calculateRemainingDays(expiresAt, now),
      remainingLabel: 'Paused',
      isExpired: false,
      isLifetime: expiresAt == null,
    }
  }

  const ms = toMs(expiresAt)

  // Lifetime — no expiry set.
  if (ms == null) {
    return {
      status: 'lifetime',
      label: 'Lifetime',
      remainingDays: null,
      remainingLabel: 'Lifetime',
      isExpired: false,
      isLifetime: true,
    }
  }

  // Expired.
  if (ms <= now) {
    return {
      status: 'expired',
      label: 'Expired',
      remainingDays: 0,
      remainingLabel: 'Expired',
      isExpired: true,
      isLifetime: false,
    }
  }

  const remainingDays = calculateRemainingDays(expiresAt, now) ?? 0

  if (remainingDays <= EXPIRING_SOON_DAYS) {
    return {
      status: 'expiring_soon',
      label: 'Expiring Soon',
      remainingDays,
      remainingLabel: formatRemainingLabel(remainingDays, ms, now),
      isExpired: false,
      isLifetime: false,
    }
  }

  return {
    status: 'active',
    label: 'Active',
    remainingDays,
    remainingLabel: formatRemainingLabel(remainingDays, ms, now),
    isExpired: false,
    isLifetime: false,
  }
}

function formatRemainingLabel(remainingDays: number, expiresMs: number, now: number): string {
  // Same calendar day as expiry but still in the future → "Expires today".
  if (expiresMs - now < ONE_DAY_MS && remainingDays <= 1) {
    if (remainingDays <= 0) return 'Expires today'
    return '1 day left'
  }
  return `${remainingDays} days left`
}

/** Detect plan name from the stored hourly token budget. */
export function detectPlan(hourlyTokenBudget: bigint | number | null | undefined): PlanName | 'Custom' | 'None' {
  if (hourlyTokenBudget == null) return 'None'
  const budget = typeof hourlyTokenBudget === 'bigint' ? hourlyTokenBudget : BigInt(Math.trunc(hourlyTokenBudget))
  if (budget === 0n) return 'None'
  if (budget === PLAN_BUDGETS['5X']) return '5X'
  if (budget === PLAN_BUDGETS['20X']) return '20X'
  return 'Custom'
}

export function isPlanName(value: string): value is PlanName {
  return value === '5X' || value === '20X'
}
