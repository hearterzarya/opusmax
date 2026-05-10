/**
 * Anthropic-compatible GET /v1/models payload when upstream list fails.
 * Lets clients (e.g. Claude Desktop) populate the model picker; chat still uses the server ANTHROPIC_API_KEY.
 *
 * Shape follows https://platform.claude.com/docs/en/api/models/list
 */
function cap(supported: boolean) {
  return { supported }
}

function modelEntry(
  id: string,
  displayName: string,
  maxInput: number,
  maxOut: number
): Record<string, unknown> {
  return {
    type: 'model',
    id,
    display_name: displayName,
    created_at: '2025-05-01T00:00:00Z',
    max_input_tokens: maxInput,
    max_tokens: maxOut,
    capabilities: {
      batch: cap(false),
      citations: cap(true),
      image_input: cap(true),
      pdf_input: cap(true),
      structured_outputs: cap(true),
    },
  }
}

export function getAnthropicModelsListFallback(): Record<string, unknown> {
  const data: Record<string, unknown>[] = [
    modelEntry('claude-opus-4-7', 'Claude Opus 4.7', 200_000, 32_000),
    modelEntry('claude-opus-4-5-20250514', 'Claude Opus 4.5', 200_000, 32_000),
    modelEntry('claude-sonnet-4-6', 'Claude Sonnet 4.6', 200_000, 64_000),
    modelEntry('claude-sonnet-4-20250514', 'Claude Sonnet 4', 200_000, 64_000),
    modelEntry('claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 200_000, 64_000),
    modelEntry('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 200_000, 8192),
    modelEntry('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 200_000, 8192),
  ]
  const ids = data.map((m) => String(m.id))
  return {
    data,
    first_id: ids[0],
    last_id: ids[ids.length - 1],
    has_more: false,
  }
}
