import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { DEFAULT_V1_URL } from './constants.js'
import { claudeCodeSettingsPath, claudeDesktopConfigPath, vscodeUserSettingsPath } from './detect.js'
import { mergeJsonConfigFile } from './json-config.js'
import { patchClaudeDesktopConfig } from './claude-desktop.js'
import type { IdeId } from './constants.js'

export type IdeSetupResult = {
  id: IdeId
  label: string
  ok: boolean
  summary: string
}

function claudeEnvMerge(baseUrl: string, apiKey: string) {
  return (current: Record<string, unknown>) => {
    const env =
      typeof current.env === 'object' && current.env !== null
        ? (current.env as Record<string, string>)
        : {}
    return {
      ...current,
      hasCompletedOnboarding: current.hasCompletedOnboarding ?? true,
      env: {
        ...env,
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_MODEL: env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
        ANTHROPIC_SMALL_FAST_MODEL: env.ANTHROPIC_SMALL_FAST_MODEL ?? 'claude-haiku-4-5-20251001',
        ANTHROPIC_DEFAULT_SONNET_MODEL: env.ANTHROPIC_DEFAULT_SONNET_MODEL ?? 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: env.ANTHROPIC_DEFAULT_OPUS_MODEL ?? 'claude-opus-4-7',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? 'claude-haiku-4-5-20251001',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ?? '1',
      },
    }
  }
}

export function setupClaudeCode(baseUrl: string, apiKey: string): IdeSetupResult {
  const filePath = claudeCodeSettingsPath()
  const result = mergeJsonConfigFile(filePath, claudeEnvMerge(baseUrl, apiKey))
  if (!result.ok) {
    return { id: 'claude-code', label: 'Claude Code', ok: false, summary: result.error }
  }
  const note = result.created ? 'created' : `updated (backup saved)`
  return { id: 'claude-code', label: 'Claude Code', ok: true, summary: `${filePath} ${note}` }
}

export function setupClaudeDesktop(baseUrl: string, apiKey: string): IdeSetupResult {
  const patch = patchClaudeDesktopConfig(baseUrl, apiKey)
  if (!patch.ok) {
    return { id: 'claude-desktop', label: 'Claude Desktop', ok: false, summary: patch.error }
  }
  if (patch.manual) {
    return {
      id: 'claude-desktop',
      label: 'Claude Desktop',
      ok: true,
      summary: `Manual: create ${patch.path}`,
    }
  }
  return {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    ok: true,
    summary: `Updated ${patch.path}`,
  }
}

function setupVsCodeFamily(
  baseUrl: string,
  apiKey: string,
  parts: IdeId[]
): IdeSetupResult[] {
  const filePath = vscodeUserSettingsPath()
  const result = mergeJsonConfigFile(filePath, (current) => {
    const next: Record<string, unknown> = { ...current }
    if (parts.includes('vscode')) {
      next['claude-code.environment'] = {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_API_KEY: apiKey,
      }
    }
    if (parts.includes('cline')) {
      next['cline.apiProvider'] = 'anthropic'
      next['cline.anthropicBaseUrl'] = baseUrl
      next['cline.apiKey'] = apiKey
    }
    if (parts.includes('roo')) {
      next['roo-cline.apiProvider'] = 'anthropic'
      next['roo-cline.anthropicBaseUrl'] = baseUrl
      next['roo-cline.apiKey'] = apiKey
    }
    return next
  })

  if (!result.ok) {
    return parts.map((id) => ({
      id,
      label: id === 'roo' ? 'Roo Code' : id === 'cline' ? 'Cline' : 'VS Code',
      ok: false,
      summary: result.error,
    }))
  }

  const shared = `${filePath} updated — restart VS Code`
  return parts.map((id) => ({
    id,
    label: id === 'roo' ? 'Roo Code' : id === 'cline' ? 'Cline' : 'VS Code',
    ok: true,
    summary: shared,
  }))
}

export function printCursorInstructions(apiKey: string): IdeSetupResult {
  return {
    id: 'cursor',
    label: 'Cursor',
    ok: true,
    summary: 'See Cursor block below',
  }
}

export function printWindsurfInstructions(): IdeSetupResult {
  return {
    id: 'windsurf',
    label: 'Windsurf',
    ok: true,
    summary: `Base URL → ${DEFAULT_V1_URL}`,
  }
}

export function setupTerminalEnv(baseUrl: string, apiKey: string, cwd: string): IdeSetupResult {
  const envPath = path.join(cwd, '.env')
  const lines = [
    `# OpusMax Gateway`,
    `ANTHROPIC_BASE_URL=${baseUrl}`,
    `ANTHROPIC_API_KEY=${apiKey}`,
    '',
  ]
  try {
    fs.writeFileSync(envPath, lines.join('\n'), 'utf8')
    return { id: 'terminal', label: 'Terminal', ok: true, summary: `Wrote ${envPath}` }
  } catch (err) {
    return {
      id: 'terminal',
      label: 'Terminal',
      ok: false,
      summary: err instanceof Error ? err.message : 'Failed to write .env',
    }
  }
}

export function printIdeSnippetBlock(ide: IdeId, baseUrl: string, apiKey: string) {
  if (ide === 'cursor') {
    console.log(chalk.gray('  Cursor → Settings → Models → OpenAI-compatible'))
    console.log(chalk.cyan(`  Base URL: ${DEFAULT_V1_URL}`))
    console.log(chalk.cyan(`  API Key:  ${apiKey.slice(0, 12)}••••••••`))
    console.log(chalk.cyan('  Model:    claude-sonnet-4-6'))
  }
  if (ide === 'windsurf') {
    console.log(chalk.gray('  Windsurf → Settings → AI Provider'))
    console.log(chalk.cyan(`  Base URL: ${DEFAULT_V1_URL}`))
  }
}

export function runIdeSetups(
  selected: IdeId[],
  baseUrl: string,
  apiKey: string,
  cwd: string
): IdeSetupResult[] {
  const results: IdeSetupResult[] = []
  const vscodeParts = selected.filter((id): id is 'vscode' | 'cline' | 'roo' =>
    id === 'vscode' || id === 'cline' || id === 'roo'
  )

  if (selected.includes('claude-code')) results.push(setupClaudeCode(baseUrl, apiKey))
  if (selected.includes('claude-desktop')) results.push(setupClaudeDesktop(baseUrl, apiKey))
  if (vscodeParts.length > 0) results.push(...setupVsCodeFamily(baseUrl, apiKey, vscodeParts))
  if (selected.includes('cursor')) results.push(printCursorInstructions(apiKey))
  if (selected.includes('windsurf')) results.push(printWindsurfInstructions())
  if (selected.includes('terminal')) results.push(setupTerminalEnv(baseUrl, apiKey, cwd))

  return results
}
