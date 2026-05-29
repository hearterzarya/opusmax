import { confirm } from '@inquirer/prompts'
import { clearApiKey, configFilePath, loadConfig } from '../utils/config.js'
import { log, printBanner } from '../utils/logger.js'

export async function runLogout() {
  printBanner()
  const config = loadConfig()
  if (!config?.apiKey) {
    log.warn('No API key stored locally.')
    return
  }

  const ok = await confirm({
    message: 'Remove saved API key from local config?',
    default: false,
  })

  if (!ok) {
    log.dim('Cancelled.')
    return
  }

  clearApiKey()
  log.success(`API key removed from ${configFilePath()}`)
  log.dim('Base URL and other settings were kept.')
}
