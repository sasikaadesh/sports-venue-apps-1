/**
 * Swap the placeholder court photos for the real ones in public/images/courts.
 *
 *   npx tsx prisma/update-court-images.mts
 *
 * Replaces (does not append to) the `images` array of the courts listed below.
 * Table Tennis and Fitness Center are deliberately absent — their images stay
 * as they are. The deactivated legacy "Cricket Nets" court is not touched.
 *
 * Courts are matched by name, and the whole run is one transaction: if any
 * court is missing, nothing is written. Idempotent — safe to re-run.
 *
 * The public pages read courts through the cached catalogue (lib/catalogue.ts).
 * A script cannot revalidate that tag, and an expired entry is still served
 * stale once — per court for the detail pages — so after running this, either
 * save any court in the admin panel or bump the catalogue cache keys.
 */
import { config } from "dotenv";
import { PrismaClient } from "../lib/generated/prisma/client";

config({ path: ".env.local" });

const prisma = new PrismaClient();

const DIR = "/images/courts/";

const COURT_IMAGES: Record<string, string[]> = {
  Badminton: ["badminton_1.jpg", "badminton_2.jpg"],
  Basketball: ["basketball_1.jpg", "basketball_2.jpg", "basketball_3.jpg"],
  Tennis: ["tennis_1.png", "tennis_2.jpg"],
  "Swimming Pool": ["Pool_01.jpeg", "Pool_02.jpeg", "Pool_03.jpeg"],
  "Cricket Net - Concrete": ["cricket_nets_1.jpg"],
  "Cricket Nets - Double": ["cricket_nets_2.jpg"],
  "Cricket Net - Astro": ["cricket_nets_3.jpg"],
};

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const [name, files] of Object.entries(COURT_IMAGES)) {
      const matches = await tx.court.findMany({ where: { name } });
      if (matches.length !== 1) {
        throw new Error(`Expected exactly one court named "${name}", found ${matches.length}`);
      }
      const images = files.map((f) => DIR + f);
      await tx.court.update({ where: { id: matches[0].id }, data: { images } });
      console.log(`${name}: ${matches[0].images.length} old -> ${images.length} new`);
    }
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
