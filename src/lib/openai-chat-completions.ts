import { randomUUID } from 'node:crypto'

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function'
  content?: string | null | Array<{ type?: string; text?: string }>
}

export type OpenAIChatRequest = {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  max_tokens?: number
  temperature?: number
  top_p?: number
}

function messageContentToString(content: OpenAIMessage['content']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export function openaiChatToAnthropic(body: OpenAIChatRequest) {
  const systemText = body.messages
    .filter((m) => m.role === 'system')
    .map((m) => messageContentToString(m.content))
    .filter(Boolean)
    .join('\n')

  const messages = body.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: messageContentToString(m.content),
    }))
    .filter((m) => m.content.length > 0)

  return {
    model: body.model,
    max_tokens: body.max_tokens ?? 1024,
    stream: body.stream ?? false,
    messages,
    ...(systemText ? { system: systemText } : {}),
    ...(body.temperature != null ? { temperature: body.temperature } : {}),
    ...(body.top_p != null ? { top_p: body.top_p } : {}),
  }
}

export function anthropicJsonToOpenAIChat(data: Record<string, unknown>, model: string) {
  const text = Array.isArray(data.content)
    ? (data.content as Array<{ type?: string; text?: string }>)
        .filter((part) => part.type === 'text' || part.text)
        .map((part) => part.text ?? '')
        .join('')
    : ''

  const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined

  return {
    id: typeof data.id === 'string' ? data.id : `chatcmpl-${randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        finish_reason: mapStopReason(data.stop_reason),
        message: {
          role: 'assistant',
          content: text,
        },
      },
    ],
    ...(usage
      ? {
          usage: {
            prompt_tokens: usage.input_tokens ?? 0,
            completion_tokens: usage.output_tokens ?? 0,
            total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          },
        }
      : {}),
  }
}

function mapStopReason(reason: unknown): string {
  if (reason === 'end_turn') return 'stop'
  if (reason === 'max_tokens') return 'length'
  if (typeof reason === 'string') return reason
  return 'stop'
}

export function openaiError(message: string, status: number) {
  return {
    error: {
      message,
      type: status === 401 ? 'invalid_api_key' : 'api_error',
      code: status,
    },
  }
}

export function createOpenAIStreamTransform(
  model: string,
  completionId: string
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let sentRole = false

  const emit = (payload: Record<string, unknown>) =>
    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (line.startsWith('data:')) {
          const dataPart = line.slice(5).trim()
          if (!dataPart || dataPart === '[DONE]') {
            newlineIndex = buffer.indexOf('\n')
            continue
          }
          try {
            const event = JSON.parse(dataPart) as Record<string, unknown>
            const type = event.type

            if (type === 'content_block_delta') {
              const delta = event.delta as { type?: string; text?: string } | undefined
              if (delta?.type === 'text_delta' && delta.text) {
                if (!sentRole) {
                  sentRole = true
                  controller.enqueue(
                    emit({
                      id: completionId,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model,
                      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
                    })
                  )
                }
                controller.enqueue(
                  emit({
                    id: completionId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [{ index: 0, delta: { content: delta.text }, finish_reason: null }],
                  })
                )
              }
            }

            if (type === 'message_delta') {
              const delta = event.delta as { stop_reason?: string } | undefined
              controller.enqueue(
                emit({
                  id: completionId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason: mapStopReason(delta?.stop_reason),
                    },
                  ],
                })
              )
            }
          } catch {
            /* ignore malformed SSE JSON */
          }
        }
        newlineIndex = buffer.indexOf('\n')
      }
    },
    flush(controller) {
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    },
  })
}
