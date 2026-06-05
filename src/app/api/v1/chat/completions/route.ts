import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { API_CORS_HEADERS, apiOptionsResponse } from '@/lib/api-cors'
import {
  anthropicJsonToOpenAIChat,
  createOpenAIStreamTransform,
  openaiChatToAnthropic,
  openaiError,
  type OpenAIChatRequest,
} from '@/lib/openai-chat-completions'
import { POST as messagesPost } from '../../messages/route'

function forwardHeaders(request: NextRequest): Headers {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')

  const apiKey = request.headers.get('x-api-key')
  const auth = request.headers.get('authorization')
  if (apiKey) headers.set('x-api-key', apiKey)
  if (auth) headers.set('authorization', auth)

  const version = request.headers.get('anthropic-version')
  if (version) headers.set('anthropic-version', version)

  return headers
}

/** OpenAI-compatible chat completions for LobeHub and other OpenAI-mode clients. */
export async function POST(request: NextRequest) {
  let body: OpenAIChatRequest
  try {
    body = (await request.json()) as OpenAIChatRequest
  } catch {
    return NextResponse.json(openaiError('Invalid JSON body', 400), {
      status: 400,
      headers: API_CORS_HEADERS,
    })
  }

  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(openaiError('model and messages are required', 400), {
      status: 400,
      headers: API_CORS_HEADERS,
    })
  }

  const anthropicPayload = openaiChatToAnthropic(body)
  const proxyRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: forwardHeaders(request),
    body: JSON.stringify(anthropicPayload),
  })

  const proxyResponse = await messagesPost(proxyRequest)
  if (!proxyResponse) {
    return NextResponse.json(openaiError('Gateway handler returned no response', 500), {
      status: 500,
      headers: API_CORS_HEADERS,
    })
  }

  const completionId = `chatcmpl-${randomUUID()}`

  if (body.stream && proxyResponse.body) {
    const contentType = proxyResponse.headers.get('content-type') ?? ''
    if (contentType.includes('text/event-stream')) {
      const transformed = proxyResponse.body.pipeThrough(
        createOpenAIStreamTransform(body.model, completionId)
      )
      return new NextResponse(transformed, {
        status: proxyResponse.status,
        headers: {
          ...API_CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }
  }

  const data = (await proxyResponse.json().catch(() => ({}))) as Record<string, unknown>

  if (!proxyResponse.ok) {
    const err = data.error as { message?: string } | undefined
    return NextResponse.json(
      openaiError(err?.message ?? 'Upstream request failed', proxyResponse.status),
      { status: proxyResponse.status, headers: API_CORS_HEADERS }
    )
  }

  return NextResponse.json(anthropicJsonToOpenAIChat(data, body.model), {
    status: proxyResponse.status,
    headers: API_CORS_HEADERS,
  })
}

export async function OPTIONS() {
  return apiOptionsResponse('POST, OPTIONS')
}
