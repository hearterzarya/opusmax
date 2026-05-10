import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateKeyPair, ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { ensureSameOrigin } from '@/lib/csrf'
import { z } from 'zod'

const createKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  rpmLimit: z.coerce.number().int().positive().max(10000).optional(),
  hourlyTokenBudget: z.coerce.bigint().optional(),
  expiresAt: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      z.string().datetime().optional()
    )
    .optional(),
})

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)
    }

    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ keys })
  } catch (error) {
    console.error('Error fetching keys:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const originError = ensureSameOrigin(request)
    if (originError) return originError

    const session = await getAdminSession()
    if (!session) {
      return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)
    }

    const body = await request.json()
    const data = createKeySchema.parse(body)
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null

    if (expiresAt && !Number.isFinite(expiresAt.getTime())) {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid expiresAt value', 400)
    }

    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Expiration must be in the future',
        400
      )
    }

    // Generate new API key
    const { raw, hash, prefix, last4 } = await generateKeyPair()

    const key = await prisma.apiKey.create({
      data: {
        keyHash: hash,
        keyPrefix: prefix,
        keyFullLast4: last4,
        name: data.name,
        rpmLimit: data.rpmLimit ?? 60,
        hourlyTokenBudget: data.hourlyTokenBudget ?? 0n,
        monthlyTokenBudget: null,
        expiresAt,
      },
    })

    // Log admin action without blocking key creation.
    // If token claims become stale, resolve admin by email before writing.
    let auditLogWarning: string | null = null
    try {
      const admin = await prisma.adminUser.findUnique({
        where: { email: session.email },
        select: { id: true },
      })

      if (!admin) {
        console.warn('Audit log skipped: admin no longer exists for email', session.email)
      } else {
        await prisma.auditLog.create({
          data: {
            adminId: admin.id,
            action: 'CREATE_API_KEY',
            details: { keyId: key.id, name: data.name },
          },
        })
      }
    } catch (auditError) {
      console.warn('Audit log write failed after API key creation:', auditError)
      auditLogWarning = 'API key created, but audit logging failed'
    }

    return NextResponse.json({
      id: key.id,
      name: key.name,
      prefix: key.keyPrefix,
      rawKey: raw, // Only returned once!
      warning: auditLogWarning,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((i) => i.message).join(', ')
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Invalid request body: ${message}`,
        400
      )
    }

    console.error('Error creating key:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}