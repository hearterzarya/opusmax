'use client'

import { useMemo, useState } from 'react'
import { Key, Search } from 'lucide-react'
import Link from 'next/link'
import { KeyRowActions } from './key-row-actions'
import type { ApiKeyStatusValue } from '@/lib/api-key-status'

/**
 * Fully server-computed row. All time/locale-dependent values (status,
 * remaining days, formatted dates) are calculated on the server so the
 * client render matches SSR exactly — otherwise hydration fails and onClick
 * handlers never attach (buttons appear but do nothing).
 */
export interface EnrichedKey {
  id: string
  name: string
  keyPrefix: string
  keyFullLast4: string
  status: string
  expiresAt: string | null
  hourlyTokenBudget: string | null
  statusValue: ApiKeyStatusValue
  statusLabel: string
  remainingLabel: string
  plan: string
  createdLabel: string
  expiryLabel: string
  createdMs: number
  expiryMs: number | null
  remainingDays: number | null
}

type StatusFilter = 'all' | ApiKeyStatusValue
type PlanFilter = 'all' | '5X' | '20X' | 'Custom' | 'None'
type SortKey = 'created_desc' | 'created_asc' | 'expiry_asc' | 'expiry_desc' | 'remaining_asc'

const STATUS_BADGE: Record<ApiKeyStatusValue, { ring: string; bg: string; text: string; dot: string }> = {
  active: { ring: 'border-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  expiring_soon: { ring: 'border-amber-400/30', bg: 'bg-amber-400/10', text: 'text-amber-300', dot: 'bg-amber-400' },
  expired: { ring: 'border-rose-400/30', bg: 'bg-rose-400/10', text: 'text-rose-300', dot: 'bg-rose-400' },
  lifetime: { ring: 'border-violet-400/30', bg: 'bg-violet-400/10', text: 'text-violet-300', dot: 'bg-violet-400' },
  paused: { ring: 'border-amber-400/30', bg: 'bg-amber-400/10', text: 'text-amber-200', dot: 'bg-amber-300' },
  revoked: { ring: 'border-white/15', bg: 'bg-white/[0.04]', text: 'text-white/60', dot: 'bg-white/40' },
}

export function KeysTable({ keys }: { keys: EnrichedKey[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_desc')

  const rows = useMemo(() => {
    const filtered = keys.filter((k) => {
      if (statusFilter !== 'all' && k.statusValue !== statusFilter) return false
      if (planFilter !== 'all' && k.plan !== planFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const hay = `${k.name} ${k.keyPrefix} ${k.keyFullLast4} ${k.plan}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const expiryMs = (v: number | null) => (v == null ? Number.POSITIVE_INFINITY : v)
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'created_asc':
          return a.createdMs - b.createdMs
        case 'expiry_asc':
          return expiryMs(a.expiryMs) - expiryMs(b.expiryMs)
        case 'expiry_desc':
          return expiryMs(b.expiryMs) - expiryMs(a.expiryMs)
        case 'remaining_asc':
          return (a.remainingDays ?? Number.POSITIVE_INFINITY) - (b.remainingDays ?? Number.POSITIVE_INFINITY)
        case 'created_desc':
        default:
          return b.createdMs - a.createdMs
      }
    })
    return sorted
  }, [keys, search, statusFilter, planFilter, sortKey])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, key, plan…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/35 focus:border-fuchsia-400/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/80 focus:outline-none">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring soon</option>
            <option value="expired">Expired</option>
            <option value="lifetime">Lifetime</option>
            <option value="paused">Disabled</option>
            <option value="revoked">Revoked</option>
          </select>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as PlanFilter)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/80 focus:outline-none">
            <option value="all">All plans</option>
            <option value="5X">5X</option>
            <option value="20X">20X</option>
            <option value="Custom">Custom</option>
            <option value="None">No budget</option>
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/80 focus:outline-none">
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="expiry_asc">Expiry soonest</option>
            <option value="expiry_desc">Expiry latest</option>
            <option value="remaining_asc">Fewest days left</option>
          </select>
        </div>
      </div>

      <div className="grad-border glass overflow-hidden rounded-2xl">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/10">
              <Key className="h-6 w-6 text-white/65" />
            </div>
            <h3 className="font-display mt-4 text-lg font-semibold text-white">No keys match</h3>
            <p className="mt-1 text-white/65">Adjust filters or create a new key.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Key</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Expiry</th>
                  <th className="px-5 py-3">Remaining</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((k) => {
                  const badge = STATUS_BADGE[k.statusValue]
                  return (
                    <tr key={k.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-3 font-medium text-white">{k.name}</td>
                      <td className="px-5 py-3">
                        <code className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-white/85">
                          {k.keyPrefix}…{k.keyFullLast4}
                        </code>
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-white/85">{k.plan}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.ring} ${badge.bg} ${badge.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {k.statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-white/55">{k.createdLabel}</td>
                      <td className="px-5 py-3 text-white/55">{k.expiryLabel}</td>
                      <td className="px-5 py-3">
                        <span className={k.statusValue === 'expired' ? 'text-rose-300' : k.statusValue === 'expiring_soon' ? 'text-amber-300' : 'text-white/80'}>
                          {k.remainingLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <KeyRowActions
                          keyId={k.id}
                          status={k.status}
                          name={k.name}
                          expiresAt={k.expiresAt}
                          hourlyTokenBudget={k.hourlyTokenBudget}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-white/40">
        Showing {rows.length} of {keys.length} keys.{' '}
        <Link href="/admin/keys/new" className="text-fuchsia-300 hover:underline">Create a new key →</Link>
      </p>
    </div>
  )
}
