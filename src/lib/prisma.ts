import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';

// Configure Neon for serverless environments
// This enables WebSocket connections which are more efficient for serverless
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineTLS = true;
neonConfig.pipelineConnect = 'password';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Create Prisma client optimized for Neon serverless PostgreSQL
 * - Uses connection pooling via Neon's serverless driver
 * - Singleton pattern prevents connection exhaustion in development
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

/**
 * Create a Neon connection pool for raw SQL queries
 * Use this when you need to bypass Prisma for performance-critical operations
 */
export function createNeonPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  return new Pool({ connectionString: process.env.DATABASE_URL });
}




