import ora from 'ora'
import chalk from 'chalk'
import { testMessage, ApiError } from '../utils/api.js'
import { loadConfig } from '../utils/config.js'
import { log, printBanner } from '../utils/logger.js'

const DEFAULT_TEST_MODEL = 'claude-sonnet-4-6'

export async function runTest(options: { model?: string }) {
  printBanner()
  const config = loadConfig()
  if (!config?.apiKey) {
    log.error('No API key in config. Run opusmaxx setup first.')
    process.exitCode = 1
    return
  }

  const model = options.model ?? DEFAULT_TEST_MODEL
  const spinner = ora(`Sending test message (${model})…`).start()

  try {
    const text = await testMessage(config.baseUrl, config.apiKey, model)
    spinner.succeed('Gateway responded')
    console.log()
    log.title('Model reply')
    console.log(chalk.white(text))
  } catch (err) {
    spinner.fail('Test failed')
    if (err instanceof ApiError) {
      log.error(err.message)
      if (err.status) log.dim(`HTTP ${err.status}`)
    } else {
      log.error(err instanceof Error ? err.message : 'Unknown error')
    }
    process.exitCode = 1
  }
}
