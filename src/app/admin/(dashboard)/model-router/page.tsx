'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, CheckCircle2, Cpu, DollarSign, Zap } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface ModelInfo {
  id: string
  name: string
  cost: string
  inputPer1M: string
  outputPer1M: string
}

interface UsageEntry {
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requests: number
}

interface RouterData {
  modelOverride: { enabled: boolean; targetModel: string | null }
  availableModels: ModelInfo[]
  usage24h: UsageEntry[]
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function ModelRouterPage() {
  const toast = useToast()
  const [data, setData] = useState<RouterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/model-router')
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setEnabled(json.modelOverride.enabled)
        setSelectedModel(json.modelOverride.targetModel || '')
      }
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    intervalRef.current = setInterval(fetchData, 10000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  const save = async () => {
    if (enabled && !selectedModel) {
      toast.error('Select a target model first')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/model-router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, targetModel: selectedModel || undefined }),
      })
      if (res.ok) {
        toast.success(enabled ? `All requests now routed to ${selectedModel}` : 'Model override disabled — using user-requested models')
        fetchData()
      } else {
        toast.error('Failed to save')
      }
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  if (loading) return <div className="mx-auto max-w-4xl"><p className="text-white/50">Loading...</p></div>

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Cost Control</p>
        <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">Model Router</h1>
        <p className="mt-1 text-white/65">Force all user requests to a specific model to reduce token costs.</p>
      </div>

      {/* Override Control */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-violet-500/20 ring-1 ring-white/10">
              <Cpu className="h-5 w-5 text-fuchsia-300" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Global Model Override</h2>
              <p className="text-sm text-white/55">When enabled, ALL requests are routed to the selected model regardless of what the user requested.</p>
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.45)]' : 'bg-white/10'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {enabled && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">Route all requests to:</label>
              <div className="mt-3 grid gap-2">
                {data?.availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
                      selectedModel === model.id
                        ? 'border-fuchsia-400/40 bg-fuchsia-400/10 shadow-[0_0_20px_-5px_rgba(217,70,239,0.3)]'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-white">{model.name}</p>
                      <p className="text-xs text-white/50 font-mono">{model.id}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        model.cost === 'Cheapest' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' :
                        model.cost === 'Very Cheap' ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' :
                        model.cost === 'Medium' ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' :
                        'border-rose-400/30 bg-rose-400/10 text-rose-300'
                      }`}>{model.cost}</span>
                      <p className="mt-1 text-[10px] text-white/40">In: {model.inputPer1M} · Out: {model.outputPer1M}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-grad inline-flex h-10 items-center gap-2 rounded-full px-6 text-sm font-medium disabled:opacity-60">
            {saving ? 'Saving...' : enabled ? 'Apply Model Override' : 'Disable Override'}
          </button>
          {data?.modelOverride.enabled && data.modelOverride.targetModel && (
            <p className="text-xs text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Currently active: <span className="font-mono">{data.modelOverride.targetModel}</span>
            </p>
          )}
        </div>
      </div>

      {/* Token Usage (24h) */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-4 w-4 text-amber-300" />
          <h3 className="font-display text-lg font-semibold text-white">Token Usage (Last 24h)</h3>
          <Activity className="h-3 w-3 animate-pulse text-fuchsia-300 ml-auto" />
        </div>

        {data?.usage24h && data.usage24h.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
                  <th className="pb-2">Model</th>
                  <th className="pb-2 text-right">Input Tokens</th>
                  <th className="pb-2 text-right">Output Tokens</th>
                  <th className="pb-2 text-right">Total Tokens</th>
                  <th className="pb-2 text-right">Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.usage24h.map((u) => (
                  <tr key={u.model} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 font-mono text-white/90">{u.model}</td>
                    <td className="py-2.5 text-right text-white/70">{compactNumber(u.inputTokens)}</td>
                    <td className="py-2.5 text-right text-white/70">{compactNumber(u.outputTokens)}</td>
                    <td className="py-2.5 text-right font-medium text-white">{compactNumber(u.totalTokens)}</td>
                    <td className="py-2.5 text-right text-white/60">{u.requests}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10">
                  <td className="pt-2.5 font-medium text-white">Total</td>
                  <td className="pt-2.5 text-right text-white/70">{compactNumber(data.usage24h.reduce((s, u) => s + u.inputTokens, 0))}</td>
                  <td className="pt-2.5 text-right text-white/70">{compactNumber(data.usage24h.reduce((s, u) => s + u.outputTokens, 0))}</td>
                  <td className="pt-2.5 text-right font-medium text-white">{compactNumber(data.usage24h.reduce((s, u) => s + u.totalTokens, 0))}</td>
                  <td className="pt-2.5 text-right text-white/60">{data.usage24h.reduce((s, u) => s + u.requests, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-white/40">No usage data in the last 24 hours.</p>
        )}
      </div>

      {/* How it works */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-300" />
          <p className="text-xs font-medium text-white/60">How it works</p>
        </div>
        <div className="mt-3 space-y-2 text-xs text-white/50">
          <p>• When enabled, user requests <span className="text-white/80 font-mono">claude-opus-4-8</span> but actually gets routed to your selected model</p>
          <p>• The user/Claude Code won&apos;t notice — response format stays the same</p>
          <p>• Switch to <span className="text-emerald-300">Haiku</span> for 60x cheaper tokens vs <span className="text-rose-300">Opus</span></p>
          <p>• Disable anytime to let users choose their own models</p>
        </div>
      </div>
    </div>
  )
}
