import { NextRequest, NextResponse } from 'next/server'
import { ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { validateActiveApiKeyFromRequest } from '@/lib/api-key-auth'
import { upstreamModelsListUrl } from '@/lib/upstream-anthropic'

export async function GET(request: NextRequest) {
  try {
    const auth = await validateActiveApiKeyFromRequest(request)
    if (!auth.ok) return auth.response
    const key = auth.key

    const upstreamKey = (process.env.ANTHROPIC_API_KEY || '').trim()
    if (!upstreamKey) {
      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        'Server misconfigured: ANTHROPIC_API_KEY is missing on the gateway (set it in Vercel env)',
        500
      )
    }

    const modelsUrl = upstreamModelsListUrl(process.env.UPSTREAM_ANTHROPIC_BASE_URL)
    const upstreamResponse = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'x-api-key': upstreamKey,
        'anthropic-version': '2023-06-01',
      },
    })

    if (!upstreamResponse.ok) {
      let preview = ''
      try {
        preview = (await upstreamResponse.text()).slice(0, 280)
      } catch {
        /* ignore */
      }
      console.error('[models] upstream', upstreamResponse.status, modelsUrl, preview)
      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        `Anthropic models request failed (${upstreamResponse.status}). On Vercel set ANTHROPIC_API_KEY and UPSTREAM_ANTHROPIC_BASE_URL=https://api.anthropic.com (no /v1 double path).`,
        502,
        { upstream_status: upstreamResponse.status, upstream_body_preview: preview || undefined }
      )
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