import { ArrowUpRight, Sparkles } from 'lucide-react'

const BADGE_COLORS: Record<string, string> = {
  Latest:    'bg-amber-500/15 text-amber-200 ring-amber-500/30',
  Flagship: 'bg-violet-500/15 text-violet-200 ring-violet-500/30',
  Premium:   'bg-amber-500/10 text-amber-200/70 ring-amber-500/20',
  Popular:   'bg-cyan-500/15 text-cyan-200 ring-cyan-500/30',
  Stable:    'bg-violet-500/10 text-violet-200/60 ring-violet-500/20',
  Fast:      'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
}

const MODEL_ACCENT: Record<string, string> = {
  'claude-fable-5[1m]':       'bg-gradient-to-br from-amber-500/30 to-orange-500/20',
  'claude-opus-4-8[1m]':      'bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20',
  'claude-opus-4-7':          'bg-gradient-to-br from-amber-500/25 to-orange-500/15',
  'claude-sonnet-5':          'bg-gradient-to-br from-cyan-500/30 to-blue-500/20',
  'claude-sonnet-4-6':        'bg-gradient-to-br from-violet-500/20 to-blue-500/10',
  'claude-haiku-4-5-20251001':'bg-gradient-to-br from-emerald-500/30 to-teal-500/20',
}

export interface ModelCardData {
  name: string
  badge: string
  badgeClass: string
  id: string
  description: string
}

interface ModelGridProps {
  models: readonly ModelCardData[]
}

export function ModelGrid({ models }: ModelGridProps) {
  return (
    <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((m, i) => (
        <ModelCard key={m.id} model={m} index={i} />
      ))}
    </div>
  )
}

function ModelCard({ model, index }: { model: ModelCardData; index: number }) {
  return (
    <div
      className={[
        'model-card tilt-3d glass-hover lift reveal',
        'group cursor-pointer rounded-3xl p-5',
        'relative',
        BADGE_COLORS[model.badge] || 'bg-white/[0.07] text-white/80 ring-white/20',
        'reveal-delay-' + (index % 6),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="card-glow rounded-3xl" aria-hidden />

      <span
        className={[
          'inline-flex h-10 w-10 items-center justify-center rounded-2xl',
          'text-lg',
          MODEL_ACCENT[model.id] || 'bg-white/5 text-white/80',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Sparkles className="h-5 w-5 text-white/90" />
      </span>

      <div className="mt-4">
        <span className="font-mono text-xs uppercase tracking-widest text-white/45">
          {model.id}
        </span>
        <h3 className="font-display mt-1 text-xl font-semibold text-white">{model.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/65">
          {model.description}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full border bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70 border-white/10">
          {model.badge}
        </span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/0 transition-all duration-300 group-hover:bg-white/10">
          <ArrowUpRight className="h-4 w-4 -rotate-45 text-white/0 transition-all duration-300 group-hover:text-white" />
        </span>
      </div>
    </div>
  )
}
