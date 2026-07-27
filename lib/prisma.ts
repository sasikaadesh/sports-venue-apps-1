import "server-only";

import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Point Prisma at the Linux query engine on serverless (Vercel).
 *
 * The client is generated to a custom path, and Next bundles it into
 * `.next/server/chunks`, so every location Prisma searches for the engine is
 * wrong on a deployed function:
 *
 *   1. the generated client's own dirname — resolves to the bundled chunk
 *   2. `node_modules/@prisma/client/..`  — the engine is not there
 *   3. the generator's `output` value    — an absolute path baked in at BUILD
 *      time (`/vercel/path0/...`), which does not exist at RUNTIME (`/var/task`)
 *   4. `.prisma/client`, `/tmp/prisma-engines`, cwd
 *
 * `outputFileTracingIncludes` (next.config.ts) copies the engine into the
 * function at `<cwd>/lib/generated/prisma`, but that is on none of those paths,
 * which is why the include alone still 500s. `PRISMA_QUERY_ENGINE_LIBRARY` is
 * read *before* the search runs, so pinning it is the only deterministic fix.
 *
 * Linux-only and existence-checked: local Windows/macOS dev never enters this
 * branch and keeps using the `native` engine as before.
 */
if (process.platform === "linux" && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const engineDir = path.join(process.cwd(), "lib/generated/prisma");
  const engine = fs.existsSync(engineDir)
    ? fs
        .readdirSync(engineDir)
        .find((f) => f.startsWith("libquery_engine-") && f.endsWith(".so.node"))
    : undefined;

  if (engine) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(engineDir, engine);
  }
}

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
