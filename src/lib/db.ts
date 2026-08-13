import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Query logging is OFF in production. We only surface actual failures,
// never request tracing, so production logs stay clean and we don't leak
// row counts or query shapes into log aggregators.
const logLevels =
  process.env.NODE_ENV === 'development'
    ? (['warn', 'error'] as Array<'warn' | 'error'>)
    : (['error'] as Array<'error'>)

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: logLevels })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
