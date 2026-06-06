# Vercel + Railway hybrid deploy

Same repo runs on **both** platforms. Vercel behavior is unchanged when Railway env vars are not set.

## Roles

| Platform | Purpose | URL example |
|----------|---------|-------------|
| **Vercel** | Website, admin, docs, API (existing) | `https://opusxmax.vercel.app` |
| **Railway** | Always-on API (lower latency, streaming) | `https://xxx.up.railway.app` or `https://api.yourdomain.com` |

Both share the **same** Neon `DATABASE_URL`. **Redis is Vercel-only** — Railway uses in-memory rate/quota (faster, no `REDIS_URL` needed).

## 1. Railway setup

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub → this repo
2. **Region:** US East (same as Neon / Upstash)
3. Railway reads `railway.toml` + `Dockerfile` automatically
4. **Variables** — copy from Vercel, plus Railway-specific:

```env
# Required (same Neon DB as Vercel)
DATABASE_URL=...
ANTHROPIC_API_KEY=...              # OpusMax Pro upstream key
UPSTREAM_ANTHROPIC_BASE_URL=...    # OpusMax Pro base URL
JWT_SECRET=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...

# Do NOT set REDIS_URL on Railway — it slows every request if Redis is in another region.
# Rate limit + quota run in-memory on the always-on Railway instance.

# Railway API origin (this service)
NEXT_PUBLIC_API_BASE_URL=https://YOUR-RAILWAY-DOMAIN/api
NEXT_PUBLIC_SITE_URL=https://opusxmax.vercel.app
```

5. **Resources:** 512MB–1GB RAM, 0.5–1 vCPU, 1 replica
6. Generate domain or add custom domain (e.g. `api.yourdomain.com`)

## 2. Vercel (no code changes required)

Keep existing deploy. Optionally add **one** variable so docs show the Railway fast endpoint:

```env
NEXT_PUBLIC_RAILWAY_API_URL=https://api.yourdomain.com/api
```

If unset, docs and defaults stay `https://opusxmax.vercel.app/api`.

## 3. Client setup

**Claude Code (fast path — Railway):**

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-ox-…",
    "ANTHROPIC_BASE_URL": "https://api.yourdomain.com/api"
  }
}
```

**LobeHub (OpenAI mode):** Base URL = `https://api.yourdomain.com/api/v1`

**Fallback (Vercel API):** `https://opusxmax.vercel.app/api`

## 4. Verify

```bash
curl https://YOUR-RAILWAY-DOMAIN/api/health
curl https://YOUR-RAILWAY-DOMAIN/api/v1
curl https://opusxmax.vercel.app/api/health   # Vercel still works
```

## 5. Cost

Railway **Hobby** (~$5/mo) is enough to start. Monitor Usage in Railway dashboard.
