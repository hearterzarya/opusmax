/**
 * Whether an API key's expiresAt instant is strictly before "now".
 * Uses a small leeway so minor clock skew does not false-positive expire keys.
 */
const EXPIRY_LEEWAY_MS = 10_000

export function isApiKeyPastExpiry(expiresAt: Date | null | undefined): boolean {
  if (expiresAt == null) return false
  const t = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime()
  if (!Number.isFinite(t)) return false
  return t < Date.now() - EXPIRY_LEEWAY_MS
}
