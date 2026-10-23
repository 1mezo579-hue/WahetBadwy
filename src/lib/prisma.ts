import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Strict safety guard: In Vercel Preview deployments, isolate completely from Production database
const isVercelPreview = process.env.VERCEL_ENV === "preview";
const isolatedDummyUrl = "postgresql://preview_guard:dummy_pass@127.0.0.1:5432/preview_db?schema=public";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
    ...(isVercelPreview
      ? {
          datasources: {
            db: {
              url: isolatedDummyUrl,
            },
          },
        }
      : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
