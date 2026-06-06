import { PrismaClient } from '@prisma/client'
import { shouldUseNeonServerlessDriver } from '@/lib/runtime-config'

type BigIntWithToJSON = bigint & { toJSON?: () => string }
if (typeof (BigInt.prototype as BigIntWithToJSON).toJSON !== 'function') {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function toJSON(this: bigint) {
      return this.toString()
    },
    writable: true,
    configurable: true,
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildPrismaClient(): PrismaClient {
  const log =
    process.env.NODE_ENV === 'development' ? (['warn', 'error'] as const) : (['error'] as const)

  if (shouldUseNeonServerlessDriver()) {
    const { PrismaNeon } = require('@prisma/adapter-neon') as typeof import('@prisma/adapter-neon')
    const { neonConfig } = require('@neondatabase/serverless') as typeof import('@neondatabase/serverless')

    // Node dev/local: WebSocket driver. Cloudflare Workers use HTTP fetch (no ws).
    if (typeof process !== 'undefined' && process.release?.name === 'node') {
      try {
        const ws = require('ws') as typeof import('ws')
        neonConfig.webSocketConstructor = ws as unknown as typeof neonConfig.webSocketConstructor
      } catch {
        /* ws optional */
      }
    }

    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for Neon serverless Prisma driver')
    }

    const adapter = new PrismaNeon({ connectionString })
    return new PrismaClient({ adapter, log: [...log] })
  }

  return new PrismaClient({ log: [...log] })
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = buildPrismaClient()
  }
  return globalForPrisma.prisma
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = getPrismaClient()
}
