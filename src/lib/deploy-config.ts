/**
 * Public URLs for docs, CLI snippets, and client setup.
 *
 * Vercel (default): no env needed — falls back to opusxmax.vercel.app
 * Railway hybrid: set NEXT_PUBLIC_RAILWAY_API_URL on Vercel build so docs show the fast API endpoint
 * Railway service: set NEXT_PUBLIC_API_BASE_URL on Railway to its own origin (/api)
 */

const DEFAULT_SITE_ORIGIN = 'https://opusxmax.vercel.app'

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export const SITE_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    DEFAULT_SITE_ORIGIN
)

/** Primary API base shown in docs (Vercel default unchanged). */
export const API_BASE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? `${SITE_ORIGIN}/api`
)

export const API_V1_URL = `${API_BASE_URL}/v1`

export const DOCS_URL = `${SITE_ORIGIN}/docs`

/**
 * Optional fast API origin (Railway). Set on Vercel so docs/admin can link to it
 * without changing the default Vercel API behavior.
 * Example: https://api-opusx.up.railway.app/api or https://api.yourdomain.com/api
 */
export const RAILWAY_API_BASE_URL = process.env.NEXT_PUBLIC_RAILWAY_API_URL
  ? trimTrailingSlash(process.env.NEXT_PUBLIC_RAILWAY_API_URL)
  : null

/** Runtime API base when this process runs on Railway (for /api/v1 discovery). */
export function resolveRuntimeApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL)
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api`
  }
  return API_BASE_URL
}

export const IS_RAILWAY_RUNTIME = process.env.RAILWAY_ENVIRONMENT != null
