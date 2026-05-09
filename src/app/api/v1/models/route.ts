import { NextRequest, NextResponse } from 'next/server'
import { ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { validateActiveApiKeyFromRequest } from '@/lib/api-key-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await validateActiveApiKeyFromRequest(request)
    if (!auth.ok) return auth.response
    const key = auth.key

    // Forward to upstream Anthropic
    const upstreamUrl = process.env.UPSTREAM_ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
    const upstreamResponse = await fetch(`${upstreamUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
    })

    if (!upstreamResponse.ok) {
      return createErrorResponse(ErrorCodes.UPSTREAM_ERROR, 'Failed to fetch models from upstream', 502)
    }

    const data = await upstreamResponse.json()

    // Update last used
    prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(console.error)

    return NextResponse.json(data)

  } catch (error) {
    console.error('Models endpoint error:', error)
    return createErrorResponse(ErrorCodes.UPSTREAM_ERROR, 'An error occurred', 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  })
}