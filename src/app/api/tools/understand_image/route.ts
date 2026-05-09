import { NextRequest, NextResponse } from 'next/server'
import { ErrorCodes, createErrorResponse } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { validateActiveApiKeyFromRequest } from '@/lib/api-key-auth'
import { z } from 'zod'

const understandImageSchema = z.object({
  image_url: z.string().url().optional(),
  image_data: z.string().optional(),
  prompt: z.string().min(1),
  model: z.string().optional(),
})

function parseDataUrl(input: string): { mediaType: string; data: string } | null {
  const match = input.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return {
    mediaType: match[1] || 'image/jpeg',
    data: match[2] || '',
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateActiveApiKeyFromRequest(request)
    if (!auth.ok) return auth.response
    const key = auth.key

    const body = await request.json()
    const validatedBody = understandImageSchema.parse(body)

    // Validate that at least one image source is provided
    if (!validatedBody.image_url && !validatedBody.image_data) {
      return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Either image_url or image_data is required', 400)
    }

    const model = validatedBody.model || 'claude-3-5-sonnet-latest'
    const upstreamUrl = (process.env.UPSTREAM_ANTHROPIC_BASE_URL || 'https://api.anthropic.com')
      .trim()
      .replace(/\/+$/, '')
    const messagesUrl = upstreamUrl.endsWith('/v1')
      ? `${upstreamUrl}/messages`
      : `${upstreamUrl}/v1/messages`

    let imageBlock: Record<string, unknown>
    if (validatedBody.image_data) {
      const parsed = parseDataUrl(validatedBody.image_data)
      imageBlock = parsed
        ? {
            type: 'image',
            source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data },
          }
        : {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: validatedBody.image_data,
            },
          }
    } else {
      imageBlock = {
        type: 'image',
        source: {
          type: 'url',
          url: validatedBody.image_url,
        },
      }
    }

    const upstreamResponse = await fetch(messagesUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: [imageBlock, { type: 'text', text: validatedBody.prompt }],
          },
        ],
      }),
    })

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text()
      console.error('Understand image upstream error:', text)
      return createErrorResponse(ErrorCodes.UPSTREAM_ERROR, 'Failed to understand image', 502)
    }

    const data = (await upstreamResponse.json()) as {
      id?: string
      model?: string
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
      stop_reason?: string
    }

    const description = (data.content || [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n\n')

    // Update last used
    prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(console.error)

    return NextResponse.json({
      prompt: validatedBody.prompt,
      description: description || 'No description generated',
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

    console.error('Understand image error:', error)
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