'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DOC_NAV } from '@/lib/docs-config'
import { cn } from '@/lib/utils'

/** Compact on-page outline for xl+ viewports */
export function DocsToc() {
  const [activeId, setActiveId] = useState('overview')

  useEffect(() => {
    const ids = DOC_NAV.flatMap((g) => g.items.map((i) => i.id))
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.2] }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const flat = DOC_NAV.flatMap((g) => g.items)

  return (
    <aside className="hidden w-44 shrink-0 2xl:block">
      <div className="sticky top-24">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">On this page</p>
        <ul className="space-y-1 border-l border-white/[0.06] pl-3">
          {flat.map((item) => (
            <li key={item.id}>
              <Link
                href={`#${item.id}`}
                className={cn(
                  'block py-0.5 text-[12px] leading-snug transition-colors',
                  activeId === item.id ? 'text-cyan-200' : 'text-white/40 hover:text-white/70'
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
