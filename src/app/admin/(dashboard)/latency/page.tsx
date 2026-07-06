'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Info,
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

interface VendorStatus {
  vendor: string
  metric: string
  latencyMs: number | null
  displayValue: string
  status: string
  source: string
  sourcePage: string
  extractionMethod: string | null
  sourceCheckedAt: string | null
  updatedAt: string | null
  errorCode: string | null
}

/** Format ms intelligently: < 1000 → "824 ms", >= 1000 → "1.82 sec" */
function fmtMs(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v < 1000) return `${Math.round(v)} ms`
  return `${(v / 1000).toFixed(2)} sec`
}

function fmtMsShort(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${Math.round(v)} ms`
}

function pct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(2)}%`
}

const STATUS_BADGE_COLOR: Record<string, string> = {
  'Excellent': 'text-emerald-300',
  'Good': 'text-cyan-300',
  'Moderate': 'text-amber-300',
  'Slow': 'text-orange-300',
  'Very Slow': 'text-rose-300',
  'Critical': 'text-rose-300',
  'No Data': 'text-white/40',
}

const SEVERITY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  info: { border: 'border-cyan-400/30', bg: 'bg-cyan-400/10', text: 'text-cyan-100' },
  warning: { border: 'border-amber-400/30', bg: 'bg-amber-400/10', text: 'text-amber-100' },
  critical: { border: 'border-rose-400/30', bg: 'bg-rose-400/10', text: 'text-rose-100' },
}

export default function LatencyDashboardPage() {
  const [data, setData] = useState<LatencyData | null>(null)
  const [vendorStatus, setVendorStatus] = useState<VendorStatus | null>(null)
  const [range, setRange] = useState<string>('15m')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (isBackground = false) => {
    if (isBackground) setRefreshing(true)
    try {
      const [latencyRes, statusRes] = await Promise.all([
        fetch(`/api/admin/infrastructure-latency?range=${range}`),
        fetch('/api/admin/vendor-status-latency'),
      ])
      if (latencyRes.ok) setData(await latencyRes.json())
      if (statusRes.ok) setVendorStatus(await statusRes.json())
    } catch { /* keep old data */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [range])

  useEffect(() => { setLoading(true); fetchData() }, [fetchData])
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(true), 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  if (loading && !data) {
    return <div className="mx-auto max-w-6xl space-y-6"><Header /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div></div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <Header />
        <div className="flex items-center gap-3">
          <LiveIndicator status={data?.monitor.status ?? 'no_data'} refreshing={refreshing} />
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {['15m', '1h', '24h', '7d'].map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 text-xs font-medium transition-colors ${range === r ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}`}>{r}</button>
            ))}
          </div>
        </div>
      </div>

      {(data || vendorStatus) && <>
        {data && <DiagnosticBanner diagnostic={data.diagnostic} />}

        {/* ═══ VENDOR STATUS MIRROR (zero-token) ═══ */}
        {vendorStatus && <VendorStatusCard data={vendorStatus} />}

        {/* ═══ REAL-TRAFFIC INSTRUMENTATION CARDS ═══ */}
        {data && <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* CARD: OpusX Real Traffic - AI Response (from actual user requests) */}
          <MetricCard
            icon={Globe} iconColor="text-cyan-300" glow="bg-cyan-500/20"
            title="OpusX Real Traffic" subtitle="From Actual User Requests"
            heroValue={fmtMs(data.services.opusx.current.firstTokenMs)}
            heroLabel="AI First Token (E2E)"
            statusLabel={null}
            stats={[
              { label: 'Vendor Headers', value: fmtMsShort(data.services.opusmax.current.headersMs) },
              { label: 'Vendor First Byte', value: fmtMsShort(data.services.opusmax.current.firstByteMs) },
              { label: 'Vendor AI Token', value: fmtMs(data.services.opusmax.current.firstTokenMs) },
              { label: 'Full Response', value: fmtMs(data.services.opusx.current.totalMs) },
              { label: 'P50 First Token', value: fmtMs(data.services.opusx.statistics.p50FirstTokenMs) },
              { label: 'P95 First Token', value: fmtMs(data.services.opusx.statistics.p95FirstTokenMs) },
            ]}
            tooltip="Measured from actual user requests flowing through OpusX. Includes AI model generation time."
          />

          {/* CARD: Wrapper Overhead */}
          <MetricCard
            icon={Zap} iconColor="text-amber-300" glow="bg-amber-500/20"
            title="Wrapper Overhead" subtitle="Latency Added by OpusX"
            heroValue={data.wrapper.current.firstTokenOverheadMs != null ? `+${fmtMsShort(data.wrapper.current.firstTokenOverheadMs)}` : '—'}
            heroLabel="Added Latency"
            statusLabel={data.wrapper.status}
            stats={[
              { label: 'Pre-Vendor', value: fmtMsShort(data.wrapper.current.preVendorMs) },
              { label: 'Auth', value: fmtMsShort(data.wrapper.current.authMs) },
              { label: 'Quota', value: fmtMsShort(data.wrapper.current.quotaMs) },
              { label: 'Routing', value: fmtMsShort(data.wrapper.current.routingMs) },
              { label: 'P50 Overhead', value: fmtMsShort(data.wrapper.statistics.p50OverheadMs) },
              { label: 'P95 Overhead', value: fmtMsShort(data.wrapper.statistics.p95OverheadMs) },
            ]}
            tooltip="How much extra latency OpusX adds on top of the vendor's response. Measured from real traffic."
          />

          {/* CARD: Monitor Info */}
          <MonitorInfoCard monitor={data.monitor} />
        </div>

        {/* ═══ PROCESSING BREAKDOWN ═══ */}
        <DetailedOverhead data={data.wrapper} />
        </>}
      </>}
    </div>
  )
}

function Header() {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Infrastructure</p>
      <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">Real-Time Latency</h1>
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
  const Icon = diagnostic.severity === 'critical' || diagnostic.severity === 'warning' ? AlertTriangle : CheckCircle2
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

function MetricCard({ icon: IconComp, iconColor, glow, title, subtitle, heroValue, heroLabel, statusLabel, stats, tooltip }: {
  icon: React.ElementType; iconColor: string; glow: string
  title: string; subtitle: string
  heroValue: string; heroLabel: string
  statusLabel: string | null
  stats: Array<{ label: string; value: string }>
  tooltip: string
}) {
  return (
    <div className="glass lift relative overflow-hidden rounded-2xl p-5">
      <div aria-hidden className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${glow} blur-2xl`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconComp className={`h-4 w-4 ${iconColor}`} />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{title}</p>
          </div>
          {statusLabel && <span className={`text-xs font-medium ${STATUS_BADGE_COLOR[statusLabel] ?? 'text-white/50'}`}>{statusLabel}</span>}
        </div>
        <p className="font-display tracking-display mt-3 text-3xl font-semibold text-white">{heroValue}</p>
        <div className="flex items-center gap-1">
          <p className="text-xs text-white/50">{heroLabel}</p>
          <span className="group relative">
            <Info className="h-3 w-3 text-white/30 cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg border border-white/10 bg-[#0c0c14] p-2 text-[10px] text-white/70 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-xl">
              {tooltip}
            </span>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
          {stats.map((s) => <Stat key={s.label} label={s.label} value={s.value} />)}
        </div>
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
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">OpusX Processing Breakdown</p>
      </div>
      <div className="mt-4 space-y-3">
        <BreakdownBar label="Authentication" ms={data.current.authMs} max={200} color="bg-violet-400" />
        <BreakdownBar label="Quota Validation" ms={data.current.quotaMs} max={200} color="bg-fuchsia-400" />
        <BreakdownBar label="Model Routing" ms={data.current.routingMs} max={200} color="bg-cyan-400" />
        <BreakdownBar label="Post-Vendor Stream" ms={data.current.postVendorFirstTokenOverheadMs} max={200} color="bg-amber-400" />
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
        <span className="text-white/80">{fmtMsShort(ms)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-white/45">{label}</p><p className="font-medium text-white/90">{value}</p></div>
}

function VendorStatusCard({ data }: { data: VendorStatus }) {
  const statusColor = data.status === 'LIVE' ? 'text-emerald-300' : data.status === 'STALE' ? 'text-amber-300' : 'text-rose-300'
  const statusDot = data.status === 'LIVE' ? 'bg-emerald-400 animate-pulse' : data.status === 'STALE' ? 'bg-amber-400' : 'bg-rose-400'
  const heroValue = data.latencyMs != null ? `${data.latencyMs} ms` : '—'

  const lastSyncedAgo = data.sourceCheckedAt
    ? `${Math.max(0, Math.round((Date.now() - new Date(data.sourceCheckedAt).getTime()) / 1000))} sec ago`
    : '—'

  return (
    <div className="glass lift relative overflow-hidden rounded-2xl p-6">
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-500/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-violet-300" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">OpusMax Vendor Latency</p>
              <p className="text-xs text-white/40">Live from OpusMax public status system</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            {data.status}
          </span>
        </div>

        <p className="font-display tracking-display mt-4 text-5xl font-semibold text-white">{heroValue}</p>
        <p className="mt-1 text-xs text-white/50">Vendor Status Latency</p>

        <div className="mt-5 grid grid-cols-2 gap-y-3 text-xs">
          <Stat label="Source" value={data.source} />
          <Stat label="Refresh Source" value="30 sec" />
          <Stat label="Last Synced" value={lastSyncedAgo} />
          <Stat label="Extraction" value={data.extractionMethod ?? '—'} />
        </div>

        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <p className="flex items-start gap-1.5 text-[10px] text-white/40">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            This value mirrors the latency reported by the OpusMax public status system. OpusX does not send AI generation requests to calculate this metric.
          </p>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return <div className="glass rounded-2xl p-5 h-64 animate-pulse" />
}
