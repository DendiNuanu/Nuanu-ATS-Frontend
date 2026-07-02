import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton client for Next.js.
 *
 * In development, Next.js hot-reloads modules which can create multiple
 * PrismaClient instances and exhaust DB connections. This pattern stores
 * the client on the global object so it is reused across reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
