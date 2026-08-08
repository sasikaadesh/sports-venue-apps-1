import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  pageCountFor,
  type AffiliationFilter,
  type RoleFilter,
  type SortDirection,
  type UserSort,
} from "@/lib/admin-filters";
import {
  filterUsersByRating,
  getRatingSummaries,
  sortUsersByRating,
  type RatingSummary,
} from "@/lib/user-ratings";
import type { UserRatingFilter } from "@/lib/validations";

/**
 * The read side of the admin Users table.
 *
 * **Admin-only, like everything it touches.** `import "server-only"` keeps it
 * out of every client bundle, and its one caller sits behind `requireAdmin()`.
 * It selects `nic` and joins conduct ratings — see `lib/user-ratings.ts` for
 * why neither ever leaves this half of the app.
 *
 * ## Why there are two paths through `listAdminUsers`
 *
 * Role, affiliation and the name/email search are columns on `User`, so
 * Postgres filters, orders and pages them — the browser receives one page.
 *
 * Conduct average is not. It lives in `UserRating` and Prisma cannot order a
 * user query by it, so sorting or filtering by conduct still needs the
 * in-memory pass this table has always used. That pass is now *narrowed by the
 * database first* — it runs over the accounts matching the other filters, not
 * over every account — and it reports when it hit its cap so the page can say
 * so rather than silently lying about the total.
 */

export type UserFilters = {
  role: RoleFilter;
  affiliation: AffiliationFilter;
  /** Free text matched against name and email. */
  search?: string;
  rated: UserRatingFilter;
};

/**
 * How many accounts the conduct path will pull before it gives up on being
 * exact. Only reached when sorting or filtering by conduct.
 */
const CONDUCT_SCAN_CAP = 1000;

export function hasActiveUserFilters(filters: UserFilters): boolean {
  return (
    filters.role !== "all" ||
    filters.affiliation !== "all" ||
    filters.rated !== "all" ||
    Boolean(filters.search)
  );
}

function userWhere(filters: UserFilters): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [];

  if (filters.role !== "all") conditions.push({ role: filters.role });

  if (filters.affiliation === "unset") {
    // The accounts that predate the field — exactly the people
    // /complete-profile still has to catch.
    conditions.push({ affiliation: null });
  } else if (filters.affiliation !== "all") {
    conditions.push({ affiliation: filters.affiliation });
  }

  if (filters.search) {
    // Case-insensitive substring on both display fields: an admin looking
    // someone up has either half of "Ada Perera <ada@…>", not a prefix.
    conditions.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

/**
 * Sort column → `orderBy`, for the columns Postgres can actually sort.
 *
 * `rating` is not one of them; it falls back to the newest-first order so the
 * capped scan that precedes the in-memory conduct sort is at least
 * deterministic. Every order carries `id` as a tie-breaker — without one,
 * equal keys can come back in a different order per request, which shows up as
 * a row appearing on two different pages.
 */
function userOrderBy(
  sort: UserSort,
  direction: SortDirection
): Prisma.UserOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      // Nulls last: an account that has never filled in a name is not "before
      // A". Prisma needs this spelled out; Postgres defaults nulls first on DESC.
      return [{ name: { sort: direction, nulls: "last" } }, { email: "asc" }];
    case "joined":
      return [{ createdAt: direction }, { id: "asc" }];
    case "rating":
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  nic: true,
  affiliation: true,
  role: true,
  createdAt: true,
  _count: { select: { bookings: true } },
} satisfies Prisma.UserSelect;

export type AdminUserRow = Prisma.UserGetPayload<{
  select: typeof USER_SELECT;
}>;

export type AdminUserPage = {
  rows: AdminUserRow[];
  summaries: Map<string, RatingSummary>;
  total: number;
  pageCount: number;
  /**
   * True when the conduct path hit `CONDUCT_SCAN_CAP`, so `total` is a floor
   * rather than the exact number. The page says so instead of pretending.
   */
  truncated: boolean;
};

export async function listAdminUsers({
  filters,
  sort,
  direction,
  page,
}: {
  filters: UserFilters;
  sort: UserSort;
  direction: SortDirection;
  page: number;
}): Promise<AdminUserPage> {
  const where = userWhere(filters);
  const orderBy = userOrderBy(sort, direction);

  // Conduct lives in another table, so anything that sorts or filters by it
  // cannot be paged by Postgres. Everything else can.
  const needsConductPass = sort === "rating" || filters.rated !== "all";

  if (!needsConductPass) {
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
        select: USER_SELECT,
      }),
    ]);

    // One aggregate for the page's rows, not for every account.
    const summaries = await getRatingSummaries(rows.map((u) => u.id));

    return {
      rows,
      summaries,
      total,
      pageCount: pageCountFor(total),
      truncated: false,
    };
  }

  const scanned = await prisma.user.findMany({
    where,
    orderBy,
    take: CONDUCT_SCAN_CAP,
    select: USER_SELECT,
  });

  const summaries = await getRatingSummaries(scanned.map((u) => u.id));

  const matching = filterUsersByRating(scanned, summaries, filters.rated);
  const ordered =
    sort === "rating"
      ? sortUsersByRating(matching, summaries, direction)
      : matching;

  const total = ordered.length;

  return {
    rows: ordered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE),
    summaries,
    total,
    pageCount: pageCountFor(total),
    truncated: scanned.length === CONDUCT_SCAN_CAP,
  };
}
