import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hashApiKey, ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { isApiKeyPastExpiry } from '@/lib/api-key-expiry'
import { cacheGet, cacheSet } from '@/lib/redis'

const KEY_CACHE_PREFIX = 'api_key_auth:v1:'
const KEY_CACHE_TTL_SECONDS = 60

export type ValidatedApiKey = {
  id: string
  status: string
  expiresAt: Date | null
  rpmLimit: number
  hourlyTokenBudget: bigint | null
}

type CachedApiKeyRow = {
  id: string
  status: string
  expiresAt: string | null
  rpmLimit: number
  hourlyTokenBudget: string | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P1001'
  }
  return (
    error instanceof Error &&
    (error.message.includes("Can't reach database server") || error.message.includes('P1001'))
  )
}

function serializeKeyRow(key: ValidatedApiKey): CachedApiKeyRow {
  return {
    id: key.id,
    status: key.status,
    expiresAt: key.expiresAt ? key.expiresAt.toISOString() : null,
    rpmLimit: key.rpmLimit,
    hourlyTokenBudget: key.hourlyTokenBudget?.toString() ?? null,
  }
}

function deserializeKeyRow(row: CachedApiKeyRow): ValidatedApiKey {
  return {
    id: row.id,
    status: row.status,
    expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
    rpmLimit: row.rpmLimit,
    hourlyTokenBudget: row.hourlyTokenBudget ? BigInt(row.hourlyTokenBudget) : null,
  }
}

export async function invalidateApiKeyCache(keyHash: string): Promise<void> {
  await cacheSet(`${KEY_CACHE_PREFIX}${keyHash}`, 'invalidated', 1)
}

async function loadKeyFromDatabase(keyHash: string): Promise<ValidatedApiKey | null> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const key = await prisma.apiKey.findUnique({
        where: { keyHash },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          rpmLimit: true,
          hourlyTokenBudget: true,
        },
      })
      lastError = null
      return key
    } catch (error) {
      lastError = error
      if (!isDatabaseUnavailableError(error) || attempt === 1) {
        throw error
      }
      await sleep(300)
    }
  }

  if (lastError) throw lastError
  return null
}

async function resolveApiKeyRecord(keyHash: string): Promise<ValidatedApiKey | null> {
  const cacheKey = `${KEY_CACHE_PREFIX}${keyHash}`
  const cached = await cacheGet(cacheKey)
  if (cached && cached !== 'invalidated') {
    try {
      return deserializeKeyRow(JSON.parse(cached) as CachedApiKeyRow)
    } catch {
      /* fall through to DB */
    }
  }

  const key = await loadKeyFromDatabase(keyHash)
  if (!key) {
    return null
  }

  await cacheSet(cacheKey, JSON.stringify(serializeKeyRow(key)), KEY_CACHE_TTL_SECONDS)
  return key
}

export function extractAuthKey(request: NextRequest): string | null {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) return apiKey

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)

  return null
}

async function validateKeyRecord(
  key: ValidatedApiKey
): Promise<
  | { ok: true; key: ValidatedApiKey }
  | { ok: false; response: Response }
> {
  if (key.status === 'REVOKED') {
    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.KEY_INACTIVE, 'API key has been revoked', 403),
    }
  }
  if (key.status === 'PAUSED') {
    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.KEY_INACTIVE, 'API key is paused', 403),
    }
  }

  if (isApiKeyPastExpiry(key.expiresAt)) {
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { status: 'EXPIRED' },
    })
    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.KEY_EXPIRED, 'API key has expired', 403, {
        expires_at: key.expiresAt ? key.expiresAt.toISOString() : null,
        hint:
          'Create keys in the same deployment as ANTHROPIC_BASE_URL. Clear expiry: pnpm db:clear-key-expiry',
      }),
    }
  }

  if (key.status === 'EXPIRED') {
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { status: 'ACTIVE' },
    })
    return { ok: true, key: { ...key, status: 'ACTIVE' } }
  }

  return { ok: true, key }
}

export async function validateActiveApiKeyFromRequest(request: NextRequest): Promise<
  | { ok: true; key: ValidatedApiKey }
  | { ok: false; response: Response }
> {
  const rawKey = extractAuthKey(request)
  if (!rawKey) {
    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key required', 401),
    }
  }

  try {
    const keyHash = await hashApiKey(rawKey)
    const key = await resolveApiKeyRecord(keyHash)

    if (!key) {
      return {
        ok: false,
        response: createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key not found', 401),
      }
    }

    return validateKeyRecord(key)
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return {
        ok: false,
        response: createErrorResponse(
          ErrorCodes.DATABASE_UNAVAILABLE,
          'Database is temporarily unavailable. Please try again shortly.',
          503
        ),
      }
    }
    throw error
  }
}
