/**
 * Anthropic ↔ OpenAI format converter with FULL tool calling support.
 *
 * Handles:
 * - Text messages conversion
 * - Tool definitions (Anthropic tools ↔ OpenAI functions)
 * - Tool use (assistant calling tools)
 * - Tool results (user providing tool output)
 * - Streaming SSE conversion
 * - Multi-content blocks
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface AnthropicContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: string | Array<{ type: string; text?: string }>
  [key: string]: unknown
}

interface AnthropicMessage {
  role: string
  content: string | AnthropicContentBlock[]
}

interface AnthropicTool {
  name: string
  description?: string
  input_schema?: Record<string, unknown>
}

interface OpenAIMessage {
  role: string
  content?: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

// ═══════════════════════════════════════════════════════
// ANTHROPIC → OPENAI REQUEST
// ═══════════════════════════════════════════════════════

export function anthropicToOpenAIRequest(body: Record<string, unknown>): Record<string, unknown> {
  const messages = body.messages as AnthropicMessage[] | undefined
  const system = body.system as string | Array<{ type: string; text?: string }> | undefined
  const tools = body.tools as AnthropicTool[] | undefined
  const toolChoice = body.tool_choice as { type?: string } | undefined

  const openaiMessages: OpenAIMessage[] = []

  // System message
  if (system) {
    const systemText = typeof system === 'string'
      ? system
      : system.map(b => b.text || '').join('\n')
    if (systemText.trim()) {
      openaiMessages.push({ role: 'system', content: systemText })
    }
  }

  // Convert messages
  if (messages) {
    for (const msg of messages) {
      const converted = convertAnthropicMessageToOpenAI(msg)
      openaiMessages.push(...converted)
    }
  }

  // Build request
  const openaiBody: Record<string, unknown> = {
    model: body.model,
    messages: openaiMessages,
    stream: body.stream ?? false,
  }

  if (body.max_tokens != null) openaiBody.max_tokens = body.max_tokens
  if (body.temperature != null) openaiBody.temperature = body.temperature
  if (body.top_p != null) openaiBody.top_p = body.top_p
  if (body.stop_sequences != null) openaiBody.stop = body.stop_sequences

  // Convert tools
  if (tools && tools.length > 0) {
    openaiBody.tools = tools.map(convertAnthropicToolToOpenAI)
  }

  // Convert tool_choice
  if (toolChoice) {
    openaiBody.tool_choice = convertAnthropicToolChoiceToOpenAI(toolChoice)
  }

  return openaiBody
}

function convertAnthropicMessageToOpenAI(msg: AnthropicMessage): OpenAIMessage[] {
  // Simple text message
  if (typeof msg.content === 'string') {
    return [{ role: msg.role, content: msg.content }]
  }

  if (!Array.isArray(msg.content)) {
    return [{ role: msg.role, content: String(msg.content || '') }]
  }

  const blocks = msg.content as AnthropicContentBlock[]

  // Assistant message with tool_use blocks
  if (msg.role === 'assistant') {
    const textParts: string[] = []
    const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = []

    for (const block of blocks) {
      if (block.type === 'text' && block.text) {
        textParts.push(block.text)
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id || `call_${Date.now().toString(36)}`,
          type: 'function',
          function: {
            name: block.name || '',
            arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input || {}),
          },
        })
      }
    }

    const result: OpenAIMessage = {
      role: 'assistant',
      content: textParts.length > 0 ? textParts.join('\n') : null,
    }
    if (toolCalls.length > 0) result.tool_calls = toolCalls
    return [result]
  }

  // User message with tool_result blocks
  if (msg.role === 'user') {
    const results: OpenAIMessage[] = []
    const textParts: string[] = []

    for (const block of blocks) {
      if (block.type === 'text' && block.text) {
        textParts.push(block.text)
      } else if (block.type === 'tool_result') {
        // Convert tool_result to OpenAI tool message
        let content = ''
        if (typeof block.content === 'string') {
          content = block.content
        } else if (Array.isArray(block.content)) {
          content = block.content
            .filter(c => c.type === 'text')
            .map(c => c.text || '')
            .join('\n')
        }
        results.push({
          role: 'tool',
          tool_call_id: block.tool_use_id || '',
          content,
        })
      }
    }

    // If there's plain text, add it as a user message first
    if (textParts.length > 0) {
      results.unshift({ role: 'user', content: textParts.join('\n') })
    }

    return results.length > 0 ? results : [{ role: 'user', content: '' }]
  }

  // Other roles — extract text
  const text = blocks
    .filter(b => b.type === 'text')
    .map(b => b.text || '')
    .join('\n')
  return [{ role: msg.role, content: text }]
}

function convertAnthropicToolToOpenAI(tool: AnthropicTool): OpenAITool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema || { type: 'object', properties: {} },
    },
  }
}

function convertAnthropicToolChoiceToOpenAI(choice: { type?: string; name?: string }): unknown {
  switch (choice.type) {
    case 'auto': return 'auto'
    case 'any': return 'required'
    case 'none': return 'none'
    case 'tool':
      return { type: 'function', function: { name: choice.name } }
    default: return 'auto'
  }
}

// ═══════════════════════════════════════════════════════
// OPENAI → ANTHROPIC RESPONSE (non-streaming)
// ═══════════════════════════════════════════════════════

export function openAIToAnthropicResponse(openaiResp: Record<string, unknown>): Record<string, unknown> {
  const choices = openaiResp.choices as Array<{
    message?: { content?: string | null; role?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
    finish_reason?: string
  }> | undefined
  const usage = openaiResp.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined
  const firstChoice = choices?.[0]

  const content: AnthropicContentBlock[] = []

  // Add text content if present
  if (firstChoice?.message?.content) {
    content.push({ type: 'text', text: firstChoice.message.content })
  }

  // Convert tool_calls to Anthropic tool_use blocks
  if (firstChoice?.message?.tool_calls) {
    for (const call of firstChoice.message.tool_calls) {
      let input: unknown = {}
      try {
        input = JSON.parse(call.function.arguments)
      } catch {
        input = { raw: call.function.arguments }
      }
      content.push({
        type: 'tool_use',
        id: call.id,
        name: call.function.name,
        input,
      })
    }
  }

  // If no content at all, add empty text
  if (content.length === 0) {
    content.push({ type: 'text', text: '' })
  }

  const stopReason = mapFinishReason(firstChoice?.finish_reason)

  return {
    id: openaiResp.id || `msg_${Date.now().toString(36)}`,
    type: 'message',
    role: 'assistant',
    content,
    model: openaiResp.model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens || 0,
      output_tokens: usage?.completion_tokens || 0,
    },
  }
}

// ═══════════════════════════════════════════════════════
// OPENAI SSE → ANTHROPIC SSE (streaming with tool calls)
// ═══════════════════════════════════════════════════════

export function createOpenAIToAnthropicSSETransform(): TransformStream<Uint8Array, Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ''
  let sentMessageStart = false
  let contentBlockIndex = 0
  let currentToolCall: { id: string; name: string; arguments: string } | null = null
  let hasTextBlock = false
  let inputTokens = 0
  let outputTokens = 0

  function emit(controller: TransformStreamDefaultController<Uint8Array>, eventType: string, data: Record<string, unknown>) {
    controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`))
  }

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
            // Close any open blocks
            if (currentToolCall) {
              emit(controller, 'content_block_stop', { type: 'content_block_stop', index: contentBlockIndex })
              contentBlockIndex++
              currentToolCall = null
            }
            // message_delta + message_stop
            emit(controller, 'message_delta', {
              type: 'message_delta',
              delta: { stop_reason: 'end_turn', stop_sequence: null },
              usage: { output_tokens: outputTokens },
            })
            emit(controller, 'message_stop', { type: 'message_stop' })
            return
          }

          try {
            const parsed = JSON.parse(data)
            processOpenAIChunk(parsed, controller)
          } catch { /* skip */ }
        }

        newlineIdx = buffer.indexOf('\n')
      }
    },

    flush(controller) {
      if (currentToolCall) {
        emit(controller, 'content_block_stop', { type: 'content_block_stop', index: contentBlockIndex })
      }
      if (sentMessageStart) {
        emit(controller, 'message_delta', {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: outputTokens },
        })
        emit(controller, 'message_stop', { type: 'message_stop' })
      }
    },
  })

  function processOpenAIChunk(chunk: Record<string, unknown>, controller: TransformStreamDefaultController<Uint8Array>) {
    const choices = chunk.choices as Array<{
      delta?: { content?: string | null; role?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> }
      finish_reason?: string | null
    }> | undefined
    const usage = chunk.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined

    if (usage?.prompt_tokens) inputTokens = usage.prompt_tokens
    if (usage?.completion_tokens) outputTokens = usage.completion_tokens

    // Send message_start on first chunk
    if (!sentMessageStart) {
      sentMessageStart = true
      emit(controller, 'message_start', {
        type: 'message_start',
        message: {
          id: chunk.id || `msg_${Date.now().toString(36)}`,
          type: 'message',
          role: 'assistant',
          content: [],
          model: chunk.model || 'unknown',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: inputTokens, output_tokens: 0 },
        },
      })
    }

    const delta = choices?.[0]?.delta
    if (!delta) return

    // Text content
    if (delta.content) {
      if (!hasTextBlock) {
        hasTextBlock = true
        emit(controller, 'content_block_start', {
          type: 'content_block_start', index: contentBlockIndex,
          content_block: { type: 'text', text: '' },
        })
      }
      emit(controller, 'content_block_delta', {
        type: 'content_block_delta', index: contentBlockIndex,
        delta: { type: 'text_delta', text: delta.content },
      })
    }

    // Tool calls
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        // New tool call starting
        if (tc.id && tc.function?.name) {
          // Close previous blocks
          if (hasTextBlock && !currentToolCall) {
            emit(controller, 'content_block_stop', { type: 'content_block_stop', index: contentBlockIndex })
            contentBlockIndex++
            hasTextBlock = false
          }
          if (currentToolCall) {
            // Finish previous tool call input
            emit(controller, 'content_block_delta', {
              type: 'content_block_delta', index: contentBlockIndex,
              delta: { type: 'input_json_delta', partial_json: '' },
            })
            emit(controller, 'content_block_stop', { type: 'content_block_stop', index: contentBlockIndex })
            contentBlockIndex++
          }

          currentToolCall = { id: tc.id, name: tc.function.name, arguments: '' }
          emit(controller, 'content_block_start', {
            type: 'content_block_start', index: contentBlockIndex,
            content_block: { type: 'tool_use', id: tc.id, name: tc.function.name, input: {} },
          })
        }

        // Streaming tool call arguments
        if (tc.function?.arguments && currentToolCall) {
          currentToolCall.arguments += tc.function.arguments
          emit(controller, 'content_block_delta', {
            type: 'content_block_delta', index: contentBlockIndex,
            delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
          })
        }
      }
    }

    // Finish reason
    const finishReason = choices?.[0]?.finish_reason
    if (finishReason) {
      if (hasTextBlock && !currentToolCall) {
        emit(controller, 'content_block_stop', { type: 'content_block_stop', index: contentBlockIndex })
        contentBlockIndex++
      }
      if (currentToolCall) {
        emit(controller, 'content_block_stop', { type: 'content_block_stop', index: contentBlockIndex })
        contentBlockIndex++
        currentToolCall = null
      }

      const stopReason = mapFinishReason(finishReason)
      emit(controller, 'message_delta', {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: outputTokens },
      })
      emit(controller, 'message_stop', { type: 'message_stop' })
    }
  }
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function mapFinishReason(reason: string | undefined | null): string {
  switch (reason) {
    case 'stop': return 'end_turn'
    case 'length': return 'max_tokens'
    case 'tool_calls': return 'tool_use'
    case 'content_filter': return 'end_turn'
    default: return 'end_turn'
  }
}
