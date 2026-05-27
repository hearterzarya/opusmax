import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export function StepCard({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 font-mono text-xs font-semibold text-cyan-200 ring-1 ring-cyan-500/25">
        {step}
      </span>
      <p className="text-sm leading-relaxed text-white/70">{children}</p>
    </div>
  )
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
        <Icon className="h-5 w-5 text-cyan-300" />
      </div>
      <h3 className="font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{description}</p>
    </div>
  )
}

export function ToolCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-5 backdrop-blur-sm">
      <h3 className="font-mono text-sm font-medium text-violet-200">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{description}</p>
    </div>
  )
}

export function ModelCard({
  name,
  badge,
  badgeClass,
  id,
  description,
}: {
  name: string
  badge: string
  badgeClass: string
  id: string
  description: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0d14]/80 p-5 backdrop-blur-sm transition hover:border-cyan-500/20">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl transition group-hover:bg-cyan-500/20" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-white">{name}</h3>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1', badgeClass)}>
            {badge}
          </span>
        </div>
        <code className="mt-3 block font-mono text-sm text-cyan-200/90">{id}</code>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{description}</p>
      </div>
    </div>
  )
}

export function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-white/50">{label}</span>
      <code className="font-mono text-sm text-cyan-100/90">{value}</code>
    </div>
  )
}
