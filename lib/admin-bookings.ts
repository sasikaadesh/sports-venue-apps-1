import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import type { BookingStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  BOOKING_SORT_DEFAULT_DIRECTION,
  pageCountFor,
  parseBookingSort,
  parseDateParam,
  parseIdParam,
  parsePage,
  parsePaymentFilter,
  parseSearchParam,
  parseSortDirection,
  type BookingSort,
  type PaymentFilter,
  type SortDirection,
} from "@/lib/admin-filters";
import { dateStringToDate, monthRange, todayString } from "@/lib/time";

/**
 * The read side of the admin Bookings table.
 *
 * **Reads only.** Nothing here writes a booking — every booking write still
 * goes through `lib/booking-service.ts`, which owns the status transitions and
 * the anti-double-booking constraint. This module exists so that filtering,
 * sorting and paging happen *in Postgres* rather than by downloading the whole
 * table and hiding rows in the browser. The page renders at most
 * `ADMIN_PAGE_SIZE` rows however many bookings the venue has taken.
 *
 * Every filter maps onto an index the schema already carries:
 * `[bookingDate, status]` for the date range and status chips, `[courtId,
 * bookingDate]` for the court dropdown, `[userId]` for the who dropdown, and
 * `Payment[bookingId]` for the payment-state filter.
 */

export type BookingFilters = {
  status?: BookingStatus;
  courtId?: string;
  userId?: string;
  /**
   * Free text from the Who box when it did not resolve to an account — matched
   * against name and email. Ignored while `userId` is set: an id is exact, and
   * the two would only ever disagree.
   */
  userQuery?: string;
  payment: PaymentFilter;
  /** Inclusive `YYYY-MM-DD` bounds on `bookingDate`. */
  from?: string;
  to?: string;
};

/** The statuses a booking can be filtered by — the whole enum, in lifecycle order. */
export const BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
  "blocked",
  "expired",
];

/** The raw query string of /admin/bookings, before any of it is trusted. */
export type BookingSearchParams = {
  status?: string;
  court?: string;
  user?: string;
  uq?: string;
  pay?: string;
  from?: string;
  to?: string;
  dates?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

/**
 * The whole view state of the Bookings table, parsed once.
 *
 * Shared by the table and its print view so the two cannot drift: the Print
 * button hands the print page the same query string, and both read it through
 * here.
 *
 * ## The month default, and how it stays escapable
 *
 * Arriving at /admin/bookings with no date range in the URL lands on the
 * **current month**, because "this month's bookings" is the report the office
 * actually asks for and it should not cost four clicks. That default must not
 * become a cage, though: if an empty `from`/`to` always meant "this month",
 * clearing the two date fields would silently re-apply it and there would be no
 * way to see the whole table.
 *
 * So the filter form carries a hidden `dates=set` field. Its presence means
 * "the date fields in this URL are deliberate, empty or not", and defaulting is
 * skipped. A bare `/admin/bookings` — the nav link, a bookmark, Reset
 * filters — has no such marker and gets the month.
 */
export function parseBookingView(params: BookingSearchParams) {
  let from = parseDateParam(params.from);
  let to = parseDateParam(params.to);

  // Only a URL that has never been through the filter form gets defaulted.
  const monthDefault = params.dates !== "set" && !from && !to;
  if (monthDefault) ({ from, to } = monthRange(todayString()));

  const filters: BookingFilters = {
    status: BOOKING_STATUSES.includes(params.status as BookingStatus)
      ? (params.status as BookingStatus)
      : undefined,
    courtId: parseIdParam(params.court),
    userId: parseIdParam(params.user),
    userQuery: parseSearchParam(params.uq),
    payment: parsePaymentFilter(params.pay),
    from,
    to,
  };

  const sort = parseBookingSort(params.sort);
  const direction = parseSortDirection(
    params.dir,
    BOOKING_SORT_DEFAULT_DIRECTION[sort]
  );

  // The canonical, sanitised view state. Every link on the page is built from
  // this, so junk someone hand-typed into the URL is dropped the moment they
  // click anything, and no link can carry a value the parsers would reject.
  const view = {
    status: filters.status,
    court: filters.courtId,
    user: filters.userId,
    // Only one of the two is ever set — see `FilterCombobox`.
    uq: filters.userId ? undefined : filters.userQuery,
    pay: filters.payment === "all" ? undefined : filters.payment,
    from: filters.from,
    to: filters.to,
    // Carried only when the range is deliberately empty — otherwise `from`/`to`
    // speak for themselves and the marker would be noise in every URL.
    dates: !filters.from && !filters.to ? "set" : undefined,
    sort,
    dir: direction,
  };

  return {
    filters,
    sort,
    direction,
    page: parsePage(params.page),
    monthDefault,
    view,
    /**
     * Whether the admin has narrowed anything *themselves*. The month default
     * is the resting state of this page, not a filter someone applied, so it
     * does not light up "Reset filters" or turn an empty month into "nothing
     * matches your filters".
     */
    isFiltered: hasActiveBookingFilters(
      monthDefault ? { ...filters, from: undefined, to: undefined } : filters
    ),
  };
}

/** True when the view is narrowed at all — drives "Reset filters" and the empty state. */
export function hasActiveBookingFilters(filters: BookingFilters): boolean {
  return Boolean(
    filters.status ||
    filters.courtId ||
    filters.userId ||
    filters.userQuery ||
    filters.from ||
    filters.to ||
    filters.payment !== "all"
  );
}

/**
 * Payment state → a `where` fragment.
 *
 * A booking may have several `Payment` attempts, so these are phrased about the
 * set, not about "the latest row":
 *
 *   success — one attempt succeeded. That is terminal: `notify_url` only ever
 *             writes success once, so this is also what the table's badge shows.
 *   pending — an attempt is still open and none has succeeded (someone is at
 *             the PayHere checkout, or abandoned it there).
 *   failed  — every attempt failed or was cancelled.
 *   unpaid  — no attempt at all. Admin blocks are excluded: a block is not a
 *             thing anyone owes money for, and listing every block under
 *             "unpaid" would bury the bookings this filter exists to find.
 */
function paymentWhere(filter: PaymentFilter): Prisma.BookingWhereInput {
  switch (filter) {
    case "success":
      return { payments: { some: { status: "success" } } };
    case "pending":
      return {
        payments: { some: { status: "pending" }, none: { status: "success" } },
      };
    case "failed":
      return {
        payments: {
          some: { status: { in: ["failed", "cancelled"] } },
          none: { status: { in: ["success", "pending"] } },
        },
      };
    case "unpaid":
      return { payments: { none: {} }, status: { not: "blocked" } };
    case "all":
      return {};
  }
}

/**
 * Every active filter, ANDed.
 *
 * Built as a list rather than one merged object so two filters can constrain
 * the same field without silently overwriting each other — "unpaid" already
 * says `status is not blocked`, and adding the "blocked" chip on top must
 * produce a contradiction that finds nothing, not quietly drop one of the two.
 */
function bookingWhere(filters: BookingFilters): Prisma.BookingWhereInput {
  const conditions: Prisma.BookingWhereInput[] = [
    paymentWhere(filters.payment),
  ];

  if (filters.status) conditions.push({ status: filters.status });
  if (filters.courtId) conditions.push({ courtId: filters.courtId });
  if (filters.userId) {
    conditions.push({ userId: filters.userId });
  } else if (filters.userQuery) {
    // The Who box was typed into but matched nobody in the (capped) list, so
    // search the accounts themselves. Case-insensitive substring on both
    // display fields — an admin has half a name, not a prefix.
    conditions.push({
      user: {
        OR: [
          { name: { contains: filters.userQuery, mode: "insensitive" } },
          { email: { contains: filters.userQuery, mode: "insensitive" } },
        ],
      },
    });
  }

  if (filters.from || filters.to) {
    // A backwards range is a mis-click, not a request for nothing. Swap it so
    // the admin gets the range they plainly meant.
    let { from, to } = filters;
    if (from && to && from > to) [from, to] = [to, from];

    conditions.push({
      bookingDate: {
        ...(from ? { gte: dateStringToDate(from) } : {}),
        ...(to ? { lte: dateStringToDate(to) } : {}),
      },
    });
  }

  return { AND: conditions };
}

/**
 * Sort column → `orderBy`.
 *
 * Every sort gets a stable tie-breaker. Without one, Postgres is free to return
 * rows with equal keys in a different order on each request, which shows up as
 * a row appearing on both page 2 and page 3 — the classic unstable-pagination
 * bug rather than anything to do with the filters.
 *
 * **Amount sorts by `Booking.totalPrice`, not `Payment.amount`.** The two are
 * the same number — the payment is created from the booking total on the server
 * and the client never supplies a price — but only `totalPrice` is a column on
 * the row being sorted. Ordering by "the amount of the most recent payment in a
 * to-many relation" is not something Prisma can express, and doing it in memory
 * would mean loading every booking to sort one page of them.
 *
 * **Who sorts by the account, not by what the cell prints.** A block's cell
 * reads "— admin block —", but the row belongs to the admin who made it, so
 * blocks sort under that admin's name rather than clumping together. Name first
 * and email second, because the table shows whichever it has; rows with no
 * account at all (legacy imports) land at the end of an A–Z sort, where
 * Postgres puts NULLs.
 *
 * **Status sorts by the enum's declared order**, which is the booking
 * lifecycle — see `BOOKING_SORT_DEFAULT_DIRECTION`. Alphabetical would put
 * "blocked" before "confirmed" and mean nothing.
 */
function bookingOrderBy(
  sort: BookingSort,
  direction: SortDirection
): Prisma.BookingOrderByWithRelationInput[] {
  switch (sort) {
    case "court":
      return [
        { court: { name: direction } },
        { bookingDate: "desc" },
        { id: "asc" },
      ];
    case "who":
      return [
        { user: { name: direction } },
        { user: { email: direction } },
        { bookingDate: "desc" },
        { id: "asc" },
      ];
    case "status":
      return [{ status: direction }, { bookingDate: "desc" }, { id: "asc" }];
    case "amount":
      return [
        { totalPrice: direction },
        { bookingDate: "desc" },
        { id: "asc" },
      ];
    case "date":
      return [{ bookingDate: direction }, { createdAt: "desc" }, { id: "asc" }];
  }
}

export type AdminBookingRow = Awaited<
  ReturnType<typeof listAdminBookings>
>["rows"][number];

/** One page of bookings, plus the totals the pager needs. */
export async function listAdminBookings({
  filters,
  sort,
  direction,
  page,
}: {
  filters: BookingFilters;
  sort: BookingSort;
  direction: SortDirection;
  page: number;
}) {
  const where = bookingWhere(filters);

  // Count and page in parallel — the count drives the pager and neither query
  // depends on the other.
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: bookingOrderBy(sort, direction),
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        bookingDate: true,
        playerCount: true,
        durationHours: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        court: { select: { name: true } },
        // The hours this booking holds, in clock order. A released booking
        // (cancelled/expired) has none — it gave its hours back.
        slots: {
          orderBy: { slot: { startTime: "asc" } },
          select: {
            id: true,
            slot: { select: { startTime: true, endTime: true } },
          },
        },
        user: { select: { name: true, email: true } },
        // Latest payment attempt is the one whose status matters.
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, amount: true },
        },
        // Whether the booking has EVER been paid, which is not the same
        // question as the latest attempt's status and is what decides whether
        // "Remove" is offered. A cancelled booking can still carry a successful
        // payment — `adminCancelBooking` leaves it as the record of what was
        // charged — and that row must never be deleted. Counted rather than
        // fetched: the row itself is not needed, only whether one exists.
        _count: { select: { payments: { where: { status: "success" } } } },
      },
    }),
  ]);

  return { rows, total, pageCount: pageCountFor(total) };
}

/**
 * How many rows one printed report will carry.
 *
 * The print view deliberately ignores paging — a report that stops at row 25
 * is not a report — but it cannot be unbounded either: this runs in a Vercel
 * function and renders to a single HTML document. 1,000 rows is roughly 25
 * printed pages, far past anything a month of one venue's bookings produces,
 * and the page says so plainly when it is reached rather than quietly printing
 * a partial total.
 */
export const PRINT_ROW_LIMIT = 1000;

export type PrintBookingRow = Awaited<
  ReturnType<typeof listAdminBookingsForPrint>
>["rows"][number];

/**
 * Every row matching the filters, in the chosen order, for the print view.
 *
 * Same `where` and same `orderBy` as the on-screen table — that is the whole
 * promise of the Print button: what you filtered and sorted is what comes out
 * of the printer. Only the `select` differs, and only by dropping what a paper
 * report has no use for.
 */
export async function listAdminBookingsForPrint({
  filters,
  sort,
  direction,
}: {
  filters: BookingFilters;
  sort: BookingSort;
  direction: SortDirection;
}) {
  const rows = await prisma.booking.findMany({
    where: bookingWhere(filters),
    orderBy: bookingOrderBy(sort, direction),
    // One over the limit, so "there are more" can be detected without a
    // second count.
    take: PRINT_ROW_LIMIT + 1,
    select: {
      id: true,
      bookingDate: true,
      playerCount: true,
      durationHours: true,
      totalPrice: true,
      status: true,
      court: { select: { name: true } },
      slots: {
        orderBy: { slot: { startTime: "asc" } },
        select: {
          id: true,
          slot: { select: { startTime: true, endTime: true } },
        },
      },
      user: { select: { name: true, email: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, amount: true },
      },
    },
  });

  const truncated = rows.length > PRINT_ROW_LIMIT;
  return { rows: truncated ? rows.slice(0, PRINT_ROW_LIMIT) : rows, truncated };
}

export type BookingReportSummary = Awaited<
  ReturnType<typeof summariseAdminBookings>
>;

/**
 * The report's totals, counted in Postgres over the *whole* filtered set.
 *
 * Deliberately not summed from the rows above: those are capped, and a total
 * that silently stopped at the cap is worse than no total. Two queries —
 *
 *   - a `groupBy(status)` for how many bookings of each kind and what they are
 *     worth at list price (`Booking.totalPrice`, the frozen figure);
 *   - a sum over successful `Payment` rows for what was actually **received**.
 *
 * The two answer different questions and a report needs both: the first is what
 * was booked, the second is what is in the bank.
 */
export async function summariseAdminBookings(filters: BookingFilters) {
  const where = bookingWhere(filters);

  const [byStatus, paid] = await Promise.all([
    prisma.booking.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalPrice: true },
    }),
    prisma.payment.aggregate({
      where: { status: "success", booking: where },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const count = (status: BookingStatus) =>
    byStatus.find((g) => g.status === status)?._count._all ?? 0;

  const total = byStatus.reduce((sum, g) => sum + g._count._all, 0);

  // Value of the bookings that still stand — a cancelled or expired row is not
  // revenue, and a block was never money in the first place.
  const bookedValue = byStatus
    .filter((g) => g.status === "pending" || g.status === "confirmed")
    .reduce((sum, g) => sum + Number(g._sum.totalPrice ?? 0), 0);

  return {
    total,
    pending: count("pending"),
    confirmed: count("confirmed"),
    cancelled: count("cancelled"),
    expired: count("expired"),
    blocked: count("blocked"),
    bookedValue,
    paidValue: Number(paid._sum.amount ?? 0),
    paidCount: paid._count._all,
  };
}

const PAYMENT_FILTER_LABEL: Record<PaymentFilter, string> = {
  all: "Any",
  success: "Paid",
  pending: "Awaiting payment",
  failed: "Failed or cancelled payment",
  unpaid: "No payment attempt",
};

/**
 * The active filters, written out for the top of a printed report.
 *
 * A report that does not say what it is a report *of* is a page of numbers
 * someone will have to re-derive in a meeting. Ids are resolved to names here —
 * "Court: Tennis Court 1", not a UUID — which is the one thing the on-screen
 * bar gets for free from its dropdowns and paper does not.
 */
export async function describeBookingFilters(
  filters: BookingFilters
): Promise<{ label: string; value: string }[]> {
  const [court, user] = await Promise.all([
    filters.courtId
      ? prisma.court.findUnique({
          where: { id: filters.courtId },
          select: { name: true },
        })
      : null,
    filters.userId
      ? prisma.user.findUnique({
          where: { id: filters.userId },
          select: { name: true, email: true },
        })
      : null,
  ]);

  const applied: { label: string; value: string }[] = [];

  if (filters.status) applied.push({ label: "Status", value: filters.status });
  if (filters.courtId) {
    applied.push({ label: "Court", value: court?.name ?? "unknown court" });
  }
  if (filters.userId) {
    applied.push({
      label: "Booked by",
      value: user ? (user.name ?? user.email) : "unknown account",
    });
  } else if (filters.userQuery) {
    applied.push({
      label: "Booked by",
      value: `matching “${filters.userQuery}”`,
    });
  }
  if (filters.payment !== "all") {
    applied.push({
      label: "Payment",
      value: PAYMENT_FILTER_LABEL[filters.payment],
    });
  }

  return applied;
}

export type BookingFilterOptions = Awaited<
  ReturnType<typeof getBookingFilterOptions>
>;

/**
 * The contents of the Court and Who dropdowns.
 *
 * Both are deliberately *not* read through `lib/catalogue.ts`. That cache holds
 * only **active** courts, and a booking taken last month against a court since
 * retired must still be filterable — otherwise the row is visible in the table
 * but unreachable by its own filter.
 *
 * The people list is only accounts that have actually booked something, which
 * keeps it to a useful length instead of every account ever created. It is
 * capped, and the cap is not a hole: the Who control is a combobox, and a name
 * past the cap can still be typed into it — the text goes to `userQuery`, which
 * searches the accounts table rather than this list. So the cap bounds the
 * payload, not what an admin can find.
 */
export async function getBookingFilterOptions() {
  const [courts, users] = await Promise.all([
    prisma.court.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.user.findMany({
      where: { bookings: { some: {} } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 300,
      select: { id: true, name: true, email: true },
    }),
  ]);

  return { courts, users };
}
