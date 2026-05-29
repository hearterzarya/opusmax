import fs from 'node:fs'
import path from 'node:path'
import { claudeDesktopConfigPath } from './detect.js'

export type ClaudeDesktopPatchResult =
  | { ok: true; path: string; backupPath: string; manual: false }
  | { ok: true; path: string; manual: true; instructions: string }
  | { ok: false; error: string }

export function patchClaudeDesktopConfig(baseUrl: string, apiKey: string): ClaudeDesktopPatchResult {
  const configPath = claudeDesktopConfigPath()
  if (!configPath) {
    return { ok: false, error: 'Could not resolve Claude Desktop config path on this OS.' }
  }

  const manualSnippet = JSON.stringify(
    {
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: apiKey,
      },
    },
    null,
    2
  )

  if (!fs.existsSync(configPath)) {
    return {
      ok: true,
      path: configPath,
      manual: true,
      instructions: `Create ${configPath} with:\n${manualSnippet}`,
    }
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const backupPath = `${configPath}.opusmax-backup-${Date.now()}`
    fs.copyFileSync(configPath, backupPath)

    const env =
      typeof parsed.env === 'object' && parsed.env !== null
        ? (parsed.env as Record<string, string>)
        : {}

    const next = {
      ...parsed,
      env: {
        ...env,
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: apiKey,
      },
    }

    fs.writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', 'utf8')
    return { ok: true, path: configPath, backupPath, manual: false }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update Claude Desktop config',
    }
  }
}

export function describeClaudeDesktopPath(): string {
  const p = claudeDesktopConfigPath()
  return p || '(unknown)'
}
