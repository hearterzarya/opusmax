import { ArrowUpRight, ShieldCheck, Zap } from 'lucide-react'

const STATS = [
  { value: '100%', label: 'Anthropic-compatible' },
  { value: '<50ms', label: 'Proxy latency' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: 'FIPS', label: 'Ready' },
]

export function Stats() {
  return (
    <div className="mt-14 flex flex-wrap justify-center gap-10">
      {STATS.map((s) => (
        <div key={s.label} className="text-center">
          <div className="font-display text-3xl font-semibold text-white">{s.value}</div>
          <div className="mt-1 text-xs uppercase tracking-wider text-white/55">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
