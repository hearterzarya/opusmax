import { hashApiKey, isValidKeyFormat } from '@/lib/apikey'
import { prisma } from '@/lib/prisma'
import { getRollingWindowUsageFromUsageLogs } from '@/lib/quota'

export type KeyCheckResult =
  | {
      ok: true
      exists: true
      status: string
      name: string
      active: boolean
      expired: boolean
      quotaBlocked: boolean
      expiresAt: string | null
    }
  | { ok: false; reason: 'invalid_format' | 'not_found' | 'inactive' | 'expired' | 'quota_exceeded' }

export async function checkOpusMaxApiKey(rawKey: string): Promise<KeyCheckResult> {
  const key = rawKey.trim()
  if (!isValidKeyFormat(key) && !key.startsWith('sk-ox-')) {
    return { ok: false, reason: 'invalid_format' }
  }

  const keyHash = await hashApiKey(key)
  const record = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      status: true,
      name: true,
      expiresAt: true,
      hourlyTokenBudget: true,
    },
  })

  if (!record) {
    return { ok: false, reason: 'not_found' }
  }

  const now = Date.now()
  const expired = record.expiresAt != null && record.expiresAt.getTime() <= now
  if (expired) {
    return { ok: false, reason: 'expired' }
  }

  if (record.status !== 'ACTIVE') {
    return { ok: false, reason: 'inactive' }
  }

  let quotaBlocked = false
  if (record.hourlyTokenBudget && record.hourlyTokenBudget > 0n) {
    const quota = await getRollingWindowUsageFromUsageLogs(record.id, record.hourlyTokenBudget)
    quotaBlocked = quota.blocked
  }

  if (quotaBlocked) {
    return { ok: false, reason: 'quota_exceeded' }
  }

  return {
    ok: true,
    exists: true,
    status: record.status,
    name: record.name,
    active: true,
    expired: false,
    quotaBlocked: false,
    expiresAt: record.expiresAt?.toISOString() ?? null,
  }
}
