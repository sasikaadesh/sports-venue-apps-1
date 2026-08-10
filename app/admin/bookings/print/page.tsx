import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AutoPrint, PrintButton } from "@/components/admin/print-controls";
import { requireAdmin } from "@/lib/auth";
import {
  parseBookingView,
  type BookingSearchParams,
} from "@/lib/admin-bookings";
import {
  REPORT_COLUMNS,
  buildBookingReport,
  type ReportAlign,
  type ReportRow,
} from "@/lib/booking-report";
import { buildAdminHref } from "@/lib/admin-filters";

export const metadata = { title: "Bookings report — Admin" };

const PATH = "/admin/bookings/print";

/**
 * A printable report of the bookings currently filtered on /admin/bookings.
 *
 * **The same query string, the same query.** The Print button hands this page
 * the table's own URL, and `parseBookingView` parses it identically, so the
 * report is by construction the set the admin was looking at — filtered the
 * same way, sorted the same way. The one difference is paging: a report stops
 * at `PRINT_ROW_LIMIT`, not at 25, because a page of a list is not a report.
 *
 * The report's *content* — its heading lines, totals and rows — is not built
 * here. It comes from `buildBookingReport`, which the PDF route renders too, so
 * printing this page and downloading the PDF cannot produce different reports.
 * This file is one of the two renderers; `lib/reports/bookings-pdf.tsx` is the
 * other.
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

  const report = await buildBookingReport({ filters, sort, direction });

  // Back to the table exactly as it was left — same filters, same order.
  const backHref = buildAdminHref("/admin/bookings", view);

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
            {report.brand}
          </p>
          <h1 className="text-2xl leading-none">{report.title}</h1>
          <p className="text-sm text-muted-foreground">
            {report.range} · generated {report.generatedAt}
          </p>
        </header>

        {/* --- What this is a report of --------------------------------- */}
        <section className="flex flex-col gap-1.5 text-sm">
          <h2 className="text-xs font-bold tracking-widest uppercase">
            Filters applied
          </h2>
          {report.applied.length === 0 ? (
            <p className="text-muted-foreground">
              None beyond the date range above — every booking and admin block
              in the period.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {report.applied.map((item) => (
                <li key={item.label}>
                  <span className="text-muted-foreground">{item.label}: </span>
                  <span className="font-medium capitalize">{item.value}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground">{report.sortLine}</p>
        </section>

        {/* --- Summary --------------------------------------------------
            Counted over the whole filtered set in Postgres, not summed from
            the rows below — see `summariseAdminBookings`. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold tracking-widest uppercase">
            Summary
          </h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4 print:gap-0 print:rounded-none print:bg-transparent">
            {report.figures.map((figure) => (
              <Figure key={figure.label} {...figure} />
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">{report.summaryNote}</p>
        </section>

        {/* --- The rows -------------------------------------------------- */}
        {report.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed px-5 py-8 text-sm text-muted-foreground print:rounded-none">
            Nothing matched these filters, so there is nothing to print. Go back
            and widen the date range.
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-foreground/70">
                {REPORT_COLUMNS.map((column) => (
                  <Th key={column.key} align={column.align}>
                    {column.label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  {REPORT_COLUMNS.map((column) => (
                    <Td
                      key={column.key}
                      align={column.align}
                      // Times read as data, statuses read as labels; every
                      // other cell is prose. Plain text throughout — a printer
                      // drops background fills, so the screen's colour-coded
                      // badge would print as a word in a faint box at best.
                      className={
                        column.key === "time"
                          ? "font-mono text-xs"
                          : column.key === "status"
                            ? "capitalize"
                            : ""
                      }
                    >
                      {row[column.key as keyof ReportRow]}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {report.truncated && (
          <p className="text-sm font-medium">
            This report stops at the first {report.rowLimit} rows. The summary
            above still covers all {report.totalCount} — narrow the date range
            to list every one of them.
          </p>
        )}

        <footer className="border-t pt-3 text-xs text-muted-foreground">
          {report.brand} · internal booking report · generated{" "}
          {report.generatedAt}. Figures are as at the moment of printing.
        </footer>
      </article>
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: ReportAlign;
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
  align?: ReportAlign;
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
  value: string;
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
