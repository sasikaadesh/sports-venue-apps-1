import { AFFILIATIONS, type AffiliationValue } from "@/lib/validations";

/**
 * The query-string vocabulary shared by the admin tables.
 *
 * /admin/bookings and /admin/users keep their entire view state — every
 * filter, the sort column, its direction and the page number — in the URL.
 * That is deliberate:
 *
 *   - the pages stay **server components**, so filtering is a database query,
 *     not a client-side pass that hides rows it already downloaded;
 *   - a view an admin wants to return to ("unpaid Tennis bookings in March,
 *     dearest first") is a link they can bookmark or send to a colleague;
 *   - the back button works, and a refresh lands on the same view.
 *
 * A query string is untrusted input, so nothing here trusts it. Every parser
 * returns a value from a fixed set or its default, and the parsed values — not
 * the raw ones — are what reach Prisma and what get re-serialised into links.
 * `?sort=totalPrice;DROP+TABLE` arrives at the query as "date".
 */

/** Rows per page in both admin tables. */
export const ADMIN_PAGE_SIZE = 25;

/**
 * Upper bound on the page number we will honour.
 *
 * `skip` is `(page - 1) * pageSize`, and an unbounded page number from the URL
 * is an invitation to ask Postgres for row 50,000,000 of a table with 300 rows.
 * Anything past the real last page simply renders an empty page anyway.
 */
const MAX_PAGE = 10_000;

type Param = string | string[] | undefined;

/**
 * First usable value of a search param.
 *
 * Repeated keys (`?status=a&status=b`) arrive as an array — take the first
 * rather than crashing or stringifying the lot. Blank becomes `undefined` so
 * "present but empty" and "absent" mean the same thing; the no-JS form
 * fallback submits empty strings for every unset control.
 */
function first(value: Param): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/** Narrow to a member of `allowed`, else `fallback`. */
function oneOf<T extends string>(
  value: Param,
  allowed: readonly T[],
  fallback: T
): T {
  const v = first(value);
  return allowed.includes(v as T) ? (v as T) : fallback;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export function parseSortDirection(
  value: Param,
  fallback: SortDirection
): SortDirection {
  return oneOf(value, SORT_DIRECTIONS, fallback);
}

/** The other direction — what a header click toggles to. */
export function flipDirection(direction: SortDirection): SortDirection {
  return direction === "asc" ? "desc" : "asc";
}

/** Sortable columns of the Bookings table. */
export const BOOKING_SORTS = [
  "date",
  "court",
  "who",
  "status",
  "amount",
] as const;
export type BookingSort = (typeof BOOKING_SORTS)[number];

/** Sortable columns of the Users table. */
export const USER_SORTS = ["name", "joined", "rating"] as const;
export type UserSort = (typeof USER_SORTS)[number];

/**
 * The direction a column sorts by on its *first* click.
 *
 * Dates and money read newest/largest first — that is the question an admin is
 * actually asking when they click them. Names read A–Z. Getting this wrong is
 * not a bug, just an extra click every time, which is worse.
 *
 * `status` ascending is the booking lifecycle in order (pending → confirmed →
 * cancelled → blocked → expired), because that is how the Postgres enum is
 * declared — so the first click puts the rows that still need a decision at the
 * top, which is the reason to sort by status at all.
 */
export const BOOKING_SORT_DEFAULT_DIRECTION: Record<
  BookingSort,
  SortDirection
> = {
  date: "desc",
  court: "asc",
  who: "asc",
  status: "asc",
  amount: "desc",
};

export const USER_SORT_DEFAULT_DIRECTION: Record<UserSort, SortDirection> = {
  name: "asc",
  joined: "desc",
  rating: "asc", // lowest first — the conduct sort exists to surface problems
};

export function parseBookingSort(value: Param): BookingSort {
  return oneOf(value, BOOKING_SORTS, "date");
}

export function parseUserSort(value: Param): UserSort {
  return oneOf(value, USER_SORTS, "joined");
}

// ---------------------------------------------------------------------------
// Bookings filters
// ---------------------------------------------------------------------------

/**
 * Payment state, as an admin thinks about it.
 *
 * Not the same vocabulary as `PaymentStatus`: a booking can have several
 * payment attempts, and what matters is the state of the booking as a whole.
 * `unpaid` in particular has no `Payment` row at all, so it cannot be a status
 * value — it is the absence of one. See `paymentWhere` in lib/admin-bookings.ts
 * for how each maps to a query.
 */
export const PAYMENT_FILTERS = [
  "all",
  "success",
  "pending",
  "failed",
  "unpaid",
] as const;
export type PaymentFilter = (typeof PAYMENT_FILTERS)[number];

export function parsePaymentFilter(value: Param): PaymentFilter {
  return oneOf(value, PAYMENT_FILTERS, "all");
}

// ---------------------------------------------------------------------------
// Users filters
// ---------------------------------------------------------------------------

/** Role filter. `all` is not a role — it is "do not filter by role". */
export const ROLE_FILTERS = ["all", "user", "admin", "super_admin"] as const;
export type RoleFilter = (typeof ROLE_FILTERS)[number];

export function parseRoleFilter(value: Param): RoleFilter {
  return oneOf(value, ROLE_FILTERS, "all");
}

/**
 * Affiliation filter. `unset` is the accounts created before the field
 * existed — a real and useful group to be able to list, since they are exactly
 * the people /complete-profile still has to catch.
 */
export const AFFILIATION_FILTERS = [
  "all",
  ...AFFILIATIONS.map((a) => a.value),
  "unset",
] as const;
export type AffiliationFilter = "all" | AffiliationValue | "unset";

export function parseAffiliationFilter(value: Param): AffiliationFilter {
  return oneOf(value, AFFILIATION_FILTERS, "all") as AffiliationFilter;
}

// ---------------------------------------------------------------------------
// Scalar parsers
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A `YYYY-MM-DD` bound from an `<input type="date">`.
 *
 * Shape-checked *and* calendar-checked: "2026-02-31" matches the regex but is
 * not a day, and letting it through would hand Prisma an Invalid Date, which
 * fails at the driver with something unreadable.
 */
export function parseDateParam(value: Param): string | undefined {
  const v = first(value);
  if (!v || !DATE_RE.test(v)) return undefined;
  const parsed = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  // Round-trip check: JS rolls 2026-02-31 forward to 2026-03-03 rather than
  // rejecting it, so compare what came back with what went in.
  return parsed.toISOString().slice(0, 10) === v ? v : undefined;
}

/** An id filter — must look like a UUID before it is worth a query. */
export function parseIdParam(value: Param): string | undefined {
  const v = first(value);
  return v && UUID_RE.test(v) ? v : undefined;
}

/** A free-text search term, length-capped so it cannot become a huge LIKE. */
export function parseSearchParam(value: Param): string | undefined {
  const v = first(value);
  return v ? v.slice(0, 80) : undefined;
}

export function parsePage(value: Param): number {
  const v = Number(first(value));
  if (!Number.isInteger(v) || v < 1) return 1;
  return Math.min(v, MAX_PAGE);
}

// ---------------------------------------------------------------------------
// Link building
// ---------------------------------------------------------------------------

/**
 * Build an admin-table URL from the *parsed* view state plus some overrides.
 *
 * Callers pass the normalised params, never the raw ones, so every link the
 * page emits carries only vocabulary this module recognises — a junk value
 * someone hand-typed is dropped the moment they click anything. Values equal to
 * `undefined` or `""` are omitted, which is what keeps the default view at a
 * bare `/admin/bookings` rather than a URL full of `&status=&court=`.
 */
export function buildAdminHref(
  basePath: string,
  current: Record<string, string | number | undefined>,
  overrides: Record<string, string | number | undefined> = {}
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Total pages for a row count — always at least 1, so "1 of 1" reads right. */
export function pageCountFor(
  total: number,
  pageSize = ADMIN_PAGE_SIZE
): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
