import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth'
import { ensureSameOrigin } from '@/lib/csrf'
import { createErrorResponse, ErrorCodes, generateKeyPair } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { resetRollingWindowQuota } from '@/lib/quota'

const patchSchema = z.object({
  action: z.enum(['pause', 'activate', 'revoke', 'reset_quota', 'rotate', 'delete']),
})

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
    const { action } = patchSchema.parse(body)

    const existing = await prisma.apiKey.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    })
    if (!existing) {
      return createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key not found', 404)
    }

    // REVOKED is terminal.
    if (existing.status === 'REVOKED' && action !== 'revoke') {
      return createErrorResponse(
        ErrorCodes.KEY_INACTIVE,
        'Revoked keys cannot be re-activated',
        409
      )
    }

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
