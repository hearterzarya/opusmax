import Redis from 'ioredis'

// Unified Redis interface for type safety
interface RedisInterface {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<string | null>
  setex(key: string, ttl: number, value: string): Promise<string | null>
  zadd(key: string, score: number, member: string): Promise<number>
  zrange(key: string, start: number, stop: number): Promise<string[]>
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>
  zcard(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  pipeline(): RedisPipeline
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>
  ping(): Promise<string>
  quit(): Promise<string>
}

interface RedisPipeline {
  zremrangebyscore(key: string, min: number, max: number): RedisPipeline
  zcard(key: string): RedisPipeline
  zadd(key: string, score: number, member: string): RedisPipeline
  expire(key: string, seconds: number): RedisPipeline
  exec(): Promise<Array<[Error | null, unknown]>>
}

// In-memory storage for development without Redis
const mockStringStorage = new Map<string, string>()
const mockSortedSets = new Map<string, Array<{ score: number; value: string }>>()

function getSortedSet(key: string): Array<{ score: number; value: string }> {
  return mockSortedSets.get(key) || []
}

function setSortedSet(key: string, values: Array<{ score: number; value: string }>): void {
  mockSortedSets.set(key, values.sort((a, b) => a.score - b.score))
}

function createMockRedis(): RedisInterface {
  const redisInstance: RedisInterface = {
    get: async (key: string) => mockStringStorage.get(key) || null,
    set: async (key: string, value: string) => { mockStringStorage.set(key, value); return null },
    setex: async (key: string, _ttl: number, value: string) => { mockStringStorage.set(key, value); return null },
    zadd: async (key: string, score: number, member: string) => {
      const existing = getSortedSet(key)
      const deduped = existing.filter(entry => entry.value !== member)
      setSortedSet(key, [...deduped, { score, value: member }])
      return 1
    },
    zrange: async (key: string, start: number, stop: number) => {
      const values = getSortedSet(key)
      if (values.length === 0) return []

      const normalizedStart = start < 0 ? Math.max(values.length + start, 0) : start
      const normalizedStop = stop < 0 ? values.length + stop : stop
      const endIndex = Math.min(normalizedStop + 1, values.length)
      if (normalizedStart >= values.length || normalizedStart > normalizedStop) return []

      return values.slice(normalizedStart, endIndex).map(entry => entry.value)
    },
    zremrangebyscore: async (key: string, min: number | string, max: number | string) => {
      const values = getSortedSet(key)
      const minScore =
        min === '-inf' || min === '-Infinity' ? Number.NEGATIVE_INFINITY : Number(min)
      const maxScore =
        max === '+inf' || max === 'Infinity' || max === '+Infinity'
          ? Number.POSITIVE_INFINITY
          : Number(max)
      const filtered = values.filter(
        (entry) => !(entry.score >= minScore && entry.score <= maxScore)
      )
      const removedCount = values.length - filtered.length
      setSortedSet(key, filtered)
      return removedCount
    },
    zrangebyscore: async (key: string, min: number | string, max: number | string) => {
      const values = getSortedSet(key)
      const minScore =
        min === '-inf' || min === '-Infinity' ? Number.NEGATIVE_INFINITY : Number(min)
      const maxScore =
        max === '+inf' || max === 'Infinity' || max === '+Infinity'
          ? Number.POSITIVE_INFINITY
          : Number(max)
      return values
        .filter((entry) => entry.score >= minScore && entry.score <= maxScore)
        .map((entry) => entry.value)
    },
    eval: async (_script: string, numKeys: number, ...args: Array<string | number>) => {
      // Rolling-window reservation script: keys [rollingKey, resetMarkerKey?], argv now, windowMs, budget, tokens, member, ttl
      if (numKeys < 1 || numKeys > 2 || args.length < numKeys + 5) return null
      const rollingKey = String(args[0] ?? '')
      const resetKey = numKeys >= 2 ? String(args[1] ?? '') : ''
      const argv0 = numKeys
      const now = Number(args[argv0] ?? Date.now())
      const windowMs = Number(args[argv0 + 1] ?? 5 * 60 * 60 * 1000)
      const budget = Number(args[argv0 + 2] ?? 0)
      const tokens = Number(args[argv0 + 3] ?? 0)
      const member = String(args[argv0 + 4] ?? `${now}:0`)
      const windowStart = now - windowMs

      let markerMs = 0
      if (numKeys >= 2 && resetKey) {
        const raw = await redisInstance.get(resetKey)
        if (raw) markerMs = Number(raw) || 0
      }
      const floorMs = Math.max(windowStart, markerMs)
      await redisInstance.zremrangebyscore(rollingKey, '-inf', floorMs - 1)
      const entries = await redisInstance.zrange(rollingKey, 0, -1)
      let used = 0
      for (const entry of entries) {
        const parts = String(entry).split(':')
        if (parts.length === 2) used += Number(parts[1] ?? 0) || 0
      }

      if (used + tokens > budget) {
        const first = (await redisInstance.zrange(rollingKey, 0, 0))[0]
        const firstTs = Number(first?.split(':')[0] ?? now)
        const resetAt = Number.isFinite(firstTs) ? firstTs + windowMs : now + windowMs
        const remaining = Math.max(0, budget - used)
        return [0, used, remaining, resetAt]
      }

      await redisInstance.zadd(rollingKey, now, member)
      await redisInstance.expire(rollingKey, Math.ceil(windowMs / 1000))
      const newUsed = used + tokens
      const first = (await redisInstance.zrange(rollingKey, 0, 0))[0]
      const firstTs = Number(first?.split(':')[0] ?? now)
      const resetAt = Number.isFinite(firstTs) ? firstTs + windowMs : now + windowMs
      const remaining = Math.max(0, budget - newUsed)
      return [1, newUsed, remaining, resetAt]
    },
    zcard: async (key: string) => getSortedSet(key).length,
    expire: async (_key: string, _seconds: number) => 1,
    ping: async () => 'PONG',
    quit: async () => 'OK',
    pipeline: () => {
      const operations: Array<() => Promise<[Error | null, unknown]>> = []
      const pipelineApi: RedisPipeline = {
        zremrangebyscore: (key: string, min: number, max: number) => {
          operations.push(async () => [null, await redisInstance.zremrangebyscore(key, min, max)])
          return pipelineApi
        },
        zcard: (key: string) => {
          operations.push(async () => [null, await redisInstance.zcard(key)])
          return pipelineApi
        },
        zadd: (key: string, score: number, member: string) => {
          operations.push(async () => [null, await redisInstance.zadd(key, score, member)])
          return pipelineApi
        },
        expire: (key: string, seconds: number) => {
          operations.push(async () => [null, await redisInstance.expire(key, seconds)])
          return pipelineApi
        },
        exec: async () => {
          const results: Array<[Error | null, unknown]> = []
          for (const op of operations) {
            results.push(await op())
          }
          return results
        },
      }

      return pipelineApi
    },
  }

  return redisInstance
}

const globalForRedis = globalThis as unknown as {
  redis: RedisInterface | undefined
  redisMockWarned?: boolean
}

function isPlaceholderRedisUrl(url: string | undefined): boolean {
  return !url || url.includes('xxx.upstash.io')
}

/** Real Redis only when URL is valid and not opted out (Railway defaults to in-memory for speed). */
export function shouldUseRealRedis(): boolean {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (isPlaceholderRedisUrl(redisUrl)) return false

  const enforce = process.env.GATEWAY_REDIS_ENFORCE?.trim()
  if (enforce === '1' || enforce === 'true') return true
  if (enforce === '0' || enforce === 'false') return false

  // Railway always-on single instance: remote Redis RTT (esp. cross-region) adds ~200–400ms/request.
  if (process.env.RAILWAY_ENVIRONMENT != null) return false

  return true
}

function createRedisClient(): RedisInterface {
  if (!shouldUseRealRedis()) {
    if (!globalForRedis.redisMockWarned) {
      globalForRedis.redisMockWarned = true
      const hasUrl = Boolean(process.env.REDIS_URL?.trim()) && !isPlaceholderRedisUrl(process.env.REDIS_URL)
      if (hasUrl && process.env.RAILWAY_ENVIRONMENT != null) {
        console.warn(
          'Railway fast path: in-memory Redis (rate/quota). Set GATEWAY_REDIS_ENFORCE=1 when Redis is in the same region as Railway.'
        )
      } else {
        console.warn('REDIS_URL is missing or placeholder, using mock Redis for development')
      }
    }
    return createMockRedis()
  }

  const redisUrl = process.env.REDIS_URL!.trim()
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: false,
    connectTimeout: 10_000,
    keepAlive: 30_000,
  })

  redis.on('error', () => {
    // Suppress connection errors in development
  })

  // Wrap real Redis to match our interface
  return {
    get: (key: string) => redis.get(key) as Promise<string | null>,
    set: (key: string, value: string) => redis.set(key, value) as Promise<string | null>,
    setex: (key: string, ttl: number, value: string) => redis.setex(key, ttl, value) as Promise<string | null>,
    zadd: (key: string, score: number, member: string) => redis.zadd(key, score, member),
    zrange: (key: string, start: number, stop: number) => redis.zrange(key, start, stop) as Promise<string[]>,
    zremrangebyscore: (key: string, min: number | string, max: number | string) => redis.zremrangebyscore(key, min, max) as Promise<number>,
    zrangebyscore: (key: string, min: number | string, max: number | string) => redis.zrangebyscore(key, min, max) as Promise<string[]>,
    eval: (script: string, numKeys: number, ...args: Array<string | number>) => {
      const redisArgs = [script, numKeys, ...args] as [string, number, ...Array<string | number>]
      return redis.eval(...redisArgs)
    },
    zcard: (key: string) => redis.zcard(key),
    expire: (key: string, seconds: number) => redis.expire(key, seconds),
    ping: () => redis.ping() as Promise<string>,
    quit: () => redis.quit() as Promise<string>,
    pipeline: () => {
      const p = redis.pipeline()
      return {
        zremrangebyscore: (key: string, min: number, max: number) => {
          p.zremrangebyscore(key, min, max)
          return p as unknown as RedisPipeline
        },
        zcard: (key: string) => {
          p.zcard(key)
          return p as unknown as RedisPipeline
        },
        zadd: (key: string, score: number, member: string) => {
          p.zadd(key, score, member)
          return p as unknown as RedisPipeline
        },
        expire: (key: string, seconds: number) => {
          p.expire(key, seconds)
          return p as unknown as RedisPipeline
        },
        exec: () => p.exec() as Promise<Array<[Error | null, unknown]>>,
      }
    },
  }
}

export const redis: RedisInterface = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

// Rate limiting using sorted sets
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(key, 0, windowStart)
  pipeline.zcard(key)
  pipeline.zadd(key, now, `${now}-${Math.random()}`)
  pipeline.expire(key, windowSeconds)

  const results = await pipeline.exec()

  if (!results || results.length < 2) {
    return { allowed: true, remaining: limit, resetAt: now + windowSeconds * 1000 }
  }

  const currentCount = (results[1]?.[1] as number) ?? 0

  if (currentCount >= limit) {
    const entries = await redis.zrange(key, 0, 0)
    const resetAt = entries.length >= 1
      ? parseInt(entries[0]?.split('-')[0] ?? '0') + windowSeconds * 1000
      : now + windowSeconds * 1000

    return { allowed: false, remaining: 0, resetAt }
  }

  return {
    allowed: true,
    remaining: limit - currentCount - 1,
    resetAt: now + windowSeconds * 1000,
  }
}

// Rolling token window for 5-hour budget
export async function checkTokenBudget(
  keyId: string,
  tokens: number,
  budget: bigint,
  windowSeconds: number = 5 * 60 * 60
): Promise<{ allowed: boolean; used: number; remaining: number; resetAt: number }> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  const rollingKey = `token_budget:${keyId}`

  await redis.zremrangebyscore(rollingKey, 0, windowStart)

  const entries = await redis.zrange(rollingKey, 0, -1)
  let currentUsage = 0

  for (const entry of entries) {
    const parts = String(entry).split(':')
    if (parts.length === 2) {
      currentUsage += parseInt(parts[1] ?? '0') || 0
    }
  }

  const totalUsage = currentUsage + tokens

  if (totalUsage > Number(budget)) {
    const entries = await redis.zrange(rollingKey, 0, 0)
    const resetAt = entries.length >= 1
      ? parseInt(entries[0]?.split(':')[0] ?? '0') + windowSeconds * 1000
      : now + windowSeconds * 1000

    return {
      allowed: false,
      used: currentUsage,
      remaining: 0,
      resetAt,
    }
  }

  await redis.zadd(rollingKey, now, `${now}:${tokens}`)
  await redis.expire(rollingKey, windowSeconds)

  return {
    allowed: true,
    used: totalUsage,
    remaining: Number(budget) - totalUsage,
    resetAt: now + windowSeconds * 1000,
  }
}

// Monthly token budget tracking
export async function getMonthlyUsage(keyId: string): Promise<number> {
  const entries = await redis.zrange(`monthly_tokens:${keyId}`, 0, -1)
  let total = 0

  for (const entry of entries) {
    total += parseInt(entry) || 0
  }

  return total
}

export async function addMonthlyUsage(keyId: string, tokens: number): Promise<void> {
  const now = Date.now()
  await redis.zadd(`monthly_tokens:${keyId}`, now, `${tokens}`)
  await redis.expire(`monthly_tokens:${keyId}`, 62 * 24 * 60 * 60)
}

// Cache helper
export async function cacheGet(key: string): Promise<string | null> {
  return redis.get(key)
}

export async function cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, value)
  } else {
    await redis.set(key, value)
  }
}
