# Optional: Cloudflare Workers deploy (OpenNext)

**Vercel + Railway stay the default.** Cloudflare is an **optional** path — nothing breaks if you never use it.

## What this adds

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Cloudflare Worker config |
| `open-next.config.ts` | OpenNext adapter config |
| `public/_headers` | Static asset caching on CF |
| `pnpm cf:*` scripts | Build / preview / deploy |

**Unchanged:** `Dockerfile`, `railway.toml`, `vercel.json`, `next.config.ts`, normal `pnpm build` / `pnpm start`.

---

## Deploy to Cloudflare

### 1. Prerequisites

- [Cloudflare account](https://dash.cloudflare.com) (Workers Paid recommended — bundle size)
- Wrangler login: `pnpm wrangler login`

### 2. Env vars (Cloudflare dashboard → Workers → Settings → Variables)

Copy from Vercel/Railway **except** `REDIS_URL` TCP — use **Upstash REST** when you enable Redis on CF:

```env
DATABASE_URL=postgresql://...neon...
ANTHROPIC_API_KEY=...
UPSTREAM_ANTHROPIC_BASE_URL=https://api.opusmax.pro
JWT_SECRET=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
NEXT_PUBLIC_API_BASE_URL=https://opusmax-gateway.YOUR_SUBDOMAIN.workers.dev/api
NEXT_PUBLIC_SITE_URL=https://opusxmax.vercel.app
```

**Production blockers (not migrated yet):**

- **Prisma/Neon:** needs [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) or Prisma Accelerate for Workers
- **Redis:** `ioredis` TCP does not run on Workers — switch to `@upstash/redis` REST API
- **Long streaming:** Workers CPU limits may differ from Railway 300s

Until those are done, use **Railway for API** and treat CF deploy as experimental.

### 3. Local preview

```bash
cp .dev.vars.example .dev.vars
pnpm cf:preview
# → http://localhost:8787
curl http://localhost:8787/api/health
```

### 4. Deploy (CLI)

```bash
pnpm cf:deploy
```

### 5. Deploy (GitHub → Cloudflare)

Cloudflare dashboard → Workers → Connect repository:

| Setting | Value |
|---------|-------|
| Root directory | `/` (repo root, **not** `packages/cli`) |
| Build command | `pnpm install && pnpm cf:build` |
| Deploy command | `pnpm cf:deploy` |

Do **not** use plain `wrangler deploy` alone — that causes the monorepo workspace error.

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
pnpm remove -D wrangler @opennextjs/cloudflare
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

No changes needed to `next.config.ts`, `src/`, or env on Railway/Vercel.

---

## Recommended production setup (today)

| Role | Platform |
|------|----------|
| API (fast) | **Railway** |
| Web + admin | **Vercel** |
| Cloudflare | Optional / experimental until Hyperdrive + Upstash REST migration |
