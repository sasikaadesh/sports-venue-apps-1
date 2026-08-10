import "server-only";

import {
  PRINT_ROW_LIMIT,
  describeBookingFilters,
  listAdminBookingsForPrint,
  summariseAdminBookings,
  type BookingFilters,
} from "@/lib/admin-bookings";
import type { BookingSort, SortDirection } from "@/lib/admin-filters";
import {
  dateStringToDate,
  dateToTimeString,
  formatDate,
  formatDateTime,
  formatPrice,
} from "@/lib/time";

/**
 * The bookings report, as data.
 *
 * There are two renderers — the printable HTML page at /admin/bookings/print
 * and the PDF built by /api/admin/bookings/report — and they must produce the
 * *same report*, not two reports that happen to look alike. So neither of them
 * queries or formats anything: they both render this structure, which is built
 * once, here, from the same `where`/`orderBy` the on-screen table uses.
 *
 * That is what makes "Print and Export PDF output exactly what you are looking
 * at" a property of the code rather than a promise. A column added below
 * appears in both; a total changed below changes in both.
 *
 * Everything is pre-formatted to a display string. A renderer that has to
 * decide how to format a price is a renderer that can disagree with the other
 * one — and one of the two (react-pdf) has no CSS to fall back on.
 */

/** How each sort column reads in the report's header line. */
const SORT_LABEL: Record<BookingSort, string> = {
  date: "date",
  court: "court",
  who: "who booked",
  status: "status",
  amount: "amount",
};

export type ReportAlign = "left" | "right";

export type ReportColumn = {
  key: keyof ReportRow & string;
  label: string;
  align: ReportAlign;
  /** Share of the table width, as a fraction. Used by the PDF, which has no table layout algorithm. */
  width: number;
};

/**
 * The report's columns, in order.
 *
 * The widths only matter to the PDF renderer — react-pdf lays a "table" out as
 * flex rows and cannot measure content the way a browser can, so each column
 * is given its share explicitly. They sum to 1.
 */
export const REPORT_COLUMNS: readonly ReportColumn[] = [
  { key: "date", label: "Date", align: "left", width: 0.12 },
  { key: "time", label: "Time", align: "left", width: 0.11 },
  { key: "court", label: "Court", align: "left", width: 0.15 },
  { key: "who", label: "Booked by", align: "left", width: 0.2 },
  { key: "players", label: "Players", align: "right", width: 0.06 },
  { key: "status", label: "Status", align: "left", width: 0.09 },
  { key: "value", label: "Value", align: "right", width: 0.12 },
  // The widest cell in the table — "success · LKR 4,000.00" — so it gets the
  // room the narrow numeric columns do not need.
  { key: "payment", label: "Payment", align: "left", width: 0.15 },
];

export type ReportRow = {
  id: string;
  date: string;
  time: string;
  court: string;
  who: string;
  players: string;
  status: string;
  value: string;
  payment: string;
};

export type ReportFigure = { label: string; value: string; note?: string };

export type BookingReport = {
  brand: string;
  title: string;
  /** The date range in words — the report's subject, before any other filter. */
  range: string;
  generatedAt: string;
  /** Filters beyond the date range, resolved to names. Empty when none are set. */
  applied: { label: string; value: string }[];
  sortLine: string;
  figures: ReportFigure[];
  summaryNote: string;
  rows: ReportRow[];
  /** True when the row list stopped at `rowLimit` — the totals above still cover everything. */
  truncated: boolean;
  rowLimit: number;
  /** Every booking matching the filters, however many rows are listed. */
  totalCount: number;
};

/**
 * A date range in the order a human would read it.
 *
 * The query swaps a backwards range rather than returning nothing (see
 * `bookingWhere`), so the report has to describe the range that was actually
 * used, not the one that was typed.
 */
function orderedRange(filters: BookingFilters): {
  from?: string;
  to?: string;
} {
  let { from, to } = filters;
  if (from && to && from > to) [from, to] = [to, from];
  return { from, to };
}

/** The range as a heading line: "1 Aug 2026 – 31 Aug 2026", "All dates", … */
function describeRange(filters: BookingFilters): string {
  const { from, to } = orderedRange(filters);

  if (from && to) {
    return `${formatDate(dateStringToDate(from))} – ${formatDate(dateStringToDate(to))}`;
  }
  if (from) return `From ${formatDate(dateStringToDate(from))}`;
  if (to) return `Up to ${formatDate(dateStringToDate(to))}`;
  return "All dates";
}

/**
 * The download's file name, keyed by the range it covers.
 *
 * A whole calendar month — which is what the table opens on and what the office
 * asks for — collapses to `bookings-2026-08.pdf`, so a year of monthly reports
 * sorts correctly in a folder. Anything else spells its bounds out rather than
 * pretending to be a month.
 */
export function bookingReportFileName(filters: BookingFilters): string {
  const { from, to } = orderedRange(filters);

  if (from && to) {
    const month = from.slice(0, 7);
    // A full calendar month: the 1st through the last day of the same month.
    const isWholeMonth =
      from.endsWith("-01") &&
      to.startsWith(month) &&
      // Day after `to` is in the next month, i.e. `to` is the last day.
      new Date(`${to}T00:00:00Z`).getUTCMonth() !==
        new Date(
          new Date(`${to}T00:00:00Z`).getTime() + 86_400_000
        ).getUTCMonth();

    return isWholeMonth
      ? `bookings-${month}.pdf`
      : `bookings-${from}-to-${to}.pdf`;
  }

  if (from) return `bookings-from-${from}.pdf`;
  if (to) return `bookings-to-${to}.pdf`;
  return "bookings-all-dates.pdf";
}

/**
 * Build the report for a filtered, sorted view.
 *
 * The three queries are independent — the rows, the totals and the names behind
 * the filter ids — so they run together.
 */
export async function buildBookingReport({
  filters,
  sort,
  direction,
}: {
  filters: BookingFilters;
  sort: BookingSort;
  direction: SortDirection;
}): Promise<BookingReport> {
  const [{ rows, truncated }, summary, applied] = await Promise.all([
    listAdminBookingsForPrint({ filters, sort, direction }),
    summariseAdminBookings(filters),
    describeBookingFilters(filters),
  ]);

  // One timestamp for the whole document, used in both the masthead and the
  // footer. Two calls to `new Date()` can straddle a minute boundary and print
  // a report that says it was generated at two different times.
  const generatedAt = formatDateTime(new Date());

  return {
    brand: "Courtside",
    title: "Bookings report",
    range: describeRange(filters),
    generatedAt,
    applied,
    sortLine: `Sorted by ${SORT_LABEL[sort]}, ${
      direction === "asc" ? "ascending" : "descending"
    }.`,
    figures: [
      { label: "Bookings shown", value: String(summary.total) },
      {
        label: "Confirmed",
        value: String(summary.confirmed),
        note: `${summary.pending} pending`,
      },
      {
        label: "Value of live bookings",
        value: formatPrice(summary.bookedValue),
        note: "pending + confirmed, at list price",
      },
      {
        label: "Payments received",
        value: formatPrice(summary.paidValue),
        note: `${summary.paidCount} successful ${
          summary.paidCount === 1 ? "payment" : "payments"
        }`,
      },
    ],
    summaryNote:
      `Also in the period: ${summary.cancelled} cancelled, ${summary.expired} expired, ` +
      `${summary.blocked} admin ${summary.blocked === 1 ? "block" : "blocks"}. ` +
      "Cancelled, expired and blocked rows are excluded from the value figure — a block " +
      "was never money, and a released booking is not revenue.",
    rows: rows.map((booking): ReportRow => {
      const first = booking.slots[0];
      const last = booking.slots[booking.slots.length - 1];
      const payment = booking.payments[0];
      const isBlock = booking.status === "blocked";

      return {
        id: booking.id,
        date: formatDate(booking.bookingDate),
        time:
          first && last
            ? `${dateToTimeString(first.slot.startTime)}–${dateToTimeString(last.slot.endTime)}`
            : "released",
        court: booking.court.name,
        who: isBlock
          ? "Admin block"
          : (booking.user?.name ?? booking.user?.email ?? "—"),
        players: isBlock ? "—" : String(booking.playerCount),
        status: booking.status,
        value: isBlock ? "—" : formatPrice(booking.totalPrice.toString()),
        payment: payment
          ? `${payment.status} · ${formatPrice(payment.amount.toString())}`
          : isBlock
            ? "—"
            : "unpaid",
      };
    }),
    truncated,
    rowLimit: PRINT_ROW_LIMIT,
    totalCount: summary.total,
  };
}
