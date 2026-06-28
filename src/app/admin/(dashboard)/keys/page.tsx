import Link from 'next/link'
import { Plus, Key, CheckCircle2, XCircle, AlertTriangle, Infinity as InfinityIcon, Layers, PauseCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getApiKeyStatus, detectPlan } from '@/lib/api-key-status'
import { KeysTable, type EnrichedKey } from './keys-table'

// Always render fresh from the DB so expiry/extend/plan/disable changes show
// immediately after router.refresh() — never serve a stale cached snapshot.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Deterministic UTC date label — identical on server and client (no tz drift). */
function formatDateUTC(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

async function getApiKeys() {
  try {
    return await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } })
  } catch (error) {
    console.error('Keys list fetch failed:', error)
    return []
  }
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  glow,
}: {
  label: string
  value: number
  icon: React.ElementType
  glow: string
}) {
  return (
    <div className="glass lift relative overflow-hidden rounded-2xl p-4">
      <div aria-hidden className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${glow}`} />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{label}</p>
          <p className="font-display tracking-display mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/85 ring-1 ring-white/10">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  )
}

export default async function AdminKeysPage() {
  const apiKeys = await getApiKeys()
  const now = Date.now()

  const enriched: EnrichedKey[] = apiKeys.map((k) => {
    const expiresIso = k.expiresAt ? k.expiresAt.toISOString() : null
    const budget = k.hourlyTokenBudget != null ? k.hourlyTokenBudget.toString() : null
    const info = getApiKeyStatus(expiresIso, k.status, now)
    const plan = detectPlan(k.hourlyTokenBudget ?? null)
    return {
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      keyFullLast4: k.keyFullLast4,
      status: k.status,
      expiresAt: expiresIso,
      hourlyTokenBudget: budget,
      statusValue: info.status,
      statusLabel: info.label,
      remainingLabel: info.remainingLabel,
      remainingDays: info.remainingDays,
      plan,
      createdLabel: formatDateUTC(k.createdAt.toISOString()),
      expiryLabel: expiresIso ? formatDateUTC(expiresIso) : 'Lifetime',
      createdMs: k.createdAt.getTime(),
      expiryMs: k.expiresAt ? k.expiresAt.getTime() : null,
    }
  })

  const summary = enriched.reduce(
    (acc, k) => {
      acc.total += 1
      if (k.statusValue === 'active') acc.active += 1
      if (k.statusValue === 'expired') acc.expired += 1
      if (k.statusValue === 'expiring_soon') acc.expiringSoon += 1
      if (k.statusValue === 'lifetime') acc.lifetime += 1
      if (k.statusValue === 'paused') acc.disabled += 1
      if (k.plan === '5X') acc.plan5x += 1
      if (k.plan === '20X') acc.plan20x += 1
      return acc
    },
    { total: 0, active: 0, expired: 0, expiringSoon: 0, lifetime: 0, disabled: 0, plan5x: 0, plan20x: 0 }
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Manage</p>
          <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">API Keys</h1>
          <p className="mt-1 text-white/65">Create, expire, extend, and convert keys across plans.</p>
        </div>
        <Link href="/admin/keys/new" className="btn-grad inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium">
          <Plus className="h-4 w-4" /> Create new key
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <SummaryCard label="Total" value={summary.total} icon={Key} glow="bg-violet-500/20" />
        <SummaryCard label="Active" value={summary.active} icon={CheckCircle2} glow="bg-emerald-500/20" />
        <SummaryCard label="Expired" value={summary.expired} icon={XCircle} glow="bg-rose-500/20" />
        <SummaryCard label="Expiring Soon" value={summary.expiringSoon} icon={AlertTriangle} glow="bg-amber-500/20" />
        <SummaryCard label="Lifetime" value={summary.lifetime} icon={InfinityIcon} glow="bg-fuchsia-500/20" />
        <SummaryCard label="Disabled" value={summary.disabled} icon={PauseCircle} glow="bg-white/10" />
        <SummaryCard label="5X Plans" value={summary.plan5x} icon={Layers} glow="bg-cyan-500/20" />
        <SummaryCard label="20X Plans" value={summary.plan20x} icon={Layers} glow="bg-sky-500/20" />
      </div>

      {enriched.length === 0 ? (
        <div className="grad-border glass rounded-2xl p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/10">
            <Key className="h-6 w-6 text-white/65" />
          </div>
          <h3 className="font-display mt-4 text-lg font-semibold text-white">No API keys yet</h3>
          <p className="mt-1 text-white/65">Create your first key to start using OpusMax.</p>
          <Link href="/admin/keys/new" className="btn-grad mt-4 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium">
            <Plus className="h-4 w-4" /> Create API key
          </Link>
        </div>
      ) : (
        <KeysTable keys={enriched} />
      )}
    </div>
  )
}
