import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth'
import { ensureSameOrigin } from '@/lib/csrf'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { invalidateApiKeyCache } from '@/lib/api-key-auth'
import { resetRollingWindowQuota } from '@/lib/quota'
import {
  PLAN_BUDGETS,
  calculateRemainingDays,
  detectPlan,
  getApiKeyStatus,
  isPlanName,
  ONE_DAY_MS,
} from '@/lib/api-key-status'

const bodySchema = z.object({
  newPlan: z.string().trim().min(1),
  keepSameExpiry: z.boolean().optional().default(true),
  resetUsage: z.boolean().optional().default(false),
  customValidityDays: z
    .union([z.coerce.number().int().min(1).max(3650), z.null()])
    .optional()
    .default(null),
})

/**
 * POST /api/admin/keys/:id/convert-plan
 * Body: { newPlan, keepSameExpiry?, resetUsage?, customValidityDays? }
 *
 * Keeps the SAME api key. Only updates plan-related settings (hourly token
 * budget). Optionally resets the 5-hour usage window and/or sets a new expiry.
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

    const { newPlan, keepSameExpiry, resetUsage, customValidityDays } = bodySchema.parse(
      await request.json()
    )

    if (!isPlanName(newPlan)) {
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Unknown plan "${newPlan}". Valid plans: 5X, 20X.`,
        400
      )
    }

    const existing = await prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        expiresAt: true,
        keyHash: true,
        hourlyTokenBudget: true,
      },
    })
    if (!existing) {
      return createErrorResponse(ErrorCodes.INVALID_API_KEY, 'API key not found', 404)
    }
    if (existing.status === 'REVOKED') {
      return createErrorResponse(ErrorCodes.KEY_INACTIVE, 'Revoked keys cannot be converted', 409)
    }

    const oldPlan = detectPlan(existing.hourlyTokenBudget)
    const newBudget = PLAN_BUDGETS[newPlan]

    const now = Date.now()
    let nextExpiry = existing.expiresAt
    if (!keepSameExpiry && customValidityDays != null) {
      nextExpiry = new Date(now + customValidityDays * ONE_DAY_MS)
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        hourlyTokenBudget: newBudget,
        expiresAt: nextExpiry,
        // Converting reactivates an expired key only when a fresh validity is set.
        status:
          existing.status === 'EXPIRED' && nextExpiry && nextExpiry.getTime() > now
            ? 'ACTIVE'
            : existing.status,
      },
      select: { id: true, name: true, status: true, expiresAt: true, hourlyTokenBudget: true },
    })

    if (resetUsage) {
      await resetRollingWindowQuota(existing.id).catch((err) =>
        console.warn('Quota reset during plan conversion failed:', err)
      )
    }

    prisma.auditLog
      .create({
        data: {
          adminId: session.id,
          action: 'CONVERT_API_KEY_PLAN',
          details: {
            keyId: updated.id,
            keyName: updated.name,
            oldPlan,
            newPlan,
            oldBudget: existing.hourlyTokenBudget?.toString() ?? null,
            newBudget: newBudget.toString(),
            keepSameExpiry,
            resetUsage,
            customValidityDays,
            expiresAt: updated.expiresAt?.toISOString() ?? null,
          },
        },
      })
      .catch((error) => console.warn('Audit log write failed:', error))

    await invalidateApiKeyCache(existing.keyHash).catch(() => undefined)

    const statusInfo = getApiKeyStatus(updated.expiresAt, updated.status, now)

    return NextResponse.json({
      success: true,
      message: 'Plan converted successfully',
      oldPlan,
      newPlan,
      apiKeyId: updated.id,
      status: statusInfo.status,
      expiresAt: updated.expiresAt?.toISOString() ?? null,
      remainingDays: calculateRemainingDays(updated.expiresAt, now),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((i) => i.message).join(', ')
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, `Invalid request: ${message}`, 400)
    }
    console.error('Convert plan failed:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}
