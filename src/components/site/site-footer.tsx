import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="relative mt-20 border-t border-white/5 bg-background/40 backdrop-blur-xl">
      <div className="divider-grad absolute inset-x-0 top-0" />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_repeat(2,_1fr)]">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
              <span
                className="absolute inset-0 rounded-lg"
                style={{
                  background:
                    'conic-gradient(from 200deg, hsl(var(--neon-violet)), hsl(var(--neon-pink)), hsl(var(--neon-cyan)), hsl(var(--neon-violet)))',
                }}
              />
              <span className="absolute inset-[2px] rounded-[7px] bg-background" />
              <span className="relative font-display text-sm font-semibold text-white">O</span>
            </span>
            <span className="font-display text-base font-semibold tracking-display text-white">
              Opus<span className="gradient-text">Max</span>
            </span>
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            One key for every Claude model. Drop-in Anthropic-compatible gateway with budgets,
            rate limits, and real-time usage.
          </p>
        </div>

        <FooterColumn
          title="Product"
          items={[
            { label: 'Docs', href: '/docs' },
            { label: 'Usage', href: '/key-status' },
            { label: 'Status', href: '/status' },
          ]}
        />
        <FooterColumn
          title="Legal"
          items={[
            { label: 'Terms', href: '/terms' },
            { label: 'Privacy', href: '/privacy' },
          ]}
        />
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} OpusMax. All rights reserved.</p>
          <p className="font-mono">build · {new Date().getFullYear()}.opusmax.pro</p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  items,
}: {
  title: string
  items: { label: string; href: string }[]
}) {
  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">
        {title}
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="text-foreground/70 transition-colors hover:text-white"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
