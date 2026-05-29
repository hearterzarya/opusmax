import chalk from 'chalk'

export function printBanner() {
  console.log()
  console.log(chalk.cyan.bold(`◆ ${'OpusMax CLI'}`))
  console.log(chalk.gray('Premium API access for Claude-compatible tools'))
  console.log()
}

export const log = {
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  info: (msg: string) => console.log(chalk.gray('→'), msg),
  title: (msg: string) => console.log(chalk.white.bold(msg)),
  dim: (msg: string) => console.log(chalk.gray(msg)),
}
