'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Cloud, Edit2, Plus, Power, Star, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'

interface Provider {
  id: string
  name: string
  displayName: string
  baseUrl: string
  authMethod: string
  authHeaderName: string | null
  authValue: string
  isActive: boolean
  isDefault: boolean
  anthropicVersion: string | null
  notes: string | null
  createdAt: string
}

const AUTH_METHODS = [
  { value: 'x-api-key', label: 'x-api-key (Anthropic standard)', hint: 'ANTHROPIC_API_KEY' },
  { value: 'bearer', label: 'Bearer Token (Authorization: Bearer ...)', hint: 'ANTHROPIC_AUTH_TOKEN / CLAUDE_CODE_OAUTH_TOKEN' },
  { value: 'oauth', label: 'OAuth Token (same as Bearer)', hint: 'CLAUDE_CODE_OAUTH_TOKEN' },
  { value: 'custom-header', label: 'Custom Header', hint: 'Any custom auth header' },
]

const PRESETS = [
  { name: 'anthropic-direct', displayName: 'Anthropic Direct', baseUrl: 'https://api.anthropic.com', authMethod: 'x-api-key' },
  { name: 'opusmax', displayName: 'OpusMax', baseUrl: 'https://api.opusmax.pro', authMethod: 'x-api-key' },
  { name: 'anthropic-oauth', displayName: 'Anthropic OAuth', baseUrl: 'https://api.anthropic.com', authMethod: 'bearer' },
]

export default function ProvidersPage() {
  const router = useRouter()
  const toast = useToast()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editProvider, setEditProvider] = useState<Provider | null>(null)

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/providers')
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers ?? [])
      }
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete provider "${name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Provider deleted'); fetchProviders() }
      else toast.error('Delete failed')
    } catch { toast.error('Delete failed') }
  }

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })
      if (res.ok) { toast.success(currentActive ? 'Provider disabled' : 'Provider enabled'); fetchProviders() }
    } catch { toast.error('Toggle failed') }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (res.ok) { toast.success('Default provider updated'); fetchProviders() }
    } catch { toast.error('Update failed') }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Configuration</p>
          <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">Providers</h1>
          <p className="mt-1 text-white/65">Manage upstream AI providers. Supports Anthropic API Key, Bearer/OAuth tokens, and custom auth.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-grad inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium">
          <Plus className="h-4 w-4" /> Add Provider
        </button>
      </div>

      {/* Auth method support info */}
      <div className="glass rounded-2xl p-4">
        <p className="text-xs text-white/50 font-mono uppercase tracking-wide">Supported Authentication Methods</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="font-medium text-white">ANTHROPIC_API_KEY</p>
            <p className="text-white/50 mt-1">x-api-key header (standard Anthropic)</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="font-medium text-white">ANTHROPIC_AUTH_TOKEN</p>
            <p className="text-white/50 mt-1">Authorization: Bearer (token auth)</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="font-medium text-white">CLAUDE_CODE_OAUTH_TOKEN</p>
            <p className="text-white/50 mt-1">OAuth Bearer token (Claude Code)</p>
          </div>
        </div>
      </div>

      {/* Provider list */}
      {loading ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-white/50">Loading providers...</p></div>
      ) : providers.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Cloud className="mx-auto h-10 w-10 text-white/30" />
          <h3 className="font-display mt-4 text-lg font-semibold text-white">No providers configured</h3>
          <p className="mt-1 text-white/55">Add your first upstream AI provider to start routing requests.</p>
          <button onClick={() => setAddOpen(true)} className="btn-grad mt-4 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium">
            <Plus className="h-4 w-4" /> Add Provider
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className={`glass rounded-2xl p-5 transition-all ${p.isDefault ? 'ring-1 ring-fuchsia-400/40' : ''} ${!p.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-white">{p.displayName}</h3>
                    {p.isDefault && <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300"><Star className="h-2.5 w-2.5" /> DEFAULT</span>}
                    {!p.isActive && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50">DISABLED</span>}
                  </div>
                  <p className="mt-1 font-mono text-xs text-white/55">{p.name}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <div><p className="text-white/40">Base URL</p><p className="font-mono text-white/80 truncate">{p.baseUrl}</p></div>
                    <div><p className="text-white/40">Auth Method</p><p className="text-white/80">{p.authMethod}</p></div>
                    <div><p className="text-white/40">API Key</p><p className="font-mono text-white/80">{p.authValue}</p></div>
                    <div><p className="text-white/40">Version</p><p className="text-white/80">{p.anthropicVersion || '—'}</p></div>
                  </div>
                  {p.notes && <p className="mt-2 text-xs text-white/40">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  {!p.isDefault && <button onClick={() => handleSetDefault(p.id)} title="Set as default" className="rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-fuchsia-300"><Star className="h-4 w-4" /></button>}
                  <button onClick={() => setEditProvider(p)} title="Edit" className="rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-white"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => handleToggle(p.id, p.isActive)} title={p.isActive ? 'Disable' : 'Enable'} className="rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-amber-300"><Power className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(p.id, p.displayName)} title="Delete" className="rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <ProviderFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => { fetchProviders(); setAddOpen(false) }}
        mode="add"
      />

      {/* Edit Modal */}
      {editProvider && (
        <ProviderFormModal
          open={!!editProvider}
          onClose={() => setEditProvider(null)}
          onSaved={() => { fetchProviders(); setEditProvider(null) }}
          mode="edit"
          provider={editProvider}
        />
      )}
    </div>
  )
}

function ProviderFormModal({ open, onClose, onSaved, mode, provider }: {
  open: boolean; onClose: () => void; onSaved: () => void
  mode: 'add' | 'edit'; provider?: Provider
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(provider?.name ?? '')
  const [displayName, setDisplayName] = useState(provider?.displayName ?? '')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '')
  const [messagesPath, setMessagesPath] = useState((provider as any)?.messagesPath ?? '/v1/messages')
  const [format, setFormat] = useState((provider as any)?.format ?? 'anthropic')
  const [modelOverride, setModelOverride] = useState((provider as any)?.modelOverride ?? '')
  const [authMethod, setAuthMethod] = useState(provider?.authMethod ?? 'x-api-key')
  const [authHeaderName, setAuthHeaderName] = useState(provider?.authHeaderName ?? '')
  const [authValue, setAuthValue] = useState('')
  const [isDefault, setIsDefault] = useState(provider?.isDefault ?? false)
  const [anthropicVersion, setAnthropicVersion] = useState(provider?.anthropicVersion ?? '2023-06-01')
  const [notes, setNotes] = useState(provider?.notes ?? '')

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name)
    setDisplayName(preset.displayName)
    setBaseUrl(preset.baseUrl)
    setAuthMethod(preset.authMethod)
  }

  const submit = async () => {
    if (!name.trim() || !displayName.trim() || !baseUrl.trim()) {
      toast.error('Name, display name, and base URL are required'); return
    }
    if (mode === 'add' && !authValue.trim()) {
      toast.error('Auth value (API key/token) is required'); return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        displayName, baseUrl, messagesPath, format, modelOverride: modelOverride || null, authMethod, isDefault, anthropicVersion: anthropicVersion || null, notes: notes || null,
        authHeaderName: authMethod === 'custom-header' ? authHeaderName : null,
      }
      if (mode === 'add') {
        body.name = name
        body.authValue = authValue
      } else if (authValue.trim()) {
        body.authValue = authValue
      }

      const url = mode === 'add' ? '/api/admin/providers' : `/api/admin/providers/${provider!.id}`
      const method = mode === 'add' ? 'POST' : 'PATCH'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed')
      toast.success(mode === 'add' ? 'Provider created' : 'Provider updated')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Operation failed')
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'add' ? 'Add Provider' : `Edit ${provider?.displayName}`} footer={
      <>
        <button onClick={onClose} disabled={saving} className="rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.06]">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-grad rounded-lg px-4 py-2 text-sm font-medium">{saving ? 'Saving...' : mode === 'add' ? 'Create Provider' : 'Save Changes'}</button>
      </>
    }>
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        {mode === 'add' && (
          <div>
            <p className="text-xs text-white/50 mb-2">Quick presets:</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => applyPreset(p)} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06]">{p.displayName}</button>
              ))}
            </div>
          </div>
        )}

        <Field label="Slug (unique ID)" value={name} onChange={setName} placeholder="anthropic-direct" disabled={mode === 'edit'} mono />
        <Field label="Display Name" value={displayName} onChange={setDisplayName} placeholder="Anthropic Direct" />
        <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api.anthropic.com" mono />
        <Field label="Messages Path" value={messagesPath} onChange={setMessagesPath} placeholder="/v1/messages" mono />

        <div>
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">API Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-fuchsia-400/50 focus:outline-none">
            <option value="anthropic">Anthropic (Claude API format)</option>
            <option value="openai">OpenAI (GPT/MiniMax/Together format)</option>
          </select>
          <p className="mt-1 text-[10px] text-white/40">
            {format === 'openai' ? 'Request will be auto-converted from Anthropic → OpenAI format' : 'Standard Anthropic /v1/messages format'}
          </p>
        </div>

        <Field label="Model Override (optional)" value={modelOverride} onChange={setModelOverride} placeholder="e.g. minimax-01 (leave empty to use original model)" mono />

        <div>
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">Auth Method</label>
          <select value={authMethod} onChange={(e) => setAuthMethod(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-fuchsia-400/50 focus:outline-none">
            {AUTH_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <p className="mt-1 text-[10px] text-white/40">
            {AUTH_METHODS.find(m => m.value === authMethod)?.hint}
          </p>
        </div>

        {authMethod === 'custom-header' && (
          <Field label="Custom Header Name" value={authHeaderName} onChange={setAuthHeaderName} placeholder="X-Custom-Auth" mono />
        )}

        <div>
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
            {mode === 'edit' ? 'Auth Value (leave blank to keep current)' : 'Auth Value (API Key / Token)'}
          </label>
          <input type="password" value={authValue} onChange={(e) => setAuthValue(e.target.value)} placeholder={mode === 'edit' ? '••• leave blank to keep •••' : 'sk-ant-... or oauth token'} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/35 focus:border-fuchsia-400/50 focus:outline-none" />
          <p className="mt-1 text-[10px] text-white/40">
            Supports: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, or any custom token
          </p>
        </div>

        <Field label="Anthropic Version" value={anthropicVersion} onChange={setAnthropicVersion} placeholder="2023-06-01" mono />
        <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Production key for..." />

        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Set as default provider
        </label>
      </div>
    </Modal>
  )
}

function Field({ label, value, onChange, placeholder, disabled, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; mono?: boolean
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={`mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-fuchsia-400/50 focus:outline-none disabled:opacity-50 ${mono ? 'font-mono' : ''}`} />
    </div>
  )
}
