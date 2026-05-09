'use client'

import { useState } from 'react'
import { BookOpen, Code2, Copy, Key, Shield, Terminal, Zap } from 'lucide-react'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'

const quickstartCode = `import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.opusmax.pro/v1',
});

const message = await client.messages.create({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }],
});

console.log(message);`

const setupCommands = [
  {
    title: 'Claude Code',
    description: 'Edit your ~/.claude/settings.json',
    command: `"anthropic": {
  "apiKey": "your-opusmax-key",
  "baseURL": "https://api.opusmax.pro/v1"
}`,
  },
  {
    title: 'Cursor',
    description: 'Add to Cursor AI settings (Cmd+,)',
    command: `"ANTHROPIC_API_KEY": "your-opusmax-key",
"ANTHROPIC_BASE_URL": "https://api.opusmax.pro/v1"`,
  },
  {
    title: 'VS Code',
    description: 'Add to Claude extension settings',
    command: `{
  "apiKey": "your-opusmax-key",
  "baseURL": "https://api.opusmax.pro/v1"
}`,
  },
  {
    title: 'Windsurf / Cline / Roo',
    description: 'Use environment variables in your editor',
    command: `ANTHROPIC_API_KEY=your-opusmax-key
ANTHROPIC_BASE_URL=https://api.opusmax.pro/v1`,
  },
]

const endpoints = [
  { method: 'POST', path: '/v1/messages', description: 'Create a message with Claude', body: '{ model, messages, max_tokens, stream? }' },
  { method: 'GET', path: '/v1/models', description: 'List available models', body: '' },
  { method: 'POST', path: '/v1/messages/count_tokens', description: 'Count tokens in a message', body: '{ model, messages, system? }' },
  { method: 'GET', path: '/api/key-status', description: 'Check API key usage', body: '?key=your-api-key' },
]

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }
  return (
    <div className="grad-border relative overflow-hidden rounded-xl">
      <div className="bg-[#0a0817]/80 backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400/80" />
            <span className="h-2 w-2 rounded-full bg-amber-400/80" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          </div>
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-white/85">
          <code className="font-mono">{code}</code>
        </pre>
      </div>
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ElementType
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <div className="mb-5">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">{eyebrow}</p>
      <h2 className="font-display tracking-display mt-2 flex items-center gap-2 text-3xl font-semibold text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 ring-1 ring-white/10">
          <Icon className="h-4 w-4 text-white/85" />
        </span>
        {title}
      </h2>
      {description && <p className="mt-2 text-white/65">{description}</p>}
    </div>
  )
}

export default function DocsPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <SiteHeader active="docs" />

      <main className="aurora relative">
        <span className="aurora-blob" aria-hidden />
        <div className="relative z-10 mx-auto max-w-4xl px-6 py-14">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Documentation</p>
            <h1 className="font-display tracking-display mt-3 text-5xl font-semibold text-white md:text-6xl">
              Build with the <span className="gradient-text">OpusMax</span> API
            </h1>
            <p className="mt-4 max-w-2xl text-white/70">
              Fully Anthropic-compatible. Point your client at our base URL, use your key,
              and continue using the official SDKs you already know.
            </p>
          </div>

          <section className="mt-12">
            <SectionHeader
              icon={Zap}
              eyebrow="Quick Start"
              title="Install and send your first request"
              description="Use the Anthropic SDK and configure your OpusMax key."
            />
            <div className="glass rounded-2xl p-5">
              <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-white/85">
                <span className="text-white/40">$</span> npm install @anthropic-ai/sdk
              </div>
              <CodeBlock code={quickstartCode} />
            </div>
          </section>

          <section className="mt-12">
            <SectionHeader icon={Terminal} eyebrow="API" title="Endpoints" />
            <div className="space-y-3">
              {endpoints.map((ep) => (
                <div
                  key={ep.path}
                  className="glass glass-hover lift flex flex-col gap-2 rounded-2xl p-4 md:flex-row md:items-start"
                >
                  <span
                    className={`inline-flex w-fit items-center rounded-md px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                      ep.method === 'GET'
                        ? 'border border-white/10 bg-white/[0.04] text-white/85'
                        : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <div className="flex-1">
                    <code className="font-mono text-sm text-white">{ep.path}</code>
                    <p className="mt-1 text-sm text-white/65">{ep.description}</p>
                    {ep.body && <p className="mt-2 font-mono text-xs text-white/45">{ep.body}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <SectionHeader icon={Code2} eyebrow="Setup" title="Editor configuration" />
            <div className="grid gap-4 md:grid-cols-2">
              {setupCommands.map((s) => (
                <div key={s.title} className="glass rounded-2xl p-5">
                  <h3 className="font-display text-base font-semibold text-white">{s.title}</h3>
                  <p className="mt-1 text-sm text-white/65">{s.description}</p>
                  <div className="mt-4">
                    <CodeBlock code={s.command} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <SectionHeader icon={Key} eyebrow="Auth" title="Authentication" />
            <div className="glass space-y-4 rounded-2xl p-5">
              <div>
                <h3 className="font-medium text-white">x-api-key header</h3>
                <p className="mt-1 text-sm text-white/65">Include your API key in the request header:</p>
                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-white/85">
                  x-api-key: sk-ant-opm-your-key-here
                </div>
              </div>
              <div>
                <h3 className="font-medium text-white">Bearer token</h3>
                <p className="mt-1 text-sm text-white/65">Or use the Authorization header:</p>
                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-white/85">
                  Authorization: Bearer sk-ant-opm-your-key-here
                </div>
              </div>
            </div>
          </section>

          <section className="mt-12">
            <SectionHeader icon={Shield} eyebrow="Limits" title="Rate limits & budgets" />
            <ul className="glass grid gap-2 rounded-2xl p-5 text-sm text-white/80 md:grid-cols-2">
              <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                Per-key RPM limits based on your plan
              </li>
              <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                5-hour rolling token window for budget control
              </li>
              <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                Monthly token budget enforcement
              </li>
              <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                Streaming pass-through with zero added latency
              </li>
            </ul>
          </section>

          <section className="mt-12">
            <SectionHeader icon={BookOpen} eyebrow="Examples" title="cURL example" />
            <CodeBlock
              code={`curl https://api.opusmax.pro/v1/messages \\
  -H "x-api-key: sk-ant-opm-your-key-here" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-opus-4-7",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 1024
  }'`}
            />
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
