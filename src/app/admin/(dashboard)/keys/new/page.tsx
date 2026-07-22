'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, Loader2, Sparkles } from 'lucide-react'
import { API_BASE_URL } from '@/lib/deploy-config'

function extractErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value

  if (typeof value === 'object' && value !== null) {
    const maybeMessage = (value as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage

    if (typeof maybeMessage === 'object' && maybeMessage !== null) {
      const nested = (maybeMessage as { message?: unknown }).message
      if (typeof nested === 'string' && nested.trim()) return nested
    }
  }

  return fallback
}

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 disabled:opacity-60'

const labelClass = 'text-xs font-medium uppercase tracking-[0.16em] text-white/55'

/** `datetime-local` is wall-clock local; do not use `toISOString().slice(0, 16)` (that is UTC). */
function minDatetimeLocalFromNow(leadMs: number): string {
  const d = new Date(Date.now() + leadMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NewApiKeyPage() {
  const [name, setName] = useState('')
  const [rpmLimit, setRpmLimit] = useState('')
  const [hourlyBudget, setHourlyBudget] = useState('')
  const [limitPlan, setLimitPlan] = useState<'custom' | 'max5x' | 'max20x'>('custom')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [warning, setWarning] = useState('')

  const rpmValue = rpmLimit.trim() ? Number(rpmLimit) : null
  const hourlyValue = hourlyBudget.trim() ? Number(hourlyBudget) : null

  function validateBeforeSubmit(): string | null {
    if (!name.trim()) return 'Name is required'
    if (name.trim().length > 80) return 'Name must be at most 80 characters'
    if (rpmValue !== null && (!Number.isInteger(rpmValue) || rpmValue <= 0 || rpmValue > 10000)) {
      return 'RPM must be an integer between 1 and 10000'
    }
    if (hourlyValue !== null && (!Number.isInteger(hourlyValue) || hourlyValue < 0)) {
      return 'Hourly budget must be a non-negative integer'
    }
    if (expiresAt) {
      const dt = new Date(expiresAt)
      if (Number.isNaN(dt.getTime())) return 'Expiration date is invalid'
      if (dt.getTime() <= Date.now()) return 'Expiration must be in the future'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validateBeforeSubmit()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')
    setWarning('')

    try {
      const response = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          rpmLimit: rpmLimit.trim() ? parseInt(rpmLimit, 10) : undefined,
          hourlyTokenBudget: hourlyBudget.trim() || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(extractErrorMessage(data.error, 'Failed to create API key'))
        return
      }

      setNewKey(data.rawKey)
      if (typeof data.warning === 'string' && data.warning.trim()) {
        setWarning(data.warning)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copyKey() {
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (newKey) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="grad-border glass-strong relative overflow-hidden rounded-2xl p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display tracking-display text-xl font-semibold text-white">
                API key created
              </h2>
              <p className="text-sm text-white/65">
                Copy this key now — for security we won&apos;t show it again.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 font-mono text-sm text-white/90 break-all">
            {newKey}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={copyKey}
              className="btn-grad inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
            <Link
              href="/admin/keys"
              className="btn-ghost-glass inline-flex h-10 items-center rounded-full px-4 text-sm font-medium"
            >
              View all keys
            </Link>
            <button
              type="button"
              onClick={() => {
                setNewKey('')
                setName('')
                setRpmLimit('')
                setHourlyBudget('')
                setLimitPlan('custom')
                setExpiresAt('')
                setError('')
                setWarning('')
              }}
              className="btn-ghost-glass inline-flex h-10 items-center rounded-full px-4 text-sm font-medium"
            >
              Create another key
            </button>
          </div>

          {warning && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
              {warning}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300" />
            <div>
              <p className="text-sm font-medium text-amber-200">Important</p>
              <p className="mt-1 text-sm text-amber-200/80">
                Store this API key securely. If you lose it you&apos;ll need to create a new one.
              </p>
            </div>
          </div>
        </div>

        <div className="glass mt-6 rounded-2xl border border-cyan-500/20 p-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">CLI Setup</p>
          <p className="mt-2 text-sm text-white/65">
            Configure Claude Code or other tools with the official CLI:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-cyan-100">
            npx opusmaxx setup
          </pre>
          <p className="mt-4 text-xs text-white/50">Or set manually:</p>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-white/80">
{`ANTHROPIC_BASE_URL=${API_BASE_URL}
ANTHROPIC_API_KEY=${newKey}`}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/keys"
        className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to API keys
      </Link>

      <div className="mt-4">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">New key</p>
        <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">
          Create API key
        </h1>
        <p className="mt-1 text-white/65">Set name and optional limits. Key is shown only once.</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <PreviewChip label="RPM" value={rpmValue === null ? 'Default (60)' : rpmValue.toLocaleString()} />
        <PreviewChip
          label="Hourly budget"
          value={hourlyValue === null ? 'No limit' : hourlyValue.toLocaleString()}
        />
        <PreviewChip label="Plan preset" value={limitPlan === 'custom' ? 'Custom' : limitPlan === 'max5x' ? 'Max 5x Plan' : 'Max 20x Plan'} />
      </div>

      <div className="grad-border glass-strong mt-6 rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="name" className={labelClass}>
              Name *
            </label>
            <input
              id="name"
              placeholder="e.g. Production Gateway Key"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              className={fieldClass}
            />
            <p className="text-xs text-white/45">A descriptive name to identify this key.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="limitPlan" className={labelClass}>Window plan</label>
              <select
                id="limitPlan"
                value={limitPlan}
                onChange={(e) => {
                  const next = e.target.value as 'custom' | 'max5x' | 'max20x'
                  setLimitPlan(next)
                  if (next === 'max5x') setHourlyBudget('5000000')
                  if (next === 'max20x') setHourlyBudget('20000000')
                  if (next === 'custom') setHourlyBudget('')
                }}
                className={fieldClass}
              >
                <option value="custom">Custom</option>
                <option value="max5x">Max 5x Plan (5M / 5h)</option>
                <option value="max20x">Max 20x Plan (20M / 5h)</option>
              </select>
              <p className="text-xs text-white/45">Preset only affects 5-hour window limit.</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rpmLimit" className={labelClass}>RPM limit</label>
              <input
                id="rpmLimit"
                type="number"
                min={1}
                max={10000}
                step={1}
                placeholder="60"
                value={rpmLimit}
                onChange={(e) => setRpmLimit(e.target.value)}
                className={fieldClass}
              />
              <p className="text-xs text-white/45">Leave empty to use default RPM = 60.</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="expiresAt" className={labelClass}>Expires at</label>
              <input
                id="expiresAt"
                type="datetime-local"
                min={minDatetimeLocalFromNow(60_000)}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={fieldClass}
              />
              <p className="text-xs text-white/45">Optional. Must be a future date/time.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="hourlyBudget" className={labelClass}>
                Hourly token budget (5h)
              </label>
              <input
                id="hourlyBudget"
                type="number"
                min={0}
                step={1}
                placeholder="100000"
                value={hourlyBudget}
                onChange={(e) => {
                  setHourlyBudget(e.target.value)
                  if (limitPlan !== 'custom') setLimitPlan('custom')
                }}
                className={fieldClass}
              />
              <p className="text-xs text-white/45">This is the only token budget enforced.</p>
            </div>
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm text-cyan-100/90">
              Monthly limit is disabled.
              <br />
              Window resets automatically every 5 hours from first usage in the active window.
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn-grad inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  Create API key <Sparkles className="h-4 w-4" />
                </>
              )}
            </button>
            <Link
              href="/admin/keys"
              className="btn-ghost-glass inline-flex h-10 items-center rounded-full px-4 text-sm font-medium"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

function PreviewChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  )
}
