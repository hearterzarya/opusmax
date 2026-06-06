export interface RedisPipeline {
  zremrangebyscore(key: string, min: number, max: number): RedisPipeline
  zcard(key: string): RedisPipeline
  zadd(key: string, score: number, member: string): RedisPipeline
  expire(key: string, seconds: number): RedisPipeline
  exec(): Promise<Array<[Error | null, unknown]>>
}

export interface RedisInterface {
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
