// A single shared PrismaClient for the whole process.
//
// Each route module used to instantiate its own `new PrismaClient()`, which
// opens a separate connection pool per module. In development (with tsx watch)
// hot-reloads compound the problem and quickly exhaust Postgres connections.
// Exporting one instance keeps a single pool and makes graceful shutdown easy.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
