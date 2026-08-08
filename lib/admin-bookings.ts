import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import type { BookingStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  pageCountFor,
  type BookingSort,
  type PaymentFilter,
  type SortDirection,
} from "@/lib/admin-filters";
import { dateStringToDate } from "@/lib/time";

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
