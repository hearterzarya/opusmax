'use client'

import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { DocsApiCodePair, DocsApiSection } from '@/components/docs/docs-api-section'
import { ConfigRow, ModelCard, ToolCard } from '@/components/docs/docs-cards'
import { DocsCodeBlock } from '@/components/docs/docs-code-block'
import { DocsMobileNav } from '@/components/docs/docs-mobile-nav'
import { DocsSection, DocsSubheading, DocsProse } from '@/components/docs/docs-section'
import { DocsSidebar } from '@/components/docs/docs-sidebar'
import { DocsToc } from '@/components/docs/docs-toc'
import { DocsTroubleshooting } from '@/components/docs/docs-troubleshooting'
import {
  API_BASE_URL,
  API_ENDPOINTS,
  API_KEY_PLACEHOLDER,
  API_PATHS,
  API_V1_URL,
  AUTH_HEADERS_CODE,
  AVAILABLE_MODELS,
  CLI_COMMANDS,
  CLI_PACKAGE,
  CLI_QUICK_START_CODE,
  CLI_SETUP_STEPS,
  CLI_SUPPORTED_IDES,
  CLAUDE_CODE_SETTINGS_JSON,
  CLINE_SETTINGS_JSON,
  COUNT_TOKENS_REQUEST_CODE,
  FEATURE_BADGES,
  IMAGE_ANALYSIS_REQUEST_CODE,
  KEY_STATUS_RESPONSE_CODE,
  MESSAGES_REQUEST_CODE,
  MESSAGES_RESPONSE_CODE,
  MODELS_RESPONSE_CODE,
  ROO_SETTINGS_JSON,
  WEB_SEARCH_REQUEST_CODE,
} from '@/lib/docs-config'
import { CheckCircle2 } from 'lucide-react'

export default function DocsPage() {
  return (
    <div className="relative min-h-screen bg-[#030408] text-foreground">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(139,92,246,0.1),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:64px_64px]"
        aria-hidden
      />

      <SiteHeader active="docs" />

      <main className="relative z-10">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:py-14">
          <div className="flex gap-8 xl:gap-10">
            <DocsSidebar />

            <article className="min-w-0 flex-1 max-w-3xl xl:max-w-none">
              <header id="overview" className="scroll-mt-28">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-200/60">Documentation</p>
                <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Setup Guide
                </h1>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
                  Get up and running with OpusMax in minutes. Run{' '}
                  <code className="text-cyan-200/90">{CLI_COMMANDS.setup}</code> to paste your API key and configure
                  your favorite IDE — or follow the manual steps below.
                </p>
                <div className="mt-5 rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-violet-200/70">Recommended</p>
                  <p className="mt-2 font-mono text-sm text-white sm:text-base">{CLI_COMMANDS.setup}</p>
                  <p className="mt-2 text-xs text-white/50">
                    Requires Node.js 18+. No global install needed — uses the{' '}
                    <span className="font-mono text-white/70">{CLI_PACKAGE}</span> npm package.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {FEATURE_BADGES.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-medium text-cyan-100/90"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.04] p-4 sm:grid-cols-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">Base URL</p>
                    <p className="mt-1 font-mono text-sm text-cyan-100">{API_BASE_URL}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">API v1</p>
                    <p className="mt-1 font-mono text-sm text-cyan-100">{API_V1_URL}</p>
                  </div>
                </div>
                <DocsProse className="mt-6">
                  OpusMax is a Claude-compatible AI API gateway designed for developers, teams, and AI-powered coding
                  workflows. It works with Claude Code, VS Code, Cursor, Windsurf, Cline, Roo Code, and other tools that
                  support Anthropic-compatible or OpenAI-compatible API routing.
                </DocsProse>
              </header>

              <div className="mt-8">
                <DocsMobileNav />
              </div>

              <DocsSection
                id="cli-setup"
                title="CLI Setup"
                description="The fastest way to connect OpusMax — paste your API key once, then pick the tools you use."
                className="first:border-t-0"
              >
                <DocsCodeBlock code={CLI_QUICK_START_CODE} label="Terminal" />
                <DocsSubheading>What happens during setup</DocsSubheading>
                <ol className="space-y-4">
                  {CLI_SETUP_STEPS.map((step, i) => (
                    <li key={step.title} className="flex gap-3 text-sm text-white/65">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 font-mono text-xs text-cyan-200">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium text-white/85">{step.title}</p>
                        <p className="mt-0.5 leading-relaxed">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <DocsSubheading>Supported tools</DocsSubheading>
                <div className="flex flex-wrap gap-2">
                  {CLI_SUPPORTED_IDES.map((name) => (
                    <span
                      key={name}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-white/70"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <DocsSubheading>All CLI commands</DocsSubheading>
                <div className="space-y-2 font-mono text-sm text-white/70">
                  <p>
                    <span className="text-cyan-200/80">{CLI_COMMANDS.setup}</span>
                    <span className="ml-2 font-sans text-xs text-white/45">— interactive setup</span>
                  </p>
                  <p>
                    <span className="text-cyan-200/80">{CLI_COMMANDS.status}</span>
                    <span className="ml-2 font-sans text-xs text-white/45">— show config & verify key</span>
                  </p>
                  <p>
                    <span className="text-cyan-200/80">{CLI_COMMANDS.test}</span>
                    <span className="ml-2 font-sans text-xs text-white/45">— send a test message</span>
                  </p>
                  <p>
                    <span className="text-cyan-200/80">{CLI_COMMANDS.models}</span>
                    <span className="ml-2 font-sans text-xs text-white/45">— list gateway models</span>
                  </p>
                  <p>
                    <span className="text-cyan-200/80">{CLI_COMMANDS.doctor}</span>
                    <span className="ml-2 font-sans text-xs text-white/45">— run diagnostics</span>
                  </p>
                </div>
                <DocsProse>
                  Gateway base URL is preset to <code className="text-cyan-200/90">{API_BASE_URL}</code>. Check usage
                  anytime at{' '}
                  <a href={API_ENDPOINTS.keyStatus} className="text-cyan-300/90 underline-offset-2 hover:underline">
                    key-status
                  </a>
                  . Manual IDE steps are documented in the sections below if you prefer not to use the CLI.
                </DocsProse>
              </DocsSection>

              <DocsSection id="prerequisites" title="Prerequisites">
                <ul className="space-y-3">
                  {[
                    'Node.js 18 or newer',
                    'Active OpusMax API key',
                    'Supported IDE or coding agent',
                    'Internet connection for API access',
                  ].map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm text-white/65">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </DocsSection>

              <DocsSection
                id="claude-code"
                title="Claude Code CLI"
                description="Configure Claude Code CLI to route requests through OpusMax."
              >
                <DocsProse>
                  Prefer automatic setup: <code className="text-cyan-200/90">{CLI_COMMANDS.setup}</code> and select{' '}
                  <strong className="font-medium text-white/80">Claude Code</strong>. Or create or edit{' '}
                  <code className="text-cyan-200/90">~/.claude/settings.json</code> manually:
                </DocsProse>
                <DocsCodeBlock code={CLAUDE_CODE_SETTINGS_JSON} label="~/.claude/settings.json" />
              </DocsSection>

              <DocsSection
                id="vscode"
                title="VS Code"
                description="VS Code integrations can use the same Claude-compatible configuration used by Claude Code CLI. After changing configuration files, restart VS Code so the new environment values are loaded."
              >
                <DocsProse>
                  Use the same <code className="text-cyan-200/90">~/.claude/settings.json</code> configuration as Claude
                  Code CLI, then restart VS Code.
                </DocsProse>
              </DocsSection>

              <DocsSection
                id="cursor"
                title="Cursor"
                description={`Configure Cursor to route AI requests through OpusMax. Run ${CLI_COMMANDS.setup} and select Cursor for copy-paste values, or use the settings below.`}
              >
                <DocsSubheading>API Routing</DocsSubheading>
                <div className="space-y-2">
                  <ConfigRow label="Base URL" value={API_V1_URL} />
                  <ConfigRow label="API Key" value={API_KEY_PLACEHOLDER} />
                  <ConfigRow label="Model" value="claude-sonnet-4-6" />
                </div>
              </DocsSection>

              <DocsSection
                id="windsurf"
                title="Windsurf"
                description={`Configure Windsurf to use OpusMax as the API provider. ${CLI_COMMANDS.setup} prints the base URL when you select Windsurf.`}
              >
                <DocsSubheading>API Routing</DocsSubheading>
                <DocsCodeBlock code={API_V1_URL} label="Base URL" />
              </DocsSection>

              <DocsSection
                id="cline"
                title="Cline"
                description="Configure the Cline VS Code extension to connect with OpusMax."
              >
                <DocsSubheading>Configuration</DocsSubheading>
                <DocsCodeBlock code={CLINE_SETTINGS_JSON} label="settings.json" />
              </DocsSection>

              <DocsSection
                id="roo"
                title="Roo Code"
                description="Configure Roo Code to use the OpusMax Claude-compatible gateway."
              >
                <DocsSubheading>Configuration</DocsSubheading>
                <DocsCodeBlock code={ROO_SETTINGS_JSON} label="settings.json" />
              </DocsSection>

              <div className="mt-16 border-t border-cyan-500/10 pt-6">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-200/50">API Reference</p>
              </div>

              <DocsSection
                id="authentication"
                title="Authentication"
                description="API requests can authenticate using either an x-api-key header or a Bearer token."
                className="!border-t-0"
              >
                <DocsCodeBlock code={AUTH_HEADERS_CODE} label="Header Options" />
                <DocsProse>
                  Dashboard endpoints may use JWT-based authentication depending on the implementation.
                </DocsProse>
              </DocsSection>

              <DocsApiSection
                id="messages"
                method="POST"
                pathBadge={API_PATHS.messages}
                fullUrl={API_ENDPOINTS.messages}
                title="Messages"
                description="Create a message using an Anthropic-compatible request format. Streaming can be enabled with stream: true."
              >
                <DocsApiCodePair
                  request={MESSAGES_REQUEST_CODE}
                  response={MESSAGES_RESPONSE_CODE}
                  note="When stream is true, the API returns Server-Sent Events."
                />
              </DocsApiSection>

              <DocsApiSection
                id="models"
                method="GET"
                pathBadge={API_PATHS.models}
                fullUrl={API_ENDPOINTS.models}
                title="Models"
                description="Returns available model IDs and display names."
              >
                <DocsCodeBlock label="Response" code={MODELS_RESPONSE_CODE} />
              </DocsApiSection>

              <DocsApiSection
                id="token-counting"
                method="POST"
                pathBadge={API_PATHS.countTokens}
                fullUrl={API_ENDPOINTS.countTokens}
                title="Token Counting"
                description="Count tokens for a message before sending it."
              >
                <DocsCodeBlock label="Request" code={COUNT_TOKENS_REQUEST_CODE} />
              </DocsApiSection>

              <DocsApiSection
                id="key-status"
                method="GET"
                pathBadge={API_PATHS.keyStatus}
                fullUrl={API_ENDPOINTS.keyStatus}
                title="Key Status"
                description="Check API key status, usage, limits, active window, and request statistics."
              >
                <DocsCodeBlock label="Response" code={KEY_STATUS_RESPONSE_CODE} />
              </DocsApiSection>

              <DocsApiSection
                id="web-search"
                method="POST"
                pathBadge={API_PATHS.webSearch}
                fullUrl={API_ENDPOINTS.webSearch}
                title="Web Search"
                description="Search the web for fresh information. Short keyword-style queries usually work best."
              >
                <DocsCodeBlock label="Request" code={WEB_SEARCH_REQUEST_CODE} />
              </DocsApiSection>

              <DocsApiSection
                id="image-analysis"
                method="POST"
                pathBadge={API_PATHS.understandImage}
                fullUrl={API_ENDPOINTS.understandImage}
                title="Image Analysis"
                description="Analyze images using a prompt and an image URL. Supports common image formats such as JPEG, PNG, and WebP."
              >
                <DocsCodeBlock label="Request" code={IMAGE_ANALYSIS_REQUEST_CODE} />
              </DocsApiSection>

              <DocsSection
                id="builtin-tools"
                title="Built-in Tools"
                description="OpusMax includes server-side tools that work without additional MCP setup on the client side."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <ToolCard
                    title="Web Search"
                    description="Real-time web search for current information, available through supported connected clients."
                  />
                  <ToolCard
                    title="Image Analysis"
                    description="AI image understanding for JPEG, PNG, and WebP inputs with no extra local setup."
                  />
                </div>
              </DocsSection>

              <DocsSection id="available-models" title="Available Models">
                <div className="grid gap-4 lg:grid-cols-3">
                  {AVAILABLE_MODELS.map((model) => (
                    <ModelCard key={model.id} {...model} />
                  ))}
                </div>
                <DocsProse>
                  Common aliases such as opus, sonnet, and haiku may map to the configured backend model depending on
                  gateway settings.
                </DocsProse>
              </DocsSection>

              <DocsSection id="troubleshooting" title="Troubleshooting">
                <DocsTroubleshooting />
              </DocsSection>
            </article>

            <DocsToc />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
