import { NextResponse } from 'next/server'
import { logoutAdmin } from '@/lib/auth'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'

export async function POST() {
  try {
    await logoutAdmin()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to logout',
      500
    )
  }
}
