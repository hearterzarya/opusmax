import { IS_RAILWAY_RUNTIME, RAILWAY_API_BASE_URL, resolveRuntimeApiBase } from '@/lib/deploy-config'

/** GET /api/v1 discovery — includes platform hint for hybrid Vercel + Railway deploys. */
export const GATEWAY_API_INFO = {
  service: 'OpusMax Gateway',
  provider: 'opusx',
  anthropic_compatible: true,
  openai_compatible: true,
  platform: IS_RAILWAY_RUNTIME ? 'railway' : 'vercel',
  base_url: '/api',
  v1_base_url: '/api/v1',
  ...(IS_RAILWAY_RUNTIME
    ? { public_api_base_url: resolveRuntimeApiBase() }
    : RAILWAY_API_BASE_URL
      ? { fast_api_base_url: RAILWAY_API_BASE_URL }
      : {}),
  endpoints: {
    messages: '/api/v1/messages',
    chat_completions: '/api/v1/chat/completions',
    models: '/api/v1/models',
    count_tokens: '/api/v1/messages/count_tokens',
    key_status: '/api/key-status',
    health: '/api/health',
  },
  docs: '/docs',
  hint:
    'LobeHub / OpenAI: Base URL …/api/v1 · Anthropic / Claude Code: …/api · Hybrid: Railway for fast API, Vercel for web/admin.',
} as const
