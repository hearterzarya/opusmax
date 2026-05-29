export const API_BASE_URL = 'https://opusxmax.vercel.app/api'
export const API_V1_URL = 'https://opusxmax.vercel.app/api/v1'
export const DOCS_URL = 'https://opusxmax.vercel.app/docs'

export const API_KEY_PLACEHOLDER = 'YOUR_API_KEY'

export const CLI_PACKAGE = 'opusmaxx'

export const CLI_COMMANDS = {
  setup: `npx ${CLI_PACKAGE} setup`,
  status: `npx ${CLI_PACKAGE} status --verify`,
  test: `npx ${CLI_PACKAGE} test`,
  models: `npx ${CLI_PACKAGE} models`,
  doctor: `npx ${CLI_PACKAGE} doctor`,
} as const

export const CLI_QUICK_START_CODE = `# 1. Run interactive setup (paste your API key when prompted)
${CLI_COMMANDS.setup}

# 2. Verify config and key
${CLI_COMMANDS.status}

# 3. Optional: send a test message
${CLI_COMMANDS.test}`

export const CLI_SUPPORTED_IDES = [
  'Claude Code',
  'Claude Desktop',
  'VS Code',
  'Cursor',
  'Windsurf',
  'Cline',
  'Roo Code',
  'Terminal (.env)',
] as const

export const CLI_SETUP_STEPS = [
  {
    title: 'Paste your API key',
    body: `Enter your OpusMax key (sk-ant-ox-…). The CLI verifies it against ${API_BASE_URL}/key-status.`,
  },
  {
    title: 'Choose your tools',
    body: 'Select one or more IDEs/agents — VS Code, Cursor, Claude Code, Windsurf, Cline, Roo Code, and more.',
  },
  {
    title: 'Apply & test',
    body: 'Configuration is written automatically where possible. Optionally run a quick test message when setup finishes.',
  },
] as const

export const API_ENDPOINTS = {
  messages: `${API_V1_URL}/messages`,
  models: `${API_V1_URL}/models`,
  countTokens: `${API_V1_URL}/messages/count_tokens`,
  keyStatus: `${API_BASE_URL}/key-status?key=${API_KEY_PLACEHOLDER}`,
  webSearch: `${API_BASE_URL}/tools/web_search`,
  understandImage: `${API_BASE_URL}/tools/understand_image`,
} as const

export const API_PATHS = {
  messages: '/v1/messages',
  models: '/v1/models',
  countTokens: '/v1/messages/count_tokens',
  keyStatus: '/key-status?key=',
  webSearch: '/tools/web_search',
  understandImage: '/tools/understand_image',
} as const

export type DocNavItem = { id: string; label: string }
export type DocNavGroup = { title: string; items: DocNavItem[] }

export const DOC_NAV: DocNavGroup[] = [
  {
    title: 'Getting Started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'cli-setup', label: 'CLI Setup' },
      { id: 'prerequisites', label: 'Prerequisites' },
    ],
  },
  {
    title: 'IDE Configuration',
    items: [
      { id: 'claude-code', label: 'Claude Code CLI' },
      { id: 'vscode', label: 'VS Code' },
      { id: 'cursor', label: 'Cursor' },
      { id: 'windsurf', label: 'Windsurf' },
      { id: 'cline', label: 'Cline' },
      { id: 'roo', label: 'Roo Code' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { id: 'authentication', label: 'Authentication' },
      { id: 'messages', label: 'Messages' },
      { id: 'models', label: 'Models' },
      { id: 'token-counting', label: 'Token Counting' },
      { id: 'key-status', label: 'Key Status' },
      { id: 'web-search', label: 'Web Search' },
      { id: 'image-analysis', label: 'Image Analysis' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { id: 'builtin-tools', label: 'Built-in Tools' },
      { id: 'available-models', label: 'Available Models' },
      { id: 'troubleshooting', label: 'Troubleshooting' },
    ],
  },
]

export const FEATURE_BADGES = [
  'Drop-in Compatible',
  'Per-Key Budgets',
  'Built-in Tools',
  'Full Claude Lineup',
] as const

export const CLAUDE_CODE_SETTINGS_JSON = `{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "${API_KEY_PLACEHOLDER}",
    "ANTHROPIC_BASE_URL": "${API_BASE_URL}",
    "ANTHROPIC_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_SMALL_FAST_MODEL": "claude-haiku-4-5-20251001",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-7",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5-20251001",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "hasCompletedOnboarding": true
}`

export const CLINE_SETTINGS_JSON = `{
  "cline.apiProvider": "anthropic",
  "cline.anthropicBaseUrl": "${API_BASE_URL}",
  "cline.apiKey": "${API_KEY_PLACEHOLDER}"
}`

export const ROO_SETTINGS_JSON = `{
  "roo-cline.apiProvider": "anthropic",
  "roo-cline.anthropicBaseUrl": "${API_BASE_URL}",
  "roo-cline.apiKey": "${API_KEY_PLACEHOLDER}"
}`

export const AUTH_HEADERS_CODE = `x-api-key: ${API_KEY_PLACEHOLDER}

# OR

Authorization: Bearer ${API_KEY_PLACEHOLDER}`

export const MESSAGES_REQUEST_CODE = `{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Hello, Claude!"
    }
  ],
  "stream": false
}`

export const MESSAGES_RESPONSE_CODE = `{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-6",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 12,
    "output_tokens": 15
  }
}`

export const MODELS_RESPONSE_CODE = `{
  "data": [
    {
      "id": "claude-opus-4-7",
      "object": "model",
      "display_name": "Claude Opus 4.7",
      "created_at": "2026-04-16T00:00:00Z"
    },
    {
      "id": "claude-sonnet-4-6",
      "object": "model",
      "display_name": "Claude Sonnet 4.6",
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": "claude-haiku-4-5-20251001",
      "object": "model",
      "display_name": "Claude Haiku 4.5",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}`

export const COUNT_TOKENS_REQUEST_CODE = `{
  "model": "claude-sonnet-4-6",
  "messages": [
    {
      "role": "user",
      "content": "How many tokens is this?"
    }
  ]
}`

export const KEY_STATUS_RESPONSE_CODE = `{
  "status": "found",
  "name": "My Key",
  "isActive": true,
  "windowTokenLimit": "5000000",
  "windowTokensUsed": "1234567",
  "windowActive": true,
  "windowResetAt": "2026-03-19T15:00:00.000Z",
  "planName": "Pro",
  "expiresAt": "2026-06-19T00:00:00.000Z",
  "totalRequests": 142,
  "last24h": {
    "requests": 28,
    "tokensIn": 45000,
    "tokensOut": 12000,
    "totalTokens": 57000,
    "avgLatencyMs": 1250
  }
}`

export const WEB_SEARCH_REQUEST_CODE = `{
  "query": "latest Node.js release 2026"
}`

export const IMAGE_ANALYSIS_REQUEST_CODE = `{
  "prompt": "Describe what you see in this image",
  "image_url": "https://example.com/photo.jpg"
}`

export const AVAILABLE_MODELS = [
  {
    name: 'Opus 4.7',
    badge: 'Premium',
    badgeClass: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
    id: 'claude-opus-4-7',
    description:
      'Flagship model for advanced reasoning, coding, long-context tasks, and agentic workflows.',
  },
  {
    name: 'Sonnet 4.6',
    badge: 'Popular',
    badgeClass: 'bg-violet-500/15 text-violet-200 ring-violet-500/30',
    id: 'claude-sonnet-4-6',
    description: 'Balanced model for everyday coding, writing, automation, and development tasks.',
  },
  {
    name: 'Haiku 4.5',
    badge: 'Fast',
    badgeClass: 'bg-cyan-500/15 text-cyan-200 ring-cyan-500/30',
    id: 'claude-haiku-4-5-20251001',
    description: 'Fast model for lightweight queries, quick responses, and high-throughput usage.',
  },
] as const

export const TROUBLESHOOTING_ITEMS = [
  {
    title: 'CLI verification failed',
    body: `Run ${CLI_COMMANDS.status} to confirm your key. Check usage at ${API_ENDPOINTS.keyStatus}. Ensure Node.js 18+ is installed.`,
  },
  {
    title: 'Connection errors',
    body: 'Check whether your API key is active, correctly copied, and not expired.',
  },
  {
    title: 'Web search or image tools not working',
    body: 'These tools run on the server. Verify the API key and confirm the endpoint is reachable.',
  },
  {
    title: 'Model not found',
    body: 'Use exact model IDs from the Available Models section.',
  },
  {
    title: 'Rate limited',
    body: 'Your rolling token window may be exhausted. Check the key status endpoint.',
  },
  {
    title: 'Changes not applying',
    body: 'Restart your IDE after changing API or model configuration.',
  },
  {
    title: 'Cursor or Windsurf not routing',
    body: `Make sure Cursor/Windsurf uses the /v1 endpoint: ${API_V1_URL}`,
  },
  {
    title: 'Claude Code auth conflict',
    body: 'Do not set both ANTHROPIC_AUTH_TOKEN and ANTHROPIC_API_KEY at the same time unless your setup explicitly requires it.',
  },
] as const
