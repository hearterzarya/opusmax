export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prewarmUpstreamConnection } = await import('@/lib/upstream-fetch')
    prewarmUpstreamConnection()
  }
}
