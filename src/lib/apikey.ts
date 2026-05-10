import crypto from 'crypto'
import { hashApiKey } from './utils'

// Re-export hashApiKey for backward compatibility
export { hashApiKey }

// Generate a new API key
export function generateApiKey(): string {
  const prefix = 'sk-ant-ox-'
  const randomPart = crypto.randomBytes(24).toString('base64url')
  return prefix + randomPart
}

// Extract prefix from API key (first 12 chars for display)
export function getKeyPrefix(key: string): string {
  if (key.length <= 12) return key
  return key.substring(0, 12)
}

// Extract last 4 characters
export function getKeyLast4(key: string): string {
  if (key.length < 4) return key
  return key.substring(key.length - 4)
}

// Validate API key format
export function isValidKeyFormat(key: string): boolean {
  return key.startsWith('sk-ant-ox-') && key.length >= 40
}

// Hash API key for storage
export async function hashKey(key: string): Promise<string> {
  return hashApiKey(key)
}

// Generate key pair (full key and hash)
export async function generateKeyPair(): Promise<{ raw: string; hash: string; prefix: string; last4: string }> {
  const raw = generateApiKey()
  const hash = await hashKey(raw)
  const prefix = getKeyPrefix(raw)
  const last4 = getKeyLast4(raw)

  return { raw, hash, prefix, last4 }
}

// Error types for API responses
export const ErrorCodes = {
  AUTHENTICATION_ERROR: 'authentication_error',
  INVALID_API_KEY: 'invalid_api_key',
  KEY_EXPIRED: 'key_expired',
  KEY_INACTIVE: 'key_inactive',
  DATABASE_UNAVAILABLE: 'database_unavailable',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  TOKEN_BUDGET_EXCEEDED: 'token_budget_exceeded',
  MONTHLY_BUDGET_EXCEEDED: 'monthly_budget_exceeded',
  UPSTREAM_ERROR: 'upstream_error',
  VALIDATION_ERROR: 'validation_error',
  INTERNAL_ERROR: 'internal_error',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

export interface ApiError {
  error: {
    type: ErrorCode
    message: string
    code?: number
  }
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode = 400,
  meta?: Record<string, unknown>
): Response {
  const body: Record<string, unknown> = {
    error: {
      type: code,
      message,
      code: statusCode,
    },
  }
  if (meta && Object.keys(meta).length > 0) {
    body.meta = meta
  }
  return Response.json(body, { status: statusCode })
}