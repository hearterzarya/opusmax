#!/usr/bin/env node
import { Command } from 'commander'
import { runSetup } from './commands/setup.js'
import { runStatus } from './commands/status.js'
import { runTest } from './commands/test.js'
import { runModels } from './commands/models.js'
import { runDoctor } from './commands/doctor.js'
import { runLogout } from './commands/logout.js'

const program = new Command()

program
  .name('opusmaxx')
  .description('Official OpusMax CLI — configure Claude-compatible API access')
  .version('1.0.0')

program
  .command('setup')
  .description('Interactive setup for OpusMax base URL and API key')
  .action(async () => {
    await runSetup()
  })

program
  .command('status')
  .description('Show local OpusMax configuration')
  .option('--verify', 'Verify API key with the gateway')
  .action(async (opts: { verify?: boolean }) => {
    await runStatus(opts)
  })

program
  .command('test')
  .description('Send a minimal test message through the gateway')
  .option('-m, --model <id>', 'Model id', 'claude-fable-5[1m]')
  .action(async (opts: { model?: string }) => {
    await runTest(opts)
  })

program
  .command('models')
  .description('List models exposed by the gateway')
  .action(async () => {
    await runModels()
  })

program
  .command('doctor')
  .description('Run connectivity and configuration diagnostics')
  .action(async () => {
    await runDoctor()
  })

program
  .command('logout')
  .description('Remove saved API key from local config')
  .action(async () => {
    await runLogout()
  })

program.action(async () => {
  await runSetup()
})

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
