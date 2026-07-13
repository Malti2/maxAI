// A single shared PrismaClient for the whole process.
//
// Each route module used to instantiate its own `new PrismaClient()`, which
// opens a separate connection pool per module. Exporting one instance keeps a
// single pool and makes graceful shutdown easy.
//
// The client is created lazily (on first use) behind a Proxy, so that simply
// importing this module — or anything that transitively imports it — does not
// require the Prisma client to be generated yet. That keeps pure logic and unit
// tests runnable without a database.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({ log: ['warn', 'error'] });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
