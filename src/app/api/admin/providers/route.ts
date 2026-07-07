import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth'
import { ensureSameOrigin } from '@/lib/csrf'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'

const createProviderSchema = z.object({
  name: z.string().trim().min(1).max(50).regex(/^[a-z0-9_-]+$/, 'Lowercase alphanumeric, dashes, underscores only'),
  displayName: z.string().trim().min(1).max(100),
  baseUrl: z.string().url().trim(),
  authMethod: z.enum(['x-api-key', 'bearer', 'oauth', 'custom-header']),
  authHeaderName: z.string().trim().max(100).optional().nullable(),
  authValue: z.string().trim().min(1),
  isActive: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
  anthropicVersion: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)

    let providers: Array<Record<string, unknown>> = []
    try {
      if (prisma.provider) {
        providers = await (prisma.provider as any).findMany({ orderBy: { createdAt: 'desc' } })
      } else {
        providers = await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT * FROM "providers" ORDER BY "createdAt" DESC
        `
      }
    } catch { providers = [] }

    // Mask auth values for security
    const masked = providers.map((p: any) => ({
      ...p,
      authValue: p.authValue ? `${String(p.authValue).slice(0, 10)}...${String(p.authValue).slice(-4)}` : '***',
    }))

    return NextResponse.json({ providers: masked })
  } catch (error) {
    console.error('Providers list error:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const originError = ensureSameOrigin(request)
    if (originError) return originError

    const session = await getAdminSession()
    if (!session) return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)

    const body = await request.json()
    const data = createProviderSchema.parse(body)

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.$executeRaw`UPDATE "providers" SET "isDefault" = false WHERE "isDefault" = true`
    }

    const now = new Date()
    const provider = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      INSERT INTO "providers" ("id", "name", "displayName", "baseUrl", "authMethod", "authHeaderName", "authValue", "isActive", "isDefault", "anthropicVersion", "notes", "createdAt", "updatedAt")
      VALUES (${`prov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`}, ${data.name}, ${data.displayName}, ${data.baseUrl}, ${data.authMethod}, ${data.authHeaderName ?? null}, ${data.authValue}, ${data.isActive}, ${data.isDefault}, ${data.anthropicVersion ?? '2023-06-01'}, ${data.notes ?? null}, ${now}, ${now})
      RETURNING "id", "name", "displayName", "baseUrl", "authMethod", "isActive", "isDefault", "createdAt"
    `

    return NextResponse.json({ success: true, provider: provider[0] })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, error.issues.map(i => i.message).join(', '), 400)
    }
    console.error('Create provider error:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}
