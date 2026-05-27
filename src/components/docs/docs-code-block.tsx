'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DocsCodeBlock({
  code,
  label,
  className,
}: {
  code: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-cyan-500/10 bg-[#06080f]/90 shadow-[0_0_40px_-12px_rgba(34,211,238,0.15)]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-violet-500/[0.06]" />
      <div className="relative flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/45">{label ?? 'Code'}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 transition hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="relative overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-200">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}
