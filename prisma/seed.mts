/**
 * Demo data seed — court types, courts and their hourly schedules.
 *
 *   npm run db:seed        (or: npx prisma db seed)
 *
 * Idempotent by design, so it is safe to re-run against a database that is
 * already populated:
 *
 *  - **Court types** are upserted on their unique `name`.
 *  - **Courts** are matched by name, then by any former name in `aliases`
 *    (`Court.name` is not unique in the schema, so this is a
 *    find-then-create/update rather than an `upsert`). An existing court keeps
 *    its id and is renamed in place — anything booked against it stays valid.
 *  - **Slot templates** are generated per weekday only when that weekday has no
 *    templates at all, mirroring `generateDaySchedule` in the admin panel: a day
 *    is always either empty or a clean hourly grid (docs/ARCHITECTURE.md). A day
 *    that already has hours is left alone, so re-running never duplicates slots
 *    and never touches a rate an admin has since adjusted.
 *
 * Hours are fixed 1-hour blocks: every court's operating range is 18:00–21:00,
 * every day, which expands to three individual templates at the given rate.
 * The two shared facilities run the same window and are created with
 * `bookingMode: shared` and a capacity.
 *
 * Times are written through `timeStringToDate` (lib/time.ts) so they land in the
 * TIME column as UTC wall-clock values — the same path the admin panel uses.
 */
import { config } from "dotenv";
import { PrismaClient } from "../lib/generated/prisma/client";
import { DAY_NAMES, timeStringToDate } from "../lib/time";

config({ path: ".env.local" });

const prisma = new PrismaClient();

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Every court opens 18:00–21:00, every day: three 1-hour slots. */
const EVENING = { days: EVERY_DAY, startTime: "18:00", endTime: "21:00" };

type CourtSeed = {
  name: string;
  /** Former names. A court found under one is renamed in place, not duplicated. */
  aliases?: string[];
  type: { name: string; playerOptions: number[] };
  description: string;
  images: string[];
  /** Operating range, whole hours, expanded into 1-hour templates. */
  schedule: {
    days: number[];
    startTime: string;
    endTime: string;
    price: number;
  };
  /**
   * Shared facilities only (gym, pool): many members book the same hour, up to
   * `capacity` people (null = unlimited). Omitted = an exclusive court.
   */
  shared?: { capacity: number | null };
};

/**
 * Unsplash placeholders (docs/DESIGN.md); the host is whitelisted in
 * next.config.ts and everything renders through next/image. Swap these for real
 * court photography — uploaded to Supabase Storage — before going live.
 */
const COURTS: CourtSeed[] = [
  // Three separate nets. They replaced a single "Cricket Nets" court, which
  // migration 20261001120000_cricket_nets_and_rate_rise deactivated (not
  // deleted — its bookings still point at it). The seed never creates it.
  {
    name: "Cricket Net - Astro",
    type: { name: "Cricket", playerOptions: [2, 4, 6] },
    description:
      "Synthetic astro-turf practice net with a true, consistent bounce close to a grass pitch. Floodlit for evening sessions — book the lane for batting or bowling practice.",
    images: [
      "/images/courts/cricket_nets_3.jpg",
    ],
    schedule: { ...EVENING, price: 1700 },
  },
  {
    name: "Cricket Net - Concrete",
    type: { name: "Cricket", playerOptions: [2, 4, 6] },
    description:
      "Concrete practice strip laid with matting, giving pace and an even, predictable bounce. Well suited to quick bowling and back-foot work. Floodlit for evening sessions.",
    images: [
      "/images/courts/cricket_nets_1.jpg",
    ],
    schedule: { ...EVENING, price: 1400 },
  },
  {
    name: "Cricket Nets - Double",
    type: { name: "Cricket", playerOptions: [2, 4, 6] },
    description:
      "Two adjoining practice nets booked together — room for a full squad session, with batters and bowlers rotating across both lanes. Floodlit for evening sessions.",
    images: [
      "/images/courts/cricket_nets_2.jpg",
    ],
    schedule: { ...EVENING, price: 2800 },
  },
  {
    name: "Basketball",
    type: { name: "Basketball", playerOptions: [2, 4, 6, 8, 10] },
    description:
      "Full-size indoor court with sprung flooring, adjustable hoops and match-grade lighting. Suits half-court practice or a full five-a-side.",
    images: [
      "/images/courts/basketball_1.jpg",
      "/images/courts/basketball_2.jpg",
      "/images/courts/basketball_3.jpg",
    ],
    schedule: { ...EVENING, price: 2200 },
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
    schedule: { ...EVENING, price: 1000 },
  },
  {
    name: "Badminton",
    aliases: ["Badminton Court 1"],
    type: { name: "Badminton", playerOptions: [2, 4] },
    description:
      "Indoor wooden court with tournament netting and shuttle-friendly lighting, screened from any draught.",
    images: [
      "/images/courts/badminton_1.jpg",
      "/images/courts/badminton_2.jpg",
    ],
    schedule: { ...EVENING, price: 1400 },
  },
  {
    name: "Tennis",
    aliases: ["Centre Court"],
    type: { name: "Tennis", playerOptions: [2, 4] },
    description:
      "Floodlit hard court for singles or doubles, with a full-height net and courtside seating.",
    images: [
      "/images/courts/tennis_1.png",
      "/images/courts/tennis_2.jpg",
    ],
    schedule: { ...EVENING, price: 1200 },
  },

  // --- Shared facilities ----------------------------------------------------
  // One person per booking, so the hourly rate is per person and capacity
  // counts heads. Booking a place never closes the hour to other members.
  {
    name: "Fitness Center",
    type: { name: "Fitness", playerOptions: [1] },
    description:
      "Air-conditioned gym with free weights, racks, benches, treadmills and spin bikes. Book your place in a one-hour session — other members train alongside you.",
    images: [
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1600&q=80",
    ],
    schedule: { ...EVENING, price: 700 },
    shared: { capacity: 20 },
  },
  {
    name: "Swimming Pool",
    type: { name: "Swimming", playerOptions: [1] },
    description:
      "25-metre, eight-lane pool with a lifeguard on duty every session. Book your place for lane swimming — the pool is shared with other members during the hour.",
    images: [
      "/images/courts/Pool_01.jpeg",
      "/images/courts/Pool_02.jpeg",
      "/images/courts/Pool_03.jpeg",
    ],
    schedule: { ...EVENING, price: 1200 },
    shared: { capacity: 30 },
  },
];

/**
 * Display order (Court.displayOrder, every court list on the site), in tens —
 * the same values migration 20261001130000_court_display_order wrote. Written
 * only when the seed creates a court, never over an existing court's order.
 */
const DISPLAY_ORDER = [
  "Badminton",
  "Basketball",
  "Tennis",
  "Cricket Nets - Double",
  "Table Tennis",
  "Swimming Pool",
  "Fitness Center",
  "Cricket Net - Astro",
  "Cricket Net - Concrete",
];

function displayOrderFor(name: string): number {
  const i = DISPLAY_ORDER.indexOf(name);
  return i === -1 ? 1000 : (i + 1) * 10;
}

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
  // The canonical name wins over an alias, so a half-renamed database never
  // picks the old row when the new one already exists.
  const existing =
    (await prisma.court.findFirst({
      where: { name: seed.name },
      select: { id: true },
    })) ??
    (seed.aliases?.length
      ? await prisma.court.findFirst({
          where: { name: { in: seed.aliases } },
          select: { id: true },
        })
      : null);

  // Mode is written only for the shared facilities: re-seeding never touches
  // an existing court's mode (the DB refuses a switch under live bookings).
  const mode = seed.shared
    ? { bookingMode: "shared" as const, capacity: seed.shared.capacity }
    : {};

  const court = existing
    ? await prisma.court.update({
        where: { id: existing.id },
        data: {
          name: seed.name,
          courtTypeId: courtType.id,
          description: seed.description,
          images: seed.images,
          isActive: true,
          ...mode,
        },
      })
    : await prisma.court.create({
        data: {
          name: seed.name,
          displayOrder: displayOrderFor(seed.name),
          courtTypeId: courtType.id,
          description: seed.description,
          images: seed.images,
          isActive: true,
          ...mode,
        },
      });

  console.log(
    `${existing ? "updated" : "created"} ${court.name} (${seed.type.name}, players ${seed.type.playerOptions.join("/")}` +
      (seed.shared
        ? `, SHARED, capacity ${seed.shared.capacity ?? "unlimited"}/hour)`
        : ")")
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
