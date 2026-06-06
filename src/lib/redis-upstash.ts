import { Redis as UpstashRedis } from '@upstash/redis'
import type { RedisInterface, RedisPipeline } from '@/lib/redis-types'

type UpstashScoreBound = number | '-inf' | '+inf'

function toUpstashScoreBound(value: number | string): UpstashScoreBound {
  if (value === '-inf' || value === '-Infinity') return '-inf'
  if (value === '+inf' || value === '+Infinity' || value === 'Infinity') return '+inf'
  return Number(value)
}

function getClient(): UpstashRedis {
  const url = process.env.UPSTASH_REDIS_REST_URL!.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!.trim()
  return new UpstashRedis({ url, token })
}

export function createUpstashRedis(): RedisInterface {
  const client = getClient()

  return {
    get: async (key: string) => {
      const value = await client.get<string>(key)
      return value ?? null
    },
    set: async (key: string, value: string) => {
      await client.set(key, value)
      return null
    },
    setex: async (key: string, ttl: number, value: string) => {
      await client.set(key, value, { ex: ttl })
      return null
    },
    zadd: async (key: string, score: number, member: string) => {
      const added = await client.zadd(key, { score, member })
      return added ?? 0
    },
    zrange: async (key: string, start: number, stop: number) => {
      const result = await client.zrange(key, start, stop)
      return (result ?? []).map(String)
    },
    zremrangebyscore: async (key: string, min: number | string, max: number | string) => {
      return client.zremrangebyscore(key, toUpstashScoreBound(min), toUpstashScoreBound(max))
    },
    zrangebyscore: async (key: string, min: number | string, max: number | string) => {
      const result = await client.zrange(key, toUpstashScoreBound(min), toUpstashScoreBound(max), {
        byScore: true,
      })
      return (result ?? []).map(String)
    },
    zcard: async (key: string) => client.zcard(key),
    expire: async (key: string, seconds: number) => client.expire(key, seconds),
    ping: async () => {
      const reply = await client.ping()
      return typeof reply === 'string' ? reply : 'PONG'
    },
    quit: async () => 'OK',
    eval: async (script: string, numKeys: number, ...args: Array<string | number>) => {
      const keys = args.slice(0, numKeys).map(String)
      const argv = args.slice(numKeys).map(String)
      return client.eval(script, keys, argv)
    },
    pipeline: () => {
      const p = client.pipeline()
      const pipelineApi: RedisPipeline = {
        zremrangebyscore: (key: string, min: number, max: number) => {
          p.zremrangebyscore(key, min, max)
          return pipelineApi
        },
        zcard: (key: string) => {
          p.zcard(key)
          return pipelineApi
        },
        zadd: (key: string, score: number, member: string) => {
          p.zadd(key, { score, member })
          return pipelineApi
        },
        expire: (key: string, seconds: number) => {
          p.expire(key, seconds)
          return pipelineApi
        },
        exec: async () => {
          const results = await p.exec()
          if (!results) return []
          return results.map((value) => [null, value] as [Error | null, unknown])
        },
      }
      return pipelineApi
    },
  }
}
