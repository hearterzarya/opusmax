import { NextRequest, NextResponse } from 'next/server'
import { ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { validateActiveApiKeyFromRequest } from '@/lib/api-key-auth'
import { z } from 'zod'

const webSearchSchema = z.object({
  query: z.string().min(1),
  model: z.string().optional(),
  max_results: z.number().int().min(1).max(10).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await validateActiveApiKeyFromRequest(request)
    if (!auth.ok) return auth.response
    const key = auth.key

    const body = await request.json()
    const validatedBody = webSearchSchema.parse(body)

    const model = validatedBody.model || 'claude-3-5-sonnet-latest'
    const maxResults = validatedBody.max_results ?? 5
    const upstreamUrl = (process.env.UPSTREAM_ANTHROPIC_BASE_URL || 'https://api.anthropic.com')
      .trim()
      .replace(/\/+$/, '')
    const messagesUrl = upstreamUrl.endsWith('/v1')
      ? `${upstreamUrl}/messages`
      : `${upstreamUrl}/v1/messages`

    const upstreamResponse = await fetch(messagesUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        // Enables Anthropic first-party web search tool.
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system:
          'You are a web research assistant. Use the web_search tool and return concise, factual results with URLs.',
        messages: [
          {
            role: 'user',
            content: `Search the web for: "${validatedBody.query}". Return top ${maxResults} results with title, URL, and one-line summary.`,
          },
        ],
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 2,
          },
        ],
      }),
    })

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text()
      console.error('Web search upstream error:', text)
      return createErrorResponse(ErrorCodes.UPSTREAM_ERROR, 'Failed to run web search', 502)
    }

    const data = (await upstreamResponse.json()) as {
      id?: string
      model?: string
      content?: Array<{ type: string; text?: string }>
      stop_reason?: string
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    const text = (data.content || [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n\n')

    // Update last used
    prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(console.error)

    return NextResponse.json({
      query: validatedBody.query,
      answer: text || 'No web search answer generated',
      model: data.model || model,
      usage: data.usage || null,
      stop_reason: data.stop_reason || null,
      request_id: data.id || null,
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((i) => i.message).join(', ')
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, `Invalid request body: ${message}`, 400)
    }

    console.error('Web search error:', error)
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