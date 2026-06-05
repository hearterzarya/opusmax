import { NextRequest, NextResponse } from 'next/server'
import { ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { validateActiveApiKeyFromRequest } from '@/lib/api-key-auth'
import { upstreamCountTokensUrl } from '@/lib/upstream-anthropic'
import { getUpstreamApiKey, upstreamFetch } from '@/lib/upstream-fetch'
import { z } from 'zod'

const countTokensSchema = z
  .object({
    model: z.string().min(1),
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.union([z.string(), z.array(z.any())]),
      })
    ),
    system: z.union([z.string(), z.array(z.any())]).optional(),
  })
  .passthrough()

export async function POST(request: NextRequest) {
  try {
    const auth = await validateActiveApiKeyFromRequest(request)
    if (!auth.ok) return auth.response
    const key = auth.key

    const body = await request.json()
    const validatedBody = countTokensSchema.parse(body)

    const upstreamKey = getUpstreamApiKey()
    if (!upstreamKey) {
      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        'Server misconfigured: ANTHROPIC_API_KEY is missing on the gateway',
        500
      )
    }

    const countUrl = upstreamCountTokensUrl(process.env.UPSTREAM_ANTHROPIC_BASE_URL)
    const upstreamResponse = await upstreamFetch(countUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': upstreamKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(validatedBody),
    })

    if (!upstreamResponse.ok) {
      return createErrorResponse(ErrorCodes.UPSTREAM_ERROR, 'Failed to count tokens', 502)
    }

    const data = await upstreamResponse.json()

    // Update last used
    prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(console.error)

    return NextResponse.json(data)

  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((i) => i.message).join(', ')
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Invalid request body: ${message}`,
        400
      )
    }

    console.error('Count tokens error:', error)
    return createErrorResponse(ErrorCodes.UPSTREAM_ERROR, 'An error occurred', 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  })
}