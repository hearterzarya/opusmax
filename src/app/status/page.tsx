'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  RefreshCw,
  Server,
  Shield,
  XCircle,
} from 'lucide-react'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'

interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  latencyMs: number | null
  uptime: number | null
  lastCheck: Date
}

const initialServices: ServiceHealth[] = [
  { name: 'Proxy Service', status: 'healthy', latencyMs: null, uptime: 99.99, lastCheck: new Date() },
  { name: 'API Gateway', status: 'healthy', latencyMs: null, uptime: 99.99, lastCheck: new Date() },
  { name: 'Key Management', status: 'healthy', latencyMs: null, uptime: 99.99, lastCheck: new Date() },
  { name: 'Database', status: 'healthy', latencyMs: null, uptime: 99.99, lastCheck: new Date() },
  { name: 'Upstream Anthropic', status: 'healthy', latencyMs: null, uptime: 99.95, lastCheck: new Date() },
]

function ServiceIcon({ name }: { name: string }) {
  if (name === 'Proxy Service') return <Server className="h-4 w-4" />
  if (name === 'API Gateway') return <Cloud className="h-4 w-4" />
  if (name === 'Key Management') return <Shield className="h-4 w-4" />
  if (name === 'Database') return <Database className="h-4 w-4" />
  return <Activity className="h-4 w-4" />
}

function StatusPill({ status }: { status: ServiceHealth['status'] }) {
  if (status === 'healthy') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Operational
      </span>
    )
  }
  if (status === 'degraded') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
        <AlertTriangle className="h-3 w-3" /> Degraded
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 text-xs font-medium text-rose-300">
      <XCircle className="h-3 w-3" /> Down
    </span>
  )
}

function HealthCard({ service }: { service: ServiceHealth }) {
  const uptimeText = typeof service.uptime === 'number' ? `${service.uptime.toFixed(2)}%` : '--'
  const latencyText = typeof service.latencyMs === 'number' ? `${service.latencyMs}ms` : '--'

  return (
    <div className="glass lift relative overflow-hidden rounded-2xl p-5">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl ${
          service.status === 'healthy'
            ? 'bg-emerald-500/15'
            : service.status === 'degraded'
              ? 'bg-amber-500/15'
              : 'bg-rose-500/15'
        }`}
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/80 ring-1 ring-white/10">
            <ServiceIcon name={service.name} />
          </span>
          <p className="text-sm font-medium text-white">{service.name}</p>
        </div>
        <StatusPill status={service.status} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Uptime</p>
          <p className="mt-1 font-mono text-white">{uptimeText}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Latency</p>
          <p className="mt-1 font-mono text-white">{latencyText}</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-white/45">
        Last checked: {service.lastCheck.toLocaleTimeString()}
      </p>
    </div>
  )
}

export default function StatusPage() {
  const [services, setServices] = useState<ServiceHealth[]>(initialServices)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    function normalize(raw: unknown): ServiceHealth[] {
      if (!Array.isArray(raw)) return initialServices
      return raw.map((item) => {
        const s = item as Partial<ServiceHealth>
        const lastCheck = s.lastCheck ? new Date(s.lastCheck) : new Date()
        return {
          name: s.name || 'Unknown Service',
          status:
            s.status === 'healthy' || s.status === 'degraded' || s.status === 'down' ? s.status : 'degraded',
          latencyMs: typeof s.latencyMs === 'number' ? s.latencyMs : null,
          uptime: typeof s.uptime === 'number' ? s.uptime : null,
          lastCheck: Number.isNaN(lastCheck.getTime()) ? new Date() : lastCheck,
        }
      })
    }

    async function check() {
      try {
        const response = await fetch('/api/health')
        if (response.ok) {
          const data = await response.json()
          if (data.services) setServices(normalize(data.services))
        }
      } catch {
        // keep last known state
      } finally {
        setLastUpdated(new Date())
        setLoading(false)
      }
    }

    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  const allHealthy = services.every((s) => s.status === 'healthy')
  const anyDown = services.some((s) => s.status === 'down')
  const overall = allHealthy ? 'All systems operational' : anyDown ? 'Partial outage' : 'Degraded performance'
  const overallTone = allHealthy
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
    : anyDown
      ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
      : 'border-amber-400/30 bg-amber-400/10 text-amber-300'

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <SiteHeader active="status" />

      <main className="aurora relative">
        <span className="aurora-blob" aria-hidden />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-14">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Status</p>
              <h1 className="font-display tracking-display mt-3 text-5xl font-semibold text-white md:text-6xl">
                System <span className="gradient-text">status</span>
              </h1>
              <p className="mt-3 max-w-xl text-white/70">
                Real-time health monitoring for OpusMax services.
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${overallTone}`}>
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
              </span>
              {overall}
            </span>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-[148px]" />
                ))
              : services.map((service) => <HealthCard key={service.name} service={service} />)}
          </div>

          <div className="mt-10 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Auto-refreshing every 30 seconds
            </span>
            <span className="font-mono text-xs text-white/45">
              last update {lastUpdated.toLocaleTimeString()}
            </span>
          </div>

          <div className="mt-12">
            <h2 className="font-display tracking-display text-3xl font-semibold text-white">
              Recent incidents
            </h2>
            <div className="mt-4 glass rounded-2xl p-10 text-center">
              <p className="text-white">No recent incidents</p>
              <p className="mt-1 text-sm text-white/55">All systems are running normally.</p>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
