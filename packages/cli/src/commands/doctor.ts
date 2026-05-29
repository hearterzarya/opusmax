import { checkApiKey, pingBaseUrl, ApiError } from '../utils/api.js'
import { configFilePath, isValidApiKeyFormat, loadConfig } from '../utils/config.js'
import { ISSUED_KEY_PREFIX } from '../utils/constants.js'
import { describeClaudeDesktopPath } from '../utils/claude-desktop.js'
import { log, printBanner } from '../utils/logger.js'
import fs from 'node:fs'

function nodeOk(): boolean {
  const major = Number(process.versions.node.split('.')[0])
  return major >= 18
}

export async function runDoctor() {
  printBanner()
  log.title('Diagnostics')
  console.log()

  const checks: Array<{ ok: boolean; warn?: boolean; label: string; detail?: string }> = []

  checks.push({
    ok: nodeOk(),
    label: 'Node.js version',
    detail: process.version,
  })

  checks.push({
    ok: true,
    label: 'CLI package',
    detail: 'opusmaxx@1.0.0',
  })

  const config = loadConfig()
  checks.push({
    ok: !!config,
    label: 'Local config',
    detail: config ? configFilePath() : 'missing',
  })

  if (config) {
    checks.push({
      ok: true,
      label: 'Base URL',
      detail: config.baseUrl,
    })

    const reachable = await pingBaseUrl(config.baseUrl)
    checks.push({
      ok: reachable,
      label: 'Base URL reachable',
      detail: reachable ? 'OK' : 'unreachable',
    })

    if (config.apiKey) {
      const formatOk = isValidApiKeyFormat(config.apiKey)
      checks.push({
        ok: formatOk,
        label: 'API key format',
        detail: formatOk ? `starts with ${ISSUED_KEY_PREFIX}` : 'invalid',
      })

      if (formatOk) {
        try {
          await checkApiKey(config.baseUrl, config.apiKey)
          checks.push({ ok: true, label: 'API key server validation' })
        } catch (err) {
          checks.push({
            ok: false,
            label: 'API key server validation',
            detail: err instanceof ApiError ? err.message : 'failed',
          })
        }
      }
    } else {
      checks.push({ ok: false, warn: true, label: 'API key saved', detail: 'not set' })
    }
  }

  const desktopPath = describeClaudeDesktopPath()
  const desktopExists = desktopPath !== '(unknown)' && fs.existsSync(desktopPath)
  checks.push({
    ok: desktopExists,
    warn: !desktopExists,
    label: 'Claude Desktop config',
    detail: desktopExists ? desktopPath : `not found at ${desktopPath}`,
  })

  const envBase = process.env.ANTHROPIC_BASE_URL
  const envKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
  checks.push({
    ok: !!(envBase && envKey),
    warn: !(envBase && envKey),
    label: 'Shell environment',
    detail:
      envBase && envKey
        ? 'ANTHROPIC_* variables set'
        : 'ANTHROPIC_BASE_URL / key not set in this shell',
  })

  for (const c of checks) {
    const icon = c.ok ? '✓' : c.warn ? '⚠' : '✗'
    const color = c.ok ? '\x1b[32m' : c.warn ? '\x1b[33m' : '\x1b[31m'
    console.log(`${color}${icon}\x1b[0m ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)
  }

  console.log()
  const failed = checks.some((c) => !c.ok && !c.warn)
  if (failed) process.exitCode = 1
}
