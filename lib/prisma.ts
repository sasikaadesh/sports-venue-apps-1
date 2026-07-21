import "server-only";

import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Prisma singleton. Next.js dev-mode hot reloading re-evaluates modules, so
 * without the global cache every edit would open a new connection pool and
 * eventually exhaust Supabase's pooler.
 *
 * NOTE: Prisma connects as the Postgres `postgres` role, which **bypasses
 * RLS**. Every Prisma query is therefore effectively unrestricted — RLS is the
 * *second* layer of defence, protecting the anon-key path. Anything read or
 * written through Prisma must be authorized in application code first (see
 * `requireUser` / `requireAdmin` in `lib/auth.ts`).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
