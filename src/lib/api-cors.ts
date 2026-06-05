import { NextResponse } from 'next/server'

export const API_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-api-key, anthropic-version',
}

export function apiOptionsResponse(allowedMethods = 'GET, POST, OPTIONS'): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...API_CORS_HEADERS,
      'Access-Control-Allow-Methods': allowedMethods,
    },
  })
}
