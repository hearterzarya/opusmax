import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

interface SiteHeaderProps {
  active?: 'home' | 'docs' | 'status' | 'usage'
}

const links: { key: NonNullable<SiteHeaderProps['active']>; label: string; href: string }[] = [
  { key: 'docs', label: 'Docs', href: '/docs' },
  { key: 'status', label: 'Status', href: '/status' },
  { key: 'usage', label: 'Usage', href: '/key-status' },
]

export function SiteHeader({ active }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
            <span
              className="absolute inset-0 rounded-xl"
              style={{
                background:
                  'conic-gradient(from 200deg, hsl(var(--neon-violet)), hsl(var(--neon-pink)), hsl(var(--neon-cyan)), hsl(var(--neon-violet)))',
              }}
            />
            <span className="absolute inset-[2px] rounded-[10px] bg-background" />
            <span className="relative font-display text-base font-semibold text-white">O</span>
          </span>
          <span className="font-display text-lg font-semibold tracking-display text-white">
            Opus<span className="gradient-text">Max</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const isActive = active === l.key
            return (
              <Link
                key={l.key}
                href={l.href}
                className={`relative px-3 py-2 text-sm transition-colors ${
                  isActive ? 'text-white' : 'text-foreground/65 hover:text-white'
                }`}
              >
                {l.label}
                {isActive && (
                  <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent" />
                )}
              </Link>
            )
          })}
        </nav>

        <Link
          href="/admin/login"
          className="btn-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium"
        >
          Admin <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  )
}
