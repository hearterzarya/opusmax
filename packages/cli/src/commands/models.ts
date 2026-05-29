import ora from 'ora'
import chalk from 'chalk'
import { fetchModels, ApiError } from '../utils/api.js'
import { loadConfig } from '../utils/config.js'
import { log, printBanner } from '../utils/logger.js'

export async function runModels() {
  printBanner()
  const config = loadConfig()
  const baseUrl = config?.baseUrl
  if (!baseUrl) {
    log.error('No config found. Run opusmaxx setup first.')
    process.exitCode = 1
    return
  }

  const spinner = ora('Fetching models…').start()
  try {
    const data = await fetchModels(baseUrl, config?.apiKey)
    spinner.stop()
    log.title('Available Models')
    console.log()
    for (const row of data.data) {
      const label = row.display_name ? chalk.gray(` (${row.display_name})`) : ''
      console.log(`  ${chalk.cyan(row.id)}${label}`)
    }
    console.log()
  } catch (err) {
    spinner.fail('Failed to load models')
    log.error(err instanceof ApiError ? err.message : 'Unknown error')
    process.exitCode = 1
  }
}
