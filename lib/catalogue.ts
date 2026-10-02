import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The one order every court list uses — the home page grid, the booking bar's
 * court selector, /courts and the admin lists: `Court.displayOrder`, lowest
 * first, then name as a tiebreak. Data-driven, so reordering is a data change,
 * not a code change. Use this rather than writing an `orderBy` by hand.
 */
export const COURT_DISPLAY_ORDER = [
  { displayOrder: "asc" },
  { name: "asc" },
] satisfies Prisma.CourtOrderByWithRelationInput[];

/**
 * Cached reads of the court **catalogue** — the slow-moving half of the site.
 *
 * The public pages mix two kinds of data with very different lifetimes:
 *
 *   * the catalogue — which courts exist, their names, photos, type and the
 *     weekdays they run. This changes only when an admin edits it, which is
 *     rare.
 *   * availability — which hours are still free on a given date. This changes
 *     every time somebody books, and must NEVER be served from a cache.
 *
 * Before this module both were re-queried on every single navigation, so
 * browsing the site meant several database round trips per page for data that
 * had not changed in weeks. Only the catalogue lives here; availability stays
 * in `lib/availability.ts` and is still read live on every request.
 *
 * ## Invalidation
 *
 * Every entry is tagged, and the admin actions that write courts, court types
 * or slot templates call `revalidateTag(COURTS_TAG)` — so an admin edit shows
 * up on the public site immediately, exactly as it did before.
 * `CATALOGUE_TTL` is only a safety net: if an invalidation path is ever missed,
 * the stale entry heals itself within five minutes rather than sticking.
 *
 * ## Serialisation
 *
 * The cache stores JSON, and Prisma returns `Decimal` for prices and `Date` for
 * timestamps, neither of which survives that round trip faithfully. Both are
 * converted to strings *inside* the cached functions — which is the shape the
 * components wanted anyway.
 */

/** Cache tag for everything catalogue-shaped. Admin writes revalidate this. */
export const COURTS_TAG = "courts";

/** Safety-net TTL, in seconds. Correctness comes from the tag, not from this. */
const CATALOGUE_TTL = 300;

/**
 * Drop every cached catalogue read.
 *
 * Call this from any admin action that writes a court, a court type or a slot
 * template — it is what keeps an admin edit instantly visible on the public
 * site. It sits next to the cached reads on purpose: adding a new cached
 * catalogue entry above should never mean hunting through the admin actions for
 * a second tag to add.
 *
 * The `"max"` profile is Next 16's required second argument — the single-argument
 * form is deprecated. `updateTag` would expire the entries a fraction sooner but
 * throws outside a Server Action, and this helper should stay callable from
 * anywhere that writes a court.
 */
export function revalidateCatalogue(): void {
  revalidateTag(COURTS_TAG, "max");
}

export type CatalogueCourt = {
  id: string;
  name: string;
  typeName: string;
  images: string[];
  /** Cheapest active slot price across the week, or null when none exist. */
  fromPrice: string | null;
};

/**
 * Every active court with its cheapest price — what the home page grid, the
 * home page's booking bar and /courts all render, in COURT_DISPLAY_ORDER. The
 * grid and the selector share this one array, so they cannot disagree.
 */
export const getActiveCourts = unstable_cache(
  async (): Promise<CatalogueCourt[]> => {
    const courts = await prisma.court.findMany({
      where: { isActive: true },
      orderBy: COURT_DISPLAY_ORDER,
      select: {
        id: true,
        name: true,
        images: true,
        courtType: { select: { name: true } },
        slots: {
          where: { isActive: true },
          orderBy: { price: "asc" },
          take: 1,
          select: { price: true },
        },
      },
    });

    return courts.map((court) => ({
      id: court.id,
      name: court.name,
      images: court.images,
      typeName: court.courtType.name,
      fromPrice: court.slots[0]?.price.toString() ?? null,
    }));
  },
  // Key bumped from "active-courts": the cached shape and order changed, so an
  // entry written by the old code must not be served to the new. v3: court
  // images were rewritten by prisma/update-court-images.mts, a script that
  // cannot revalidate COURTS_TAG — bumped together with "court-detail" so the
  // grid and the detail pages drop their old entries at the same moment.
  ["active-courts-v3"],
  { tags: [COURTS_TAG], revalidate: CATALOGUE_TTL }
);

export type CatalogueCourtDetail = {
  id: string;
  name: string;
  description: string | null;
  /** Free-text list, e.g. "Floodlights, Changing rooms, Water". */
  amenities: string | null;
  /** Court rules, one per line; null = the standard set (lib/court-rules.ts). */
  rules: string | null;
  images: string[];
  typeName: string;
  playerOptions: number[];
  /** Weekdays (0..6) this court runs at all — drives the "Open on" badges. */
  activeDays: number[];
};

/**
 * One court's own record, for /courts/[id].
 *
 * Deliberately does NOT include availability: the page still reads that live,
 * for the requested date, on every request. Inactive courts return null so the
 * page can 404 — hiding a court is an admin write, which revalidates this.
 *
 * Note what is no longer selected: the page used to pull every active slot
 * template with its price and use it for exactly one thing, the set of weekdays
 * the court runs. `activeDays` is that set, computed here from `dayOfWeek`
 * alone.
 */
export const getCourtDetail = unstable_cache(
  async (id: string): Promise<CatalogueCourtDetail | null> => {
    const court = await prisma.court.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        amenities: true,
        rules: true,
        images: true,
        courtType: { select: { name: true, playerOptions: true } },
        slots: {
          where: { isActive: true },
          orderBy: { dayOfWeek: "asc" },
          select: { dayOfWeek: true },
        },
      },
    });

    if (!court) return null;

    return {
      id: court.id,
      name: court.name,
      description: court.description,
      amenities: court.amenities,
      rules: court.rules,
      images: court.images,
      typeName: court.courtType.name,
      playerOptions: court.courtType.playerOptions,
      activeDays: [...new Set(court.slots.map((s) => s.dayOfWeek))],
    };
  },
  // Bumped from "court-detail" when `rules` joined the shape: an entry cached
  // by the old code would otherwise be served without it. v3: see
  // "active-courts-v3" above — always bump these two together.
  ["court-detail-v3"],
  { tags: [COURTS_TAG], revalidate: CATALOGUE_TTL }
);

/**
 * Name + player options for one court — the catalogue half of what the
 * availability API returns. The slots themselves stay uncached.
 */
export const getCourtForAvailability = unstable_cache(
  async (
    id: string
  ): Promise<{ id: string; name: string; playerOptions: number[] } | null> => {
    const court = await prisma.court.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        courtType: { select: { playerOptions: true } },
      },
    });

    if (!court) return null;

    return {
      id: court.id,
      name: court.name,
      playerOptions: court.courtType.playerOptions,
    };
  },
  ["court-for-availability"],
  { tags: [COURTS_TAG], revalidate: CATALOGUE_TTL }
);
