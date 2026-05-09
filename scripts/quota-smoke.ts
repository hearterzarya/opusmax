import { QUOTA_WINDOW_SECONDS, getRollingWindowQuotaState, reserveRollingWindowQuota, settleRollingWindowQuota } from '@/lib/quota'

async function main() {
  const keyId = `smoke_${Date.now()}`
  const budget = 100n
  const base = Date.now()

  // 1) fresh key behavior
  const first = await reserveRollingWindowQuota(keyId, budget, 60, base)
  if (!first.allowed || first.used !== 60) {
    throw new Error(`expected first reservation allowed=60, got ${JSON.stringify(first)}`)
  }

  // 2) request exceeding remaining quota should be blocked
  const second = await reserveRollingWindowQuota(keyId, budget, 50, base + 1000)
  if (second.allowed) {
    throw new Error(`expected second reservation to be blocked, got ${JSON.stringify(second)}`)
  }

  // 3) settle downwards (actual lower than projected)
  await settleRollingWindowQuota(keyId, budget, 60, 30, base + 1500)
  const third = await reserveRollingWindowQuota(keyId, budget, 50, base + 2000)
  if (!third.allowed) {
    throw new Error(`expected third reservation allowed after settle, got ${JSON.stringify(third)}`)
  }

  // 4) capped settle should never push used above budget
  await settleRollingWindowQuota(keyId, budget, 10, 200, base + 2200)
  const stateInWindow = await getRollingWindowQuotaState(keyId, budget, base + 2500)
  if (!stateInWindow.resetAt || stateInWindow.used <= 0 || stateInWindow.used > Number(budget)) {
    throw new Error(`expected active window state, got ${JSON.stringify(stateInWindow)}`)
  }
  if (stateInWindow.remaining < 0) {
    throw new Error(`remaining should never be negative, got ${JSON.stringify(stateInWindow)}`)
  }

  // 5) concurrent near-boundary reservations (best effort under mock)
  const concurrentKey = `${keyId}_concurrent`
  await reserveRollingWindowQuota(concurrentKey, budget, 90, base + 3000)
  const concurrent = await Promise.all([
    reserveRollingWindowQuota(concurrentKey, budget, 15, base + 3100),
    reserveRollingWindowQuota(concurrentKey, budget, 15, base + 3101),
  ])
  const allowedCount = concurrent.filter((r) => r.allowed).length
  if (allowedCount > 1) {
    throw new Error(`at most one concurrent reservation should pass, got ${JSON.stringify(concurrent)}`)
  }

  // 6) reset after 5 hours
  const afterWindow = await reserveRollingWindowQuota(
    keyId,
    budget,
    100,
    base + (QUOTA_WINDOW_SECONDS + 3) * 1000
  )
  if (!afterWindow.allowed || afterWindow.used !== 100) {
    throw new Error(`expected full refill after window expiry, got ${JSON.stringify(afterWindow)}`)
  }

  console.log('quota smoke test passed (fresh/over-limit/blocked/concurrent/reset)')
}

main().catch((err) => {
  console.error('quota smoke test failed:', err)
  process.exit(1)
})
