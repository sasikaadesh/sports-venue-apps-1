/**
 * Demo data seed — court types, courts and their hourly schedules.
 *
 *   npm run db:seed        (or: npx prisma db seed)
 *
 * Idempotent by design, so it is safe to re-run against a database that is
 * already populated:
 *
 *  - **Court types** are upserted on their unique `name`.
 *  - **Courts** are matched by name (`Court.name` is not unique in the schema,
 *    so this is a find-then-create/update rather than an `upsert`). An existing
 *    court keeps its id — anything already booked against it stays valid.
 *  - **Slot templates** are generated per weekday only when that weekday has no
 *    templates at all, mirroring `generateDaySchedule` in the admin panel: a day
 *    is always either empty or a clean hourly grid (docs/ARCHITECTURE.md). A day
 *    that already has hours is left alone, so re-running never duplicates slots
 *    and never touches a rate an admin has since adjusted.
 *
 * Hours are fixed 1-hour blocks: an operating range of 06:00–21:00 expands to
 * fifteen individual templates at the given rate.
 *
 * Times are written through `timeStringToDate` (lib/time.ts) so they land in the
 * TIME column as UTC wall-clock values — the same path the admin panel uses.
 */
import { config } from "dotenv";
import { PrismaClient } from "../lib/generated/prisma/client";
import { DAY_NAMES, timeStringToDate } from "../lib/time";

config({ path: ".env.local" });

const prisma = new PrismaClient();

const MON_TO_FRI = [1, 2, 3, 4, 5];
const MON_TO_SAT = [1, 2, 3, 4, 5, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

type CourtSeed = {
  name: string;
  type: { name: string; playerOptions: number[] };
  description: string;
  images: string[];
  /** Operating range, whole hours, expanded into 1-hour templates. */
  schedule: { days: number[]; startTime: string; endTime: string; price: number };
};

/**
 * Unsplash placeholders (docs/DESIGN.md); the host is whitelisted in
 * next.config.ts and everything renders through next/image. Swap these for real
 * court photography — uploaded to Supabase Storage — before going live.
 */
const COURTS: CourtSeed[] = [
  {
    name: "Cricket Nets",
    type: { name: "Cricket", playerOptions: [2, 4, 6] },
    description:
      "Three turf practice nets with a bowling machine and floodlights. Book a lane for batting or bowling practice.",
    images: [
      "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1600&q=80",
    ],
    schedule: {
      days: MON_TO_SAT,
      startTime: "06:00",
      endTime: "21:00",
      price: 1500,
    },
  },
  {
    name: "Basketball",
    type: { name: "Basketball", playerOptions: [2, 4, 6, 8, 10] },
    description:
      "Full-size indoor court with sprung flooring, adjustable hoops and match-grade lighting. Suits half-court practice or a full five-a-side.",
    images: [
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1519766304817-4f37bda74a26?auto=format&fit=crop&w=1600&q=80",
    ],
    schedule: {
      days: EVERY_DAY,
      startTime: "08:00",
      endTime: "22:00",
      price: 2000,
    },
  },
  {
    name: "Table Tennis",
    type: { name: "Table Tennis", playerOptions: [2, 4] },
    description:
      "Air-conditioned hall with competition tables. Bats and balls available at the desk — singles or doubles.",
    images: [
      "https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=1600&q=80",
    ],
    schedule: {
      days: EVERY_DAY,
      startTime: "09:00",
      endTime: "21:00",
      price: 800,
    },
  },
  {
    name: "Badminton Court 1",
    type: { name: "Badminton", playerOptions: [2, 4] },
    description:
      "Indoor wooden court with tournament netting and shuttle-friendly lighting, screened from any draught.",
    images: [
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=1600&q=80",
    ],
    schedule: {
      days: MON_TO_FRI,
      startTime: "07:00",
      endTime: "22:00",
      price: 1200,
    },
  },
];

/** "06:00"–"21:00" -> the individual 1-hour rows for one weekday. */
function hoursFor(
  courtId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  price: number
) {
  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));

  const rows = [];
  for (let hour = startHour; hour < endHour; hour++) {
    rows.push({
      courtId,
      dayOfWeek,
      startTime: timeStringToDate(`${String(hour).padStart(2, "0")}:00`),
      endTime: timeStringToDate(`${String(hour + 1).padStart(2, "0")}:00`),
      price,
      isActive: true,
    });
  }
  return rows;
}

for (const seed of COURTS) {
  const courtType = await prisma.courtType.upsert({
    where: { name: seed.type.name },
    create: seed.type,
    update: { playerOptions: seed.type.playerOptions },
  });

  // `Court.name` is not unique, so this is a find-then-write. Matching by name
  // is what keeps a second run from creating a duplicate court.
  const existing = await prisma.court.findFirst({
    where: { name: seed.name },
    select: { id: true },
  });

  const court = existing
    ? await prisma.court.update({
        where: { id: existing.id },
        data: {
          courtTypeId: courtType.id,
          description: seed.description,
          images: seed.images,
          isActive: true,
        },
      })
    : await prisma.court.create({
        data: {
          name: seed.name,
          courtTypeId: courtType.id,
          description: seed.description,
          images: seed.images,
          isActive: true,
        },
      });

  console.log(
    `${existing ? "updated" : "created"} ${court.name} (${seed.type.name}, players ${seed.type.playerOptions.join("/")})`
  );

  const { days, startTime, endTime, price } = seed.schedule;
  let generated = 0;
  const skipped: string[] = [];

  for (const dayOfWeek of days) {
    const already = await prisma.slotTemplate.count({
      where: { courtId: court.id, dayOfWeek },
    });
    if (already > 0) {
      skipped.push(DAY_NAMES[dayOfWeek]);
      continue;
    }

    const rows = hoursFor(court.id, dayOfWeek, startTime, endTime, price);
    await prisma.slotTemplate.createMany({ data: rows });
    generated += rows.length;
  }

  console.log(
    `  ${startTime}–${endTime} @ LKR ${price.toLocaleString("en-LK")}/hour — ` +
      `${generated} hourly slot(s) across ${days.length - skipped.length} day(s)` +
      (skipped.length ? `; kept existing: ${skipped.join(", ")}` : "")
  );
}

console.log("\nSeed complete.");
await prisma.$disconnect();
