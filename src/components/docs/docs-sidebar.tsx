'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DOC_NAV } from '@/lib/docs-config'
import { cn } from '@/lib/utils'

export function DocsSidebar() {
  const [activeId, setActiveId] = useState('overview')

  useEffect(() => {
    const ids = DOC_NAV.flatMap((g) => g.items.map((i) => i.id))
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -60% 0px', threshold: [0, 0.15, 0.4] }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <nav className="sticky top-24 max-h-[calc(100vh-6.5rem)] overflow-y-auto pr-2">
        {DOC_NAV.map((group) => (
          <div key={group.title} className="mb-7">
            <p className="mb-2 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-200/50">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeId === item.id
                return (
                  <li key={item.id}>
                    <Link
                      href={`#${item.id}`}
                      onClick={() => setActiveId(item.id)}
                      className={cn(
                        'block rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                        active
                          ? 'bg-cyan-500/10 font-medium text-cyan-100 ring-1 ring-cyan-500/25'
                          : 'text-white/50 hover:bg-white/[0.03] hover:text-white/85'
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
