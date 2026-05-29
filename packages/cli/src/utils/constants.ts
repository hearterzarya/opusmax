export const DEFAULT_BASE_URL = 'https://opusxmax.vercel.app/api'
export const DEFAULT_V1_URL = 'https://opusxmax.vercel.app/api/v1'
export const KEY_STATUS_HINT = `${DEFAULT_BASE_URL}/key-status?key=YOUR_API_KEY`

export const CLI_NAME = 'OpusMax CLI'
export const CONFIG_DIR_NAME = '.opusmax'
export const CONFIG_FILE_NAME = 'config.json'
export const ISSUED_KEY_PREFIX = 'sk-ant-ox-'
export const LEGACY_KEY_PREFIX = 'sk-ox-'

export const IDE_CHOICES = [
  { value: 'claude-code', name: 'Claude Code', description: '~/.claude/settings.json' },
  { value: 'claude-desktop', name: 'Claude Desktop', description: 'Desktop app env' },
  { value: 'vscode', name: 'VS Code', description: 'Claude / shared env' },
  { value: 'cursor', name: 'Cursor', description: 'Models → OpenAI-compatible' },
  { value: 'windsurf', name: 'Windsurf', description: 'AI Provider base URL' },
  { value: 'cline', name: 'Cline', description: 'VS Code extension' },
  { value: 'roo', name: 'Roo Code', description: 'VS Code extension' },
  { value: 'terminal', name: 'Terminal', description: '.env in current folder' },
] as const

export type IdeId = (typeof IDE_CHOICES)[number]['value']
