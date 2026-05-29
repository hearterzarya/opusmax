import fs from 'node:fs'
import path from 'node:path'

export type JsonPatchResult =
  | { ok: true; path: string; backupPath?: string; created: boolean }
  | { ok: false; path: string; error: string; manual?: string }

export function mergeJsonConfigFile(
  filePath: string,
  merge: (current: Record<string, unknown>) => Record<string, unknown>
): JsonPatchResult {
  if (!filePath) {
    return { ok: false, path: filePath, error: 'Config path not available on this OS.' }
  }

  const dir = path.dirname(filePath)
  let created = false

  if (!fs.existsSync(filePath)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      const initial = merge({})
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2) + '\n', 'utf8')
      created = true
      return { ok: true, path: filePath, created }
    } catch (err) {
      return {
        ok: false,
        path: filePath,
        error: err instanceof Error ? err.message : 'Failed to create config',
        manual: JSON.stringify(merge({}), null, 2),
      }
    }
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const backupPath = `${filePath}.opusmax-backup-${Date.now()}`
    fs.copyFileSync(filePath, backupPath)
    const next = merge(parsed)
    fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + '\n', 'utf8')
    return { ok: true, path: filePath, backupPath, created: false }
  } catch (err) {
    return {
      ok: false,
      path: filePath,
      error: err instanceof Error ? err.message : 'Failed to update config',
    }
  }
}
