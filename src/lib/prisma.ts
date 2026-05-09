import { PrismaClient } from '@prisma/client'

// JSON.stringify throws on BigInt by default. Prisma BigInt fields would crash
// any NextResponse.json that includes them. Patch once at module load —
// safe and idempotent.
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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
