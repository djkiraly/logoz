import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Prisma client with singleton pattern to prevent connection exhaustion in development.
 * Connects to Neon PostgreSQL via the pooled DATABASE_URL.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const isDatabaseEnabled = Boolean(process.env.DATABASE_URL);
