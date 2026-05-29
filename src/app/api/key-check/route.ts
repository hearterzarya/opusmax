import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkOpusMaxApiKey } from '@/lib/key-check'
import { checkRateLimit } from '@/lib/redis'

const bodySchema = z.object({
  key: z.string().min(1),
})

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

function messageForReason(reason: string): string {
  switch (reason) {
    case 'invalid_format':
      return 'API key format is invalid. Keys must start with sk-ant-ox- or sk-ox-.'
    case 'not_found':
      return 'API key was not found on this gateway.'
    case 'inactive':
      return 'API key is not active.'
    case 'expired':
      return 'API key has expired.'
    case 'quota_exceeded':
      return 'API key has exceeded its rolling token window.'
    default:
      return 'API key validation failed.'
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rl = await checkRateLimit(`keycheck_ip:${ip}`, 60, 60)
    if (!rl.allowed) {
      const retryIn = Math.max(0, Math.ceil((rl.resetAt - Date.now()) / 1000))
      return NextResponse.json(
        { valid: false, error: { message: `Too many requests. Try again in ${retryIn}s` } },
        { status: 429 }
      )
    }

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json(
        { valid: false, error: { message: 'Request body must be valid JSON' } },
        { status: 400 }
      )
    }

    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: { message: 'Field "key" is required' } },
        { status: 400 }
      )
    }

    const result = await checkOpusMaxApiKey(parsed.data.key)
    if (!result.ok) {
      const status =
        result.reason === 'not_found' ? 404 : result.reason === 'invalid_format' ? 400 : 403
      return NextResponse.json(
        {
          valid: false,
          reason: result.reason,
          error: { message: messageForReason(result.reason) },
        },
        { status }
      )
    }

    return NextResponse.json({
      valid: true,
      status: result.status,
      name: result.name,
      active: result.active,
      quotaBlocked: result.quotaBlocked,
      expiresAt: result.expiresAt,
    })
  } catch (error) {
    console.error('[key-check] error', error)
    return NextResponse.json(
      { valid: false, error: { message: 'Internal error' } },
      { status: 500 }
    )
  }
}
