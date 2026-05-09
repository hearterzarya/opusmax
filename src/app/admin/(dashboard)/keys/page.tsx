import Link from 'next/link'
import { Key, Plus } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { KeyRowActions } from './key-row-actions'

type ApiKeyWithPlan = Prisma.ApiKeyGetPayload<Record<string, never>>

async function getApiKeys(): Promise<ApiKeyWithPlan[]> {
  try {
    return await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    })
  } catch (error) {
    console.error('Keys list fetch failed:', error)
    return []
  }
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { ring: string; text: string; bg: string; dot: string; label: string }> = {
    ACTIVE: { ring: 'border-emerald-400/30', text: 'text-emerald-300', bg: 'bg-emerald-400/10', dot: 'bg-emerald-400', label: 'Active' },
    PAUSED: { ring: 'border-amber-400/30', text: 'text-amber-300', bg: 'bg-amber-400/10', dot: 'bg-amber-400', label: 'Paused' },
    EXPIRED: { ring: 'border-white/10', text: 'text-white/65', bg: 'bg-white/[0.04]', dot: 'bg-white/40', label: 'Expired' },
    REVOKED: { ring: 'border-rose-400/30', text: 'text-rose-300', bg: 'bg-rose-400/10', dot: 'bg-rose-400', label: 'Revoked' },
  }
  const c = config[status] ?? { ring: 'border-white/10', text: 'text-white/65', bg: 'bg-white/[0.04]', dot: 'bg-white/40', label: status }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.ring} ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

export default async function AdminKeysPage() {
  const apiKeys = await getApiKeys()

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Manage</p>
          <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">
            API Keys
          </h1>
          <p className="mt-1 text-white/65">Create and manage keys with only essential controls.</p>
        </div>
        <Link
          href="/admin/keys/new"
          className="btn-grad inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Create new key
        </Link>
      </div>

      <div className="grad-border glass overflow-hidden rounded-2xl">
        {apiKeys.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/10">
              <Key className="h-6 w-6 text-white/65" />
            </div>
            <h3 className="font-display mt-4 text-lg font-semibold text-white">No API keys yet</h3>
            <p className="mt-1 text-white/65">Create your first key to start using OpusMax.</p>
            <Link
              href="/admin/keys/new"
              className="btn-grad mt-4 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Create API key
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Key prefix</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Last used</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-6 py-3 font-medium text-white">{key.name}</td>
                    <td className="px-6 py-3">
                      <code className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-white/85">
                        {key.keyPrefix}...
                      </code>
                    </td>
                    <td className="px-6 py-3">
                      <StatusPill status={key.status} />
                    </td>
                    <td className="px-6 py-3 text-white/55">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                    </td>
                    <td className="px-6 py-3">
                      <KeyRowActions keyId={key.id} status={key.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
