# OpusX Gateway

A production-ready Anthropic-compatible AI API Gateway with key management, rate limiting, usage tracking, and admin dashboard.

## Features

- **Anthropic-compatible API proxy** - Works with all Anthropic SDK clients
- **API key management** - Create, pause, revoke keys with granular control
- **Rate limiting** - Per-key RPM limits with Redis-backed rolling windows
- **Token budgets** - 5-hour rolling window + monthly budget enforcement
- **Admin dashboard** - Metrics, usage logs, plans management
- **Public pages** - Landing, docs, status, key status checker

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Prisma ORM + PostgreSQL (Neon)
- **Cache**: Redis (Upstash)
- **Auth**: JWT (jose) + bcrypt

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL database (local or Neon)
- Redis (local or Upstash)

### 1. Clone and Install

```bash
cd opusx-gateway
pnpm install
```

### 2. Environment Variables

Create a `.env` file:

```bash
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host.neon.tech/opusx_gateway?sslmode=require

# Redis (Upstash)
REDIS_URL=redis://default:xxxx@xxx.upstash.io:6379

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Upstream URL (don't change)
UPSTREAM_ANTHROPIC_BASE_URL=https://api.anthropic.com

# Admin Authentication
ADMIN_EMAIL=admin@opusx.gateway
ADMIN_PASSWORD=YourSecurePassword123!
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars-long

# App URL
NEXT_PUBLIC_APP_URL=https://opusxmax.vercel.app
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Seed database (creates admin + plans)
pnpm db:seed
```

### 4. Start Development Server

```bash
pnpm dev
```

Visit https://opusxmax.vercel.app

## Docker Setup (Production)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## Admin Login

- **URL**: https://opusxmax.vercel.app/admin/login
- **Email**: admin@opusx.gateway (or as set in ADMIN_EMAIL)
- **Password**: OpusX-Admin-2026! (or as set in ADMIN_PASSWORD)

## API Endpoints

### Proxy Endpoints (use with API key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/messages` | Send messages to Claude |
| GET | `/api/v1/models` | List available models |
| POST | `/api/v1/messages/count_tokens` | Count tokens in messages |
| GET | `/api/key-status?key=` | Check API key usage |
| POST | `/tools/web_search` | Web search (placeholder) |
| POST | `/tools/understand_image` | Image understanding (placeholder) |

### Admin API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| POST | `/api/admin/logout` | Admin logout |
| GET/POST | `/api/admin/keys` | List/create API keys |
| GET | `/api/admin/plans` | List plans |
| GET | `/api/admin/usage` | List usage logs |
| GET | `/api/health` | Health check |

## Client Configuration

This repository **is** the gateway you deploy. The [`opusx` package on npm](https://www.npmjs.com/package/opusx) is a related scaffold (full app + `opusx` CLI for greenfield setups). **Do not `npm install opusx` into this project**—you would nest a second Next.js app. Instead, point any Anthropic-compatible client at **your** deployment using the variables below.

The npm readme uses `ANTHROPIC_BASE_URL=…/api` and a short key prefix example. This gateway uses the same **base URL shape** (`…/api` so paths become `/api/v1/messages`). Issued keys use the prefix **`sk-ant-ox-`** (not `sk-ox-`).

### Claude Code

Edit `~/.claude/settings.json`:

```json
{
  "anthropic": {
    "apiKey": "sk-ant-ox-your-api-key",
    "baseURL": "https://your-domain.com/api"
  }
}
```

### Cursor

Add to Cursor AI settings (Cmd+,):

```json
{
  "ANTHROPIC_API_KEY": "sk-ant-ox-your-api-key",
  "ANTHROPIC_BASE_URL": "https://your-domain.com/api"
}
```

### VS Code (Claude Extension)

```json
{
  "apiKey": "sk-ant-ox-your-api-key",
  "baseURL": "https://your-domain.com/api"
}
```

### cURL

```bash
curl https://your-domain.com/api/v1/messages \
  -H "x-api-key: sk-ant-ox-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 1024
  }'
```

## Deployment

### Vercel + Neon + Upstash

1. **Neon Database**
   - Create a new project at https://neon.tech
   - Copy the connection string

2. **Upstash Redis**
   - Create a new database at https://upstash.com
   - Copy the REST URL

3. **Vercel Deployment**
   ```bash
   npm i -g vercel
   vercel
   ```

4. **Environment Variables** (Vercel Dashboard)
   - Add all variables from `.env.example`
   - Set `DATABASE_URL` with Neon connection string
   - Set `REDIS_URL` with Upstash URL

### Local Docker Development

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Run migrations
pnpm prisma migrate deploy

# Start app
pnpm dev
```

## Error Codes

| Code | Description |
|------|-------------|
| `invalid_api_key` | API key not found or invalid |
| `key_expired` | API key has expired |
| `key_inactive` | API key is paused or revoked |
| `rate_limit_exceeded` | RPM limit exceeded |
| `token_budget_exceeded` | 5-hour token budget exceeded |
| `monthly_budget_exceeded` | Monthly token budget exceeded |
| `upstream_error` | Error from upstream Anthropic API |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/docs` | API documentation |
| `/status` | System health status |
| `/key-status` | Public API key checker |
| `/terms` | Terms of service |
| `/privacy` | Privacy policy |
| `/admin/login` | Admin login |
| `/admin` | Dashboard |
| `/admin/keys` | API key management |
| `/admin/keys/new` | Create new API key |
| `/admin/plans` | Plan management |
| `/admin/usage` | Usage logs |
| `/admin/settings` | Admin settings |

## Security

- API keys are hashed with SHA-256 before storage
- Raw API key is shown only once at creation
- JWT tokens for admin authentication
- Passwords hashed with bcrypt (12 rounds)
- No prompt/response content is stored
- Rate limiting with Redis rolling windows
- Monthly and hourly budget enforcement

## Quality Gates

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Lint
pnpm lint

# Type check
pnpm typecheck

# Build
pnpm build
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript check |
| `pnpm prisma generate` | Generate Prisma client |
| `pnpm prisma migrate dev` | Run migrations |
| `pnpm prisma studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed database |

## License

MIT
