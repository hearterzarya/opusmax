import ora from 'ora'
import { checkApiKey, ApiError } from '../utils/api.js'
import { configFilePath, loadConfig, maskApiKey } from '../utils/config.js'
import { KEY_STATUS_HINT } from '../utils/constants.js'
import { log, printBanner } from '../utils/logger.js'

export async function runStatus(options: { verify?: boolean }) {
  printBanner()
  const config = loadConfig()

  log.title('OpusMax Status')
  console.log()

  if (!config) {
    log.warn('No local config found')
    log.dim(`Expected: ${configFilePath()}`)
    log.dim('Run: opusmaxx setup')
    return
  }

  console.log(`Base URL:     ${config.baseUrl}`)
  console.log(`API Key:      ${config.apiKey ? maskApiKey(config.apiKey) : '(not saved)'}`)
  console.log(`Config File:  ${configFilePath()}`)
  console.log(`Created:      ${config.createdAt}`)
  console.log(`Last Updated: ${config.updatedAt}`)
  console.log(`Key status:   ${KEY_STATUS_HINT}`)

  if (options.verify && config.apiKey) {
    console.log()
    const spinner = ora('Verifying key with gateway…').start()
    try {
      const result = await checkApiKey(config.baseUrl, config.apiKey)
      spinner.succeed(`Key valid (${result.status ?? 'ACTIVE'})`)
      if (result.name) log.dim(`Name: ${result.name}`)
    } catch (err) {
      spinner.fail('Verification failed')
      log.error(err instanceof ApiError ? err.message : 'Unknown error')
      process.exitCode = 1
    }
  }
}
