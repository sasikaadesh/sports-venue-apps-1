import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AutoPrint, PrintButton } from "@/components/admin/print-controls";
import { requireAdmin } from "@/lib/auth";
import {
  PRINT_ROW_LIMIT,
  describeBookingFilters,
  listAdminBookingsForPrint,
  parseBookingView,
  summariseAdminBookings,
  type BookingSearchParams,
  type PrintBookingRow,
} from "@/lib/admin-bookings";
import { buildAdminHref } from "@/lib/admin-filters";
import {
  dateStringToDate,
  dateToTimeString,
  formatDate,
  formatDateTime,
  formatPrice,
} from "@/lib/time";

export const metadata = { title: "Bookings report — Admin" };

const PATH = "/admin/bookings/print";

/** How each sort column reads in the report's header line. */
const SORT_LABEL = {
  date: "date",
  court: "court",
  who: "who booked",
  status: "status",
  amount: "amount",
} as const;

/**
 * A printable report of the bookings currently filtered on /admin/bookings.
 *
 * **The same query string, the same query.** The Print button hands this page
 * the table's own URL, and `parseBookingView` parses it identically, so the
 * report is by construction the set the admin was looking at — filtered the
 * same way, sorted the same way. The one difference is paging: a report stops
 * at `PRINT_ROW_LIMIT`, not at 25, because a page of a list is not a report.
 *
 * Admin-only, like the table: `requireAdmin` here as well as in the layout,
 * since a layout is not a boundary.
 *
 * Everything about how this looks on paper lives in the `@media print` block in
 * `app/globals.css` — tokens redefined for the print medium, so this page is
 * written once and comes out black-on-white whichever theme the admin is using.
 * The only print-specific markup here is `print:hidden` on the two controls,
 * which exist for the screen and have no business on the sheet.
 */
export default async function BookingsPrintPage({
  searchParams,
}: {
  searchParams: Promise<BookingSearchParams>;
}) {
  await requireAdmin(PATH);

  const params = await searchParams;
  const { filters, sort, direction, view } = parseBookingView(params);

  const [{ rows, truncated }, summary, applied] = await Promise.all([
    listAdminBookingsForPrint({ filters, sort, direction }),
    summariseAdminBookings(filters),
    describeBookingFilters(filters),
  ]);

  // Back to the table exactly as it was left — same filters, same order.
  const backHref = buildAdminHref("/admin/bookings", view);

  const range =
    filters.from && filters.to
      ? `${formatDate(dateStringToDate(filters.from))} – ${formatDate(dateStringToDate(filters.to))}`
      : filters.from
        ? `From ${formatDate(dateStringToDate(filters.from))}`
        : filters.to
          ? `Up to ${formatDate(dateStringToDate(filters.to))}`
          : "All dates";

  return (
    <>
      <AutoPrint />

      {/* Screen-only controls. The report below is what reaches the paper. */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to bookings
        </Link>
        <PrintButton />
      </div>

      <article className="flex flex-col gap-6">
        {/* --- Masthead ------------------------------------------------- */}
        <header className="flex flex-col gap-1 border-b pb-4">
          <p className="font-heading text-xs font-bold tracking-widest uppercase">
            Courtside
          </p>
          <h1 className="text-2xl leading-none">Bookings report</h1>
          <p className="text-sm text-muted-foreground">
            {range} · generated {formatDateTime(new Date())}
          </p>
        </header>

        {/* --- What this is a report of --------------------------------- */}
        <section className="flex flex-col gap-1.5 text-sm">
          <h2 className="text-xs font-bold tracking-widest uppercase">
            Filters applied
          </h2>
          {applied.length === 0 ? (
            <p className="text-muted-foreground">
              None beyond the date range above — every booking and admin block
              in the period.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {applied.map((item) => (
                <li key={item.label}>
                  <span className="text-muted-foreground">{item.label}: </span>
                  <span className="font-medium capitalize">{item.value}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground">
            Sorted by {SORT_LABEL[sort]},{" "}
            {direction === "asc" ? "ascending" : "descending"}.
          </p>
        </section>

        {/* --- Summary --------------------------------------------------
            Counted over the whole filtered set in Postgres, not summed from
            the rows below — see `summariseAdminBookings`. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold tracking-widest uppercase">
            Summary
          </h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4 print:gap-0 print:rounded-none print:bg-transparent">
            <Figure label="Bookings shown" value={summary.total} />
            <Figure
              label="Confirmed"
              value={summary.confirmed}
              note={`${summary.pending} pending`}
            />
            <Figure
              label="Value of live bookings"
              value={formatPrice(summary.bookedValue)}
              note="pending + confirmed, at list price"
            />
            <Figure
              label="Payments received"
              value={formatPrice(summary.paidValue)}
              note={`${summary.paidCount} successful ${summary.paidCount === 1 ? "payment" : "payments"}`}
            />
          </dl>
          <p className="text-xs text-muted-foreground">
            Also in the period: {summary.cancelled} cancelled, {summary.expired}{" "}
            expired, {summary.blocked} admin{" "}
            {summary.blocked === 1 ? "block" : "blocks"}. Cancelled, expired and
            blocked rows are excluded from the value figure — a block was never
            money, and a released booking is not revenue.
          </p>
        </section>

        {/* --- The rows -------------------------------------------------- */}
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed px-5 py-8 text-sm text-muted-foreground print:rounded-none">
            Nothing matched these filters, so there is nothing to print. Go back
            and widen the date range.
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-foreground/70">
                <Th>Date</Th>
                <Th>Time</Th>
                <Th>Court</Th>
                <Th>Booked by</Th>
                <Th align="right">Players</Th>
                <Th>Status</Th>
                <Th align="right">Value</Th>
                <Th>Payment</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((booking) => (
                <ReportRow key={booking.id} booking={booking} />
              ))}
            </tbody>
          </table>
        )}

        {truncated && (
          <p className="text-sm font-medium">
            This report stops at the first {PRINT_ROW_LIMIT} rows. The summary
            above still covers all {summary.total} — narrow the date range to
            list every one of them.
          </p>
        )}

        <footer className="border-t pt-3 text-xs text-muted-foreground">
          Courtside · internal booking report · generated{" "}
          {formatDateTime(new Date())}. Figures are as at the moment of
          printing.
        </footer>
      </article>
    </>
  );
}

/** One row of the report. */
function ReportRow({ booking }: { booking: PrintBookingRow }) {
  const first = booking.slots[0];
  const last = booking.slots[booking.slots.length - 1];
  const payment = booking.payments[0];
  const isBlock = booking.status === "blocked";

  return (
    <tr className="border-b border-border">
      <Td>{formatDate(booking.bookingDate)}</Td>
      <Td className="font-mono text-xs">
        {first && last
          ? `${dateToTimeString(first.slot.startTime)}–${dateToTimeString(last.slot.endTime)}`
          : "released"}
      </Td>
      <Td>{booking.court.name}</Td>
      <Td>
        {isBlock
          ? "Admin block"
          : (booking.user?.name ?? booking.user?.email ?? "—")}
      </Td>
      <Td align="right">{isBlock ? "—" : booking.playerCount}</Td>
      {/* Plain text, not the screen's colour-coded badge: a printer drops
          background fills, so a badge prints as a word in a faint box at best
          and an invisible word at worst. */}
      <Td className="capitalize">{booking.status}</Td>
      <Td align="right">
        {isBlock ? "—" : formatPrice(booking.totalPrice.toString())}
      </Td>
      <Td>
        {payment
          ? `${payment.status} · ${formatPrice(payment.amount.toString())}`
          : isBlock
            ? "—"
            : "unpaid"}
      </Td>
    </tr>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-2 py-1.5 text-xs font-bold tracking-wide uppercase ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`px-2 py-1.5 align-top ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

/** One number in the summary strip. */
function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="bg-card px-4 py-3 print:border print:border-border print:px-3 print:py-2">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-heading text-xl font-bold tabular-nums">
        {value}
      </dd>
      {note && <dd className="mt-0.5 text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}
