import { requireAdminApi } from "@/lib/auth";
import {
  parseBookingView,
  type BookingSearchParams,
} from "@/lib/admin-bookings";
import {
  bookingReportFileName,
  buildBookingReport,
} from "@/lib/booking-report";
import { renderBookingsReportPdf } from "@/lib/reports/bookings-pdf";

/**
 * The bookings report as a downloadable PDF.
 *
 * Takes the **same query string** as /admin/bookings and /admin/bookings/print,
 * and parses it through the same `parseBookingView`, so "Export PDF" is the
 * admin's current view — same filters, same sort — and cannot drift from what
 * the table shows. The rows and totals come from `buildBookingReport`, which
 * the printable page renders as well.
 *
 * Admin-only, checked here in the handler with `requireAdminApi` and not
 * anywhere upstream: middleware is not an authorization boundary
 * (CVE-2025-29927), and this endpoint returns every booking in the range,
 * including who made it. Signed out is 401, a non-admin is 403.
 *
 * Read-only — it queries bookings and payments and writes nothing.
 */

// react-pdf builds a Buffer and uses Node APIs, so this cannot run on the edge.
export const runtime = "nodejs";

// A report is a snapshot of live data; the next download must not be a cached
// copy of the last one. Also keeps a signed-in admin's data out of any shared
// cache in front of the function.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { searchParams } = new URL(request.url);

  // Every value is narrowed to a known vocabulary by `parseBookingView`; the
  // raw object below is untrusted input and never reaches a query.
  const params = Object.fromEntries(searchParams) as BookingSearchParams;
  const { filters, sort, direction } = parseBookingView(params);

  const report = await buildBookingReport({ filters, sort, direction });
  const pdf = await renderBookingsReportPdf(report);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `attachment` makes it a download rather than an in-tab preview, and
      // names the file by the range it covers — bookings-2026-08.pdf.
      "Content-Disposition": `attachment; filename="${bookingReportFileName(filters)}"`,
      "Cache-Control": "no-store",
    },
  });
}
