'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const VARIANT_STYLES: Record<ToastVariant, { ring: string; bg: string; text: string; Icon: React.ElementType }> = {
  success: { ring: 'border-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-100', Icon: CheckCircle2 },
  error: { ring: 'border-rose-400/30', bg: 'bg-rose-400/10', text: 'text-rose-100', Icon: AlertCircle },
  info: { ring: 'border-sky-400/30', bg: 'bg-sky-400/10', text: 'text-sky-100', Icon: Info },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++counter.current
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const value: ToastContextValue = {
    toast,
    success: useCallback((m: string) => toast(m, 'success'), [toast]),
    error: useCallback((m: string) => toast(m, 'error'), [toast]),
    info: useCallback((m: string) => toast(m, 'info'), [toast]),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const { ring, bg, text, Icon } = VARIANT_STYLES[item.variant]

  useEffect(() => {
    const id = window.setTimeout(onClose, 4000)
    return () => window.clearTimeout(id)
  }, [onClose])

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${ring} ${bg} ${text} p-3 shadow-lg backdrop-blur-md animate-in slide-in-from-right-5`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-sm">{item.message}</p>
      <button
        onClick={onClose}
        className="rounded p-0.5 text-white/50 transition-colors hover:text-white"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
