import os from 'node:os'
import path from 'node:path'

export type OsFamily = 'windows' | 'macos' | 'linux' | 'unknown'

export function detectOs(): OsFamily {
  const p = process.platform
  if (p === 'win32') return 'windows'
  if (p === 'darwin') return 'macos'
  if (p === 'linux') return 'linux'
  return 'unknown'
}

export function homeDir(): string {
  return os.homedir()
}

export function claudeCodeSettingsPath(): string {
  return path.join(homeDir(), '.claude', 'settings.json')
}

export function claudeDesktopConfigPath(): string {
  const osType = detectOs()
  if (osType === 'windows') {
    const appData = process.env.APPDATA
    if (!appData) return ''
    return path.join(appData, 'Claude', 'claude_desktop_config.json')
  }
  if (osType === 'macos') {
    return path.join(homeDir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  }
  return path.join(homeDir(), '.config', 'Claude', 'claude_desktop_config.json')
}

export function vscodeUserSettingsPath(): string {
  const osType = detectOs()
  if (osType === 'windows') {
    const appData = process.env.APPDATA
    if (!appData) return ''
    return path.join(appData, 'Code', 'User', 'settings.json')
  }
  if (osType === 'macos') {
    return path.join(homeDir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json')
  }
  return path.join(homeDir(), '.config', 'Code', 'User', 'settings.json')
}
