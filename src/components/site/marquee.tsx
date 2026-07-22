interface MarqueeItem {
  label: string
  tag: string
}

interface MarqueeProps {
  items: readonly MarqueeItem[]
}

/**
 * Pure CSS marquee — duplicated content so the loop is seamless.
 * Pause-on-hover is built in via the .marquee-track hover rule.
 */
export function Marquee({ items }: MarqueeProps) {
  const doubled = [...items, ...items]
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <div className="marquee-track">
        {doubled.map((item, i) => (
          <div
            key={i}
            className="mx-3 inline-flex shrink-0 items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 backdrop-blur"
          >
            <span className="font-display text-sm font-medium text-white">{item.label}</span>
            <span className="text-white/30">·</span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/50">
              {item.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
