'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { DOC_NAV } from '@/lib/docs-config'

export function DocsMobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white"
      >
        Browse sections
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
      {open && (
        <nav className="mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0a0d14]/95 p-4 backdrop-blur-xl">
          {DOC_NAV.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-cyan-200/50">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`#${item.id}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-2 py-1.5 text-sm text-white/65 hover:bg-white/[0.04] hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      )}
    </div>
  )
}
