import { NextResponse } from 'next/server'
import { API_CORS_HEADERS, apiOptionsResponse } from '@/lib/api-cors'
import { GATEWAY_API_INFO } from '@/lib/gateway-info'

const V1_INFO = {
  ...GATEWAY_API_INFO,
  hint: 'LobeHub: Base URL https://your-domain/api/v1 · API key sk-ant-ox-… · uses POST /chat/completions',
} as const

/** Discovery for clients that probe a base URL ending in /api/v1 (e.g. LobeHub). */
export async function GET() {
  return NextResponse.json(V1_INFO, { headers: API_CORS_HEADERS })
}

export async function OPTIONS() {
  return apiOptionsResponse()
}
