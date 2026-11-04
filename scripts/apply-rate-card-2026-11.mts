/**
 * The November 2026 rate card — sets every hourly SlotTemplate of each court
 * to an absolute LKR rate.
 *
 *   npx tsx --env-file=.env.local scripts/apply-rate-card-2026-11.mts           # dry run
 *   npx tsx --env-file=.env.local scripts/apply-rate-card-2026-11.mts --apply   # write
 *
 * - Courts are matched by their EXACT current name. A name that matches no
 *   court, or more than one, aborts the whole run before anything is written.
 * - Every rate is an absolute SET, so re-running is harmless.
 * - Only SlotTemplate.price changes. Existing bookings keep the price frozen on
 *   BookingSlot.price / Booking.totalPrice (what PayHere is charged).
 * - The public catalogue is cached (lib/catalogue.ts); a script cannot call
 *   revalidateCatalogue(), so the new rates show within the 5-minute TTL.
 */
import { PrismaClient } from "../lib/generated/prisma/client";

const RATE_CARD: Record<string, number> = {
  "Cricket Nets - Double": 2800,
  Basketball: 2200,
  Badminton: 1700,
  "Tennis - Main": 1700,
  "Tennis - Mini": 1200,
  "Cricket Net - Astro": 1700,
  "Cricket Net - Concrete": 1400,
  "Table Tennis - Arena 1": 1200,
  "Table Tennis - Arena 2": 1200,
  "Swimming Pool": 1200,
  "Fitness Center": 700,
};

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/[/?].*$/, "");
  const ref = (process.env.DATABASE_URL ?? "").match(/postgres\.([a-z0-9]+):/)?.[1];
  console.log(`Database: ${ref ?? "?"} @ ${host}`);
  console.log(apply ? "Mode: APPLY\n" : "Mode: dry run (pass --apply to write)\n");

  const names = Object.keys(RATE_CARD);
  const courts = await prisma.court.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  });

  const problems: string[] = [];
  for (const name of names) {
    const n = courts.filter((c) => c.name === name).length;
    if (n !== 1) problems.push(`"${name}" matches ${n} courts`);
  }
  if (problems.length) {
    throw new Error(`Aborting, nothing written:\n  ${problems.join("\n  ")}`);
  }

  await prisma.$transaction(async (tx) => {
    for (const court of courts) {
      const rate = RATE_CARD[court.name];
      const before = await tx.slotTemplate.findMany({
        where: { courtId: court.id },
        select: { price: true },
      });
      const old = [...new Set(before.map((s) => s.price.toString()))].join(", ");
      let changed = 0;
      if (apply) {
        ({ count: changed } = await tx.slotTemplate.updateMany({
          where: { courtId: court.id },
          data: { price: rate },
        }));
      }
      console.log(
        `${court.name.padEnd(24)} ${String(before.length).padStart(3)} slots  ${old.padEnd(10)} -> ${rate}` +
          (apply ? `  (${changed} updated)` : ""),
      );
    }
    // ~22 sequential round-trips; Prisma's 5 s default is too tight for that.
  }, { timeout: 60_000, maxWait: 10_000 });
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
