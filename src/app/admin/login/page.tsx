'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Loader2, Sparkles } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        let message = 'Invalid credentials'
        if (contentType?.includes('application/json')) {
          const data = await response.json()
          message =
            typeof data.error === 'object' && data.error !== null && 'message' in data.error
              ? String((data.error as { message: string }).message)
              : typeof data.error === 'string'
                ? data.error
                : 'Invalid credentials'
        }
        setError(message)
        return
      }

      router.push('/admin')
      router.refresh()
    } catch (err) {
      console.error('Login error:', err)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="aurora relative flex min-h-screen items-center justify-center px-6">
      <span className="aurora-blob" aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <span
                className="absolute inset-0 rounded-xl"
                style={{
                  background:
                    'conic-gradient(from 200deg, hsl(var(--neon-violet)), hsl(var(--neon-pink)), hsl(var(--neon-cyan)), hsl(var(--neon-violet)))',
                }}
              />
              <span className="absolute inset-[2px] rounded-[10px] bg-background" />
              <span className="relative font-display text-base font-semibold text-white">O</span>
            </span>
            <span className="font-display text-xl font-semibold tracking-display text-white">
              Opus<span className="gradient-text">Max</span>
            </span>
          </Link>
          <h1 className="font-display tracking-display mt-7 text-4xl font-semibold text-white">
            Admin sign in
          </h1>
          <p className="mt-2 text-white/65">Manage keys and usage.</p>
        </div>

        <div className="grad-border glass-strong mt-8 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@opusmax.pro"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-grad inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign in <Sparkles className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-white/55">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
