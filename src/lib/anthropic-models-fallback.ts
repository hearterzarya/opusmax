/**
 * Anthropic-compatible GET /v1/models payload when upstream list fails.
 * Lets clients (e.g. Cursor, Claude Desktop) populate the model picker.
 * Actual routing still uses your server's ANTHROPIC_API_KEY — only IDs your key can call will work upstream.
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

/** Ordered newest-ish first; deduped by id. Covers Claude 4.x, 3.7, 3.5, 3.x + common `-latest` aliases. */
const FALLBACK_MODEL_ROWS: ReadonlyArray<{
  id: string
  name: string
  maxIn: number
  maxOut: number
}> = [
  // Claude 4.x (aliases clients often request)
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', maxIn: 200_000, maxOut: 32_000 },
  { id: 'claude-opus-4-5-20250514', name: 'Claude Opus 4.5', maxIn: 200_000, maxOut: 32_000 },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', maxIn: 200_000, maxOut: 32_000 },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', maxIn: 200_000, maxOut: 64_000 },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', maxIn: 200_000, maxOut: 64_000 },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', maxIn: 200_000, maxOut: 64_000 },

  // Claude 3.7 Sonnet (some SDKs / previews)
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', maxIn: 200_000, maxOut: 64_000 },

  // Claude 3.5 (dated releases + latest aliases)
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (20241022)', maxIn: 200_000, maxOut: 8192 },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (20240620)', maxIn: 200_000, maxOut: 8192 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', maxIn: 200_000, maxOut: 8192 },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet (latest alias)', maxIn: 200_000, maxOut: 8192 },
  { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku (latest alias)', maxIn: 200_000, maxOut: 8192 },

  // Claude 3 family (legacy but still referenced)
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', maxIn: 200_000, maxOut: 4096 },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', maxIn: 200_000, maxOut: 4096 },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', maxIn: 200_000, maxOut: 4096 },
  { id: 'claude-3-opus-latest', name: 'Claude 3 Opus (latest alias)', maxIn: 200_000, maxOut: 4096 },
  { id: 'claude-3-sonnet-latest', name: 'Claude 3 Sonnet (latest alias)', maxIn: 200_000, maxOut: 4096 },
  { id: 'claude-3-haiku-latest', name: 'Claude 3 Haiku (latest alias)', maxIn: 200_000, maxOut: 4096 },

  // SDK / playground shorthand sometimes seen
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (short)', maxIn: 200_000, maxOut: 8192 },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku (short)', maxIn: 200_000, maxOut: 8192 },
]

export function getAnthropicModelsListFallback(): Record<string, unknown> {
  const seen = new Set<string>()
  const data: Record<string, unknown>[] = []

  for (const row of FALLBACK_MODEL_ROWS) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    data.push(modelEntry(row.id, row.name, row.maxIn, row.maxOut))
  }

  const ids = data.map((m) => String((m as { id: string }).id))
  return {
    data,
    first_id: ids[0],
    last_id: ids[ids.length - 1],
    has_more: false,
  }
}
