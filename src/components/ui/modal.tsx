'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c14]/95 shadow-2xl animate-in fade-in zoom-in-95"
      >
        <div className="h-[3px] w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 className="font-display tracking-display text-xl font-semibold text-white">{title}</h2>
            {description && <p className="mt-1 text-sm text-white/60">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-white/[0.02] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
