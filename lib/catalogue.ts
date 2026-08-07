import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

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
  /** ISO timestamp — the home page orders by it. Never rendered. */
  createdAt: string;
};

/**
 * Every active court with its cheapest price — what the home page grid, the
 * home page's booking bar and /courts all render.
 *
 * Ordered by type then name (what /courts wants). The home page wants
 * newest-first, so it re-sorts this array in memory: a handful of rows, already
 * loaded, rather than a second query and a second cache entry.
 */
export const getActiveCourts = unstable_cache(
  async (): Promise<CatalogueCourt[]> => {
    const courts = await prisma.court.findMany({
      where: { isActive: true },
      orderBy: [{ courtType: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        images: true,
        createdAt: true,
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
      createdAt: court.createdAt.toISOString(),
    }));
  },
  ["active-courts"],
  { tags: [COURTS_TAG], revalidate: CATALOGUE_TTL }
);

/** The same courts, newest first — the order the home page grid uses. */
export async function getActiveCourtsNewestFirst(): Promise<CatalogueCourt[]> {
  const courts = await getActiveCourts();
  return [...courts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type CatalogueCourtDetail = {
  id: string;
  name: string;
  description: string | null;
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
      images: court.images,
      typeName: court.courtType.name,
      playerOptions: court.courtType.playerOptions,
      activeDays: [...new Set(court.slots.map((s) => s.dayOfWeek))],
    };
  },
  ["court-detail"],
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
