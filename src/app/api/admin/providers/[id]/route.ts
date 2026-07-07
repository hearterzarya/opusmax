import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth'
import { ensureSameOrigin } from '@/lib/csrf'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'

const updateProviderSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  baseUrl: z.string().url().trim().optional(),
  authMethod: z.enum(['x-api-key', 'bearer', 'oauth', 'custom-header']).optional(),
  authHeaderName: z.string().trim().max(100).optional().nullable(),
  authValue: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  anthropicVersion: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const originError = ensureSameOrigin(request)
    if (originError) return originError

    const session = await getAdminSession()
    if (!session) return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)

    const { id } = await params
    const body = await request.json()
    const data = updateProviderSchema.parse(body)

    // Check exists
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "providers" WHERE "id" = ${id}
    `
    if (existing.length === 0) {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Provider not found', 404)
    }

    // If setting as default, unset others
    if (data.isDefault) {
      await prisma.$executeRaw`UPDATE "providers" SET "isDefault" = false WHERE "isDefault" = true`
    }

    // Build dynamic update
    const sets: string[] = []
    const now = new Date()

    if (data.displayName !== undefined) sets.push(`"displayName" = '${data.displayName.replace(/'/g, "''")}'`)
    if (data.baseUrl !== undefined) sets.push(`"baseUrl" = '${data.baseUrl.replace(/'/g, "''")}'`)
    if (data.authMethod !== undefined) sets.push(`"authMethod" = '${data.authMethod}'`)
    if (data.authHeaderName !== undefined) sets.push(`"authHeaderName" = ${data.authHeaderName ? `'${data.authHeaderName.replace(/'/g, "''")}'` : 'NULL'}`)
    if (data.authValue !== undefined) sets.push(`"authValue" = '${data.authValue.replace(/'/g, "''")}'`)
    if (data.isActive !== undefined) sets.push(`"isActive" = ${data.isActive}`)
    if (data.isDefault !== undefined) sets.push(`"isDefault" = ${data.isDefault}`)
    if (data.anthropicVersion !== undefined) sets.push(`"anthropicVersion" = ${data.anthropicVersion ? `'${data.anthropicVersion.replace(/'/g, "''")}'` : 'NULL'}`)
    if (data.notes !== undefined) sets.push(`"notes" = ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL'}`)

    if (sets.length === 0) {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Nothing to update', 400)
    }

    sets.push(`"updatedAt" = '${now.toISOString()}'`)

    await prisma.$executeRawUnsafe(`UPDATE "providers" SET ${sets.join(', ')} WHERE "id" = '${id}'`)

    return NextResponse.json({ success: true, message: 'Provider updated' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, error.issues.map(i => i.message).join(', '), 400)
    }
    console.error('Update provider error:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const originError = ensureSameOrigin(request)
    if (originError) return originError

    const session = await getAdminSession()
    if (!session) return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)

    const { id } = await params
    await prisma.$executeRaw`DELETE FROM "providers" WHERE "id" = ${id}`

    return NextResponse.json({ success: true, message: 'Provider deleted' })
  } catch (error) {
    console.error('Delete provider error:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}
