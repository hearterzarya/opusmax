'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Radio,
  Server,
  Zap,
} from 'lucide-react'

interface LatencyData {
  monitor: { status: string; lastCheckedAt: string; region: string; sampleCount: number }
  services: {
    opusmax: ServiceData
    opusx: ServiceData
  }
  wrapper: WrapperData
  diagnostic: { code: string; title: string; message: string; severity: string }
  history: Array<{ time: string; vendorFirstTokenMs: number | null; opusxFirstTokenMs: number | null; overheadMs: number | null }>
  serverNow: string
  range: string
}

interface ServiceData {
  status: string
  current: { headersMs: number | null; firstByteMs: number | null; firstTokenMs: number | null; totalMs: number | null }
  statistics: { p50FirstTokenMs: number | null; p95FirstTokenMs: number | null; p99FirstTokenMs: number | null; p50TotalMs: number | null; p95TotalMs: number | null; successRate: number | null; sampleCount: number }
}

interface WrapperData {
  current: { preVendorMs: number | null; authMs: number | null; quotaMs: number | null; routingMs: number | null; firstTokenOverheadMs: number | null; postVendorFirstTokenOverheadMs: number | null }
  statistics: { p50OverheadMs: number | null; p95OverheadMs: number | null; sampleCount: number }
  status: string
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${Math.round(v)} ms`
}

function pct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(2)}%`
}

const STATUS_COLORS: Record<string, string> = {
  operational: 'text-emerald-400',
  degraded: 'text-amber-400',
  major_outage: 'text-rose-400',
  monitoring_unavailable: 'text-white/40',
}

const SEVERITY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  info: { border: 'border-cyan-400/30', bg: 'bg-cyan-400/10', text: 'text-cyan-100' },
  warning: { border: 'border-amber-400/30', bg: 'bg-amber-400/10', text: 'text-amber-100' },
  critical: { border: 'border-rose-400/30', bg: 'bg-rose-400/10', text: 'text-rose-100' },
}

export default function LatencyDashboardPage() {
  const [data, setData] = useState<LatencyData | null>(null)
  const [range, setRange] = useState<string>('15m')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (isBackground = false) => {
    if (isBackground) setRefreshing(true)
    try {
      const res = await fetch(`/api/admin/infrastructure-latency?range=${range}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // silent — keep old data visible
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(true), 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Header />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <Header />
        <div className="flex items-center gap-3">
          <LiveIndicator status={data?.monitor.status ?? 'no_data'} refreshing={refreshing} />
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {['15m', '1h', '24h', '7d'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${range === r ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* Diagnostic banner */}
          <DiagnosticBanner diagnostic={data.diagnostic} />

          {/* Main metric cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <VendorCard data={data.services.opusmax} />
            <GatewayCard data={data.services.opusx} />
            <OverheadCard data={data.wrapper} />
          </div>

          {/* History chart (simple table-based since Recharts may not be available) */}
          <HistorySection history={data.history} />

          {/* Region + Monitor info */}
          <div className="grid gap-4 md:grid-cols-2">
            <MonitorInfoCard monitor={data.monitor} />
            <DetailedOverhead data={data.wrapper} />
          </div>
        </>
      )}
    </div>
  )
}

function Header() {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Infrastructure</p>
      <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">
        Real-Time Latency
      </h1>
      <p className="mt-1 text-white/65">Live vendor and gateway performance metrics from actual requests.</p>
    </div>
  )
}

function LiveIndicator({ status, refreshing }: { status: string; refreshing: boolean }) {
  const isLive = status === 'live'
  return (
    <div className="flex items-center gap-2">
      {refreshing && <Activity className="h-3 w-3 animate-pulse text-fuchsia-300" />}
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${isLive ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/15 bg-white/[0.04] text-white/60'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
        {isLive ? 'LIVE' : status === 'no_data' ? 'NO DATA' : 'OFFLINE'}
      </span>
    </div>
  )
}

function DiagnosticBanner({ diagnostic }: { diagnostic: LatencyData['diagnostic'] }) {
  const style = SEVERITY_STYLES[diagnostic.severity] ?? SEVERITY_STYLES.info
  const Icon = diagnostic.severity === 'critical' ? AlertTriangle : diagnostic.severity === 'warning' ? AlertTriangle : CheckCircle2
  return (
    <div className={`flex items-start gap-3 rounded-2xl border ${style.border} ${style.bg} p-4`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.text}`} />
      <div>
        <p className={`font-medium ${style.text}`}>{diagnostic.title}</p>
        <p className={`mt-0.5 text-sm opacity-80 ${style.text}`}>{diagnostic.message}</p>
      </div>
    </div>
  )
}

function VendorCard({ data }: { data: ServiceData }) {
  return (
    <div className="glass lift relative overflow-hidden rounded-2xl p-5">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-violet-300" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">OpusMax Vendor</p>
          </div>
          <span className={`text-xs font-medium capitalize ${STATUS_COLORS[data.status]}`}>{data.status.replace('_', ' ')}</span>
        </div>
        <p className="font-display tracking-display mt-3 text-3xl font-semibold text-white">{fmt(data.current.firstTokenMs)}</p>
        <p className="text-xs text-white/50">First AI Token</p>

        <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
          <Stat label="Headers" value={fmt(data.current.headersMs)} />
          <Stat label="First Byte" value={fmt(data.current.firstByteMs)} />
          <Stat label="Total" value={fmt(data.current.totalMs)} />
          <Stat label="Success" value={pct(data.statistics.successRate)} />
          <Stat label="P50" value={fmt(data.statistics.p50FirstTokenMs)} />
          <Stat label="P95" value={fmt(data.statistics.p95FirstTokenMs)} />
          <Stat label="P99" value={fmt(data.statistics.p99FirstTokenMs)} />
          <Stat label="Samples" value={String(data.statistics.sampleCount)} />
        </div>
      </div>
    </div>
  )
}

function GatewayCard({ data }: { data: ServiceData }) {
  return (
    <div className="glass lift relative overflow-hidden rounded-2xl p-5">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-fuchsia-300" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">OpusX Gateway</p>
          </div>
          <span className={`text-xs font-medium capitalize ${STATUS_COLORS[data.status]}`}>{data.status.replace('_', ' ')}</span>
        </div>
        <p className="font-display tracking-display mt-3 text-3xl font-semibold text-white">{fmt(data.current.firstTokenMs)}</p>
        <p className="text-xs text-white/50">First AI Token (end-to-end)</p>

        <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
          <Stat label="Total" value={fmt(data.current.totalMs)} />
          <Stat label="Success" value={pct(data.statistics.successRate)} />
          <Stat label="P50" value={fmt(data.statistics.p50FirstTokenMs)} />
          <Stat label="P95" value={fmt(data.statistics.p95FirstTokenMs)} />
          <Stat label="P99" value={fmt(data.statistics.p99FirstTokenMs)} />
          <Stat label="Samples" value={String(data.statistics.sampleCount)} />
        </div>
      </div>
    </div>
  )
}

function OverheadCard({ data }: { data: WrapperData }) {
  const statusColor = data.status === 'Excellent' ? 'text-emerald-300' : data.status === 'Good' ? 'text-cyan-300' : data.status === 'Moderate' ? 'text-amber-300' : data.status === 'Slow' ? 'text-orange-300' : data.status === 'Critical' ? 'text-rose-300' : 'text-white/50'
  return (
    <div className="glass lift relative overflow-hidden rounded-2xl p-5">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-300" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Wrapper Overhead</p>
          </div>
          <span className={`text-xs font-medium ${statusColor}`}>{data.status}</span>
        </div>
        <p className="font-display tracking-display mt-3 text-3xl font-semibold text-white">{fmt(data.current.firstTokenOverheadMs)}</p>
        <p className="text-xs text-white/50">Added Latency</p>

        <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
          <Stat label="Pre-Vendor" value={fmt(data.current.preVendorMs)} />
          <Stat label="Auth" value={fmt(data.current.authMs)} />
          <Stat label="Quota" value={fmt(data.current.quotaMs)} />
          <Stat label="Routing" value={fmt(data.current.routingMs)} />
          <Stat label="P50 Overhead" value={fmt(data.statistics.p50OverheadMs)} />
          <Stat label="P95 Overhead" value={fmt(data.statistics.p95OverheadMs)} />
        </div>
      </div>
    </div>
  )
}

function HistorySection({ history }: { history: LatencyData['history'] }) {
  if (history.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <Clock className="mx-auto h-8 w-8 text-white/30" />
        <p className="mt-2 text-sm text-white/55">No latency history available yet. Send requests through OpusX to populate.</p>
      </div>
    )
  }

  const maxMs = Math.max(...history.map((h) => Math.max(h.vendorFirstTokenMs ?? 0, h.opusxFirstTokenMs ?? 0, 1)))

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-display tracking-display text-xl font-semibold text-white">Latency History</h3>
      <p className="mt-1 text-xs text-white/50">OpusMax (violet) vs OpusX end-to-end (cyan) first-token latency</p>
      <div className="mt-4 flex h-32 items-end gap-px">
        {history.slice(-60).map((h, i) => {
          const vendorH = ((h.vendorFirstTokenMs ?? 0) / maxMs) * 100
          const opusxH = ((h.opusxFirstTokenMs ?? 0) / maxMs) * 100
          return (
            <div key={i} className="group relative flex flex-1 flex-col items-center gap-px" title={`Vendor: ${fmt(h.vendorFirstTokenMs)} | OpusX: ${fmt(h.opusxFirstTokenMs)}`}>
              <div className="w-full rounded-t-sm bg-violet-500/60" style={{ height: `${vendorH}%`, minHeight: vendorH > 0 ? 2 : 0 }} />
              <div className="w-full rounded-t-sm bg-cyan-400/60" style={{ height: `${Math.max(0, opusxH - vendorH)}%`, minHeight: opusxH > vendorH ? 1 : 0 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonitorInfoCard({ monitor }: { monitor: LatencyData['monitor'] }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-emerald-300" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Monitor Info</p>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        <Stat label="Status" value={monitor.status} />
        <Stat label="Region" value={monitor.region} />
        <Stat label="Samples" value={String(monitor.sampleCount)} />
        <Stat label="Last Check" value={new Date(monitor.lastCheckedAt).toLocaleTimeString()} />
      </div>
    </div>
  )
}

function DetailedOverhead({ data }: { data: WrapperData }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-cyan-300" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Processing Breakdown</p>
      </div>
      <div className="mt-4 space-y-3">
        <BreakdownBar label="Auth" ms={data.current.authMs} max={200} color="bg-violet-400" />
        <BreakdownBar label="Quota" ms={data.current.quotaMs} max={200} color="bg-fuchsia-400" />
        <BreakdownBar label="Routing" ms={data.current.routingMs} max={200} color="bg-cyan-400" />
        <BreakdownBar label="Post-Vendor" ms={data.current.postVendorFirstTokenOverheadMs} max={200} color="bg-amber-400" />
      </div>
    </div>
  )
}

function BreakdownBar({ label, ms, max, color }: { label: string; ms: number | null; max: number; color: string }) {
  const width = ms != null ? Math.min(100, (ms / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-white/80">{fmt(ms)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-white/45">{label}</p>
      <p className="font-medium text-white/90">{value}</p>
    </div>
  )
}

function SkeletonCard() {
  return <div className="glass rounded-2xl p-5 h-64 animate-pulse" />
}
