'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react'

interface ProviderLog {
  id: string
  requestId: string
  apiKeyId: string | null
  apiKeyName: string | null
  model: string
  providerName: string
  providerUrl: string
  status: string
  statusCode: number | null
  errorMessage: string | null
  latencyMs: number | null
  isFinal: boolean
  createdAt: string
}

interface Summary {
  [provider: string]: { success: number; failed: number; total: number }
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  SUCCESS: { bg: 'bg-emerald-400/10 border-emerald-400/30', text: 'text-emerald-300', icon: CheckCircle2 },
  FAILED_4XX: { bg: 'bg-rose-400/10 border-rose-400/30', text: 'text-rose-300', icon: XCircle },
  FAILED_5XX: { bg: 'bg-rose-400/10 border-rose-400/30', text: 'text-rose-300', icon: XCircle },
  FAILED_NETWORK: { bg: 'bg-amber-400/10 border-amber-400/30', text: 'text-amber-300', icon: AlertTriangle },
  FAILED_TIMEOUT: { bg: 'bg-amber-400/10 border-amber-400/30', text: 'text-amber-300', icon: AlertTriangle },
}

export default function ProviderLogsPage() {
  const [logs, setLogs] = useState<ProviderLog[]>([])
  const [summary, setSummary] = useState<Summary>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLogs = useCallback(async (bg = false) => {
    if (bg) setRefreshing(true)
    try {
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const res = await fetch(`/api/admin/provider-logs${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs ?? [])
        setSummary(data.summary ?? {})
      }
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [filter])

  useEffect(() => { setLoading(true); fetchLogs() }, [fetchLogs])
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchLogs(true), 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchLogs])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Monitoring</p>
          <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">Provider Logs</h1>
          <p className="mt-1 text-white/65">Live routing logs — which provider handled each request and fallback attempts.</p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <Activity className="h-4 w-4 animate-pulse text-fuchsia-300" />}
          <button onClick={() => fetchLogs(true)} className="btn-ghost-glass inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(summary).map(([name, stats]) => (
            <div key={name} className="glass rounded-2xl p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{name}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white">{stats.success}</span>
                <span className="text-xs text-emerald-300">ok</span>
                {stats.failed > 0 && <>
                  <span className="text-2xl font-semibold text-rose-300">{stats.failed}</span>
                  <span className="text-xs text-rose-300">fail</span>
                </>}
              </div>
              <p className="mt-1 text-xs text-white/40">Last 1 hour · {stats.total} total</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'SUCCESS', 'FAILED_4XX', 'FAILED_5XX', 'FAILED_NETWORK', 'FAILED_TIMEOUT'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${filter === f ? 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200' : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white'}`}>
            {f === 'all' ? 'All' : f.replace('FAILED_', '').replace('XX', 'xx')}
          </button>
        ))}
      </div>

      {/* Logs table */}
      {loading ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-white/50">Loading logs...</p></div>
      ) : logs.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Activity className="mx-auto h-10 w-10 text-white/30" />
          <p className="mt-3 text-white/55">No provider logs yet. Send a request through OpusX to see routing activity.</p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Final</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => {
                  const style = STATUS_STYLES[log.status] || STATUS_STYLES.FAILED_NETWORK!
                  const Icon = style.icon
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 font-mono text-xs text-white/60">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-white">{log.providerName}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white/70">{log.model}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                          <Icon className="h-2.5 w-2.5" />
                          {log.status.replace('FAILED_', '')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white/60">{log.statusCode ?? '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white/80">{log.latencyMs != null ? `${log.latencyMs}ms` : '—'}</td>
                      <td className="px-4 py-2.5">
                        {log.isFinal ? <span className="text-xs text-emerald-300">✓ Used</span> : <span className="text-xs text-white/30">skipped</span>}
                      </td>
                      <td className="px-4 py-2.5 max-w-[200px] truncate text-xs text-white/40" title={log.errorMessage || ''}>
                        {log.errorMessage?.slice(0, 60) || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
