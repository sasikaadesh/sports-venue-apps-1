import "server-only";

import { prisma } from "@/lib/prisma";
import type { SortDirection } from "@/lib/admin-filters";
import { FLAGGED_RATING_MAX, type UserRatingFilter } from "@/lib/validations";

/**
 * Admin conduct ratings — the single module that reads or writes `UserRating`.
 *
 * **Everything here is admin-only.** `import "server-only"` keeps it out of
 * every client bundle, and every caller sits behind `requireAdmin()` in
 * `app/admin/users/actions.ts` / `app/admin/users/page.tsx`. Nothing in the
 * user-facing half of the app imports this file, and there is no action a
 * signed-in non-admin can call that reaches it — a rated user cannot see their
 * own score, their own comments, or the fact that a rating exists.
 *
 * Prisma bypasses RLS, so that gate is the real one on this path. The RLS
 * policies added in 20260803120000 cover the anon-key path independently: no
 * policy on this table grants a non-admin anything, deliberately including the
 * "select own" every other table has.
 */

export type RatingSummary = {
  /** Mean of every rating, or null when the user has never been rated. */
  average: number | null;
  count: number;
};

export type UserRatingEntry = {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date;
  /** Null when the admin who wrote it has since had their account removed. */
  adminName: string | null;
  adminEmail: string | null;
};

/**
 * Average + count for many users in one round trip.
 *
 * `groupBy` rather than a per-row subquery: the Users tab draws up to 500
 * rows, and one aggregate beats 500 lookups. Users with no ratings are absent
 * from the result and are read as `{ average: null, count: 0 }` by the caller.
 */
export async function getRatingSummaries(
  userIds: string[]
): Promise<Map<string, RatingSummary>> {
  if (userIds.length === 0) return new Map();

  const rows = await prisma.userRating.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return new Map(
    rows.map((r) => [
      r.userId,
      { average: r._avg.rating ?? null, count: r._count._all },
    ])
  );
}

/** One user's full history, most recent first. */
export async function listUserRatings(
  userId: string
): Promise<UserRatingEntry[]> {
  const rows = await prisma.userRating.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      admin: { select: { name: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    adminName: r.admin?.name ?? null,
    adminEmail: r.admin?.email ?? null,
  }));
}

/**
 * Record a note. `adminId` is the *authenticated* admin, passed in by the
 * action from `requireAdmin()` — never from the form, so the history cannot be
 * signed in someone else's name.
 */
export async function addUserRating(input: {
  userId: string;
  adminId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  await prisma.userRating.create({
    data: {
      userId: input.userId,
      adminId: input.adminId,
      rating: input.rating,
      comment: input.comment,
    },
  });
}

/**
 * Count the accounts whose average is at or below the flagged threshold.
 *
 * One `groupBy` with a `HAVING`, so the "Flagged" stat on the Users tab does
 * not depend on having loaded every user first — which it did before the table
 * was paginated, and which stopped being possible once it was.
 */
export async function countFlaggedUsers(): Promise<number> {
  const rows = await prisma.userRating.groupBy({
    by: ["userId"],
    _avg: { rating: true },
    having: { rating: { _avg: { lte: FLAGGED_RATING_MAX } } },
  });

  return rows.length;
}

/**
 * Order a list of users by conduct, in memory.
 *
 * The average lives in a second table, so Postgres cannot order the user query
 * by it without a join Prisma will not express. Keeping it here means the
 * average has exactly one definition — and it is why sorting or filtering by
 * conduct is the one path in `lib/admin-users.ts` that reads a capped set
 * rather than a single page. If this list ever outgrows that cap, the thing to
 * replace is this function with a database view, not the aggregate above.
 *
 * Never-rated users sort *last* in both directions. They are not "zero stars";
 * they are unknown, and burying an unrated newcomer at the top of a
 * "worst first" list would be actively misleading.
 */
export function sortUsersByRating<T extends { id: string }>(
  users: T[],
  summaries: Map<string, RatingSummary>,
  direction: SortDirection
): T[] {
  const factor = direction === "asc" ? 1 : -1;

  return [...users].sort((a, b) => {
    const x = summaries.get(a.id)?.average ?? null;
    const y = summaries.get(b.id)?.average ?? null;

    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * factor;
  });
}

/** Narrow a list to the accounts a filter asks for. */
export function filterUsersByRating<T extends { id: string }>(
  users: T[],
  summaries: Map<string, RatingSummary>,
  filter: UserRatingFilter
): T[] {
  if (filter === "all") return users;

  return users.filter((u) => {
    const summary = summaries.get(u.id);
    const average = summary?.average ?? null;

    if (filter === "unrated") return average === null;
    if (filter === "rated") return average !== null;
    // "flagged" — the problem-user shortlist.
    return average !== null && average <= FLAGGED_RATING_MAX;
  });
}
