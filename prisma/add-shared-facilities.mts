/**
 * Add the two SHARED facilities — Fitness Center and Swimming Pool — to a
 * database that is already in use.
 *
 *   npm run db:add-shared-facilities
 *
 * Why not just `npm run db:seed`? The seed also rewrites every existing court's
 * name, description and images back to the demo values, which would undo an
 * admin's edits on a live database. This script touches nothing but these two
 * facilities and their court types.
 *
 * Idempotent — safe to run any number of times:
 *  - **Court types** are created if missing; an existing type is left alone.
 *  - **Facilities** are matched by name. A missing one is created together with
 *    its schedule in one transaction. An existing one keeps its description,
 *    images and capacity (an admin may have changed them); only its booking mode
 *    is put right if it is somehow not `shared`.
 *  - **Slot templates** are generated per weekday only when that weekday has no
 *    templates at all, exactly like the seed — never duplicated, and a rate an
 *    admin has since adjusted is never touched.
 *
 * Schedule: the same window every court runs, 18:00–21:00 every day, as three
 * 1-hour slots. See docs/ARCHITECTURE.md → "Exclusive vs shared facilities".
 *
 * The public catalogue is cached (lib/catalogue.ts) and this script runs outside
 * Next.js, so it cannot call `revalidateCatalogue()`. The new facilities appear
 * once the 5-minute safety-net TTL lapses, or at once after a dev-server restart.
 */
import { config } from "dotenv";
import { PrismaClient } from "../lib/generated/prisma/client";
import { DAY_NAMES, timeStringToDate } from "../lib/time";

config({ path: ".env.local" });

const prisma = new PrismaClient();

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** The window every court currently runs: three 1-hour slots, every day. */
const SCHEDULE = { days: EVERY_DAY, startTime: "18:00", endTime: "21:00" };

type FacilitySeed = {
  name: string;
  /** One person per booking: the hourly rate is per person, capacity counts heads. */
  type: { name: string; playerOptions: number[] };
  description: string;
  images: string[];
  price: number;
  /** Court.displayOrder — same value migration 20261001130000 / the seed use. */
  displayOrder: number;
  /** Max people per hour; null = unlimited. */
  capacity: number | null;
};

/**
 * Unsplash placeholders (docs/DESIGN.md) — the host is whitelisted in
 * next.config.ts. Swap for real photography in Supabase Storage before go-live.
 */
const FACILITIES: FacilitySeed[] = [
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
    price: 700, // Rs.500 + the Rs.200 rise (migration 20261001120000)
    displayOrder: 70,
    capacity: 20,
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
    price: 1200, // Rs.1,000 + the Rs.200 rise (migration 20261001120000)
    displayOrder: 60,
    capacity: 30,
  },
];

/** "18:00"–"21:00" -> the individual 1-hour rows for one weekday. */
function hoursFor(courtId: string, dayOfWeek: number, price: number) {
  const startHour = Number(SCHEDULE.startTime.slice(0, 2));
  const endHour = Number(SCHEDULE.endTime.slice(0, 2));

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

for (const facility of FACILITIES) {
  // `update: {}` — an existing type is never altered.
  const courtType = await prisma.courtType.upsert({
    where: { name: facility.type.name },
    create: facility.type,
    update: {},
  });

  // `Court.name` is not unique, so this is a find-then-write. Matching by name
  // is what keeps a second run from creating a duplicate.
  const existing = await prisma.court.findFirst({
    where: { name: facility.name },
    select: { id: true, bookingMode: true },
  });

  let courtId: string;

  if (!existing) {
    // Court and its whole schedule in one transaction: a failure part-way
    // never leaves a facility on the site with no bookable hours.
    courtId = await prisma.$transaction(async (tx) => {
      const court = await tx.court.create({
        data: {
          name: facility.name,
          displayOrder: facility.displayOrder,
          courtTypeId: courtType.id,
          description: facility.description,
          images: facility.images,
          isActive: true,
          bookingMode: "shared",
          capacity: facility.capacity,
        },
        select: { id: true },
      });
      await tx.slotTemplate.createMany({
        data: SCHEDULE.days.flatMap((day) =>
          hoursFor(court.id, day, facility.price)
        ),
      });
      return court.id;
    });
    console.log(
      `created ${facility.name} (SHARED, capacity ${facility.capacity ?? "unlimited"}/hour)`
    );
  } else {
    courtId = existing.id;
    if (existing.bookingMode !== "shared") {
      // The DB trigger `court_guard_booking_mode` refuses this if the court
      // holds upcoming bookings — let that error surface rather than hide it.
      await prisma.court.update({
        where: { id: courtId },
        data: { bookingMode: "shared", capacity: facility.capacity },
      });
      console.log(`${facility.name} already existed — switched to SHARED`);
    } else {
      console.log(`${facility.name} already exists (SHARED) — left as is`);
    }
  }

  // Fill in any weekday that has no hours at all (covers a half-set-up row).
  const filled: string[] = [];
  for (const dayOfWeek of SCHEDULE.days) {
    const already = await prisma.slotTemplate.count({
      where: { courtId, dayOfWeek },
    });
    if (already > 0) continue;
    await prisma.slotTemplate.createMany({
      data: hoursFor(courtId, dayOfWeek, facility.price),
    });
    filled.push(DAY_NAMES[dayOfWeek]);
  }

  console.log(
    `  ${SCHEDULE.startTime}–${SCHEDULE.endTime} @ LKR ${facility.price.toLocaleString("en-LK")}/hour` +
      (filled.length ? ` — added hours for: ${filled.join(", ")}` : "")
  );
}

await prisma.$disconnect();
console.log("\nShared facilities ready.");
