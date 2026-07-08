import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { ensureSameOrigin } from '@/lib/csrf'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Anthropic models - sorted by cost (cheapest first)
const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-3-5', name: 'Claude 3.5 Haiku', cost: 'Cheapest', inputPer1M: '$0.25', outputPer1M: '$1.25' },
  { id: 'claude-haiku-4-5', name: 'Claude 4.5 Haiku', cost: 'Very Cheap', inputPer1M: '$0.50', outputPer1M: '$2.50' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', cost: 'Medium', inputPer1M: '$3', outputPer1M: '$15' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', cost: 'Medium', inputPer1M: '$3', outputPer1M: '$15' },
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', cost: 'Expensive', inputPer1M: '$15', outputPer1M: '$75' },
]

const updateSchema = z.object({
  enabled: z.boolean(),
  targetModel: z.string().trim().min(1).optional(),
  providerName: z.string().trim().optional(), // which provider to apply override to (empty = all)
})

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return createErrorResponse(ErrorCodes.AUTHENTICATION_ERROR, 'Unauthorized', 401)

    const settings = await prisma.$queryRaw<Array<{ key: string; value: string }>>`
      SELECT "key", "value" FROM "gateway_settings" WHERE "key" IN ('model_override_enabled', 'model_override_target', 'model_override_provider')
    `

    const map = new Map(settings.map(s => [s.key, s.value]))
    const enabled = map.get('model_override_enabled') === 'true'
    const targetModel = map.get('model_override_target') || null
    const providerName = map.get('model_override_provider') || null

    // Get active providers for the dropdown
    const providers = await prisma.$queryRaw<Array<{ name: string; displayName: string }>>`
      SELECT "name", "displayName" FROM "providers" WHERE "isActive" = true ORDER BY "isDefault" DESC, "createdAt" ASC
    `.catch(() => [] as Array<{ name: string; displayName: string }>)

    // Get last 24h token usage per model
    const usage = await prisma.$queryRaw<Array<{ model: string; total_input: bigint; total_output: bigint; total_tokens: bigint; request_count: bigint }>>`
      SELECT "model",
        SUM("inputTokens")::bigint as total_input,
        SUM("outputTokens")::bigint as total_output,
        SUM("totalTokens")::bigint as total_tokens,
        COUNT(*)::bigint as request_count
      FROM "usage_logs"
      WHERE "timestamp" >= NOW() - INTERVAL '24 hours'
      GROUP BY "model"
      ORDER BY SUM("totalTokens") DESC
    `

    return NextResponse.json({
      modelOverride: { enabled, targetModel, providerName },
      availableModels: ANTHROPIC_MODELS,
      providers: providers || [],
      usage24h: usage.map(u => ({
        model: u.model,
        inputTokens: Number(u.total_input),
        outputTokens: Number(u.total_output),
        totalTokens: Number(u.total_tokens),
        requests: Number(u.request_count),
      })),
    })
  } catch (error) {
    console.error('[model-router] Error:', error)
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
    const data = updateSchema.parse(body)

    const now = new Date()

    await prisma.$executeRaw`
      INSERT INTO "gateway_settings" ("key", "value", "updatedAt") VALUES ('model_override_enabled', ${String(data.enabled)}, ${now})
      ON CONFLICT ("key") DO UPDATE SET "value" = ${String(data.enabled)}, "updatedAt" = ${now}
    `

    if (data.targetModel) {
      await prisma.$executeRaw`
        INSERT INTO "gateway_settings" ("key", "value", "updatedAt") VALUES ('model_override_target', ${data.targetModel}, ${now})
        ON CONFLICT ("key") DO UPDATE SET "value" = ${data.targetModel}, "updatedAt" = ${now}
      `
    }

    const provName = data.providerName || ''
    await prisma.$executeRaw`
      INSERT INTO "gateway_settings" ("key", "value", "updatedAt") VALUES ('model_override_provider', ${provName}, ${now})
      ON CONFLICT ("key") DO UPDATE SET "value" = ${provName}, "updatedAt" = ${now}
    `

    return NextResponse.json({ success: true, enabled: data.enabled, targetModel: data.targetModel, providerName: data.providerName })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, error.issues.map(i => i.message).join(', '), 400)
    }
    console.error('[model-router] Error:', error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500)
  }
}
