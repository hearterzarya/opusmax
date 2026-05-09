import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashApiKey, ErrorCodes, createErrorResponse } from '@/lib/apikey'

export function extractAuthKey(request: NextRequest): string | null {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) return apiKey

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)

  return null
}

export async function validateActiveApiKeyFromRequest(request: NextRequest): Promise<
  | { ok: true; key: { id: string; status: string; expiresAt: Date | null; rpmLimit: number; hourlyTokenBudget: bigint | null } }
  | { ok: false; response: Response }
> {
  const rawKey = extractAuthKey(request)
  if (!rawKey) {
    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key required', 401),
    }
  }

  const keyHash = await hashApiKey(rawKey)
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

  if (!key) {
    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key not found', 401),
    }
  }
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
  if (key.status === 'EXPIRED' || (key.expiresAt && new Date(key.expiresAt) < new Date())) {
    return {
      ok: false,
      response: createErrorResponse(ErrorCodes.KEY_EXPIRED, 'API key has expired', 403),
    }
  }

  return { ok: true, key }
}
