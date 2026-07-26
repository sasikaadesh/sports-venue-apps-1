/**
 * ONE-OFF BULK SCHEDULE UPDATE — rebuild every court's weekly slot templates to
 * the venue's new operating hours:
 *
 *   Mon–Fri   15:00–21:00   (6 × 1-hour slots)
 *   Sat–Sun   07:00–21:00   (14 × 1-hour slots)
 *
 *   npx tsx scripts/reset-slot-schedule.mts          # dry run (default)
 *   npx tsx scripts/reset-slot-schedule.mts --apply  # write changes
 *
 * What it does, per court and per weekday (all 7 days are rebuilt):
 *
 *  - **The rate is carried over, never invented.** Each day is regenerated at
 *    that day's existing hourly rate (the most common price among its current
 *    templates); a day with no templates falls back to the court's overall most
 *    common rate. A court with no templates at all is skipped and reported —
 *    there is nothing to carry over and this script must not guess a price.
 *  - **Active/inactive is carried over per day.** A day whose hours were all
 *    switched off stays off; anything else comes back active. A day that had no
 *    templates at all is created active.
 *  - **Bookings are never touched.** A `SlotTemplate` referenced by a
 *    `BookingSlot` holds history and the FK is RESTRICT, so it is never
 *    deleted:
 *      · booked hour that matches a target hour  -> kept in place (its own rate
 *        and history survive) and no duplicate is created for that hour;
 *      · booked hour outside the new range       -> switched OFF, so it leaves
 *        public availability without destroying the reservation behind it.
 *    Unbooked templates are deleted outright, so there are no leftovers.
 *  - **No overlaps are created.** If a surviving booked hour overlaps a target
 *    hour without matching it exactly (a legacy non-hour-aligned row), the
 *    target hour is skipped and reported rather than double-listing the time.
 *
 * Each court is rewritten in a single transaction: delete the unbooked rows,
 * deactivate the out-of-range booked ones, create the new hours — all or
 * nothing.
 *
 * Times go through `timeStringToDate` (lib/time.ts), the same path the admin
 * panel and the seed use, so they land in the TIME column as UTC wall-clock.
 */
import { config } from "dotenv";
import { PrismaClient, Prisma } from "../lib/generated/prisma/client";
import { DAY_NAMES_SHORT, timeStringToDate, timeToMinutes } from "../lib/time";

config({ path: ".env.local" });

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** The new schedule. Hours are half-open: 15:00–21:00 is 15–16 … 20–21. */
const WEEKDAY_HOURS = { start: 15, end: 21 }; // Mon–Fri
const WEEKEND_HOURS = { start: 7, end: 21 }; // Sat, Sun
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** 0 = Sunday, 6 = Saturday. */
const rangeFor = (dayOfWeek: number) =>
  dayOfWeek === 0 || dayOfWeek === 6 ? WEEKEND_HOURS : WEEKDAY_HOURS;

const hhmm = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
const timeLabel = (d: Date) =>
  `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

/** The most common price in a set of templates — the day's/court's rate. */
function modePrice(
  rows: { price: Prisma.Decimal }[]
): Prisma.Decimal | null {
  if (rows.length === 0) return null;
  const counts = new Map<string, { price: Prisma.Decimal; n: number }>();
  for (const row of rows) {
    const key = row.price.toString();
    const hit = counts.get(key);
    if (hit) hit.n++;
    else counts.set(key, { price: row.price, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0].price;
}

// ---------------------------------------------------------------------------

const courts = await prisma.court.findMany({
  orderBy: { name: "asc" },
  select: {
    id: true,
    name: true,
    isActive: true,
    slots: {
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        price: true,
        isActive: true,
        _count: { select: { bookingSlots: true } },
      },
    },
  },
});

console.log(
  `${APPLY ? "APPLYING" : "DRY RUN"} — new schedule: ` +
    `Mon–Fri ${hhmm(WEEKDAY_HOURS.start)}–${hhmm(WEEKDAY_HOURS.end)}, ` +
    `Sat–Sun ${hhmm(WEEKEND_HOURS.start)}–${hhmm(WEEKEND_HOURS.end)}\n` +
    `${courts.length} court(s) found.\n`
);

let touched = 0;
const skippedCourts: string[] = [];
const warnings: string[] = [];

for (const court of courts) {
  console.log(`${court.name}${court.isActive ? "" : "  (court inactive)"}`);

  const courtRate = modePrice(court.slots);
  if (!courtRate) {
    console.log("  SKIP — no existing slot templates, so no rate to carry over.\n");
    skippedCourts.push(court.name);
    continue;
  }

  const deleteIds: string[] = [];
  const deactivateIds: string[] = [];
  const newRows: Prisma.SlotTemplateCreateManyInput[] = [];
  const dayLines: string[] = [];

  for (const dayOfWeek of ALL_DAYS) {
    const { start, end } = rangeFor(dayOfWeek);
    const existing = court.slots.filter((s) => s.dayOfWeek === dayOfWeek);

    // Carry over this day's rate and its open/closed state.
    const rate = modePrice(existing) ?? courtRate;
    const dayActive = existing.length === 0 || existing.some((s) => s.isActive);

    const booked = existing.filter((s) => s._count.bookingSlots > 0);
    const unbooked = existing.filter((s) => s._count.bookingSlots === 0);

    // Unbooked rows always go — this is what stops leftovers and duplicates.
    deleteIds.push(...unbooked.map((s) => s.id));

    let kept = 0;
    let switchedOff = 0;
    const clashes: string[] = [];

    for (let hour = start; hour < end; hour++) {
      const from = hour * 60;
      const to = (hour + 1) * 60;

      const exact = booked.find(
        (s) => timeToMinutes(s.startTime) === from && timeToMinutes(s.endTime) === to
      );
      if (exact) {
        // Booked and already the right hour: leave the row exactly as it is —
        // its rate is frozen onto the reservation and its active flag is a
        // deliberate admin decision. No duplicate is created for this hour.
        kept++;
        continue;
      }

      const overlapping = booked.find(
        (s) => timeToMinutes(s.startTime) < to && from < timeToMinutes(s.endTime)
      );
      if (overlapping) {
        clashes.push(
          `${hhmm(hour)}–${hhmm(hour + 1)} overlaps booked ` +
            `${timeLabel(overlapping.startTime)}–${timeLabel(overlapping.endTime)}`
        );
        continue;
      }

      newRows.push({
        courtId: court.id,
        dayOfWeek,
        startTime: timeStringToDate(hhmm(hour)),
        endTime: timeStringToDate(hhmm(hour + 1)),
        price: rate,
        isActive: dayActive,
      });
    }

    // Booked hours that the new range no longer covers: keep the row (history)
    // but take it out of circulation.
    for (const slot of booked) {
      const inRange =
        timeToMinutes(slot.startTime) >= start * 60 &&
        timeToMinutes(slot.endTime) <= end * 60;
      if (!inRange && slot.isActive) {
        deactivateIds.push(slot.id);
        switchedOff++;
      }
    }

    const created = newRows.filter((r) => r.dayOfWeek === dayOfWeek).length;
    dayLines.push(
      `  ${DAY_NAMES_SHORT[dayOfWeek]}  ${hhmm(start)}–${hhmm(end)}  ` +
        `@ LKR ${rate.toString()}/h  ` +
        `${created} new, ${unbooked.length} removed` +
        (kept ? `, ${kept} booked hour(s) kept` : "") +
        (switchedOff ? `, ${switchedOff} booked hour(s) switched off` : "") +
        (dayActive ? "" : "  [day closed — slots created inactive]")
    );

    for (const clash of clashes) {
      const line = `${court.name} ${DAY_NAMES_SHORT[dayOfWeek]}: skipped ${clash}`;
      warnings.push(line);
      dayLines.push(`        ! ${line}`);
    }
  }

  for (const line of dayLines) console.log(line);
  console.log(
    `  => ${newRows.length} slot(s) created, ${deleteIds.length} deleted, ` +
      `${deactivateIds.length} switched off\n`
  );

  if (APPLY) {
    await prisma.$transaction([
      prisma.slotTemplate.deleteMany({ where: { id: { in: deleteIds } } }),
      prisma.slotTemplate.updateMany({
        where: { id: { in: deactivateIds } },
        data: { isActive: false },
      }),
      prisma.slotTemplate.createMany({ data: newRows }),
    ]);
  }
  touched++;
}

console.log(
  `${APPLY ? "Done" : "Dry run complete"} — ${touched} court(s) ${
    APPLY ? "updated" : "would be updated"
  }` + (skippedCourts.length ? `; skipped: ${skippedCourts.join(", ")}` : "")
);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (!APPLY) console.log("\nRe-run with --apply to write changes.");

await prisma.$disconnect();
