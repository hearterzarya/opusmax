import { describe, it, expect } from 'vitest'
import {
  QUOTA_WINDOW_SECONDS,
  computeWindowBoundaries,
  decideReservation,
} from './quota'

const FIVE_HOURS_MS = QUOTA_WINDOW_SECONDS * 1000

describe('computeWindowBoundaries — fixed 5-hour window', () => {
  const windowStart = Date.parse('2026-06-16T00:00:00.000Z')

  it('resetAt is always windowStart + 5h (never recalculated from now)', () => {
    // Same window anchor, many different "now" values → identical resetAt.
    const a = computeWindowBoundaries(windowStart, windowStart + 1_000)
    const b = computeWindowBoundaries(windowStart, windowStart + 60 * 60 * 1000)
    const c = computeWindowBoundaries(windowStart, windowStart + 4 * 60 * 60 * 1000)
    expect(a.resetAtMs).toBe(windowStart + FIVE_HOURS_MS)
    expect(b.resetAtMs).toBe(windowStart + FIVE_HOURS_MS)
    expect(c.resetAtMs).toBe(windowStart + FIVE_HOURS_MS)
  })

  it('does not expire before 5 hours', () => {
    const justBefore = windowStart + FIVE_HOURS_MS - 1
    expect(computeWindowBoundaries(windowStart, justBefore).expired).toBe(false)
  })

  it('expires exactly at 5 hours', () => {
    const exactly = windowStart + FIVE_HOURS_MS
    expect(computeWindowBoundaries(windowStart, exactly).expired).toBe(true)
  })

  it('does not create extra 5/10/15-minute windows after expiry', () => {
    // The countdown bug: resetAt creeping forward. Here resetAt is fixed, so
    // 5 minutes past the window is simply "expired", not "5 more minutes".
    const fiveMinPast = windowStart + FIVE_HOURS_MS + 5 * 60 * 1000
    const tenMinPast = windowStart + FIVE_HOURS_MS + 10 * 60 * 1000
    const r1 = computeWindowBoundaries(windowStart, fiveMinPast)
    const r2 = computeWindowBoundaries(windowStart, tenMinPast)
    expect(r1.expired).toBe(true)
    expect(r2.expired).toBe(true)
    // resetAt never moved
    expect(r1.resetAtMs).toBe(windowStart + FIVE_HOURS_MS)
    expect(r2.resetAtMs).toBe(windowStart + FIVE_HOURS_MS)
  })

  it('a fresh window opened at expiry has a brand-new fixed resetAt', () => {
    const expiredAt = windowStart + FIVE_HOURS_MS
    // Simulate the reset: new anchor = the moment of expiry.
    const fresh = computeWindowBoundaries(expiredAt, expiredAt)
    expect(fresh.resetAtMs).toBe(expiredAt + FIVE_HOURS_MS)
    // A brand-new window is NOT expired (its reset is a full 5h ahead).
    expect(fresh.expired).toBe(false)
  })
})

describe('decideReservation — budget enforcement', () => {
  const BUDGET = 20_000_000

  it('allows a request that fits the remaining budget', () => {
    const r = decideReservation(1_000_000, 500_000, BUDGET)
    expect(r.allowed).toBe(true)
    expect(r.usedAfter).toBe(1_500_000)
    expect(r.remaining).toBe(BUDGET - 1_500_000)
  })

  it('blocks a request that exceeds the budget and does not consume it', () => {
    const r = decideReservation(BUDGET - 100, 500, BUDGET)
    expect(r.allowed).toBe(false)
    expect(r.usedAfter).toBe(BUDGET - 100) // unchanged
    expect(r.remaining).toBe(100)
  })

  it('treats a fresh window (used = 0) as full budget available', () => {
    const r = decideReservation(0, 10, BUDGET)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(BUDGET - 10)
  })

  it('never returns negative remaining', () => {
    const r = decideReservation(BUDGET + 5_000, 0, BUDGET)
    expect(r.remaining).toBe(0)
  })
})
