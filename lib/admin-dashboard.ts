import "server-only";

import { prisma } from "@/lib/prisma";
import {
  dateStringToDate,
  dateToDateString,
  monthRange,
  todayString,
} from "@/lib/time";

/**
 * The numbers behind the admin Overview.
 *
 * **Reads only** — nothing here writes a booking; that stays in
 * `lib/booking-service.ts`. Everything is aggregated *in Postgres* (three
 * grouped queries and two counts), never by pulling rows into the function and
 * reducing them in JavaScript: a school's booking table grows without bound and
 * a dashboard that downloads it would get slower every month.
 *
 * ## The definitions, in one place
 *
 * A dashboard is only useful if every tile means something exact, so these are
 * stated once here and repeated to the admin on the page itself:
 *
 *  - **A booking that counts** is one whose status is `confirmed` or `pending`
 *    — the two that actually hold hours. `cancelled` and `expired` gave their
 *    hours back and are not business; `blocked` is an admin holding a court off
 *    sale, not a customer, so it is never counted as a booking and never as
 *    revenue. Blocked hours are still reported, separately, because they
 *    explain a month where utilisation looks low.
 *  - **Revenue is money actually received** — the sum of `Payment.amount` over
 *    successful payments only. Never `Booking.totalPrice`, which is a price
 *    list, not a bank statement. (`summariseAdminBookings` draws the same
 *    distinction for the printed report.)
 *  - **A month is the booking's month**, i.e. the month of `bookingDate`, not
 *    of `Payment.createdAt`. A court booked for September and paid for in
 *    August belongs to September in every tile on this page — that is what
 *    makes "revenue this month" and "bookings this month" describe the same set
 *    of bookings, and what makes the per-court table's columns add up.
 *  - **The month itself is the venue's**, from `todayString()` — Asia/Colombo,
 *    not the server's UTC. On the 1st of the month those differ.
 *  - **An hour is a `BookingSlot` row.** One slot template is exactly one
 *    bookable hour (see `schema.prisma`), and those rows exist only while the
 *    booking still holds the hours, so counting them cannot over-count a
 *    released booking.
 */

/** How many months the trend chart looks back over, including the current one. */
const TREND_MONTHS = 6;

/** Bookings that hold hours. See the definitions above. */
const LIVE_STATUSES = ["confirmed", "pending"] as const;

export type TrendPoint = {
  /** "2026-08" — the key, not for display. */
  month: string;
  /** "Aug" — the axis label. */
  label: string;
  bookings: number;
  revenue: number;
};

export type CourtPerformance = {
  id: string;
  name: string;
  typeName: string;
  isActive: boolean;
  bookings: number;
  bookedHours: number;
  blockedHours: number;
  revenue: number;
  /** Bookable hours this court offers this month, from its slot schedule. */
  capacityHours: number;
  /** 0–100, or null when the court has no schedule to be measured against. */
  utilisation: number | null;
};

export type AdminDashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

/** First day of the month `offset` months from the month `yyyymmdd` falls in. */
function shiftMonthStart(yyyymmdd: string, offset: number): string {
  const [year, month] = yyyymmdd.split("-").map(Number);
  return dateToDateString(new Date(Date.UTC(year, month - 1 + offset, 1)));
}

/**
 * Percentage change, or null when there is nothing to compare against.
 *
 * A month that follows a zero month has no meaningful percentage — "+∞%" or a
 * bare "+100%" both misinform — so the caller is handed null and says so in
 * words instead.
 */
function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * How many times each weekday falls inside an inclusive date range.
 *
 * This is what turns a *weekly* slot schedule into a *monthly* capacity: a
 * court with four Saturday slots offers 4 × (number of Saturdays) hours this
 * month. Counted by walking the days rather than with a formula, because a
 * month is at most 31 iterations and the formula version is where the
 * off-by-one lives.
 */
function weekdayOccurrences(from: string, to: string): number[] {
  const counts = new Array<number>(7).fill(0);
  const end = dateStringToDate(to);

  for (
    const day = dateStringToDate(from);
    day <= end;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    counts[day.getUTCDay()] += 1;
  }

  return counts;
}

type TrendRow = { month: string; bookings: number; revenue: number };

type CourtRow = {
  id: string;
  name: string;
  typeName: string;
  isActive: boolean;
  bookings: number;
  bookedHours: number;
  blockedHours: number;
  revenue: number;
};

/**
 * Everything the Overview renders, in five parallel queries.
 *
 * The KPI comparison does not query the previous month separately — the trend
 * series already spans it, so last month's figures are read out of that. One
 * source for both means the chart and the "vs last month" arrow can never
 * disagree, which is the failure mode that makes a dashboard stop being
 * trusted.
 */
export async function getAdminDashboard() {
  const today = todayString();
  const { from, to } = monthRange(today);
  const trendFrom = shiftMonthStart(today, -(TREND_MONTHS - 1));

  const [trendRows, courtRows, slotGroups, pendingHolds, refundsRequired] =
    await Promise.all([
      /*
        One row per month in the window, whether or not anything happened in it:
        `generate_series` supplies the months and the two aggregates are left-
        joined onto it, so a quiet month plots as a zero rather than vanishing
        and making the line lie about the gap.
      */
      prisma.$queryRaw<TrendRow[]>`
        WITH months AS (
          SELECT to_char(d, 'YYYY-MM') AS month
          FROM generate_series(${trendFrom}::date, ${to}::date, interval '1 month') AS d
        ),
        booked AS (
          SELECT to_char("bookingDate", 'YYYY-MM') AS month, COUNT(*)::int AS bookings
          FROM "Booking"
          WHERE "bookingDate" BETWEEN ${trendFrom}::date AND ${to}::date
            AND status IN ('confirmed', 'pending')
          GROUP BY 1
        ),
        paid AS (
          SELECT to_char(b."bookingDate", 'YYYY-MM') AS month,
                 SUM(p.amount)::float8 AS revenue
          FROM "Payment" p
          JOIN "Booking" b ON b.id = p."bookingId"
          WHERE p.status = 'success'
            AND b."bookingDate" BETWEEN ${trendFrom}::date AND ${to}::date
          GROUP BY 1
        )
        SELECT m.month,
               COALESCE(booked.bookings, 0)::int AS bookings,
               COALESCE(paid.revenue, 0)::float8 AS revenue
        FROM months m
        LEFT JOIN booked ON booked.month = m.month
        LEFT JOIN paid ON paid.month = m.month
        ORDER BY m.month
      `,

      /*
        This month, per court. Three independent aggregates joined onto the
        court list rather than one grouped join, because a booking has many
        slot rows and many payment rows: aggregating them in the same pass
        would multiply each by the other and report a court's revenue as
        (revenue × hours). Retired courts appear only if they saw activity —
        a court taken off sale mid-month still owes the month an explanation.
      */
      prisma.$queryRaw<CourtRow[]>`
        WITH live AS (
          SELECT "courtId", COUNT(*)::int AS bookings
          FROM "Booking"
          WHERE "bookingDate" BETWEEN ${from}::date AND ${to}::date
            AND status IN ('confirmed', 'pending')
          GROUP BY 1
        ),
        hours AS (
          SELECT bs."courtId",
                 (COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'pending')))::int AS booked,
                 (COUNT(*) FILTER (WHERE b.status = 'blocked'))::int AS blocked
          FROM "BookingSlot" bs
          JOIN "Booking" b ON b.id = bs."bookingId"
          WHERE bs."bookingDate" BETWEEN ${from}::date AND ${to}::date
          GROUP BY 1
        ),
        paid AS (
          SELECT b."courtId", SUM(p.amount)::float8 AS revenue
          FROM "Payment" p
          JOIN "Booking" b ON b.id = p."bookingId"
          WHERE p.status = 'success'
            AND b."bookingDate" BETWEEN ${from}::date AND ${to}::date
          GROUP BY 1
        )
        SELECT c.id,
               c.name,
               c."isActive" AS "isActive",
               ct.name AS "typeName",
               COALESCE(live.bookings, 0)::int AS bookings,
               COALESCE(hours.booked, 0)::int AS "bookedHours",
               COALESCE(hours.blocked, 0)::int AS "blockedHours",
               COALESCE(paid.revenue, 0)::float8 AS revenue
        FROM "Court" c
        JOIN "CourtType" ct ON ct.id = c."courtTypeId"
        LEFT JOIN live ON live."courtId" = c.id
        LEFT JOIN hours ON hours."courtId" = c.id
        LEFT JOIN paid ON paid."courtId" = c.id
        WHERE c."isActive"
           OR COALESCE(live.bookings, 0) > 0
           OR COALESCE(hours.booked, 0) > 0
        ORDER BY bookings DESC, c.name ASC
      `,

      // The whole weekly schedule, counted per court and weekday — a handful of
      // rows, which is all monthly capacity needs.
      prisma.slotTemplate.groupBy({
        by: ["courtId", "dayOfWeek"],
        where: { isActive: true, court: { isActive: true } },
        _count: { _all: true },
      }),

      // Both halves of "Needs attention" are deliberately NOT limited to this
      // month: an unpaid hold from three weeks ago and a refund owed since
      // last month are exactly the things that must not scroll out of view.
      prisma.booking.count({ where: { status: "pending" } }),
      prisma.booking.count({
        where: {
          status: "cancelled",
          payments: { some: { status: "success" } },
        },
      }),
    ]);

  const occurrences = weekdayOccurrences(from, to);

  const capacityByCourt = new Map<string, number>();
  for (const group of slotGroups) {
    const hours = group._count._all * occurrences[group.dayOfWeek];
    capacityByCourt.set(
      group.courtId,
      (capacityByCourt.get(group.courtId) ?? 0) + hours
    );
  }

  const courts: CourtPerformance[] = courtRows.map((row) => {
    const capacityHours = capacityByCourt.get(row.id) ?? 0;
    return {
      ...row,
      capacityHours,
      utilisation:
        capacityHours > 0 ? (row.bookedHours / capacityHours) * 100 : null,
    };
  });

  const trend: TrendPoint[] = trendRows.map((row) => ({
    ...row,
    label: new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      month: "short",
    }).format(dateStringToDate(`${row.month}-01`)),
  }));

  // The window always contains the current month last and last month before
  // it; a first-ever month simply has no previous point and no comparison.
  const current = trend.at(-1) ?? { bookings: 0, revenue: 0 };
  const previous = trend.length > 1 ? trend[trend.length - 2] : null;

  const bookedHours = courts.reduce((sum, c) => sum + c.bookedHours, 0);
  const blockedHours = courts.reduce((sum, c) => sum + c.blockedHours, 0);
  const capacityHours = courts.reduce((sum, c) => sum + c.capacityHours, 0);

  return {
    month: { from, to },
    trend,
    courts,
    bookings: {
      value: current.bookings,
      previous: previous?.bookings ?? null,
      changePercent: previous
        ? changePercent(current.bookings, previous.bookings)
        : null,
    },
    revenue: {
      value: current.revenue,
      previous: previous?.revenue ?? null,
      changePercent: previous
        ? changePercent(current.revenue, previous.revenue)
        : null,
    },
    utilisation: {
      percent: capacityHours > 0 ? (bookedHours / capacityHours) * 100 : null,
      bookedHours,
      blockedHours,
      capacityHours,
    },
    attention: {
      total: pendingHolds + refundsRequired,
      pendingHolds,
      refundsRequired,
    },
    /** Repeated to the admin on the page, so no tile is a number without a rule. */
    countedStatuses: LIVE_STATUSES,
  };
}
