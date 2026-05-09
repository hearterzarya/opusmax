'use client'

import { useState } from 'react'
import { Pause, Play, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type KeyStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED'

interface KeyRowActionsProps {
  keyId: string
  status: KeyStatus | string
}

async function updateKeyStatus(keyId: string, action: 'pause' | 'activate' | 'reset_quota' | 'rotate' | 'delete') {
  const response = await fetch(`/api/admin/keys/${keyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string }; rawKey?: string }
    | null
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Failed to update key status')
  }
  return payload
}

export function KeyRowActions({ keyId, status }: KeyRowActionsProps) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [rotatedKey, setRotatedKey] = useState<string | null>(null)
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false)

  const isRevoked = status === 'REVOKED'
  const isPaused = status === 'PAUSED'
  const canPause = status === 'ACTIVE'
  const canActivate = status === 'PAUSED'

  const run = async (action: 'pause' | 'activate' | 'reset_quota' | 'rotate' | 'delete') => {
    try {
      setLoadingAction(action)
      const result = await updateKeyStatus(keyId, action)
      if (action === 'rotate' && result?.rawKey) {
        setRotatedKey(result.rawKey)
        setRotateDialogOpen(true)
      }
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update key'
      window.alert(message)
    } finally {
      setLoadingAction(null)
    }
  }

  const onCopyRotatedKey = async () => {
    if (!rotatedKey) return
    try {
      await navigator.clipboard.writeText(rotatedKey)
      window.alert('New key copied')
    } catch {
      window.alert('Copy failed')
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
        type="button"
        disabled={!canPause || !!loadingAction || isRevoked}
        onClick={() => run('pause')}
        className="inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Pause className="h-3 w-3" />
        Pause
      </button>
        <button
        type="button"
        disabled={isRevoked || !!loadingAction}
        onClick={() => {
          const ok = window.confirm('Rotate key now? Old key will stop working immediately.')
          if (ok) run('rotate')
        }}
        className="inline-flex items-center gap-1 rounded-md border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 text-xs text-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className="h-3 w-3" />
        Rotate
      </button>
        <button
        type="button"
        disabled={!canActivate || !!loadingAction || isRevoked}
        onClick={() => run('activate')}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-3 w-3" />
        Resume
      </button>
        <button
        type="button"
        disabled={isRevoked || !!loadingAction}
        onClick={() => {
          const ok = window.confirm('Reset this key 5-hour quota window now?')
          if (ok) run('reset_quota')
        }}
        className="inline-flex items-center gap-1 rounded-md border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw className="h-3 w-3" />
        Reset 5h
      </button>
        <button
          type="button"
          disabled={!!loadingAction}
          onClick={() => {
            const ok = window.confirm('Delete this API key permanently? This cannot be undone.')
            if (ok) run('delete')
          }}
          className="inline-flex items-center gap-1 rounded-md border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-xs text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
        {isPaused && <span className="text-[11px] text-amber-300/80">Paused</span>}
      </div>

      <AlertDialog open={rotateDialogOpen} onOpenChange={setRotateDialogOpen}>
        <AlertDialogContent open={rotateDialogOpen} onOpenChange={setRotateDialogOpen}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">New API Key Generated</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              This key is shown only once. Copy and store it securely now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-white/15 bg-black/30 p-3 font-mono text-xs text-white break-all">
            {rotatedKey || '—'}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setRotateDialogOpen(false)}
            >
              Close
            </AlertDialogCancel>
            <AlertDialogAction onClick={onCopyRotatedKey}>
              Copy New Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
