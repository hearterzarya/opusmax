import { NextRequest, NextResponse } from 'next/server'
import { loginAdmin } from '@/lib/auth'
import { createErrorResponse, ErrorCodes } from '@/lib/apikey'
import { ensureSameOrigin } from '@/lib/csrf'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const originError = ensureSameOrigin(request)
    if (originError) return originError

    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const result = await loginAdmin(email, password)

    if (!result.success) {
      return createErrorResponse(
        ErrorCodes.AUTHENTICATION_ERROR,
        result.error || 'Invalid credentials',
        401
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((i) => i.message).join(', ')
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Invalid request body: ${message}`,
        400
      )
    }

    console.error('Login error:', error)
    return createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500
    )
  }
}