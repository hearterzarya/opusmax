/**
 * Bifrost Gateway API client
 * Handles forwarding requests to the Bifrost Gateway service
 */

import { upstreamFetch } from './upstream-fetch'

export interface BifrostConfig {
  bifrostBaseUrl: string
  bifrostApiKey: string
  timeout?: number
}

/**
 * Check if Bifrost Gateway is available
 */
export async function checkBifrostConnection(): Promise<{ available: boolean; error?: string }> {
  try {
    const response = await upstreamFetch(`${process.env.BIFROST_BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      return { available: true }
    }

    return {
      available: false,
      error: `Bifrost health check failed: ${response.status}`
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Forward Anthropic messages request to Bifrost Gateway
 */
export async function forwardAnthropicMessages(
  request: any,
  config: BifrostConfig
): Promise<Response> {
  const { bifrostBaseUrl, bifrostApiKey, timeout = 30000 } = config

  // Construct the full Bifrost URL
  const bifrostUrl = `${bifrostBaseUrl}/anthropic/v1/messages`

  // Create headers for Bifrost request
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': bifrostApiKey,
    'anthropic-version': '2023-06-01',
  }

  console.log('[Bifrost] Forwarding request to:', bifrostUrl)

  return await upstreamFetch(bifrostUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeout),
  })
}

/**
 * Pre-warm Bifrost connection on server startup
 * This should be called from a server initialization script
 */
export function prewarmBifrostConnection(): void {
  // Perform a health check to prewarm the connection
  void checkBifrostConnection().catch(() => {
    /* non-fatal — first request will connect if prewarm fails */
  })
}