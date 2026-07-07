/**
 * Dynamic Provider Resolver
 *
 * Reads the active default provider from the database and returns its
 * base URL + auth headers. Falls back to environment variables when no
 * DB provider is configured (backward compatible).
 *
 * Supports auth methods:
 * - x-api-key: standard Anthropic header
 * - bearer: Authorization: Bearer <token>  (ANTHROPIC_AUTH_TOKEN / CLAUDE_CODE_OAUTH_TOKEN)
 * - oauth: same as bearer
 * - custom-header: any header name + value
 */

import { prisma } from '@/lib/prisma'

export interface ResolvedProvider {
  name: string
  displayName: string
  baseUrl: string
  authHeaders: Record<string, string>
  anthropicVersion: string
}

interface ProviderRow {
  id: string
  name: string
  displayName: string
  baseUrl: string
  authMethod: string
  authHeaderName: string | null
  authValue: string
  anthropicVersion: string | null
}

/**
 * Resolve the upstream provider to use for a request.
 * Priority:
 * 1. Default active provider from DB
 * 2. Any active provider from DB
 * 3. Environment variables (ANTHROPIC_API_KEY + UPSTREAM_ANTHROPIC_BASE_URL)
 */
export async function resolveProvider(): Promise<ResolvedProvider | null> {
  try {
    // Try to get default provider first, then any active one
    const providers = await prisma.$queryRaw<ProviderRow[]>`
      SELECT "id", "name", "displayName", "baseUrl", "authMethod", "authHeaderName", "authValue", "anthropicVersion"
      FROM "providers"
      WHERE "isActive" = true
      ORDER BY "isDefault" DESC, "createdAt" ASC
      LIMIT 1
    `

    if (providers.length > 0) {
      const p = providers[0]!
      return {
        name: p.name,
        displayName: p.displayName,
        baseUrl: p.baseUrl.replace(/\/+$/, ''),
        authHeaders: buildAuthHeaders(p.authMethod, p.authValue, p.authHeaderName),
        anthropicVersion: p.anthropicVersion || '2023-06-01',
      }
    }
  } catch (err) {
    // DB might not have the providers table yet or query fails — fall through to env
    console.warn('[provider-resolver] DB query failed, falling back to env:', (err as Error).message?.slice(0, 100))
  }

  // Fallback: use environment variables (backward compatible)
  return resolveFromEnv()
}

function resolveFromEnv(): ResolvedProvider | null {
  // Support multiple env var names for the API key
  const apiKey = (
    process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.CLAUDE_CODE_OAUTH_TOKEN ||
    ''
  ).trim()

  if (!apiKey) return null

  const baseUrl = (process.env.UPSTREAM_ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '')

  // Determine auth method from the key format
  let authHeaders: Record<string, string>
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN) {
    // OAuth/Bearer style
    const token = (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN || '').trim()
    authHeaders = { 'Authorization': `Bearer ${token}` }
  } else {
    // Standard x-api-key
    authHeaders = { 'x-api-key': apiKey }
  }

  return {
    name: 'env-default',
    displayName: 'Environment Config',
    baseUrl,
    authHeaders,
    anthropicVersion: '2023-06-01',
  }
}

function buildAuthHeaders(method: string, value: string, customHeaderName: string | null): Record<string, string> {
  switch (method) {
    case 'bearer':
    case 'oauth':
      return { 'Authorization': `Bearer ${value}` }
    case 'custom-header':
      if (customHeaderName) {
        return { [customHeaderName]: value }
      }
      return { 'x-api-key': value }
    case 'x-api-key':
    default:
      return { 'x-api-key': value }
  }
}
