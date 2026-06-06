/** Cloudflare Workers (OpenNext). Set OPUSX_RUNTIME=cloudflare in wrangler.jsonc vars. */
export const IS_CLOUDFLARE_RUNTIME =
  process.env.OPUSX_RUNTIME === 'cloudflare' ||
  process.env.CF_PAGES === '1' ||
  process.env.CLOUDFLARE_WORKERS === '1'

export function hasUpstashRestConfig(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  )
}

/** Prisma via @neondatabase/serverless HTTP driver (required on Cloudflare Workers). */
export function shouldUseNeonServerlessDriver(): boolean {
  const driver = process.env.GATEWAY_PRISMA_DRIVER?.trim()
  if (driver === 'neon') return true
  if (driver === 'default' || driver === 'native') return false
  return IS_CLOUDFLARE_RUNTIME && Boolean(process.env.DATABASE_URL?.trim())
}
