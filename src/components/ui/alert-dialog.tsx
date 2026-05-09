'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const AlertDialogContext = React.createContext<{ onOpenChange: (open: boolean) => void } | null>(null)

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  return (
    <AlertDialogContext.Provider value={{ onOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

function AlertDialogTrigger({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <div onClick={onClick}>{children}</div>
}

function AlertDialogContent({ children, open, onOpenChange }: {
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 glass rounded-xl border p-6 shadow-lg max-w-md w-full mx-4 animate-fade-in">
        {children}
      </div>
    </div>
  )
}

function AlertDialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

function AlertDialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mt-6 flex justify-end gap-3', className)}>{children}</div>
}

function AlertDialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold', className)}>{children}</h2>
}

function AlertDialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-sm text-muted-foreground mt-2', className)}>{children}</p>
}

function AlertDialogAction({ children, onClick, variant = 'default' }: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'default' | 'destructive'
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
      )}
    >
      {children}
    </button>
  )
}

function AlertDialogCancel({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center justify-center rounded-lg border border-input bg-transparent px-4 py-2 text-sm hover:bg-accent/10">
      {children}
    </button>
  )
}

function AlertDialogClose({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const ctx = React.useContext(AlertDialogContext)
  return (
    <button onClick={() => { onClick?.(); ctx?.onOpenChange(false) }} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
      <X className="h-4 w-4" />
    </button>
  )
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogClose,
}