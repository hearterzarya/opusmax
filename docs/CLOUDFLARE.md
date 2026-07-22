# Cloudflare Workers deploy (OpenNext)

**Vercel + Railway stay the default.** Cloudflare is an **optional** production path — nothing breaks if you never use it.

## What this adds

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Worker config (`OPUSX_RUNTIME=cloudflare`) |
| `open-next.config.ts` | OpenNext adapter config |
| `src/lib/runtime-config.ts` | CF / Upstash / Neon driver detection |
| `src/lib/redis-upstash.ts` | Upstash REST Redis (Workers-compatible) |
| `src/lib/prisma.ts` | Neon HTTP driver when `OPUSX_RUNTIME=cloudflare` |
| `public/_headers` | Static asset caching on CF |
| `pnpm cf:*` scripts | Build / preview / deploy |

**Unchanged:** `Dockerfile`, `railway.toml`, `vercel.json`, normal `pnpm build` / `pnpm start`.

---

## Full production on Cloudflare

### Runtime requirements

| Service | Cloudflare Workers | Railway / Vercel |
|---------|-------------------|------------------|
| **Postgres** | Neon via `@prisma/adapter-neon` (HTTP) | Standard Prisma TCP |
| **Redis** | **Upstash REST** (`UPSTASH_REDIS_REST_*`) | TCP `REDIS_URL` (Vercel only) or in-memory (Railway) |
| **Upstream** | `UPSTREAM_ANTHROPIC_BASE_URL` (fetch) | Same |

TCP Redis (`redis.io`, `REDIS_URL`) **does not work** on Workers. Create a free [Upstash Redis](https://console.upstash.com/) database and use the **REST** URL + token.

### 1. Prerequisites

- [Cloudflare account](https://dash.cloudflare.com) — **Workers Paid** recommended (bundle size)
- Wrangler login: `pnpm wrangler login`
- Neon `DATABASE_URL` (same as Vercel/Railway)
- Upstash REST credentials

### 2. Env vars

**Cloudflare dashboard → Workers → opusmax-gateway → Settings → Variables**

```env
DATABASE_URL=postgresql://...neon...
UPSTASH_REDIS_REST_URL=https://YOUR-DB.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN

ANTHROPIC_API_KEY=...
UPSTREAM_ANTHROPIC_BASE_URL=https://api.anthropic.com
JWT_SECRET=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...

NEXT_PUBLIC_API_BASE_URL=https://opusmax-gateway.YOUR_SUBDOMAIN.workers.dev/api
NEXT_PUBLIC_SITE_URL=https://opusxmax.vercel.app
```

`OPUSX_RUNTIME=cloudflare` is set in `wrangler.jsonc` `vars` — no need to duplicate unless overriding.

**Do not set** `REDIS_URL` on Cloudflare (ignored; use Upstash REST).

Optional overrides:

| Variable | Effect |
|----------|--------|
| `GATEWAY_PRISMA_DRIVER=neon` | Force Neon HTTP driver (e.g. local CF preview) |
| `GATEWAY_PRISMA_DRIVER=default` | Force standard Prisma TCP (Node only) |
| `GATEWAY_REDIS_KEY_CACHE=1` | Enable Redis API-key cache (needs Upstash on CF) |

### 3. Local preview

```bash
cp .dev.vars.example .dev.vars
# Fill DATABASE_URL, UPSTASH_*, gateway secrets
pnpm cf:preview
# → http://localhost:8787
curl http://localhost:8787/api/health
```

### 4. Deploy (CLI)

```bash
pnpm cf:deploy
```

> **Windows:** `pnpm cf:build` may fail with `EPERM` symlink errors. Use WSL, GitHub-connected Cloudflare builds (Linux), or enable Developer Mode / run terminal as Administrator. Railway/Vercel `pnpm build` is unaffected.

### 5. Deploy (GitHub → Cloudflare Workers Builds)

Cloudflare dashboard → Workers & Pages → opusmax-gateway → Settings → Builds:

| Setting | Value |
|---------|-------|
| Root directory | `/` (repo root, **not** `packages/cli`) |
| Build command | `pnpm install --frozen-lockfile && pnpm cf:deploy` |
| Deploy command | _(leave empty — `cf:deploy` handles both build + deploy)_ |

**Important:** Do NOT use `pnpm run build` as the build command — that runs `next build` (for Vercel), not the OpenNext Cloudflare build.

If Cloudflare Workers Builds requires separate build/deploy steps:

| Setting | Value |
|---------|-------|
| Build command | `pnpm install --frozen-lockfile && pnpm cf:build` |
| Deploy command | `pnpm cf:deploy` |

**Environment variables** must be set in Cloudflare Workers → Settings → Variables & secrets (NOT in Build Variables, since these are runtime secrets):

```
DATABASE_URL=postgresql://...neon...
UPSTASH_REDIS_REST_URL=https://YOUR-DB.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN
ANTHROPIC_API_KEY=...
UPSTREAM_ANTHROPIC_BASE_URL=https://api.anthropic.com
JWT_SECRET=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

**Build variables** (needed at build time for static page generation — set in Builds → Build Variables):

```
DATABASE_URL=postgresql://...neon... (same as runtime)
```

Do **not** use plain `wrangler deploy` alone — that skips the OpenNext build step.

### 6. Hyperdrive (optional)

The default path uses Neon's HTTP driver (`@neondatabase/serverless`). For lower DB latency you can add [Hyperdrive](https://developers.cloudflare.com/hyperdrive/):

1. Create a Hyperdrive config pointing at your Neon `DATABASE_URL`
2. Uncomment the `hyperdrive` block in `wrangler.jsonc`
3. Set `GATEWAY_PRISMA_DRIVER=default` and wire Hyperdrive in Prisma (advanced — not required for initial deploy)

### 7. Streaming / CPU limits

Workers have different CPU/time limits than Railway (300s). Long `POST /api/v1/messages` streams may hit limits on very long responses. Test with your typical Claude Code sessions; keep **Railway** as API fallback if needed.

---

## Claude Code (if CF is production API)

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-ox-…",
    "ANTHROPIC_BASE_URL": "https://opusmax-gateway.YOUR_SUBDOMAIN.workers.dev/api"
  }
}
```

---

## Remove Cloudflare (back to Railway + Vercel only)

Follow these steps to restore the repo to **exactly** the pre-Cloudflare workflow:

### 1. Delete files

```bash
rm wrangler.jsonc
rm open-next.config.ts
rm -rf public
rm .dev.vars.example
rm docs/CLOUDFLARE.md
```

### 2. Remove from `package.json`

Delete the `cf:build`, `cf:preview`, `cf:deploy`, `cf:upload`, `cf:typegen` scripts.

### 3. Uninstall packages

```bash
pnpm remove @upstash/redis @prisma/adapter-neon @neondatabase/serverless
pnpm remove -D wrangler @opennextjs/cloudflare ws @types/ws
```

### 4. Revert `.gitignore`

Remove these lines:

```
.open-next
.wrangler
.dev.vars
cloudflare-env.d.ts
```

### 5. Cloudflare dashboard

Disconnect the GitHub repo or delete the Worker project.

### 6. Keep using

- **Railway** — API (`railway.toml` + `Dockerfile`)
- **Vercel** — web/admin (`git push` to main)

Revert `src/lib/runtime-config.ts`, `redis-upstash.ts`, `redis-types.ts`, and Prisma/Redis changes if you added CF-only logic.

---

## Recommended production setup

| Role | Platform | Notes |
|------|----------|-------|
| API (lowest latency) | **Railway** US East | No `REDIS_URL`; in-memory rate/quota |
| Web + admin | **Vercel** | Unchanged |
| API (edge / global) | **Cloudflare** | Neon + Upstash REST required |
