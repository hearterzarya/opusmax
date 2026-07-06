'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  ChevronRight,
  Home,
  Key,
  LayoutDashboard,
  LogOut,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'API Keys', href: '/admin/keys', icon: Key },
  { label: 'Latency', href: '/admin/latency', icon: BarChart3 },
  { label: 'Usage', href: '/admin/usage', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

function getCrumb(pathname: string): string {
  const seg = pathname.split('/')[2]
  if (!seg) return 'Dashboard'
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <div className="relative flex min-h-screen text-white">
      <aside className="relative z-10 flex w-64 flex-col border-r border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="border-b border-white/5 p-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
              <span
                className="absolute inset-0 rounded-xl"
                style={{
                  background:
                    'conic-gradient(from 200deg, hsl(var(--neon-violet)), hsl(var(--neon-pink)), hsl(var(--neon-cyan)), hsl(var(--neon-violet)))',
                }}
              />
              <span className="absolute inset-[2px] rounded-[10px] bg-background" />
              <span className="relative font-display text-sm font-semibold text-white">O</span>
            </span>
            <div>
              <p className="font-display text-base font-semibold tracking-display text-white">
                Opus<span className="gradient-text">Max</span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                Admin Console
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                  isActive
                    ? 'bg-white/[0.06] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]'
                    : 'text-white/60 hover:bg-white/[0.03] hover:text-white'
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-gradient-to-b from-violet-400 via-fuchsia-400 to-cyan-400 shadow-[0_0_12px_rgba(217,70,239,0.7)]"
                  />
                )}
                <item.icon
                  className={cn(
                    'h-4 w-4 transition-transform group-hover:scale-110',
                    isActive ? 'text-fuchsia-300' : 'text-white/60'
                  )}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/5 p-3">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 transition-all hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/5 bg-background/60 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-white/55 transition-colors hover:text-white">
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-4 w-4 text-white/30" />
            <span className="text-white">Admin</span>
            {pathname !== '/admin' && (
              <>
                <ChevronRight className="h-4 w-4 text-white/30" />
                <span className="text-white">{getCrumb(pathname)}</span>
              </>
            )}
          </div>
          <Link
            href="/key-status"
            className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white md:inline-flex"
          >
            Public usage page →
          </Link>
        </header>

        <main className="relative flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
