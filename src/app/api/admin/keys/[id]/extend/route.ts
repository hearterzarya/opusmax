import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth'
import { ensureSameOrigin } from '@/lib/csrf'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { invalidateApiKeyCache } from '@/lib/api-key-auth'
import { calculateRemainingDays, getApiKeyStatus, ONE_DAY_MS } from '@/lib/api-key-status'

const MAX_EXTENSION_DAYS = 365

const bodySchema = z.object({
  days: z.coerce.number().int().min(1).max(MAX_EXTENSION_DAYS),
  // When extending a lifetime (no-expiry) key, the admin must explicitly opt in
  // to converting it into an expiry-based key.
  convertLifetime: z.boolean().optional(),
})

/**
 * POST /api/admin/keys/:id/extend
 * Body: { days: number, convertLifetime?: boolean }
 *
 * Extension rules:
 * - active key:   newExpiry = currentExpiry + days
 * - expired key:  newExpiry = now + days  (and reactivates the key)
 * - lifetime key: requires convertLifetime=true, then newExpiry = now + days
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const originError = ensureSameOrigin(request)
    if (originError) return originError

    const session = await getAdminSession()
    if (!session) {
      return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)
    }

    const { id } = await params
    if (!id) {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Key id is required', 400)
    }

    const { days, convertLifetime } = bodySchema.parse(await request.json())

    const existing = await prisma.apiKey.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, expiresAt: true, keyHash: true },
    })
    if (!existing) {
      return createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key not found', 404)
    }
    if (existing.status === 'REVOKED') {
      return createErrorResponse(ErrorCodes.KEY_INACTIVE, 'Revoked keys cannot be extended', 409)
    }

    const now = Date.now()
    const oldExpiryMs = existing.expiresAt ? existing.expiresAt.getTime() : null
    const extensionMs = days * ONE_DAY_MS

    let newExpiryMs: number
    if (oldExpiryMs == null) {
      // Lifetime key — only extend if admin explicitly confirmed conversion.
      if (!convertLifetime) {
        return createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'This key has no expiry (lifetime). Confirm conversion to an expiry-based key to extend it.',
          409
        )
      }
      newExpiryMs = now + extensionMs
    } else if (oldExpiryMs <= now) {
      // Expired — restart from now.
      newExpiryMs = now + extensionMs
    } else {
      // Active — add to the existing expiry.
      newExpiryMs = oldExpiryMs + extensionMs
    }

    const newExpiry = new Date(newExpiryMs)
    // Extending always (re)activates a non-paused key.
    const nextStatus = existing.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'

    const updated = await prisma.apiKey.update({
      where: { id },
      data: { expiresAt: newExpiry, status: nextStatus },
      select: { id: true, name: true, status: true, expiresAt: true },
    })

    prisma.auditLog
      .create({
        data: {
          adminId: session.id,
          action: 'EXTEND_API_KEY',
          details: {
            keyId: updated.id,
            keyName: updated.name,
            days,
            oldExpiry: oldExpiryMs ? new Date(oldExpiryMs).toISOString() : null,
            newExpiry: newExpiry.toISOString(),
            convertedFromLifetime: oldExpiryMs == null,
          },
        },
      })
      .catch((error) => console.warn('Audit log write failed:', error))

    await invalidateApiKeyCache(existing.keyHash).catch(() => undefined)

    const statusInfo = getApiKeyStatus(updated.expiresAt, updated.status, now)

    return NextResponse.json({
      success: true,
      message: 'API key extended successfully',
      oldExpiry: oldExpiryMs ? new Date(oldExpiryMs).toISOString() : null,
      newExpiry: newExpiry.toISOString(),
      remainingDays: calculateRemainingDays(newExpiry, now),
      status: statusInfo.status,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((i) => i.message).join(', ')
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, `Invalid request: ${message}`, 400)
    }
    console.error('Extend API key failed:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}
