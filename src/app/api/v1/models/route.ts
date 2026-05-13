import { NextRequest, NextResponse } from 'next/server'
import { ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { validateActiveApiKeyFromRequest } from '@/lib/api-key-auth'
import { upstreamModelsListUrl } from '@/lib/upstream-anthropic'
import { getAnthropicModelsListFallback } from '@/lib/anthropic-models-fallback'

function mergeAnthropicModelsPayload(upstreamBody: unknown): unknown {
  const merge =
    process.env.GATEWAY_MERGE_MODEL_FALLBACK !== '0' &&
    process.env.GATEWAY_MERGE_MODEL_FALLBACK !== 'false'

  if (!merge) return upstreamBody

  const fb = getAnthropicModelsListFallback()
  const fbRows = fb.data as Array<Record<string, unknown>>

  if (!upstreamBody || typeof upstreamBody !== 'object') {
    return fb
  }

  const obj = upstreamBody as {
    data?: unknown[]
    first_id?: string
    last_id?: string
    has_more?: boolean
  }

  const upstreamData = Array.isArray(obj.data) ? obj.data : []

  const idOf = (row: unknown): string | null => {
    if (row && typeof row === 'object' && 'id' in row) {
      const id = (row as { id: unknown }).id
      return typeof id === 'string' ? id : null
    }
    return null
  }

  const seen = new Set<string>()
  for (const row of upstreamData) {
    const id = idOf(row)
    if (id) seen.add(id)
  }

  const merged = [...upstreamData]
  for (const row of fbRows) {
    const id = typeof row.id === 'string' ? row.id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    merged.push(row)
  }

  return {
    ...obj,
    data: merged,
  }
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

    const upstreamKey = (process.env.ANTHROPIC_API_KEY || '').trim()
    if (!upstreamKey) {
      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        'Server misconfigured: ANTHROPIC_API_KEY is missing on the gateway (set it in Vercel env)',
        500
      )
    }

    const baseModelsUrl = upstreamModelsListUrl(process.env.UPSTREAM_ANTHROPIC_BASE_URL)
    const search = request.nextUrl.search
    const modelsUrl = search ? `${baseModelsUrl}${search}` : baseModelsUrl

    const upstreamResponse = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'x-api-key': upstreamKey,
        'anthropic-version': '2023-06-01',
      },
    })

    const bumpLastUsed = () => {
      prisma.apiKey
        .update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(console.error)
    }

    if (!upstreamResponse.ok) {
      let preview = ''
      try {
        preview = (await upstreamResponse.text()).slice(0, 280)
      } catch {
        /* ignore */
      }
      console.error('[models] upstream', upstreamResponse.status, modelsUrl, preview)

      const fallbackDisabled = process.env.GATEWAY_DISABLE_MODELS_FALLBACK === '1'
      if (!fallbackDisabled) {
        bumpLastUsed()
        const body = getAnthropicModelsListFallback()
        return NextResponse.json(body, {
          headers: {
            ...corsHeaders,
            'x-opusx-models': 'fallback',
            'x-opusx-upstream-status': String(upstreamResponse.status),
          },
        })
      }

      return createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        `Anthropic models request failed (${upstreamResponse.status}). Set ANTHROPIC_API_KEY on Vercel or unset GATEWAY_DISABLE_MODELS_FALLBACK to allow a built-in model list.`,
        502,
        { upstream_status: upstreamResponse.status, upstream_body_preview: preview || undefined }
      )
    }

    let data: unknown
    try {
      data = await upstreamResponse.json()
    } catch {
      console.error('[models] upstream returned non-JSON')
      if (process.env.GATEWAY_DISABLE_MODELS_FALLBACK === '1') {
        return createErrorResponse(
          ErrorCodes.UPSTREAM_ERROR,
          'Upstream models response was not valid JSON',
          502
        )
      }
      bumpLastUsed()
      return NextResponse.json(getAnthropicModelsListFallback(), {
        headers: { ...corsHeaders, 'x-opusx-models': 'fallback', 'x-opusx-upstream-status': 'invalid-json' },
      })
    }

    bumpLastUsed()
    const merged = mergeAnthropicModelsPayload(data)
    return NextResponse.json(merged, { headers: corsHeaders })
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
