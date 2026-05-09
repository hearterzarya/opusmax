import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Compact number formatter: 1.2K, 3.4M, 1.5B …
 * Trims trailing ".0" so 5_000 → "5K" not "5.0K".
 */
export function compactNumber(num: number): string {
  if (!Number.isFinite(num)) return '—'
  const abs = Math.abs(num)
  const fmt = (v: number, suffix: string) => {
    const fixed = v.toFixed(1)
    return (fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed) + suffix
  }
  if (abs >= 1_000_000_000) return fmt(num / 1_000_000_000, 'B')
  if (abs >= 1_000_000) return fmt(num / 1_000_000, 'M')
  if (abs >= 1_000) return fmt(num / 1_000, 'K')
  return num.toString()
}

// Backwards-compatible alias.
export const formatNumber = compactNumber

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function generateApiKeyPrefix(): string {
  return 'sk-ant-ox-' + Math.random().toString(36).substring(2, 10)
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}