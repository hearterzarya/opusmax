import Link from 'next/link'
import { Activity, AlertTriangle, ArrowRight, Clock, Key, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { prisma } from '@/lib/prisma'

type DashboardMetrics = {
  totalKeys: number
  activeKeys: number
  last24hRequests: number
  last7dRequests: number
  last30dRequests: number
  totalTokens: number
  avgLatency: number
  errors: number
  dbAvailable: boolean
}

const EMPTY_METRICS: DashboardMetrics = {
  totalKeys: 0,
  activeKeys: 0,
  last24hRequests: 0,
  last7dRequests: 0,
  last30dRequests: 0,
  totalTokens: 0,
  avgLatency: 0,
  errors: 0,
  dbAvailable: false,
}

async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  try {
    const [
      totalKeys,
      activeKeys,
      last24hRequests,
      last7dRequests,
      last30dRequests,
      last24hLogs,
      last7dLogs,
      totalErrors,
    ] = await Promise.all([
      prisma.apiKey.count(),
      prisma.apiKey.count({ where: { status: 'ACTIVE' } }),
      prisma.usageLog.count({ where: { timestamp: { gte: dayAgo } } }),
      prisma.usageLog.count({ where: { timestamp: { gte: weekAgo } } }),
      prisma.usageLog.count({ where: { timestamp: { gte: monthAgo } } }),
      prisma.usageLog.aggregate({
        where: { timestamp: { gte: dayAgo } },
        _sum: { inputTokens: true, outputTokens: true },
        _avg: { latencyMs: true },
      }),
      prisma.usageLog.aggregate({
        where: { timestamp: { gte: weekAgo } },
        _sum: { inputTokens: true, outputTokens: true },
      }),
      prisma.usageLog.count({ where: { statusCode: { gte: 400 } } }),
    ])

    const totalInputTokens =
      (last24hLogs._sum.inputTokens || 0) + (last7dLogs._sum.inputTokens || 0)
    const totalOutputTokens =
      (last24hLogs._sum.outputTokens || 0) + (last7dLogs._sum.outputTokens || 0)

    return {
      totalKeys,
      activeKeys,
      last24hRequests,
      last7dRequests,
      last30dRequests,
      totalTokens: totalInputTokens + totalOutputTokens,
      avgLatency: Math.round(last24hLogs._avg.latencyMs || 0),
      errors: totalErrors,
      dbAvailable: true,
    }
  } catch (error) {
    console.error('Dashboard metrics fetch failed (DB likely down):', error)
    return EMPTY_METRICS
  }
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  glow,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  description?: string
  glow: string
}) {
  return (
    <div className="glass lift relative overflow-hidden rounded-2xl p-5">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl ${glow}`}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">{title}</p>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/85 ring-1 ring-white/10">
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="font-display tracking-display mt-3 text-3xl font-semibold text-white">{value}</p>
        {description && <p className="mt-1 text-sm text-white/55">{description}</p>}
      </div>
    </div>
  )
}

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics()

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Overview</p>
          <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-white/65">Real-time view of OpusMax usage and key health.</p>
        </div>
        <Link
          href="/admin/keys/new"
          className="btn-grad inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium"
        >
          <Sparkles className="h-4 w-4" /> Create new API key
        </Link>
      </div>

      {!metrics.dbAvailable && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Database is currently unreachable.</p>
            <p className="text-amber-100/70">
              Showing zeros for live metrics. We&apos;ll auto-recover when the connection comes back.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total API Keys"
          value={metrics.totalKeys}
          icon={Key}
          description={`${metrics.activeKeys} active`}
          glow="bg-violet-500/20"
        />
        <MetricCard
          title="Requests (24h)"
          value={metrics.last24hRequests.toLocaleString()}
          icon={Activity}
          glow="bg-fuchsia-500/20"
        />
        <MetricCard
          title="Total Tokens"
          value={metrics.totalTokens.toLocaleString()}
          icon={Zap}
          glow="bg-cyan-500/20"
        />
        <MetricCard
          title="Errors (30d)"
          value={metrics.errors.toLocaleString()}
          icon={AlertTriangle}
          glow="bg-rose-500/20"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grad-border glass rounded-2xl p-6">
          <h2 className="font-display tracking-display text-xl font-semibold text-white">Quick stats</h2>
          <div className="mt-5 space-y-3">
            <StatRow icon={Clock} label="Avg latency" value={`${metrics.avgLatency}ms`} />
            <StatRow
              icon={TrendingUp}
              label="Last 7 days"
              value={`${metrics.last7dRequests.toLocaleString()} requests`}
            />
            <StatRow
              icon={TrendingUp}
              label="Last 30 days"
              value={`${metrics.last30dRequests.toLocaleString()} requests`}
            />
          </div>
        </div>

        <div className="grad-border glass rounded-2xl p-6">
          <h2 className="font-display tracking-display text-xl font-semibold text-white">Quick actions</h2>
          <div className="mt-5 grid gap-3">
            <ActionRow
              href="/admin/keys/new"
              title="Create new API key"
              description="Issue keys with budget and rate limits"
            />
            <ActionRow
              href="/admin/usage"
              title="View usage logs"
              description="Per-key history with model, latency, status"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-white/65">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <span className="font-medium text-white">{value}</span>
    </div>
  )
}

function ActionRow({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-all hover:bg-white/[0.06] hover:shadow-[0_0_30px_-10px_rgba(168,85,247,0.45)]"
    >
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-white/55">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-white/40 transition-all group-hover:translate-x-0.5 group-hover:text-fuchsia-300" />
    </Link>
  )
}
