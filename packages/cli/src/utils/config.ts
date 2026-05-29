import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { CONFIG_DIR_NAME, CONFIG_FILE_NAME, DEFAULT_BASE_URL } from './constants.js'
import { homeDir } from './detect.js'

const configSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type OpusMaxConfig = z.infer<typeof configSchema>

export function configDir(): string {
  return path.join(homeDir(), CONFIG_DIR_NAME)
}

export function configFilePath(): string {
  return path.join(configDir(), CONFIG_FILE_NAME)
}

export function maskApiKey(key: string): string {
  if (!key) return '—'
  if (key.length < 16) return '••••••••'
  const head = key.slice(0, 12)
  const tail = key.slice(-4)
  return `${head}${'•'.repeat(8)}${tail}`
}

export function isValidApiKeyFormat(key: string): boolean {
  const k = key.trim()
  return (
    (k.startsWith('sk-ant-ox-') || k.startsWith('sk-ox-')) && k.length >= 20
  )
}

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Base URL must start with http:// or https://')
  }
  return trimmed
}

export function loadConfig(): OpusMaxConfig | null {
  const file = configFilePath()
  if (!fs.existsSync(file)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
    return configSchema.parse(raw)
  } catch {
    return null
  }
}

export function saveConfig(partial: { baseUrl: string; apiKey?: string }): OpusMaxConfig {
  const now = new Date().toISOString()
  const existing = loadConfig()
  const next: OpusMaxConfig = configSchema.parse({
    baseUrl: normalizeBaseUrl(partial.baseUrl || existing?.baseUrl || DEFAULT_BASE_URL),
    apiKey: partial.apiKey ?? existing?.apiKey,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })

  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 })
  fs.writeFileSync(configFilePath(), JSON.stringify(next, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  })
  return next
}

export function clearApiKey(): OpusMaxConfig | null {
  const existing = loadConfig()
  if (!existing) return null
  const now = new Date().toISOString()
  const next: OpusMaxConfig = {
    baseUrl: existing.baseUrl,
    createdAt: existing.createdAt,
    updatedAt: now,
  }
  fs.writeFileSync(configFilePath(), JSON.stringify(next, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  })
  return next
}
