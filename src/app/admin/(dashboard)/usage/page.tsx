'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { formatDate, formatNumber } from '@/lib/utils'

interface UsageLog {
  id: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  latencyMs: number
  statusCode: number
  errorType: string | null
  timestamp: string
  apiKey: {
    id: string
    name: string
    keyPrefix: string
  }
}

const inputClass =
  'h-9 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/35 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20'

function StatusPill({ statusCode }: { statusCode: number }) {
  let cls = 'border-white/10 bg-white/[0.04] text-white/75'
  if (statusCode >= 200 && statusCode < 300) cls = 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
  else if (statusCode >= 400 && statusCode < 500) cls = 'border-amber-400/30 bg-amber-400/10 text-amber-300'
  else if (statusCode >= 500) cls = 'border-rose-400/30 bg-rose-400/10 text-rose-300'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {statusCode}
    </span>
  )
}

export default function AdminUsagePage() {
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [model, setModel] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' })
      if (model) params.set('model', model)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const response = await fetch(`/api/admin/usage?${params}`)
      const data = await response.json()
      if (data.logs) {
        setLogs(data.logs)
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.total || 0)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }, [page, model, dateFrom, dateTo])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  async function exportCSV() {
    try {
      const params = new URLSearchParams()
      if (model) params.set('model', model)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      params.set('export', 'csv')

      const response = await fetch(`/api/admin/usage?${params}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `usage-logs-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Logs</p>
          <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">Usage</h1>
          <p className="mt-1 text-white/65">Browse request history with filtering and CSV export.</p>
        </div>
        <button
          onClick={exportCSV}
          className="btn-ghost-glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grad-border glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input placeholder="Search by key name..." className={`${inputClass} w-full pl-9`} />
          </div>

          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value)
              setPage(1)
            }}
            className={inputClass}
          >
            <option value="">All models</option>
            <option value="claude-opus-4-5">Opus 4</option>
            <option value="claude-sonnet-4-5">Sonnet 4</option>
            <option value="claude-haiku-4-5">Haiku 4</option>
          </select>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-white/40" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className={`${inputClass} w-[150px]`}
            />
            <span className="text-white/40">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className={`${inputClass} w-[150px]`}
            />
          </div>

          <button
            onClick={() => {
              setModel('')
              setDateFrom('')
              setDateTo('')
              setPage(1)
            }}
            className="btn-ghost-glass inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      <p className="text-sm text-white/55">
        Showing {logs.length} of {totalCount.toLocaleString()} logs
      </p>

      <div className="grad-border glass overflow-hidden rounded-2xl">
        {loading ? (
          <div className="space-y-2 p-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-10" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-white/55">No usage logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Key</th>
                  <th className="px-6 py-3">Model</th>
                  <th className="px-6 py-3">Input</th>
                  <th className="px-6 py-3">Output</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Latency</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-6 py-3 text-white/55">{formatDate(new Date(log.timestamp))}</td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-white">{log.apiKey.name}</div>
                      <div className="font-mono text-xs text-white/45">{log.apiKey.keyPrefix}...</div>
                    </td>
                    <td className="px-6 py-3">
                      <code className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-white/85">
                        {log.model}
                      </code>
                    </td>
                    <td className="px-6 py-3 text-white/75">{formatNumber(log.inputTokens)}</td>
                    <td className="px-6 py-3 text-white/75">{formatNumber(log.outputTokens)}</td>
                    <td className="px-6 py-3 font-medium text-white">{formatNumber(log.totalTokens)}</td>
                    <td className="px-6 py-3 text-white/75">{log.latencyMs}ms</td>
                    <td className="px-6 py-3">
                      <StatusPill statusCode={log.statusCode} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost-glass inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-white/55">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost-glass inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
