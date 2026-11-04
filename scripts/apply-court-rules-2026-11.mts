/**
 * The November 2026 court rules — replaces Court.rules (one rule per line) for
 * every court on the list below.
 *
 *   npx tsx --env-file=.env.local scripts/apply-court-rules-2026-11.mts           # dry run
 *   npx tsx --env-file=.env.local scripts/apply-court-rules-2026-11.mts --apply   # write
 *
 * - Courts are matched by their EXACT current name. A name that matches no
 *   court, or more than one, aborts the whole run before anything is written.
 * - Absolute SET, so re-running is harmless. Only Court.rules changes.
 * - Court pages are cached (lib/catalogue.ts); a script cannot call
 *   revalidateCatalogue(), so the new rules show within the 5-minute TTL.
 *
 * The same sets live in prisma/seed.mts so a re-seed keeps them.
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import { COURT_RULES_2026_11 } from "../prisma/court-rules-2026-11";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^.*@/, "").replace(/[/?].*$/, "");
  const ref = url.match(/postgres\.([a-z0-9]+):/)?.[1];
  console.log(`Database: ${ref ?? "?"} @ ${host}`);
  console.log(apply ? "Mode: APPLY\n" : "Mode: dry run (pass --apply to write)\n");

  const names = Object.keys(COURT_RULES_2026_11);
  const courts = await prisma.court.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true, rules: true },
  });

  const problems = names
    .map((name) => [name, courts.filter((c) => c.name === name).length] as const)
    .filter(([, n]) => n !== 1)
    .map(([name, n]) => `"${name}" matches ${n} courts`);
  if (problems.length) {
    throw new Error(`Aborting, nothing written:\n  ${problems.join("\n  ")}`);
  }

  await prisma.$transaction(
    async (tx) => {
      for (const court of courts) {
        const rules = COURT_RULES_2026_11[court.name].join("\n");
        const before = court.rules?.trim()
          ? `${court.rules.split(/\r?\n/).filter((l) => l.trim()).length} custom`
          : "type default";
        if (apply) {
          await tx.court.update({ where: { id: court.id }, data: { rules } });
        }
        const after = COURT_RULES_2026_11[court.name].length;
        console.log(
          `${court.name.padEnd(24)} ${before.padEnd(13)} -> ${after} rules` +
            (apply ? "  (updated)" : ""),
        );
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
