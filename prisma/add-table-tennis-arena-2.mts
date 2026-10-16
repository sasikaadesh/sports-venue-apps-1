/**
 * Split Table Tennis into two arenas on a database that is already in use.
 *
 *   npm run db:add-table-tennis-arena-2
 *
 * Why not just `npm run db:seed`? The seed also rewrites every other court's
 * description and images back to the demo values, which would undo an admin's
 * edits on a live database. This script touches only the two table tennis
 * courts.
 *
 *  - **Arena 1 is the existing court, renamed in place** — found as
 *    "Table Tennis" (or already as Arena 1 on a re-run). Its id, rate, slot
 *    templates, bookings, reference prefix (TT), colour and display order are
 *    kept; only its name and photos change.
 *  - **Arena 2 is new**: same Table Tennis court type (so the same 2/4 player
 *    options), same description and rules (blank = the type's standard set,
 *    `lib/court-rules.ts`), and an exact copy of Arena 1's *live* slot
 *    templates — read from the database, not assumed — so its rate and
 *    schedule match whatever Arena 1 runs today. It sits straight after
 *    Arena 1 in every court list (displayOrder 55, between 50 and Swimming
 *    Pool's 60), with its own colour and the `TT2` reference prefix.
 *
 * One transaction, idempotent: a re-run finds Arena 2 already there and only
 * re-applies the photos.
 *
 * The public catalogue is cached (lib/catalogue.ts) and this script runs outside
 * Next.js, so it cannot call `revalidateCatalogue()`. The change appears once
 * the 5-minute safety-net TTL lapses, at once after a dev-server restart, or
 * immediately after saving any court in the admin panel.
 */
import { config } from "dotenv";
import { PrismaClient } from "../lib/generated/prisma/client";

config({ path: ".env.local" });

const prisma = new PrismaClient();

const DIR = "/images/courts/";

const ARENA_1 = {
  name: "Table Tennis - Arena 1",
  aliases: ["Table Tennis"],
  images: ["table_tennis_1.jpg", "table_tennis_3.jpg"],
};

const ARENA_2 = {
  name: "Table Tennis - Arena 2",
  images: ["table_tennis_2.jpg", "table_tennis_3.jpg"],
  displayOrder: 55,
  referencePrefix: "TT2",
  // Navy: distinct from Arena 1's Teal and from its list neighbours
  // (Cricket Nets - Double, Swimming Pool). Changeable in the admin panel.
  color: "#1B3A5C",
};

async function main() {
  await prisma.$transaction(async (tx) => {
    // The canonical name wins over the alias, so a re-run never picks a stray
    // row still called "Table Tennis" over the already-renamed Arena 1.
    const arena1 =
      (await tx.court.findFirst({ where: { name: ARENA_1.name } })) ??
      (await tx.court.findFirst({ where: { name: { in: ARENA_1.aliases } } }));
    if (!arena1) {
      throw new Error(
        `No court named "${ARENA_1.name}" or ${ARENA_1.aliases.map((a) => `"${a}"`).join(", ")}`
      );
    }

    await tx.court.update({
      where: { id: arena1.id },
      data: {
        name: ARENA_1.name,
        images: ARENA_1.images.map((f) => DIR + f),
      },
    });
    console.log(`${arena1.name} -> ${ARENA_1.name} (id ${arena1.id} kept)`);

    const existing = await tx.court.findFirst({ where: { name: ARENA_2.name } });
    if (existing) {
      await tx.court.update({
        where: { id: existing.id },
        data: { images: ARENA_2.images.map((f) => DIR + f) },
      });
      console.log(`${ARENA_2.name} already exists — photos re-applied`);
      return;
    }

    const arena2 = await tx.court.create({
      data: {
        name: ARENA_2.name,
        courtTypeId: arena1.courtTypeId,
        description: arena1.description,
        amenities: arena1.amenities,
        rules: arena1.rules,
        bookingMode: arena1.bookingMode,
        capacity: arena1.capacity,
        isActive: true,
        displayOrder: ARENA_2.displayOrder,
        referencePrefix: ARENA_2.referencePrefix,
        color: ARENA_2.color,
        images: ARENA_2.images.map((f) => DIR + f),
      },
    });

    const slots = await tx.slotTemplate.findMany({
      where: { courtId: arena1.id },
    });
    await tx.slotTemplate.createMany({
      data: slots.map((s) => ({
        courtId: arena2.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        price: s.price,
        isActive: s.isActive,
      })),
    });
    console.log(
      `created ${ARENA_2.name} (id ${arena2.id}) with ${slots.length} slot templates copied from Arena 1`
    );
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
