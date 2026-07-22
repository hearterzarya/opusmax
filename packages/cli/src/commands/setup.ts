import { checkbox, confirm, password } from '@inquirer/prompts'
import ora from 'ora'
import chalk from 'chalk'
import { checkApiKey, ApiError } from '../utils/api.js'
import {
  configFilePath,
  isValidApiKeyFormat,
  maskApiKey,
  saveConfig,
} from '../utils/config.js'
import {
  DEFAULT_BASE_URL,
  IDE_CHOICES,
  ISSUED_KEY_PREFIX,
  KEY_STATUS_HINT,
  type IdeId,
} from '../utils/constants.js'
import { printIdeSnippetBlock, runIdeSetups } from '../utils/ide-setup.js'
import { log, printBanner } from '../utils/logger.js'

export async function runSetup() {
  printBanner()

  log.dim(`Gateway: ${chalk.cyan(DEFAULT_BASE_URL)}`)
  log.dim(`Key check: ${chalk.gray(KEY_STATUS_HINT)}`)
  console.log()

  const apiKey = await password({
    message: `Paste your OpusMax API key (${ISSUED_KEY_PREFIX}…)`,
    mask: '*',
    validate: (v) =>
      isValidApiKeyFormat(v) ? true : `Use a valid OpusMax key (${ISSUED_KEY_PREFIX}… or sk-ox-)`,
  })

  const spinner = ora('Verifying API key…').start()
  let keyName: string | undefined
  try {
    const result = await checkApiKey(DEFAULT_BASE_URL, apiKey)
    keyName = result.name
    spinner.succeed(keyName ? `Verified — ${keyName}` : 'API key verified')
  } catch (err) {
    spinner.fail('Verification failed')
    if (err instanceof ApiError) {
      log.error(err.message)
      log.dim(`Check usage: ${KEY_STATUS_HINT.replace('YOUR_API_KEY', maskApiKey(apiKey))}`)
    } else {
      log.error(err instanceof Error ? err.message : 'Unknown error')
    }
    process.exitCode = 1
    return
  }

  saveConfig({ baseUrl: DEFAULT_BASE_URL, apiKey })
  log.success(`Saved locally (${configFilePath()})`)
  log.dim(`Key: ${maskApiKey(apiKey)}`)

  console.log()
  const selected = await checkbox<IdeId>({
    message: 'Configure which tools? (Space to toggle, Enter to confirm)',
    choices: IDE_CHOICES.map((c) => ({
      name: c.name,
      value: c.value,
      description: c.description,
    })),
    required: true,
  })

  if (selected.length === 0) {
    log.warn('No tools selected. Config saved — run opusmaxx setup again anytime.')
    return
  }

  console.log()
  log.title('Applying configuration…')
  const results = runIdeSetups(selected, DEFAULT_BASE_URL, apiKey, process.cwd())

  for (const r of results) {
    if (r.ok) {
      log.success(`${r.label}: ${r.summary}`)
      if (r.id === 'cursor' || r.id === 'windsurf') {
        printIdeSnippetBlock(r.id, DEFAULT_BASE_URL, apiKey)
      }
    } else {
      log.error(`${r.label}: ${r.summary}`)
    }
  }

  const needsRestart = selected.some((id) =>
    ['claude-code', 'claude-desktop', 'vscode', 'cline', 'roo'].includes(id)
  )
  if (needsRestart) {
    console.log()
    log.info('Restart your IDE(s) or Claude Desktop for changes to take effect.')
  }

  const runTest = await confirm({
    message: 'Send a quick test message now?',
    default: true,
  })

  if (runTest) {
    const { runTest: testCmd } = await import('./test.js')
    console.log()
    await testCmd({ model: 'claude-fable-5[1m]' })
  } else {
    console.log()
    log.success('Setup complete')
    log.dim(`Next: ${chalk.white('opusmaxx test')} or ${chalk.white('opusmaxx models')}`)
  }
}
