/**
 * Build Anthropic REST URLs from UPSTREAM_ANTHROPIC_BASE_URL.
 * Accepts either `https://api.anthropic.com` or `https://api.anthropic.com/v1` (no double /v1).
 */
export const DEFAULT_ANTHROPIC_ORIGIN = 'https://api.anthropic.com'

export function resolveAnthropicV1Base(raw?: string | null): string {
  const trimmed = (raw?.trim() || DEFAULT_ANTHROPIC_ORIGIN).replace(/\/+$/, '')
  if (trimmed.endsWith('/v1')) return trimmed
  return `${trimmed}/v1`
}

export function upstreamModelsListUrl(raw?: string | null): string {
  return `${resolveAnthropicV1Base(raw)}/models`
}

export function upstreamMessagesUrl(raw?: string | null): string {
  return `${resolveAnthropicV1Base(raw)}/messages`
}

export function upstreamCountTokensUrl(raw?: string | null): string {
  return `${resolveAnthropicV1Base(raw)}/messages/count_tokens`
}
