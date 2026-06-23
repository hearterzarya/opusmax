'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Hourglass,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { compactNumber } from '@/lib/utils'

interface UsageActivityRow {
  at: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  statusCode: number
  latencyMs: number
  errorType: string | null
}

interface KeyStatus {
  exists: boolean
  status: string | null
  quotaBlocked?: boolean
  name: string | null
  createdAt?: string | null
  expiresAt: string | null
  hourlyUsage: number | null
  hourlyBudget: number | null
  hourlyRemaining?: number | null
  windowResetAt: string | null
  windowStartedAt?: string | null
  // Fixed-window fields (backend is the single source of truth)
  resetAt?: string | null
  serverNow?: string | null
  timeRemainingMs?: number | null
  isQuotaReset?: boolean
  lastUsed: string | null
  rpmLimit: number | null
  requests24h?: number | null
  allTimeRequests?: number | null
  usageSource?: string
  activity?: UsageActivityRow[]
  recentRequests?: number | null
}

function extractErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'object' && value !== null) {
    const m = (value as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  return fallback
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function maskApiKey(key: string): string {
  if (!key) return '—'
  if (key.length <= 14) return key
  return `${key.slice(0, 13)}${'•'.repeat(10)}${key.slice(-4)}`
}

function StatusPill({ status, quotaBlocked }: { status: string | null; quotaBlocked?: boolean }) {
  if (quotaBlocked) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 text-xs font-medium text-rose-300">
        <XCircle className="h-3 w-3" /> Quota blocked
      </span>
    )
  }
  const s = status?.toLowerCase()
  if (s === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Active
      </span>
    )
  }
  if (s === 'paused') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
        <Hourglass className="h-3 w-3" /> Paused
      </span>
    )
  }
  if (s === 'expired' || s === 'revoked') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 text-xs font-medium text-rose-300">
        <XCircle className="h-3 w-3" /> {status}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium text-white/70">
      Unknown
    </span>
  )
}

export default function KeyStatusPage() {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [autoRefreshSec, setAutoRefreshSec] = useState<0 | 5 | 10 | 30>(5)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [changedPulse, setChangedPulse] = useState(false)
  const inflightRef = useRef<AbortController | null>(null)
  const prevStatusRef = useRef<KeyStatus | null>(null)
  // Offset between the server clock and this browser's clock (serverNow - clientNow).
  // Used so the countdown tracks the backend's absolute resetAt, never a locally
  // invented reset time. Prevents client/server time-mismatch drift.
  const serverOffsetRef = useRef<number>(0)
  const zeroRefetchedRef = useRef<boolean>(false)

  const checkKey = useCallback(async (opts?: { preserveStatus?: boolean }) => {
    if (!apiKey.trim()) {
      setError('Please enter an API key')
      return
    }

    const preserveStatus = Boolean(opts?.preserveStatus)
    if (preserveStatus) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)
    if (!preserveStatus) {
      setStatus(null)
    }

    inflightRef.current?.abort()
    const controller = new AbortController()
    inflightRef.current = controller

    try {
      const response = await fetch(`/api/key-status?key=${encodeURIComponent(apiKey.trim())}`, {
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok) {
        setError(extractErrorMessage(data?.error, 'Failed to check key status'))
        return
      }
      const previous = prevStatusRef.current
      const next = data as KeyStatus
      // Sync server clock offset so the countdown uses backend time, not local time.
      if (typeof next.serverNow === 'string') {
        const serverNowMs = new Date(next.serverNow).getTime()
        if (Number.isFinite(serverNowMs)) {
          serverOffsetRef.current = serverNowMs - Date.now()
        }
      }
      // Allow a fresh single refetch when the next countdown reaches zero.
      zeroRefetchedRef.current = false
      const changed =
        !previous ||
        previous.hourlyUsage !== next.hourlyUsage ||
        previous.windowResetAt !== next.windowResetAt ||
        previous.requests24h !== next.requests24h ||
        previous.lastUsed !== next.lastUsed ||
        (previous.activity?.[0]?.at ?? '') !== (next.activity?.[0]?.at ?? '')
      prevStatusRef.current = next
      setStatus(next)
      setLastUpdatedAt(Date.now())
      if (preserveStatus && changed) {
        setChangedPulse(true)
        window.setTimeout(() => setChangedPulse(false), 550)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError('Network error. Please try again.')
    } finally {
      if (preserveStatus) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [apiKey])

  async function copyKey() {
    if (!apiKey.trim()) return
    try {
      await navigator.clipboard.writeText(apiKey.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard not available
    }
  }

  const usageStats = useMemo(() => {
    if (!status || status.hourlyUsage === null || status.hourlyBudget === null || status.hourlyBudget <= 0) {
      return null
    }
    const usedPct = Math.min(100, (status.hourlyUsage / status.hourlyBudget) * 100)
    const remainingPct = Math.max(0, 100 - usedPct)
    return { usedPct, remainingPct }
  }, [status])

  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const windowCountdown = useMemo(() => {
    // Prefer the fixed-window resetAt; fall back to legacy windowResetAt.
    const resetSource = status?.resetAt ?? status?.windowResetAt
    if (!resetSource) return null
    const resetTs = new Date(resetSource).getTime()
    if (!Number.isFinite(resetTs)) return null
    // Use server-synced clock so the countdown matches the backend exactly.
    const serverNow = nowMs + serverOffsetRef.current
    const diff = Math.max(0, resetTs - serverNow)
    return formatDuration(diff)
  }, [status?.resetAt, status?.windowResetAt, nowMs])

  // When the countdown reaches zero, ask the backend for the refreshed state
  // exactly once. The backend decides whether the window actually reset — the
  // frontend never fabricates a new reset time.
  useEffect(() => {
    const resetSource = status?.resetAt ?? status?.windowResetAt
    if (!resetSource || !apiKey.trim()) return
    const resetTs = new Date(resetSource).getTime()
    if (!Number.isFinite(resetTs)) return
    const serverNow = nowMs + serverOffsetRef.current
    if (serverNow >= resetTs && !zeroRefetchedRef.current) {
      zeroRefetchedRef.current = true
      checkKey({ preserveStatus: true })
    }
  }, [status?.resetAt, status?.windowResetAt, nowMs, apiKey, checkKey])

  const lastSeenAgo = useMemo(() => {
    if (!status?.lastUsed) return 'Never'
    const ts = new Date(status.lastUsed).getTime()
    if (!Number.isFinite(ts)) return '—'
    const diff = Math.max(0, nowMs - ts)
    return formatRelative(diff)
  }, [status?.lastUsed, nowMs])

  useEffect(() => {
    if (!status || autoRefreshSec === 0 || !apiKey.trim()) return
    const id = window.setInterval(() => {
      checkKey({ preserveStatus: true })
    }, autoRefreshSec * 1000)
    return () => window.clearInterval(id)
  }, [status, autoRefreshSec, apiKey, checkKey])

  useEffect(() => {
    return () => inflightRef.current?.abort()
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <SiteHeader active="usage" />

      <main className="aurora relative">
        <span className="aurora-blob" aria-hidden />
        <div className="relative z-10 mx-auto max-w-5xl space-y-8 px-6 py-14">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Usage</p>
            <h1 className="font-display tracking-display mt-3 text-5xl font-semibold text-white md:text-6xl">
              Check <span className="gradient-text">usage</span>
            </h1>
            <p className="mt-3 max-w-2xl text-white/70">
              Enter your API key to view real-time status, the 5-hour rolling token window, and request history.
            </p>
          </div>

          <div className="grad-border glass-strong rounded-2xl p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <label htmlFor="api-key" className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                  API key
                </label>
                <input
                  id="api-key"
                  placeholder="sk-ant-opm-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/35 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                />
              </div>
              <button
                onClick={() => checkKey()}
                disabled={loading}
                className="btn-grad inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 md:w-44"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Checking
                  </>
                ) : (
                  <>
                    Check status <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            {!!lastUpdatedAt && !error && (
              <p className="mt-3 text-xs text-white/50">
                Last updated: {new Date(lastUpdatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          {status && (
            <>
              <section
                className={`grad-border glass-strong overflow-hidden rounded-2xl transition-shadow ${
                  changedPulse ? 'shadow-[0_0_35px_-12px_rgba(34,211,238,0.85)]' : ''
                }`}
              >
                <div className="h-[3px] w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
                <div className="space-y-6 p-6">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-white ring-1 ring-white/10">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h2 className="font-display tracking-display text-2xl font-semibold text-white">
                            {status.name || 'API key'}
                          </h2>
                          <StatusPill status={status.status} quotaBlocked={status.quotaBlocked} />
                        </div>
                        <div className="flex items-center gap-2 font-mono text-sm text-white/55">
                          <span>{maskApiKey(apiKey.trim())}</span>
                          <button
                            onClick={copyKey}
                            className="rounded p-1 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
                            aria-label="Copy API key"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {copied && <span className="text-xs text-emerald-300">Copied</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={String(autoRefreshSec)}
                        onChange={(e) => setAutoRefreshSec(Number(e.target.value) as 0 | 5 | 10 | 30)}
                        className="h-9 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-white/80 outline-none transition-colors hover:border-white/20"
                        aria-label="Auto refresh interval"
                      >
                        <option value="0">Auto refresh: Off</option>
                        <option value="5">Auto refresh: 5s</option>
                        <option value="10">Auto refresh: 10s</option>
                        <option value="30">Auto refresh: 30s</option>
                      </select>
                      <button
                        onClick={() => checkKey({ preserveStatus: true })}
                        disabled={refreshing}
                        className="btn-ghost-glass inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat
                      label="Created"
                      big={status.createdAt ? formatTimestamp(status.createdAt) : '—'}
                      sub="From gateway database"
                    />
                    <Stat
                      label="Expires"
                      big={status.expiresAt ? 'Set' : 'No expiry'}
                      sub={formatTimestamp(status.expiresAt)}
                    />
                    <Stat
                      label="Last used"
                      big={status.lastUsed ? lastSeenAgo : 'Never'}
                      sub={formatTimestamp(status.lastUsed)}
                    />
                    <Stat
                      label="Rate limit"
                      big={`${status.rpmLimit ?? 0} req/min`}
                      sub={status.rpmLimit ? `${(status.rpmLimit / 60).toFixed(2)} req/sec` : '—'}
                    />
                  </div>
                </div>
              </section>

              {usageStats && status.hourlyUsage !== null && status.hourlyBudget !== null && (
                <section className="glass-strong rounded-2xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-violet-500/20 text-cyan-200 ring-1 ring-white/10">
                        <Clock3 className="h-4 w-4" />
                      </span>
                      <h3 className="font-display tracking-display text-2xl font-semibold text-white">
                        5-hour rolling window
                      </h3>
                    </div>
                    <div className="font-display text-3xl font-semibold gradient-text">
                      {usageStats.usedPct.toFixed(1)}%
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-white/60">
                    Window reset in:{' '}
                    <span className="font-mono text-white">
                      {windowCountdown || 'Starts after first request'}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    Window totals use logged token usage (stable). They update after each request completes, not on
                    every streaming chunk.
                  </p>

                  <div className="mt-5 grid gap-2 text-sm md:grid-cols-2">
                    <p className="text-white/55">
                      Used <span className="font-semibold text-white">{usageStats.usedPct.toFixed(1)}%</span>
                    </p>
                    <p className="text-right text-white/55">
                      Remaining{' '}
                      <span className="font-semibold text-white">{usageStats.remainingPct.toFixed(1)}%</span>
                    </p>
                  </div>

                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-[width] shadow-[0_0_20px_rgba(217,70,239,0.55)]"
                      style={{ width: `${usageStats.usedPct}%` }}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 text-sm text-white/55 md:grid-cols-2">
                    <p>
                      {compactNumber(status.hourlyUsage)} / {compactNumber(status.hourlyBudget)} tokens used
                    </p>
                    <p className="text-right">
                      {compactNumber(
                        status.hourlyRemaining ?? Math.max(status.hourlyBudget - status.hourlyUsage, 0)
                      )}{' '}
                      tokens remaining
                    </p>
                  </div>
                </section>
              )}

              <section className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Requests (24h)"
                  value={compactNumber(status.requests24h ?? 0)}
                  sub={`All-time: ${compactNumber(status.allTimeRequests ?? 0)}`}
                />
                <MetricCard
                  label="Window reset"
                  value={windowCountdown || 'Fresh'}
                  sub="Rolling 5-hour budget"
                />
                <MetricCard
                  label="Key status"
                  value={status.quotaBlocked ? 'quota_blocked' : (status.status || 'unknown').toString()}
                  sub={status.quotaBlocked ? '5-hour window exhausted' : 'Current activation state'}
                  capitalize
                />
              </section>

              {status.activity && status.activity.length > 0 && (
                <section className="glass-strong rounded-2xl p-6">
                  <h3 className="font-display tracking-display text-xl font-semibold text-white">
                    Recent request log
                  </h3>
                  <p className="mt-1 text-sm text-white/55">Latest completed calls through this gateway (newest first).</p>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
                        <tr>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Model</th>
                          <th className="px-3 py-2 text-right">In</th>
                          <th className="px-3 py-2 text-right">Out</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-right">HTTP</th>
                          <th className="px-3 py-2 text-right">ms</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-white/80">
                        {status.activity.map((row, idx) => (
                          <tr key={`${idx}-${row.at}-${row.model}-${row.statusCode}`} className="hover:bg-white/[0.03]">
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-white/70">
                              {formatTimestamp(row.at)}
                            </td>
                            <td className="max-w-[220px] truncate px-3 py-2 font-mono text-xs">{row.model}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{compactNumber(row.inputTokens)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{compactNumber(row.outputTokens)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-white">
                              {compactNumber(row.totalTokens)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs">
                              {row.statusCode}
                              {row.errorType ? (
                                <span className="ml-1 text-rose-300/90" title={row.errorType}>
                                  *
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{row.latencyMs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatRelative(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 5) return 'Just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function Stat({ label, big, sub }: { label: string; big: string; sub: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="font-display tracking-display mt-1 text-2xl font-semibold text-white">{big}</p>
      <p className="text-sm text-white/55">{sub}</p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  capitalize,
}: {
  label: string
  value: string
  sub: string
  capitalize?: boolean
}) {
  return (
    <div className="glass lift rounded-2xl p-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p
        className={`font-display tracking-display mt-3 text-4xl font-semibold text-white ${
          capitalize ? 'capitalize' : ''
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-white/55">{sub}</p>
    </div>
  )
}
