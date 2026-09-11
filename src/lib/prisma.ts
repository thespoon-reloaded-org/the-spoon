import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma";

import { env } from "./env";

function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
}

// Next.js recharge les modules à chaud en dev : on réutilise la même instance
// pour ne pas ouvrir un nouveau pool de connexions à chaque rechargement.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
