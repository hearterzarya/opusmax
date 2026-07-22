import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  CircuitBoard,
  Gauge,
  Globe2,
  KeyRound,
  Layers,
  Lock,
  Rocket,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'

const models = [
  {
    name: 'Opus 4.8',
    id: 'claude-opus-4-8',
    description: 'Latest flagship — 1M context, adaptive thinking, and agentic coding at the top tier.',
    accent: 'from-violet-500 via-fuchsia-500 to-rose-500',
    glow: 'glow-violet',
  },
  {
    name: 'Sonnet 4.6',
    id: 'claude-sonnet-4-6',
    description: 'Speed meets intelligence. The everyday workhorse for most production traffic.',
    accent: 'from-fuchsia-500 via-pink-500 to-cyan-400',
    glow: 'glow-pink',
  },
  {
    name: 'Haiku 4.5',
    id: 'claude-haiku-4-5-20251001',
    description: 'Fastest tier — built for high-throughput, low-latency, cost-sensitive flows.',
    accent: 'from-cyan-400 via-sky-500 to-violet-500',
    glow: 'glow-cyan',
  },
]

const capabilities = [
  { icon: Gauge, title: 'Per-key budgets', desc: 'Rolling 5h windows with hard ceilings.' },
  { icon: Lock, title: 'Isolated rate limits', desc: 'RPM caps & expiry tied to each key.' },
  { icon: Zap, title: 'Zero-latency streaming', desc: 'SSE pass-through, no proxy buffering.' },
  { icon: Sparkles, title: 'Prompt caching', desc: 'Cache reads bill at $0 — pure savings.' },
  { icon: CircuitBoard, title: 'SDK-compatible', desc: 'Drop-in for Anthropic JS, Python, cURL.' },
  { icon: Globe2, title: 'Editor-ready', desc: 'Cursor, Claude Code, Cline, Roo, Windsurf.' },
]

const steps = [
  {
    n: '01',
    title: 'Get a key',
    desc: 'Your admin issues a key with budget, RPM, and expiry already configured.',
    icon: KeyRound,
  },
  {
    n: '02',
    title: 'Set base URL',
    desc: 'Point any Anthropic client at https://opusxmax.vercel.app/api. Everything else stays the same.',
    icon: Layers,
  },
  {
    n: '03',
    title: 'Ship',
    desc: 'Streaming, caching, SDKs — it all just works. No code changes required.',
    icon: Rocket,
  },
]

function HeroTerminal() {
  return (
    <div className="float-y mx-auto mt-14 max-w-3xl">
      <div className="grad-border glass-strong relative overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-rose-400/90" />
          <span className="h-3 w-3 rounded-full bg-amber-400/90" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
          <span className="ml-3 font-mono text-[11px] uppercase tracking-wider text-white/50">
            opusmax — bash
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/60">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            connected
          </span>
        </div>
        <pre className="overflow-x-auto px-5 py-5 text-left font-mono text-[13px] leading-relaxed text-white/85">
{`$ export ANTHROPIC_BASE_URL=https://opusxmax.vercel.app/api/v1
$ export ANTHROPIC_API_KEY=sk-ant-ox-***

$ curl $ANTHROPIC_BASE_URL/messages \\
    -H "x-api-key: $ANTHROPIC_API_KEY" \\
    -H "anthropic-version: 2023-06-01" \\
    -H "content-type: application/json" \\
    -d '{
      "model": "claude-opus-4-8",
      "max_tokens": 256,
      "messages": [{"role":"user","content":"hello"}]
    }'

`}<span className="text-emerald-300">{'< 200 OK · streaming · 38ms TTFB'}</span>
        </pre>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <SiteHeader active="home" />

      <main>
        {/* HERO */}
        <section className="aurora relative">
          <span className="aurora-blob" aria-hidden />
          <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-24 text-center md:pt-32">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/80 backdrop-blur">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              All Claude models live · Opus 4.8, Sonnet 4.6, Haiku 4.5
            </div>

            <h1 className="font-display tracking-display mx-auto mt-7 max-w-4xl text-balance text-6xl font-semibold leading-[1.02] text-white md:text-[88px]">
              One key.{' '}
              <span className="gradient-text">Every model.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-white/70">
              A blazing-fast, Anthropic-compatible gateway with per-key budgets,
              streaming pass-through, and a beautiful admin console. Swap your base URL —
              your code stays the same.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/docs"
                className="btn-grad inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-medium"
              >
                Start building <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="btn-ghost-glass inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-medium"
              >
                Read the docs <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <HeroTerminal />

            {/* Trust bar */}
            <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: '99.99%', v: 'Uptime' },
                { k: '<40ms', v: 'TTFB' },
                { k: '1M', v: 'Context' },
                { k: '0$', v: 'Cache reads' },
              ].map((s) => (
                <div
                  key={s.v}
                  className="glass rounded-xl px-4 py-3 text-left"
                >
                  <p className="font-display text-xl font-semibold text-white">{s.k}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/55">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MODELS */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Models</p>
            <h2 className="font-display tracking-display mt-3 text-4xl font-semibold text-white md:text-5xl">
              The full Claude lineup
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/70">
              Every model, one endpoint. Pick the model that fits your task — switch with a string.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {models.map((m) => (
              <article
                key={m.id}
                className="group relative"
              >
                <div className="tilt-3d grad-border glass-strong relative overflow-hidden rounded-3xl p-6">
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute -top-1/2 left-1/2 h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-gradient-to-br ${m.accent} opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60`}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${m.accent} px-2.5 py-0.5 text-[11px] font-medium text-white shadow-sm`}
                      >
                        <Sparkles className="h-3 w-3" /> Available
                      </span>
                      <code className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/70">
                        {m.id}
                      </code>
                    </div>
                    <h3 className="font-display tracking-display mt-6 text-3xl font-semibold text-white">
                      {m.name}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">{m.description}</p>
                    <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/55">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${m.accent}`} />
                        Streaming · Caching
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* CAPABILITIES */}
        <section className="relative">
          <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">
                  Why OpusMax
                </p>
                <h2 className="font-display tracking-display mt-3 text-4xl font-semibold text-white md:text-5xl">
                  Built for teams who need <span className="gradient-text">control</span>.
                </h2>
                <p className="mt-4 text-white/70">
                  Multi-tenant API key management with per-key budgets, rate limits, real-time usage,
                  and a full admin console. Designed for resellers and product teams.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/key-status"
                    className="btn-ghost-glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium"
                  >
                    Live usage demo <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/status"
                    className="btn-ghost-glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium"
                  >
                    System status
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {capabilities.map((c) => (
                  <div key={c.title} className="glass glass-hover lift rounded-2xl p-5">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-white ring-1 ring-white/10">
                      <c.icon className="h-4 w-4" />
                    </span>
                    <h3 className="font-display mt-4 text-base font-semibold text-white">
                      {c.title}
                    </h3>
                    <p className="mt-1 text-sm text-white/65">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Setup</p>
            <h2 className="font-display tracking-display mt-3 text-4xl font-semibold text-white md:text-5xl">
              Ready in 60 seconds
            </h2>
            <p className="mt-3 text-white/70">Three steps. That&apos;s it.</p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                {i !== steps.length - 1 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-3 top-12 hidden h-px w-6 bg-gradient-to-r from-violet-400/60 to-transparent md:block"
                  />
                )}
                <div className="glass lift rounded-3xl p-6">
                  <div className="flex items-center gap-4">
                    <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
                      <span
                        className="absolute inset-0 rounded-2xl"
                        style={{
                          background:
                            'conic-gradient(from 200deg, hsl(var(--neon-violet)), hsl(var(--neon-pink)), hsl(var(--neon-cyan)), hsl(var(--neon-violet)))',
                        }}
                      />
                      <span className="absolute inset-[2px] rounded-[14px] bg-background" />
                      <s.icon className="relative h-5 w-5 text-white" />
                    </span>
                    <span className="font-mono text-sm text-white/40">{s.n}</span>
                  </div>
                  <h3 className="font-display mt-5 text-xl font-semibold text-white">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <div className="grad-border glass-strong relative overflow-hidden rounded-[28px] p-10 text-center md:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-32 -z-10"
              style={{
                background:
                  'radial-gradient(40% 50% at 30% 30%, hsl(var(--neon-violet) / 0.35), transparent 60%), radial-gradient(40% 50% at 70% 70%, hsl(var(--neon-pink) / 0.30), transparent 60%)',
                filter: 'blur(40px)',
              }}
            />
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">
              Ready when you are
            </span>
            <h2 className="font-display tracking-display mt-4 text-4xl font-semibold text-white md:text-5xl">
              Stop juggling raw <span className="gradient-text">Anthropic keys</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/70">
              Issue scoped keys, watch usage in real time, and ship to Cursor, Claude Code, or any
              Anthropic-compatible client in seconds.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/docs"
                className="btn-grad inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-medium"
              >
                Read documentation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/key-status"
                className="btn-ghost-glass inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-medium"
              >
                <Terminal className="h-4 w-4" /> Check usage
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
