/**
 * Anthropic ↔ OpenAI format converter.
 *
 * When OpusX receives a request in Anthropic format (from Claude Code/Cursor),
 * and the target provider uses OpenAI-compatible format (MiniMax, Together, etc.),
 * this module converts the request body and response back transparently.
 */

// ─── Anthropic → OpenAI Request ───

interface AnthropicMessage {
  role: string
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>
}

interface OpenAIMessage {
  role: string
  content: string
}

export function anthropicToOpenAIRequest(body: Record<string, unknown>): Record<string, unknown> {
  const messages = body.messages as AnthropicMessage[] | undefined
  const system = body.system as string | Array<{ type: string; text?: string }> | undefined

  // Convert messages
  const openaiMessages: OpenAIMessage[] = []

  // Add system message if present
  if (system) {
    const systemText = typeof system === 'string'
      ? system
      : system.map(b => b.text || '').join('\n')
    if (systemText.trim()) {
      openaiMessages.push({ role: 'system', content: systemText })
    }
  }

  // Convert Anthropic messages to OpenAI format
  if (messages) {
    for (const msg of messages) {
      let content: string
      if (typeof msg.content === 'string') {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        // Extract text from content blocks
        content = msg.content
          .filter(block => block.type === 'text')
          .map(block => block.text || '')
          .join('\n')
      } else {
        content = String(msg.content || '')
      }
      openaiMessages.push({ role: msg.role, content })
    }
  }

  // Build OpenAI request
  const openaiBody: Record<string, unknown> = {
    model: body.model,
    messages: openaiMessages,
    stream: body.stream ?? false,
  }

  // Map parameters
  if (body.max_tokens != null) openaiBody.max_tokens = body.max_tokens
  if (body.temperature != null) openaiBody.temperature = body.temperature
  if (body.top_p != null) openaiBody.top_p = body.top_p
  if (body.stop_sequences != null) openaiBody.stop = body.stop_sequences

  return openaiBody
}

// ─── OpenAI → Anthropic Response (non-streaming) ───

export function openAIToAnthropicResponse(openaiResp: Record<string, unknown>): Record<string, unknown> {
  const choices = openaiResp.choices as Array<{ message?: { content?: string; role?: string }; finish_reason?: string }> | undefined
  const usage = openaiResp.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined
  const firstChoice = choices?.[0]

  return {
    id: openaiResp.id || `msg_${Date.now().toString(36)}`,
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: firstChoice?.message?.content || '',
      },
    ],
    model: openaiResp.model,
    stop_reason: mapFinishReason(firstChoice?.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens || 0,
      output_tokens: usage?.completion_tokens || 0,
    },
  }
}

// ─── OpenAI SSE → Anthropic SSE (streaming) ───

/**
 * Creates a TransformStream that converts OpenAI SSE chunks into Anthropic SSE format.
 * This allows Claude Code to receive responses in the format it expects.
 */
export function createOpenAIToAnthropicSSETransform(): TransformStream<Uint8Array, Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ''
  let sentMessageStart = false
  let sentContentBlockStart = false
  let inputTokens = 0
  let outputTokens = 0

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })

      let newlineIdx = buffer.indexOf('\n')
      while (newlineIdx !== -1) {
        const line = buffer.slice(0, newlineIdx).trim()
        buffer = buffer.slice(newlineIdx + 1)

        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          if (data === '[DONE]') {
            // Send message_stop
            const stopEvent = `event: message_stop\ndata: {"type":"message_stop"}\n\n`
            controller.enqueue(encoder.encode(stopEvent))
            return
          }

          try {
            const parsed = JSON.parse(data)
            const anthropicEvents = convertOpenAIChunkToAnthropic(parsed, {
              sentMessageStart, sentContentBlockStart, inputTokens, outputTokens,
            })

            for (const evt of anthropicEvents) {
              if (evt.type === 'message_start') sentMessageStart = true
              if (evt.type === 'content_block_start') sentContentBlockStart = true
              if (evt.usage) {
                inputTokens = evt.usage.input_tokens || inputTokens
                outputTokens = evt.usage.output_tokens || outputTokens
              }
              const sseData = `event: ${evt.type}\ndata: ${JSON.stringify(evt.data)}\n\n`
              controller.enqueue(encoder.encode(sseData))
            }
          } catch {
            // Skip unparseable chunks
          }
        }

        newlineIdx = buffer.indexOf('\n')
      }
    },
    flush(controller) {
      // Send final message_delta with usage
      if (sentMessageStart) {
        const deltaEvent = `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":${outputTokens}}}\n\n`
        controller.enqueue(encoder.encode(deltaEvent))
        const stopEvent = `event: message_stop\ndata: {"type":"message_stop"}\n\n`
        controller.enqueue(encoder.encode(stopEvent))
      }
    },
  })
}

interface ConvertState {
  sentMessageStart: boolean
  sentContentBlockStart: boolean
  inputTokens: number
  outputTokens: number
}

interface AnthropicSSEEvent {
  type: string
  data: Record<string, unknown>
  usage?: { input_tokens?: number; output_tokens?: number }
}

function convertOpenAIChunkToAnthropic(
  chunk: Record<string, unknown>,
  state: ConvertState
): AnthropicSSEEvent[] {
  const events: AnthropicSSEEvent[] = []
  const choices = chunk.choices as Array<{ delta?: { content?: string; role?: string }; finish_reason?: string | null }> | undefined
  const usage = chunk.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined

  // Send message_start on first chunk
  if (!state.sentMessageStart) {
    events.push({
      type: 'message_start',
      data: {
        type: 'message_start',
        message: {
          id: chunk.id || `msg_${Date.now().toString(36)}`,
          type: 'message',
          role: 'assistant',
          content: [],
          model: chunk.model || 'unknown',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: usage?.prompt_tokens || 0, output_tokens: 0 },
        },
      },
      usage: { input_tokens: usage?.prompt_tokens || 0 },
    })
  }

  const firstChoice = choices?.[0]
  const deltaContent = firstChoice?.delta?.content

  // Send content_block_start before first text
  if (deltaContent && !state.sentContentBlockStart) {
    events.push({
      type: 'content_block_start',
      data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    })
  }

  // Send text delta
  if (deltaContent) {
    events.push({
      type: 'content_block_delta',
      data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: deltaContent } },
    })
  }

  // Handle finish
  if (firstChoice?.finish_reason) {
    events.push({
      type: 'content_block_stop',
      data: { type: 'content_block_stop', index: 0 },
    })
  }

  if (usage?.completion_tokens) {
    events[events.length - 1] = {
      ...events[events.length - 1]!,
      usage: { output_tokens: usage.completion_tokens },
    }
  }

  return events
}

function mapFinishReason(reason: string | undefined | null): string {
  switch (reason) {
    case 'stop': return 'end_turn'
    case 'length': return 'max_tokens'
    case 'content_filter': return 'end_turn'
    default: return 'end_turn'
  }
}
