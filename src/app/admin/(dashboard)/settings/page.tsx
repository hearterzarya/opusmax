import { Bell, Globe, Key, Save, Shield } from 'lucide-react'
import { getAdminSession } from '@/lib/auth'

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 disabled:opacity-60'

const labelClass = 'text-xs font-medium uppercase tracking-[0.16em] text-white/55'

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grad-border glass rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-white ring-1 ring-white/10">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display tracking-display text-lg font-semibold text-white">{title}</h2>
          <p className="text-sm text-white/65">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
}

function ToggleRow({
  title,
  description,
  defaultOn,
}: {
  title: string
  description: string
  defaultOn?: boolean
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-sm text-white/55">{description}</p>
      </div>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          defaultOn
            ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.45)]'
            : 'bg-white/10'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            defaultOn ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </div>
  )
}

export default async function AdminSettingsPage() {
  const session = await getAdminSession()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Account</p>
        <h1 className="font-display tracking-display mt-2 text-4xl font-semibold text-white">
          Settings
        </h1>
        <p className="mt-1 text-white/65">Manage your admin profile, security, and preferences.</p>
      </div>

      <SectionCard icon={Key} title="Profile" description="Your admin account information.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClass}>Email</label>
            <input value={session?.email || ''} disabled className={fieldClass} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Name</label>
            <input defaultValue={session?.name || 'Admin'} className={fieldClass} />
          </div>
        </div>
        <button className="btn-grad mt-4 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium">
          <Save className="h-4 w-4" /> Update profile
        </button>
      </SectionCard>

      <SectionCard icon={Shield} title="Security" description="Password and security settings.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Current password</label>
            <input type="password" placeholder="Enter current password" className={fieldClass} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClass}>New password</label>
              <input type="password" placeholder="Enter new password" className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Confirm password</label>
              <input type="password" placeholder="Confirm new password" className={fieldClass} />
            </div>
          </div>
          <button className="btn-ghost-glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium">
            <Shield className="h-4 w-4" /> Change password
          </button>
        </div>
      </SectionCard>

      <SectionCard icon={Bell} title="Notifications" description="Configure alert preferences.">
        <ToggleRow
          title="Error rate alerts"
          description="Get notified when error rate exceeds 5%."
          defaultOn
        />
        <ToggleRow
          title="Token budget warnings"
          description="Alert when users approach their limits."
          defaultOn
        />
        <ToggleRow title="New API key created" description="Email when new keys are generated." />
      </SectionCard>

      <SectionCard icon={Globe} title="System" description="Current deployment details.">
        <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className={labelClass}>Version</dt>
            <dd className="mt-1 font-mono text-white">1.0.0</dd>
          </div>
          <div>
            <dt className={labelClass}>Environment</dt>
            <dd className="mt-1">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-white/85">
                {process.env.NODE_ENV || 'development'}
              </span>
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Database</dt>
            <dd className="mt-1 font-mono text-white">PostgreSQL (Neon)</dd>
          </div>
          <div>
            <dt className={labelClass}>Cache</dt>
            <dd className="mt-1 font-mono text-white">Redis (Upstash)</dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  )
}
