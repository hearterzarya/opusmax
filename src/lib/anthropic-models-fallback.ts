/**
 * Default Anthropic-compatible GET /v1/models payload for this gateway.
 * Served by default so clients (Cursor, Claude Desktop, etc.) always get a full picker
 * without depending on Anthropic's list endpoint.
 *
 * Optional: set GATEWAY_FETCH_UPSTREAM_MODELS=1 to replace rows with Anthropic's payload for
 * the same model ids (no extra models are appended).
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

/** Only these models are advertised and kept when merging upstream /v1/models. */
const FALLBACK_MODEL_ROWS: ReadonlyArray<{
  id: string
  name: string
  maxIn: number
  maxOut: number
}> = [
  { id: 'claude-opus-4-7', name: 'Opus 4.7', maxIn: 200_000, maxOut: 32_000 },
  { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', maxIn: 200_000, maxOut: 64_000 },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', maxIn: 200_000, maxOut: 64_000 },
]

function gatewayAllowedModelIds(): ReadonlySet<string> {
  return new Set(FALLBACK_MODEL_ROWS.map((r) => r.id))
}

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

function idOfModelRow(row: unknown): string | null {
  if (row && typeof row === 'object' && 'id' in row) {
    const id = (row as { id: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

/** Same rows and order as the default catalog; overwrite with upstream rows only for allowed ids. */
export function mergeDefaultModelsWithUpstream(
  defaultBody: Record<string, unknown>,
  upstreamBody: unknown
): Record<string, unknown> {
  const defaultData = Array.isArray(defaultBody.data)
    ? (defaultBody.data as Array<Record<string, unknown>>)
    : []
  const allowed = gatewayAllowedModelIds()
  let merged: Array<Record<string, unknown>> = [...defaultData]

  if (upstreamBody && typeof upstreamBody === 'object') {
    const upstreamData = (upstreamBody as { data?: unknown[] }).data
    if (Array.isArray(upstreamData)) {
      const upstreamById = new Map<string, Record<string, unknown>>()
      for (const row of upstreamData) {
        const id = idOfModelRow(row)
        if (!id || !allowed.has(id)) continue
        if (!row || typeof row !== 'object') continue
        upstreamById.set(id, row as Record<string, unknown>)
      }
      merged = merged.map((row) => {
        const id = idOfModelRow(row)
        if (!id) return row
        const u = upstreamById.get(id)
        return u ?? row
      })
    }
  }

  const ids = merged.map((m) => String(m.id))
  const out = {
    ...(upstreamBody && typeof upstreamBody === 'object' ? (upstreamBody as object) : defaultBody),
    data: merged,
    first_id: ids[0],
    last_id: ids[ids.length - 1],
    has_more: false,
  }
  return out
}
