export const GATEWAY_API_INFO = {
  service: 'OpusMax Gateway',
  provider: 'opusx',
  anthropic_compatible: true,
  openai_compatible: true,
  base_url: '/api',
  v1_base_url: '/api/v1',
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
    'LobeHub / OpenAI clients: Base URL https://your-domain/api/v1, API key sk-ant-ox-…. Anthropic clients: Base URL https://your-domain/api',
} as const
