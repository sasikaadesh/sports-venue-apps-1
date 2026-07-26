/**
 * DATA FIX: replace every SlotTemplate longer than 1 hour with individual
 * 1-hour slots at the same rate (docs/ARCHITECTURE.md: slots are fixed 1-hour
 * blocks). Mirrors the admin panel's generateDaySchedule expansion.
 *
 *   npx tsx scripts/fix-slot-durations.mts          # dry run (default)
 *   npx tsx scripts/fix-slot-durations.mts --apply  # write changes
 *
 * Safety:
 *  - Refuses any legacy template that already has BookingSlot children (would
 *    mean a real reservation is tied to it — needs manual handling, not here).
 *  - Refuses to create an hour that overlaps an existing template on the same
 *    court + weekday, so no double-listing.
 *  - Each template is fixed in its own transaction: create the hours, delete
 *    the block — all or nothing.
 */
import { config } from "dotenv";
import { PrismaClient } from "../lib/generated/prisma/client";

config({ path: ".env.local" });

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const mins = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
const hhmm = (d: Date) =>
  `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
/** "HH:00" -> the UTC Date shape Prisma writes to a TIME column. */
const timeAt = (hour: number) => new Date(Date.UTC(1970, 0, 1, hour, 0, 0, 0));

const bad = (
  await prisma.slotTemplate.findMany({
    orderBy: [{ courtId: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
    select: {
      id: true, courtId: true, dayOfWeek: true, startTime: true, endTime: true,
      price: true, isActive: true,
      court: { select: { name: true } },
      _count: { select: { bookingSlots: true } },
    },
  })
).filter((t) => mins(t.endTime) - mins(t.startTime) !== 60);

if (bad.length === 0) {
  console.log("Nothing to fix — every SlotTemplate is already 1 hour.");
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${bad.length} legacy template(s):\n`);

let fixed = 0;
for (const t of bad) {
  const label = `[${t.court.name}] ${DAY[t.dayOfWeek]} ${hhmm(t.startTime)}–${hhmm(t.endTime)}`;

  if (t._count.bookingSlots > 0) {
    console.log(`  SKIP  ${label} — has ${t._count.bookingSlots} booking slot(s); fix manually.`);
    continue;
  }

  const startHour = t.startTime.getUTCHours();
  const endHour = t.endTime.getUTCHours();
  if (t.startTime.getUTCMinutes() !== 0 || t.endTime.getUTCMinutes() !== 0) {
    console.log(`  SKIP  ${label} — not on whole-hour boundaries; fix manually.`);
    continue;
  }

  // Any other template on this court+weekday would overlap the hours we create.
  const others = await prisma.slotTemplate.findMany({
    where: { courtId: t.courtId, dayOfWeek: t.dayOfWeek, id: { not: t.id } },
    select: { startTime: true, endTime: true },
  });
  const overlap = others.some(
    (o) => mins(o.startTime) < endHour * 60 && startHour * 60 < mins(o.endTime)
  );
  if (overlap) {
    console.log(`  SKIP  ${label} — overlaps existing 1-hour slots; fix manually.`);
    continue;
  }

  const hours = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push({
      courtId: t.courtId,
      dayOfWeek: t.dayOfWeek,
      startTime: timeAt(h),
      endTime: timeAt(h + 1),
      price: t.price,
      isActive: t.isActive,
    });
  }

  console.log(`  ${APPLY ? "FIX " : "WOULD"} ${label} -> ${hours.length} × 1-hour slots @ ${t.price}`);

  if (APPLY) {
    await prisma.$transaction([
      prisma.slotTemplate.createMany({ data: hours }),
      prisma.slotTemplate.delete({ where: { id: t.id } }),
    ]);
  }
  fixed++;
}

console.log(`\n${APPLY ? "Done" : "Dry run complete"} — ${fixed} template(s) ${APPLY ? "fixed" : "would be fixed"}.`);
if (!APPLY) console.log("Re-run with --apply to write changes.");

await prisma.$disconnect();
