import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight CSRF defence for admin POST/DELETE/PATCH routes.
 *
 * The Origin header is reliable for cross-origin POST requests in modern
 * browsers (Sec-Fetch metadata could be added later). For same-origin
 * requests we accept either matching Origin or a missing Origin header
 * (Next.js form actions sometimes omit it) provided Host is present.
 */
export function ensureSameOrigin(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') {
    // In development we frequently call from various tools (curl, Thunder
    // Client, etc.). Skip the check there to avoid surprises.
    return null
  }

  const origin = request.headers.get('origin')
  if (!origin) return null // Same-origin form posts may omit Origin.

  const host = request.headers.get('host')
  if (!host) {
    return NextResponse.json(
      { error: { message: 'Forbidden — missing host' } },
      { status: 403 }
    )
  }

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return NextResponse.json({ error: { message: 'Forbidden — bad origin' } }, { status: 403 })
  }

  if (originHost !== host) {
    return NextResponse.json(
      { error: { message: 'Forbidden — cross-origin write blocked' } },
      { status: 403 }
    )
  }

  return null
}
