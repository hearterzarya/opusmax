import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth'
import { ensureSameOrigin } from '@/lib/csrf'
import { createErrorResponse, ErrorCodes, generateKeyPair } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { resetRollingWindowQuota } from '@/lib/quota'

const patchBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('activate') }),
  z.object({ action: z.literal('revoke') }),
  z.object({ action: z.literal('reset_quota') }),
  z.object({ action: z.literal('rotate') }),
  z.object({ action: z.literal('delete') }),
  z.object({
    action: z.literal('set_expiry'),
    expiresAt: z.union([z.string().datetime(), z.null()]),
  }),
])

const actionToStatus = {
  pause: 'PAUSED',
  activate: 'ACTIVE',
  revoke: 'REVOKED',
} as const

export async function PATCH(
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

    const body = await request.json()
    const patch = patchBodySchema.parse(body)

    const existing = await prisma.apiKey.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    })
    if (!existing) {
      return createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key not found', 404)
    }

    // REVOKED is terminal.
    if (existing.status === 'REVOKED' && patch.action !== 'revoke') {
      return createErrorResponse(
        ErrorCodes.KEY_INACTIVE,
        'Revoked keys cannot be re-activated',
        409
      )
    }

    if (patch.action === 'set_expiry') {
      const nextExpires =
        patch.expiresAt === null ? null : new Date(patch.expiresAt)

      if (nextExpires && nextExpires.getTime() <= Date.now()) {
        return createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Expiration must be in the future, or use null to remove expiry',
          400
        )
      }

      const nextStatus = existing.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'

      const key = await prisma.apiKey.update({
        where: { id },
        data: {
          expiresAt: nextExpires,
          status: nextStatus,
        },
        select: { id: true, name: true, status: true, expiresAt: true },
      })

      prisma.auditLog
        .create({
          data: {
            adminId: session.id,
            action: 'SET_API_KEY_EXPIRY',
            details: {
              keyId: key.id,
              keyName: key.name,
              expiresAt: key.expiresAt?.toISOString() ?? null,
            },
          },
        })
        .catch((error) => console.warn('Audit log write failed:', error))

      return NextResponse.json({ success: true, key })
    }

    const action = patch.action

    if (action === 'reset_quota') {
      await resetRollingWindowQuota(existing.id)

      prisma.auditLog
        .create({
          data: {
            adminId: session.id,
            action: 'RESET_API_KEY_QUOTA_WINDOW',
            details: {
              keyId: existing.id,
              keyName: existing.name,
              previousStatus: existing.status,
              windowSeconds: 5 * 60 * 60,
            },
          },
        })
        .catch((error) => console.warn('Audit log write failed:', error))

      return NextResponse.json({ success: true, key: existing, quotaReset: true })
    }

    if (action === 'rotate') {
      if (existing.status === 'REVOKED') {
        return createErrorResponse(
          ErrorCodes.KEY_INACTIVE,
          'Revoked keys cannot be rotated',
          409
        )
      }

      const { raw, hash, prefix, last4 } = await generateKeyPair()
      const key = await prisma.apiKey.update({
        where: { id },
        data: {
          keyHash: hash,
          keyPrefix: prefix,
          keyFullLast4: last4,
          status: 'ACTIVE',
          lastUsedAt: null,
        },
        select: { id: true, name: true, status: true, keyPrefix: true },
      })

      prisma.auditLog
        .create({
          data: {
            adminId: session.id,
            action: 'ROTATE_API_KEY',
            details: {
              keyId: key.id,
              keyName: key.name,
              previousStatus: existing.status,
            },
          },
        })
        .catch((error) => console.warn('Audit log write failed:', error))

      return NextResponse.json({ success: true, key, rawKey: raw, rotated: true })
    }

    if (action === 'delete') {
      await prisma.apiKey.delete({ where: { id: existing.id } })

      prisma.auditLog
        .create({
          data: {
            adminId: session.id,
            action: 'DELETE_API_KEY',
            details: {
              keyId: existing.id,
              keyName: existing.name,
              previousStatus: existing.status,
            },
          },
        })
        .catch((error) => console.warn('Audit log write failed:', error))

      return NextResponse.json({ success: true, deleted: true, keyId: existing.id })
    }

    if (action !== 'pause' && action !== 'activate' && action !== 'revoke') {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid action', 400)
    }
    const nextStatus = actionToStatus[action]

    const key = await prisma.apiKey.update({
      where: { id },
      data: { status: nextStatus },
      select: { id: true, name: true, status: true },
    })

    prisma.auditLog
      .create({
        data: {
          adminId: session.id,
          action: `UPDATE_API_KEY_STATUS_${nextStatus}`,
          details: {
            keyId: key.id,
            keyName: key.name,
            previousStatus: existing.status,
            nextStatus,
          },
        },
      })
      .catch((error) => console.warn('Audit log write failed:', error))

    return NextResponse.json({ success: true, key })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((i) => i.message).join(', ')
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Invalid request body: ${message}`,
        400
      )
    }

    console.error('Error updating API key status:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}
