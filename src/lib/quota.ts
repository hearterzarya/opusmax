import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export const QUOTA_WINDOW_SECONDS = 5 * 60 * 60
const QUOTA_WINDOW_MS = QUOTA_WINDOW_SECONDS * 1000
const HAS_REAL_REDIS =
  Boolean(process.env.REDIS_URL?.trim()) &&
  !(process.env.REDIS_URL?.includes('xxx.upstash.io') ?? false)
const RESET_MARKER_PREFIX = 'token_budget_reset:'

type ReserveQuotaResult = {
  allowed: boolean
  used: number
  remaining: number
  resetAt: number
}

const RESERVE_QUOTA_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local budget = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local member = ARGV[5]
local ttl_seconds = tonumber(ARGV[6])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local entries = redis.call('ZRANGE', key, 0, -1)
local used = 0
for _, entry in ipairs(entries) do
  local sep = string.find(entry, ':')
  if sep then
    local token_str = string.sub(entry, sep + 1)
    local token_val = tonumber(token_str)
    if token_val then
      used = used + token_val
    end
  end
end

if used + requested > budget then
  local first = redis.call('ZRANGE', key, 0, 0)[1]
  local reset_at = now + window_ms
  if first then
    local sep = string.find(first, ':')
    if sep then
      local ts = tonumber(string.sub(first, 1, sep - 1))
      if ts then
        reset_at = ts + window_ms
      end
    end
  end
  local remaining = budget - used
  if remaining < 0 then remaining = 0 end
  return {0, used, remaining, reset_at}
end

redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttl_seconds)

local new_used = used + requested
local first_after = redis.call('ZRANGE', key, 0, 0)[1]
local reset_at = now + window_ms
if first_after then
  local sep = string.find(first_after, ':')
  if sep then
    local ts = tonumber(string.sub(first_after, 1, sep - 1))
    if ts then
      reset_at = ts + window_ms
    end
  end
end
local remaining = budget - new_used
if remaining < 0 then remaining = 0 end
return {1, new_used, remaining, reset_at}
`

const SETTLE_QUOTA_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local budget = tonumber(ARGV[3])
local delta = tonumber(ARGV[4])
local ttl_seconds = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
if delta == 0 then
  return 0
end

local entries = redis.call('ZRANGE', key, 0, -1)
local used = 0
for _, entry in ipairs(entries) do
  local sep = string.find(entry, ':')
  if sep then
    local token_str = string.sub(entry, sep + 1)
    local token_val = tonumber(token_str)
    if token_val then
      used = used + token_val
    end
  end
end

local applied_delta = delta
if delta > 0 then
  local headroom = budget - used
  if headroom < 0 then headroom = 0 end
  if delta > headroom then
    applied_delta = headroom
  end
end

if applied_delta ~= 0 then
  redis.call('ZADD', key, now, tostring(now) .. ':' .. tostring(applied_delta))
  redis.call('EXPIRE', key, ttl_seconds)
end

return applied_delta
`

function parseTokenEntry(entry: string): { ts: number; tokens: number } | null {
  const [tsRaw, tokenRaw] = entry.split(':')
  const ts = Number(tsRaw)
  const tokens = Number(tokenRaw)
  if (!Number.isFinite(ts) || !Number.isFinite(tokens)) return null
  return { ts, tokens }
}

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

async function getRedisEntriesInWindow(rollingKey: string, nowMs: number): Promise<string[]> {
  const client = redis as unknown as { zrangebyscore?: (key: string, min: number, max: number) => Promise<string[]> }
  if (typeof client.zrangebyscore === 'function') {
    return client.zrangebyscore(rollingKey, nowMs - QUOTA_WINDOW_MS, nowMs)
  }

  // Backward-compat fallback for long-lived dev processes with stale redis singleton shape.
  const all = await redis.zrange(rollingKey, 0, -1)
  return all.filter((entry) => {
    const parsed = parseTokenEntry(entry)
    if (!parsed) return false
    return parsed.ts >= nowMs - QUOTA_WINDOW_MS && parsed.ts <= nowMs
  })
}

async function getQuotaResetMarkerMs(keyId: string): Promise<number | null> {
  const raw = await redis.get(`${RESET_MARKER_PREFIX}${keyId}`)
  if (!raw) return null
  const ts = Number(raw)
  return Number.isFinite(ts) ? ts : null
}

export async function resetRollingWindowQuota(keyId: string, nowMs: number = Date.now()): Promise<void> {
  const rollingKey = `token_budget:${keyId}`
  await redis.zremrangebyscore(rollingKey, 0, nowMs)
  await redis.setex(`${RESET_MARKER_PREFIX}${keyId}`, QUOTA_WINDOW_SECONDS, String(nowMs))
}

export async function reserveRollingWindowQuota(
  keyId: string,
  budget: bigint,
  requestedTokens: number,
  nowMs: number = Date.now()
): Promise<ReserveQuotaResult> {
  const normalizedRequest = Math.max(0, Math.floor(requestedTokens))
  const numericBudget = Number(budget)
  const rollingKey = `token_budget:${keyId}`
  const reservationMember = `${nowMs}:${normalizedRequest}`
  const ttlSeconds = QUOTA_WINDOW_SECONDS

  const client = redis as unknown as {
    eval?: (
      script: string,
      numKeys: number,
      ...args: Array<string | number>
    ) => Promise<unknown>
  }
  const raw =
    typeof client.eval === 'function'
      ? await client.eval(
          RESERVE_QUOTA_LUA,
          1,
          rollingKey,
          nowMs,
          QUOTA_WINDOW_MS,
          numericBudget,
          normalizedRequest,
          reservationMember,
          ttlSeconds
        )
      : null

  if (!raw) {
    // Fallback for stale dev singleton lacking eval; not strictly atomic.
    await redis.zremrangebyscore(rollingKey, 0, nowMs - QUOTA_WINDOW_MS)
    const entries = await getRedisEntriesInWindow(rollingKey, nowMs)
    let usedFallback = 0
    for (const entry of entries) {
      const parsed = parseTokenEntry(entry)
      if (parsed) usedFallback += parsed.tokens
    }
    if (usedFallback + normalizedRequest > numericBudget) {
      const first = entries[0]
      const firstTs = Number(first?.split(':')[0] ?? nowMs)
      const resetAt = Number.isFinite(firstTs) ? firstTs + QUOTA_WINDOW_MS : nowMs + QUOTA_WINDOW_MS
      return {
        allowed: false,
        used: clampNonNegative(usedFallback),
        remaining: clampNonNegative(numericBudget - usedFallback),
        resetAt,
      }
    }
    await redis.zadd(rollingKey, nowMs, reservationMember)
    await redis.expire(rollingKey, ttlSeconds)
    const updatedUsed = usedFallback + normalizedRequest
    return {
      allowed: true,
      used: clampNonNegative(updatedUsed),
      remaining: clampNonNegative(numericBudget - updatedUsed),
      resetAt: nowMs + QUOTA_WINDOW_MS,
    }
  }

  const arr = Array.isArray(raw) ? raw : []
  const allowed = Number(arr[0] ?? 0) === 1
  const used = clampNonNegative(Number(arr[1] ?? 0))
  const remaining = clampNonNegative(Number(arr[2] ?? 0))
  const resetAt = Number(arr[3] ?? nowMs + QUOTA_WINDOW_MS)

  return { allowed, used, remaining, resetAt }
}

export async function settleRollingWindowQuota(
  keyId: string,
  budget: bigint,
  projectedTokens: number,
  actualTokens: number,
  nowMs: number = Date.now()
): Promise<void> {
  const delta = Math.floor(actualTokens) - Math.floor(projectedTokens)
  if (delta === 0) return

  const rollingKey = `token_budget:${keyId}`
  const numericBudget = Number(budget)
  const client = redis as unknown as {
    eval?: (
      script: string,
      numKeys: number,
      ...args: Array<string | number>
    ) => Promise<unknown>
  }
  if (HAS_REAL_REDIS && typeof client.eval === 'function') {
    await client.eval(
      SETTLE_QUOTA_LUA,
      1,
      rollingKey,
      nowMs,
      QUOTA_WINDOW_MS,
      numericBudget,
      delta,
      QUOTA_WINDOW_SECONDS
    )
    return
  }

  // Fallback for stale dev process shape (non-atomic).
  await redis.zremrangebyscore(rollingKey, 0, nowMs - QUOTA_WINDOW_MS)
  const entries = await getRedisEntriesInWindow(rollingKey, nowMs)
  let used = 0
  for (const entry of entries) {
    const parsed = parseTokenEntry(entry)
    if (parsed) used += parsed.tokens
  }

  let appliedDelta = delta
  if (delta > 0) {
    const headroom = Math.max(0, numericBudget - used)
    appliedDelta = Math.min(delta, headroom)
  }
  if (appliedDelta !== 0) {
    await redis.zadd(rollingKey, nowMs, `${nowMs}:${appliedDelta}`)
    await redis.expire(rollingKey, QUOTA_WINDOW_SECONDS)
  }
}

export async function getRollingWindowQuotaState(
  keyId: string,
  budget: bigint,
  nowMs: number = Date.now()
): Promise<{ used: number; remaining: number; resetAt: string | null; blocked: boolean }> {
  const rollingKey = `token_budget:${keyId}`
  await redis.zremrangebyscore(rollingKey, 0, nowMs - QUOTA_WINDOW_MS)
  const redisEntries = await getRedisEntriesInWindow(rollingKey, nowMs)
  const resetMarkerMs = await getQuotaResetMarkerMs(keyId)
  const effectiveWindowStart = Math.max(nowMs - QUOTA_WINDOW_MS, resetMarkerMs ?? 0)

  let used = 0
  let firstTs: number | null = null

  for (const entry of redisEntries) {
    const parsed = parseTokenEntry(entry)
    if (!parsed) continue
    if (parsed.ts < effectiveWindowStart) continue
    used += parsed.tokens
    if (firstTs === null || parsed.ts < firstTs) firstTs = parsed.ts
  }

  if (redisEntries.length === 0) {
    // Redis can be cleared in dev/restarts; DB remains source of truth fallback.
    const since = new Date(effectiveWindowStart)
    const [agg, first] = await Promise.all([
      prisma.usageLog.aggregate({
        where: { apiKeyId: keyId, timestamp: { gte: since } },
        _sum: { totalTokens: true },
      }),
      prisma.usageLog.findFirst({
        where: { apiKeyId: keyId, timestamp: { gte: since } },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      }),
    ])
    used = agg._sum.totalTokens || 0
    firstTs = first ? first.timestamp.getTime() : null
  }

  const numericBudget = Number(budget)
  const normalizedUsed = Math.min(clampNonNegative(used), numericBudget)
  const remaining = clampNonNegative(numericBudget - normalizedUsed)
  const resetAt = firstTs ? new Date(firstTs + QUOTA_WINDOW_MS).toISOString() : null

  return {
    used: normalizedUsed,
    remaining,
    resetAt,
    blocked: normalizedUsed >= numericBudget,
  }
}
