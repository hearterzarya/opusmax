'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CalendarPlus,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import {
  detectPlan,
  getApiKeyStatus,
  PLAN_BUDGETS,
  type PlanName,
} from '@/lib/api-key-status'
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
  name: string
  expiresAt: string | null
  hourlyTokenBudget: string | null
}

const ONE_DAY_MS = 86_400_000

async function patchKey(keyId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/keys/${keyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await res.json().catch(() => null)) as
    | { error?: { message?: string }; rawKey?: string }
    | null
  if (!res.ok) throw new Error(payload?.error?.message || 'Request failed')
  return payload
}

async function postAction(keyId: string, action: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/keys/${keyId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await res.json().catch(() => null)) as
    | { error?: { message?: string }; message?: string }
    | null
  if (!res.ok) throw new Error(payload?.error?.message || 'Request failed')
  return payload
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

export function KeyRowActions({
  keyId,
  status,
  name,
  expiresAt,
  hourlyTokenBudget,
}: KeyRowActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [rotatedKey, setRotatedKey] = useState<string | null>(null)
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false)

  const [expiryOpen, setExpiryOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)

  const isRevoked = status === 'REVOKED'
  const canPause = status === 'ACTIVE'
  const canActivate = status === 'PAUSED'
  const currentPlan = detectPlan(hourlyTokenBudget ? BigInt(hourlyTokenBudget) : null)

  const run = async (action: 'pause' | 'activate' | 'rotate' | 'reset_quota' | 'delete', label: string) => {
    try {
      setLoadingAction(action)
      const result = await patchKey(keyId, { action })
      if (action === 'rotate' && result?.rawKey) {
        setRotatedKey(result.rawKey)
        setRotateDialogOpen(true)
      }
      toast.success(label)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <ActionButton color="sky" icon={CalendarClock} label="Expiry" disabled={isRevoked || !!loadingAction} onClick={() => setExpiryOpen(true)} />
        <ActionButton color="cyan" icon={CalendarPlus} label="Extend" disabled={isRevoked || !!loadingAction} onClick={() => setExtendOpen(true)} />
        <ActionButton color="fuchsia" icon={Repeat} label="Plan" disabled={isRevoked || !!loadingAction} onClick={() => setPlanOpen(true)} />
        <ActionButton color="amber" icon={Pause} label="Pause" disabled={!canPause || !!loadingAction} onClick={() => run('pause', 'Key paused')} />
        <ActionButton color="emerald" icon={Play} label="Resume" disabled={!canActivate || !!loadingAction} onClick={() => run('activate', 'Key resumed')} />
        <ActionButton color="violet" icon={RefreshCw} label="Rotate" disabled={isRevoked || !!loadingAction} onClick={() => { if (window.confirm('Rotate key now? Old key stops working immediately.')) run('rotate', 'Key rotated') }} />
        <ActionButton color="cyan" icon={RotateCcw} label="Reset 5h" disabled={isRevoked || !!loadingAction} onClick={() => { if (window.confirm('Reset this key 5-hour quota window now?')) run('reset_quota', 'Quota window reset') }} />
        <ActionButton color="rose" icon={Trash2} label="Delete" disabled={!!loadingAction} onClick={() => { if (window.confirm('Delete this API key permanently? This cannot be undone.')) run('delete', 'Key deleted') }} />
      </div>

      <SetExpiryModal
        open={expiryOpen}
        onClose={() => setExpiryOpen(false)}
        name={name}
        expiresAt={expiresAt}
        status={status}
        onSaved={() => router.refresh()}
        onError={(m) => toast.error(m)}
        onSuccess={(m) => toast.success(m)}
        keyId={keyId}
      />

      <ExtendModal
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        name={name}
        expiresAt={expiresAt}
        status={status}
        keyId={keyId}
        onSaved={() => router.refresh()}
        onError={(m) => toast.error(m)}
        onSuccess={(m) => toast.success(m)}
      />

      <ConvertPlanModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        name={name}
        currentPlan={currentPlan}
        keyId={keyId}
        onSaved={() => router.refresh()}
        onError={(m) => toast.error(m)}
        onSuccess={(m) => toast.success(m)}
      />

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
            <AlertDialogCancel onClick={() => setRotateDialogOpen(false)}>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!rotatedKey) return
                try {
                  await navigator.clipboard.writeText(rotatedKey)
                  toast.success('New key copied')
                } catch {
                  toast.error('Copy failed')
                }
              }}
            >
              Copy New Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const COLORS: Record<string, string> = {
  sky: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  cyan: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200',
  fuchsia: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200',
  amber: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  emerald: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  violet: 'border-violet-400/25 bg-violet-400/10 text-violet-200',
  rose: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
}

function ActionButton({
  color,
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  color: string
  icon: React.ElementType
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${COLORS[color]}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

function ModalButton({
  variant = 'ghost',
  ...props
}: { variant?: 'primary' | 'ghost' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60'
  const cls =
    variant === 'primary'
      ? 'btn-grad'
      : 'border border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]'
  return <button {...props} className={`${base} ${cls}`} />
}

// ---------------- Set Expiry ----------------
function SetExpiryModal({
  open,
  onClose,
  name,
  expiresAt,
  status,
  keyId,
  onSaved,
  onSuccess,
  onError,
}: {
  open: boolean
  onClose: () => void
  name: string
  expiresAt: string | null
  status: string
  keyId: string
  onSaved: () => void
  onSuccess: (m: string) => void
  onError: (m: string) => void
}) {
  const [value, setValue] = useState<string>(() => toDatetimeLocal(expiresAt))
  const [saving, setSaving] = useState(false)

  const info = useMemo(() => getApiKeyStatus(expiresAt, status), [expiresAt, status])

  const applyQuickDays = (days: number) => {
    const target = new Date(Date.now() + days * ONE_DAY_MS)
    setValue(toDatetimeLocal(target.toISOString()))
  }

  const submit = async (clear = false) => {
    setSaving(true)
    try {
      let iso: string | null = null
      if (!clear) {
        if (!value) {
          onError('Pick a date or choose “No expiry”.')
          setSaving(false)
          return
        }
        const d = new Date(value)
        if (Number.isNaN(d.getTime())) {
          onError('Invalid date.')
          setSaving(false)
          return
        }
        if (d.getTime() <= Date.now()) {
          onError('Expiration must be in the future.')
          setSaving(false)
          return
        }
        iso = d.toISOString()
      }
      await patchKey(keyId, { action: 'set_expiry', expiresAt: iso })
      onSuccess('Expiry updated successfully')
      onClose()
      onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to update expiry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set Expiry"
      description={name}
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>Cancel</ModalButton>
          <ModalButton variant="primary" onClick={() => submit(false)} disabled={saving}>
            {saving ? 'Saving…' : 'Save expiry'}
          </ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Current status" value={info.label} />
        <Field label="Current expiry" value={expiresAt ? new Date(expiresAt).toLocaleString() : 'Lifetime (no expiry)'} />
        <div>
          <label className="text-xs uppercase tracking-[0.16em] text-white/55">New expiry date</label>
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-fuchsia-400/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => applyQuickDays(d)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06]"
            >
              +{d} days
            </button>
          ))}
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={saving}
            className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-400/20 disabled:opacity-50"
          >
            Remove expiry (Lifetime)
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------- Extend ----------------
function ExtendModal({
  open,
  onClose,
  name,
  expiresAt,
  status,
  keyId,
  onSaved,
  onSuccess,
  onError,
}: {
  open: boolean
  onClose: () => void
  name: string
  expiresAt: string | null
  status: string
  keyId: string
  onSaved: () => void
  onSuccess: (m: string) => void
  onError: (m: string) => void
}) {
  const [days, setDays] = useState<number>(7)
  const [saving, setSaving] = useState(false)
  const info = useMemo(() => getApiKeyStatus(expiresAt, status), [expiresAt, status])
  const isLifetime = expiresAt == null

  const newExpiryPreview = useMemo(() => {
    const now = Date.now()
    const base = expiresAt && new Date(expiresAt).getTime() > now ? new Date(expiresAt).getTime() : now
    const target = new Date(base + days * ONE_DAY_MS)
    return target
  }, [expiresAt, days])

  const submit = async () => {
    if (!Number.isFinite(days) || days < 1) {
      onError('Enter a positive number of days (1–365).')
      return
    }
    setSaving(true)
    try {
      await postAction(keyId, 'extend', { days, convertLifetime: isLifetime })
      onSuccess('API key extended successfully')
      onClose()
      onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to extend key. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Extend API Key"
      description={name}
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>Cancel</ModalButton>
          <ModalButton variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Extending…' : 'Confirm extension'}
          </ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current expiry" value={expiresAt ? new Date(expiresAt).toLocaleString() : 'Lifetime'} />
          <Field label="Current status" value={info.label} />
          <Field label="Remaining" value={info.remainingLabel} />
          <Field label="Extension" value={`+${days} day${days === 1 ? '' : 's'}`} />
        </div>

        {isLifetime && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
            This is a lifetime key. Extending will convert it into an expiry-based key
            ({days} day{days === 1 ? '' : 's'} from now).
          </div>
        )}

        <div>
          <label className="text-xs uppercase tracking-[0.16em] text-white/55">Extension days</label>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 0)))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-fuchsia-400/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06]"
            >
              +{d} {d === 1 ? 'Day' : 'Days'}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/55">New expiry preview</p>
          <p className="mt-1 font-mono text-sm text-white">{newExpiryPreview.toLocaleString()}</p>
        </div>
      </div>
    </Modal>
  )
}

// ---------------- Convert Plan ----------------
function ConvertPlanModal({
  open,
  onClose,
  name,
  currentPlan,
  keyId,
  onSaved,
  onSuccess,
  onError,
}: {
  open: boolean
  onClose: () => void
  name: string
  currentPlan: PlanName | 'Custom' | 'None'
  keyId: string
  onSaved: () => void
  onSuccess: (m: string) => void
  onError: (m: string) => void
}) {
  const [newPlan, setNewPlan] = useState<PlanName>(currentPlan === '20X' ? '5X' : '20X')
  const [keepSameExpiry, setKeepSameExpiry] = useState(true)
  const [resetUsage, setResetUsage] = useState(false)
  const [customValidityDays, setCustomValidityDays] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  const planBudgetLabel = (plan: PlanName) => `${(Number(PLAN_BUDGETS[plan]) / 1_000_000).toFixed(0)}M tokens / 5h`

  const submit = async () => {
    setSaving(true)
    try {
      await postAction(keyId, 'convert-plan', {
        newPlan,
        keepSameExpiry,
        resetUsage,
        customValidityDays: keepSameExpiry ? null : customValidityDays === '' ? null : Number(customValidityDays),
      })
      onSuccess('Plan converted successfully')
      onClose()
      onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to convert plan. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert API Key Plan"
      description={name}
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>Cancel</ModalButton>
          <ModalButton variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Converting…' : 'Convert plan'}
          </ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-white/55">Current plan</p>
            <p className="mt-1 text-lg font-semibold text-white">{currentPlan}</p>
          </div>
          <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/[0.06] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-white/55">New plan</p>
            <p className="mt-1 text-lg font-semibold gradient-text">{newPlan}</p>
            <p className="mt-1 text-xs text-white/55">{planBudgetLabel(newPlan)}</p>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.16em] text-white/55">Convert to</label>
          <select
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value as PlanName)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-fuchsia-400/50 focus:outline-none"
          >
            <option value="5X">5X — {planBudgetLabel('5X')}</option>
            <option value="20X">20X — {planBudgetLabel('20X')}</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={keepSameExpiry} onChange={(e) => setKeepSameExpiry(e.target.checked)} />
          Keep same expiry date
        </label>

        {!keepSameExpiry && (
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-white/55">New validity (days from now)</label>
            <input
              type="number"
              min={1}
              max={3650}
              value={customValidityDays}
              onChange={(e) => setCustomValidityDays(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
              placeholder="e.g. 30"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-fuchsia-400/50 focus:outline-none"
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={resetUsage} onChange={(e) => setResetUsage(e.target.checked)} />
          Reset current 5-hour usage after conversion
        </label>

        <p className="text-xs text-white/45">The API key itself is not changed — only plan limits are updated.</p>
      </div>
    </Modal>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/55">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  )
}
