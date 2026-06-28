import { describe, it, expect } from 'vitest'
import {
  calculateRemainingDays,
  getApiKeyStatus,
  detectPlan,
  isPlanName,
  PLAN_BUDGETS,
  ONE_DAY_MS,
} from './api-key-status'

const NOW = Date.parse('2026-06-16T12:00:00.000Z')

describe('calculateRemainingDays', () => {
  it('returns null for lifetime (no expiry)', () => {
    expect(calculateRemainingDays(null, NOW)).toBeNull()
  })

  it('returns 10 for an expiry 10 days out', () => {
    const exp = new Date(NOW + 10 * ONE_DAY_MS)
    expect(calculateRemainingDays(exp, NOW)).toBe(10)
  })

  it('returns 0 for an expiry in the past', () => {
    const exp = new Date(NOW - ONE_DAY_MS)
    expect(calculateRemainingDays(exp, NOW)).toBe(0)
  })
})

describe('getApiKeyStatus', () => {
  it('Test 1: 10-day expiry → active, 10 days remaining', () => {
    const exp = new Date(NOW + 10 * ONE_DAY_MS)
    const info = getApiKeyStatus(exp, 'ACTIVE', NOW)
    expect(info.status).toBe('active')
    expect(info.remainingDays).toBe(10)
  })

  it('Test 2: expiry yesterday → expired', () => {
    const exp = new Date(NOW - ONE_DAY_MS)
    const info = getApiKeyStatus(exp, 'ACTIVE', NOW)
    expect(info.status).toBe('expired')
    expect(info.isExpired).toBe(true)
    expect(info.remainingDays).toBe(0)
  })

  it('Test 3: expiry within 3 days → expiring_soon', () => {
    const exp = new Date(NOW + 2 * ONE_DAY_MS)
    const info = getApiKeyStatus(exp, 'ACTIVE', NOW)
    expect(info.status).toBe('expiring_soon')
  })

  it('Test 9: lifetime key → lifetime, remaining null', () => {
    const info = getApiKeyStatus(null, 'ACTIVE', NOW)
    expect(info.status).toBe('lifetime')
    expect(info.remainingDays).toBeNull()
    expect(info.remainingLabel).toBe('Lifetime')
  })

  it('Test 8: paused/disabled key → paused', () => {
    const exp = new Date(NOW + 10 * ONE_DAY_MS)
    const info = getApiKeyStatus(exp, 'PAUSED', NOW)
    expect(info.status).toBe('paused')
  })

  it('revoked key → revoked', () => {
    const info = getApiKeyStatus(null, 'REVOKED', NOW)
    expect(info.status).toBe('revoked')
  })

  it('exactly at the 3-day boundary is still expiring_soon', () => {
    const exp = new Date(NOW + 3 * ONE_DAY_MS)
    expect(getApiKeyStatus(exp, 'ACTIVE', NOW).status).toBe('expiring_soon')
  })

  it('4 days out is active, not expiring soon', () => {
    const exp = new Date(NOW + 4 * ONE_DAY_MS)
    expect(getApiKeyStatus(exp, 'ACTIVE', NOW).status).toBe('active')
  })
})

describe('detectPlan', () => {
  it('maps 5M budget to 5X', () => {
    expect(detectPlan(PLAN_BUDGETS['5X'])).toBe('5X')
  })
  it('maps 20M budget to 20X', () => {
    expect(detectPlan(PLAN_BUDGETS['20X'])).toBe('20X')
  })
  it('maps null/zero to None', () => {
    expect(detectPlan(null)).toBe('None')
    expect(detectPlan(0n)).toBe('None')
  })
  it('maps other values to Custom', () => {
    expect(detectPlan(1_234_567n)).toBe('Custom')
  })
})

describe('isPlanName', () => {
  it('accepts 5X and 20X only', () => {
    expect(isPlanName('5X')).toBe(true)
    expect(isPlanName('20X')).toBe(true)
    expect(isPlanName('trial')).toBe(false)
  })
})
