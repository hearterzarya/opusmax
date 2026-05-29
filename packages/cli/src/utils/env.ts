import { detectOs } from './detect.js'

export function shellExportLines(baseUrl: string, apiKey: string): string[] {
  const os = detectOs()
  if (os === 'windows') {
    return [
      `$env:ANTHROPIC_BASE_URL="${baseUrl}"`,
      `$env:ANTHROPIC_API_KEY="${apiKey}"`,
    ]
  }
  return [
    `export ANTHROPIC_BASE_URL=${baseUrl}`,
    `export ANTHROPIC_API_KEY=${apiKey}`,
  ]
}

export function dotenvLines(baseUrl: string, apiKey: string): string[] {
  return [
    `ANTHROPIC_BASE_URL=${baseUrl}`,
    `ANTHROPIC_API_KEY=${apiKey}`,
  ]
}

export function cursorEnvLines(baseUrl: string, apiKey: string): string[] {
  const v1 = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl.replace(/\/+$/, '')}/v1`
  return [
    `"ANTHROPIC_BASE_URL": "${v1}"`,
    `"ANTHROPIC_API_KEY": "${apiKey}"`,
  ]
}
