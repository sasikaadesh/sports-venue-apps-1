import "server-only";

import { prisma } from "@/lib/prisma";
import type { BookingStatus } from "@/lib/generated/prisma/enums";
import { COURT_DISPLAY_ORDER } from "@/lib/catalogue";
import type { LegendCourt } from "@/components/court-legend";
import {
  addDays,
  dateStringToDate,
  dateToTimeString,
  dayOfWeekForDate,
  todayString,
} from "@/lib/time";

/**
 * Read side of the `/bookings` overview — the one page security staff may
 * reach (`lib/security-staff/auth.ts`). Reads only, same as
 * `lib/admin-bookings.ts`; every booking write still goes through
 * `lib/booking-service.ts`.
 */

export type BookingsOverviewTab = "today" | "week";

/**
 * The statuses worth a guard's attention. `cancelled` and `expired` hold no
 * hours and nobody is coming for them, so they would only be noise on a page
 * whose job is "who is arriving"; `blocked` is kept so the grid also explains
 * an hour with nobody booked against it.
 */
const VISIBLE_STATUSES: BookingStatus[] = ["pending", "confirmed", "blocked"];

/** Monday–Sunday containing `todayStr`, at the venue's wall clock. */
export function weekRangeContaining(todayStr: string): {
  start: string;
  end: string;
} {
  // dayOfWeekForDate: 0=Sun..6=Sat. Days since the most recent Monday.
  const dow = dayOfWeekForDate(dateStringToDate(todayStr));
  const daysSinceMonday = (dow + 6) % 7;
  const start = addDays(todayStr, -daysSinceMonday);
  return { start, end: addDays(start, 6) };
}

export type BookingsOverviewRow = {
  id: string;
  bookingDate: Date;
  status: BookingStatus;
  bookingReference: string | null;
  courtName: string;
  courtColor: string;
  name: string;
  contact: string;
  startTime: string | null;
  endTime: string | null;
};

export type BookingsOverview = {
  rows: BookingsOverviewRow[];
  range: { from: string; to: string };
};

export async function getBookingsOverview(
  tab: BookingsOverviewTab
): Promise<BookingsOverview> {
  const today = todayString();
  const range =
    tab === "today" ? { start: today, end: today } : weekRangeContaining(today);

  const bookings = await prisma.booking.findMany({
    where: {
      bookingDate: {
        gte: dateStringToDate(range.start),
        lte: dateStringToDate(range.end),
      },
      status: { in: VISIBLE_STATUSES },
    },
    select: {
      id: true,
      bookingDate: true,
      status: true,
      bookingReference: true,
      court: { select: { name: true, color: true } },
      user: { select: { name: true, email: true, phone: true } },
      slots: {
        orderBy: { slot: { startTime: "asc" } },
        select: { slot: { select: { startTime: true, endTime: true } } },
      },
    },
  });

  const rows: BookingsOverviewRow[] = bookings.map((b) => {
    const first = b.slots[0]?.slot;
    const last = b.slots.at(-1)?.slot;

    return {
      id: b.id,
      bookingDate: b.bookingDate,
      status: b.status,
      bookingReference: b.bookingReference,
      courtName: b.court.name,
      courtColor: b.court.color,
      name:
        b.status === "blocked"
          ? "— Admin block —"
          : (b.user?.name ?? b.user?.email ?? "—"),
      contact: b.status === "blocked" ? "—" : (b.user?.phone ?? "—"),
      startTime: first ? dateToTimeString(first.startTime) : null,
      endTime: last ? dateToTimeString(last.endTime) : null,
    };
  });

  // Chronological: the day first (matters for the week view), then the hour.
  rows.sort((a, b) => {
    const byDate = a.bookingDate.getTime() - b.bookingDate.getTime();
    if (byDate !== 0) return byDate;
    return (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99");
  });

  return { rows, range: { from: range.start, to: range.end } };
}

/**
 * The colour key for the `/bookings` legend — every active court, in the same
 * order the rest of the app lists them. Deliberately not scoped to "only
 * courts with a booking in this view": the legend would otherwise change
 * shape between the Today and This week tabs, which is more confusing than a
 * couple of unused entries.
 */
export async function getCourtLegend(): Promise<LegendCourt[]> {
  return prisma.court.findMany({
    where: { isActive: true },
    orderBy: COURT_DISPLAY_ORDER,
    select: { id: true, name: true, color: true },
  });
}
