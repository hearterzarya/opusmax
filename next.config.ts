import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  typescript: {
    // Type checking is done separately (pnpm typecheck). Skip during next build
    // to avoid Prisma client generation inconsistencies across platforms.
    ignoreBuildErrors: true,
  },
  serverExternalPackages: [
    'undici',
    '@neondatabase/serverless',
    '@prisma/adapter-neon',
    '@upstash/redis',
    'uncrypto',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-api-key' },
        ],
      },
    ]
  },
}

export default nextConfig