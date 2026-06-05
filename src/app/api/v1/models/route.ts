import { NextRequest, NextResponse } from 'next/server'
import { ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { validateActiveApiKeyFromRequest } from '@/lib/api-key-auth'
import { upstreamModelsListUrl } from '@/lib/upstream-anthropic'
import { getUpstreamApiKey, upstreamFetch } from '@/lib/upstream-fetch'
import {
  getAnthropicModelsListFallback,
  mergeDefaultModelsWithUpstream,
} from '@/lib/anthropic-models-fallback'

function envTruthy(v: string | undefined): boolean {
  return v === '1' || v === 'true' || v === 'yes'
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

export async function GET(request: NextRequest) {
  try {
    const auth = await validateActiveApiKeyFromRequest(request)
    if (!auth.ok) return auth.response
    const key = auth.key

    const bumpLastUsed = () => {
      prisma.apiKey
        .update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(console.error)
    }

    const staticBody = getAnthropicModelsListFallback() as Record<string, unknown>
    const fetchUpstream = envTruthy(process.env.GATEWAY_FETCH_UPSTREAM_MODELS)
    const upstreamKey = getUpstreamApiKey()
    const disableStaticOnUpstreamFailure =
      process.env.GATEWAY_DISABLE_MODELS_FALLBACK === '1'

    if (!fetchUpstream) {
      bumpLastUsed()
      return NextResponse.json(staticBody, {
        headers: { ...corsHeaders, 'x-opusx-models': 'static' },
      })
    }

    if (!upstreamKey) {
      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        'GATEWAY_FETCH_UPSTREAM_MODELS is enabled but ANTHROPIC_API_KEY is missing on the gateway',
        500
      )
    }

    const baseModelsUrl = upstreamModelsListUrl(process.env.UPSTREAM_ANTHROPIC_BASE_URL)
    const search = request.nextUrl.search
    const modelsUrl = search ? `${baseModelsUrl}${search}` : baseModelsUrl

    const upstreamResponse = await upstreamFetch(modelsUrl, {
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

      if (disableStaticOnUpstreamFailure) {
        return createErrorResponse(
          ErrorCodes.UPSTREAM_ERROR,
          `Anthropic models request failed (${upstreamResponse.status}). Unset GATEWAY_DISABLE_MODELS_FALLBACK to allow the built-in catalog when upstream fails.`,
          502,
          { upstream_status: upstreamResponse.status, upstream_body_preview: preview || undefined }
        )
      }

      bumpLastUsed()
      return NextResponse.json(staticBody, {
        headers: {
          ...corsHeaders,
          'x-opusx-models': 'static',
          'x-opusx-upstream-status': String(upstreamResponse.status),
        },
      })
    }

    let data: unknown
    try {
      data = await upstreamResponse.json()
    } catch {
      console.error('[models] upstream returned non-JSON')
      if (disableStaticOnUpstreamFailure) {
        return createErrorResponse(
          ErrorCodes.UPSTREAM_ERROR,
          'Upstream models response was not valid JSON',
          502
        )
      }
      bumpLastUsed()
      return NextResponse.json(staticBody, {
        headers: {
          ...corsHeaders,
          'x-opusx-models': 'static',
          'x-opusx-upstream-status': 'invalid-json',
        },
      })
    }

    bumpLastUsed()
    const merged = mergeDefaultModelsWithUpstream(staticBody, data)
    return NextResponse.json(merged, {
      headers: { ...corsHeaders, 'x-opusx-models': 'merged' },
    })
  } catch (error) {
    console.error('Models endpoint error:', error)
    return createErrorResponse(ErrorCodes.UPSTREAM_ERROR, 'An error occurred', 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}
