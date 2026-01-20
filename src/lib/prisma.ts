/**
 * Flux (Kora Rent Guardian) - Prisma Client Singleton
 * 
 * This module provides a singleton instance of the Prisma client
 * to prevent connection exhaustion during development (hot reloading).
 * 
 * In production, a single instance is created.
 * In development, the instance is cached on globalThis to survive HMR.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

/**
 * The Prisma client instance for database operations.
 * Uses a singleton pattern to prevent connection pool exhaustion.
 */
export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export default prisma;
