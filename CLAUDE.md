# OpusMax Gateway — AI Context Guide

> **Purpose:** Persistent project memory for Claude/Cursor agents. Read this file at the start of every session before making changes.

---

## What This Project Is

**OpusMax Gateway** (`opusx-gateway`) is a **Next.js 15 App Router** SaaS that issues per-customer API keys and proxies **Anthropic-compatible** requests to the real Anthropic API.

- **Product name:** OpusMax
- **Repo:** `hearterzarya/opusmax` on GitHub
- **Production:** https://opusxmax.vercel.app
- **Current stable commit (intentional baseline):** `9159be5` — `feat(cli): add opusmaxx setup CLI and docs integration`

Users point clients (Claude Code, Cursor, Windsurf, Cline, etc.) at the gateway base URL with a gateway-issued key (`sk-ant-ox-*`). The gateway validates quota/RPM, logs usage, and forwards to Anthropic.

---

## Production URLs (single source for docs — update `src/lib/docs-config.ts`)

| Purpose | URL |
|---------|-----|
| Gateway base | `https://opusxmax.vercel.app/api` |
| API v1 | `https://opusxmax.vercel.app/api/v1` |
| Docs | `https://opusxmax.vercel.app/docs` |
| Key usage check | `GET /api/key-status?key=YOUR_API_KEY` |
| Public usage UI | `/key-status` |

**Client env (what end-users set):**
```bash
ANTHROPIC_BASE_URL=https://opusxmax.vercel.app/api
ANTHROPIC_API_KEY=sk-ant-ox-...
```

**Cursor / Windsurf** need the **`/v1`** base for OpenAI-compatible routing:
`https://opusxmax.vercel.app/api/v1`

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, Radix UI, shadcn-style components |
| DB | PostgreSQL via Prisma (Neon in prod) |
| Cache / rate limits | Redis (Upstash) via `src/lib/redis.ts` |
| Auth (admin) | JWT in httpOnly cookie, bcrypt passwords |
| Package manager | **pnpm** (monorepo: root + `packages/cli`) |
| CLI build | tsup (ESM) |

---

## Architecture (request flow)

```
Client (Claude Code / Cursor / SDK)
  → x-api-key: sk-ant-ox-...  (gateway-issued key)
  → POST /api/v1/messages
       ├─ validate key (Prisma hash lookup)
       ├─ check RPM (Redis per key)
       ├─ reserve rolling token quota (Redis + UsageLog settle)
       └─ forward to Anthropic
            UPSTREAM_ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY (server env)
  ← stream or JSON pass-through
```

**Critical:** Gateway keys (`sk-ant-ox-*`) are **not** sent upstream. Server uses `ANTHROPIC_API_KEY` from env.

---

## Upstream configuration (DO NOT break this)

At commit `9159be5`, upstream is **direct Anthropic only**:

```env
UPSTREAM_ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_API_KEY=sk-ant-api03-...   # real Anthropic admin key
```

**Never point `UPSTREAM_ANTHROPIC_BASE_URL` at this gateway's own URL** — causes self-loop / 529 / fake overload errors.

### Reverted / rejected patterns (do NOT re-add without explicit user request)

These were tried in commits **after** `9159be5` and **reverted** because they caused `"overloaded_error": "Please wait server upgrading…"` via third-party provider:

- `src/lib/upstream-config.ts` — OpusMax provider on `api.opusmax.pro`
- `src/lib/upstream-fetch.ts` — 529 retry + Opus→Sonnet→Haiku fallback chain
- `GATEWAY_UPSTREAM_API_KEY` as separate upstream credential
- Routing through `api.opusmax.pro` instead of `api.anthropic.com`

User explicitly reset to `9159be5`. Keep upstream simple unless they ask otherwise.

URL helpers live in `src/lib/upstream-anthropic.ts` (`resolveAnthropicV1Base`, `upstreamMessagesUrl`, etc.).

---

## API routes

### Public (Anthropic-compatible)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/messages` | Main proxy; streaming SSE pass-through |
| GET | `/api/v1/models` | Static catalog by default |
| POST | `/api/v1/messages/count_tokens` | Token count proxy |
| GET | `/api/key-status?key=` | Public usage/quota checker (rate-limited) |
| POST | `/api/key-check` | JSON body `{ key }` — may not be deployed on all envs; CLI uses key-status |
| GET | `/api/health` | Health probe |
| POST | `/api/tools/web_search` | Server-side tool |
| POST | `/api/tools/understand_image` | Server-side tool |

Auth headers accepted: `x-api-key` or `Authorization: Bearer`.

### Admin (JWT cookie)

| Path | Purpose |
|------|---------|
| `/admin/login` | Admin UI login |
| `/api/admin/login` | JWT issue |
| `/api/admin/logout` | JSON logout (not redirect) |
| `/api/admin/keys` | CRUD keys |
| `/api/admin/usage` | Usage analytics |

Admin POST routes have Origin/CSRF protection.

---

## Models catalog

Defined in `src/lib/anthropic-models-fallback.ts`:

| Model ID | Display |
|----------|---------|
| `claude-opus-4-8` | Opus 4.8 (latest flagship) |
| `claude-opus-4-7` | Opus 4.7 |
| `claude-sonnet-4-6` | Sonnet 4.6 |
| `claude-haiku-4-5-20251001` | Haiku 4.5 |

- Default: static list, **no upstream call**
- Optional: `GATEWAY_FETCH_UPSTREAM_MODELS=1` merges Anthropic metadata for same IDs only (no extra models)
- `GATEWAY_DISABLE_MODELS_FALLBACK=1` → 502 if upstream models fails

Docs mirror models in `src/lib/docs-config.ts` (`AVAILABLE_MODELS`, `API_ENDPOINTS`).

> **Note:** Default Opus for Claude Code / CLI is `claude-opus-4-8`. Opus 4.7 remains available for backward compatibility.

---

## API keys

- **Issued format:** `sk-ant-ox-` + random (see `src/lib/apikey.ts`, `src/lib/utils.ts`)
- **Legacy accepted:** `sk-ox-` (CLI + key-check)
- **Storage:** SHA-256 hash only (`keyHash`), never plaintext in DB
- **Statuses:** ACTIVE, PAUSED, EXPIRED, REVOKED

Quota: rolling **5-hour window** (`QUOTA_WINDOW_SECONDS` in `src/lib/quota.ts`). Cost multipliers for budget enforcement: Haiku 0.25×, Sonnet 1×, Opus 5× (not applied to raw token logging).

Key status UI reads usage from `UsageLog` (stable window, not Redis jitter).

---

## CLI package (`packages/cli`)

| Item | Value |
|------|-------|
| npm name | `opusmaxx` |
| Command | `npx opusmaxx setup` |
| Config dir | `~/.opusmax/config.json` |

**Setup flow:** paste API key → verify via `GET /api/key-status` → multi-select IDE → write configs → optional test.

Commands: `setup`, `status --verify`, `test`, `models`, `doctor`, `logout`.

Build: `pnpm cli:build` · Dev: `pnpm cli:dev setup` · Publish: `pnpm cli:publish` (needs npm OTP).

IDE setup helpers: `packages/cli/src/utils/ide-setup.ts` (Claude Code, Desktop, VS Code/Cline/Roo merge, Cursor/Windsurf instructions, terminal `.env`).

---

## Key source files

```
src/
  app/
    api/v1/messages/route.ts    # Core proxy logic
    api/v1/models/route.ts      # Models list
    api/key-status/route.ts     # Public key checker
    api/key-check/route.ts      # POST key validation
    docs/page.tsx               # Premium docs UI
    admin/                      # Dashboard (keys, usage, plans)
    key-status/page.tsx         # Public usage page
  lib/
    docs-config.ts              # Docs URLs, CLI strings, model cards — UPDATE HERE for URL changes
    anthropic-models-fallback.ts
    upstream-anthropic.ts
    apikey.ts                   # Key format, errors, hashing
    quota.ts                    # Rolling window Redis Lua
    redis.ts                    # Singleton, deduped connection logs
    prisma.ts
    key-check.ts                # Shared key validation logic
packages/cli/                   # opusmaxx npm package
prisma/schema.prisma            # ApiKey, Plan, UsageLog, AdminUser
.env.example                    # Env template — copy to .env.local
```

---

## Frontend pages

| Route | Description |
|-------|-------------|
| `/` | Marketing homepage |
| `/docs` | Setup guide + API reference |
| `/key-status` | Public API key usage checker |
| `/admin/*` | Protected admin dashboard |
| `/privacy`, `/terms` | Legal pages with SiteHeader/Footer |

Shared layout: `src/components/site/site-header.tsx`, `site-footer.tsx`.

---

## Environment variables

See `.env.example`. Required for production:

- `DATABASE_URL` — Neon PostgreSQL
- `REDIS_URL` — Upstash Redis
- `ANTHROPIC_API_KEY` — upstream Anthropic key
- `UPSTREAM_ANTHROPIC_BASE_URL` — `https://api.anthropic.com` (not self)
- `JWT_SECRET` — min 32 chars, non-empty
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — bootstrap admin
- `NEXT_PUBLIC_APP_URL` — deployment origin

Optional: `GATEWAY_FETCH_UPSTREAM_MODELS`, `GATEWAY_DISABLE_MODELS_FALLBACK`.

---

## Dev commands

```bash
pnpm install
pnpm dev              # Next.js dev server :3000
pnpm build && pnpm start   # Production locally (prestart checks .next/BUILD_ID)
pnpm typecheck        # next typegen + tsc
pnpm lint
pnpm db:seed          # Seed plans/admin
pnpm cli:build        # Build opusmaxx CLI
pnpm cli:dev setup    # Run CLI in dev
```

**Common fixes:**
- `npm start` vendor-chunks error → delete `.next`, run `pnpm build` then `pnpm start`
- Port 3000 in use → kill old node process
- Redis ENOTFOUND spam → use singleton in `src/lib/redis.ts` (already fixed)

---

## Coding conventions for agents

1. **Minimal diffs** — only change what the task requires
2. **Match existing patterns** — Zod validation, `createErrorResponse`, Prisma selects
3. **URLs** — update `src/lib/docs-config.ts` first, then docs page imports from there
4. **No secrets in git** — never commit `.env`, real API keys
5. **BigInt JSON** — polyfill exists for admin routes serializing Prisma BigInt fields
6. **Streaming** — pass-through SSE; don't buffer full stream for usage (settle on usage events)
7. **zod** — use `error.issues` not deprecated `error.errors`
8. **Git** — only commit/push when user explicitly asks; no force-push to `main` without explicit request

---

## Git / deploy

- **Branch:** `main` → Vercel auto-deploy from GitHub
- **Hybrid (optional):** same repo on **Railway** for always-on API — see `docs/RAILWAY.md`, `railway.toml`, `Dockerfile`. Vercel unchanged when Railway env vars unset.
- **Cloudflare (optional, experimental):** OpenNext via `pnpm cf:deploy` — see `docs/CLOUDFLARE.md`. Remove guide included; Railway/Vercel default unchanged.
- **Baseline commit:** `9159be5` (user reverted later upstream experiments to this)
- Commits after `9159be5` that were removed: upstream provider layer, 529 fallbacks, `/api` root route, Opus 4.8, api-cors/gateway-info

When user says "push kro", check `git status` first — may already be synced.

### Hybrid env (optional)

| Where | Variable | Purpose |
|-------|----------|---------|
| Vercel | *(none required)* | Default API stays `https://opusxmax.vercel.app/api` |
| Vercel | `NEXT_PUBLIC_RAILWAY_API_URL` | Docs show Railway fast endpoint |
| Railway | Copy Vercel env + `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL` | Always-on API, same Neon/Redis |

---

## Troubleshooting quick reference

| Symptom | Likely cause |
|---------|--------------|
| `overloaded_error` / "server upgrading" | Upstream pointed at `api.opusmax.pro` or self-loop — use `api.anthropic.com` |
| CLI "Invalid JSON" on key-check | `/api/key-check` not deployed — CLI uses `/api/key-status` (GET) |
| Models empty in client | Check `/api/v1/models` with valid key; static fallback should always return 3 models |
| 401 on API | Wrong/expired/revoked `sk-ant-ox-*` key |
| Quota blocked | Rolling 5h window exhausted — check `/api/key-status` |
| Admin pages 500 on BigInt | Ensure BigInt.prototype.toJSON polyfill loaded |

---

## User preferences (from past sessions)

- Production base URL: **`https://opusxmax.vercel.app/api`** (not `opusmax.pro`)
- CLI command: **`npx opusmaxx`** (npm package `opusmaxx`, not `opusmax` or `opusmax-gateway`)
- Setup UX: user pastes key only → picks IDEs (VS Code, Cursor, Claude Code, Windsurf, etc.)
- Prefer **direct Anthropic upstream** — avoid re-introducing third-party provider routing
- Communicate in Hinglish when user writes in Hinglish; code/commits in English

---

*Last updated: reflects repo state at commit `9159be5`. Update this file when architecture, URLs, or baseline commit changes.*
