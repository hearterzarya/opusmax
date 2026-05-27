'use client'

import { ChevronDown } from 'lucide-react'
import { TROUBLESHOOTING_ITEMS } from '@/lib/docs-config'

export function DocsTroubleshooting() {
  return (
    <div className="space-y-2">
      {TROUBLESHOOTING_ITEMS.map((item, index) => (
        <details
          key={item.title}
          className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] open:border-cyan-500/20 open:bg-cyan-500/[0.03]"
          open={index === 0}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-white [&::-webkit-details-marker]:hidden">
            {item.title}
            <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform group-open:rotate-180" />
          </summary>
          <p className="border-t border-white/[0.05] px-4 py-3 text-sm leading-relaxed text-white/55">{item.body}</p>
        </details>
      ))}
    </div>
  )
}
