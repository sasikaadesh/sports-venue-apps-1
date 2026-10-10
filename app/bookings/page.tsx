import type { Metadata } from "next";

import { BookingsOverviewTabs } from "@/components/bookings/bookings-overview-tabs";
import {
  getBookingsOverview,
  getCourtLegend,
  type BookingsOverviewTab,
} from "@/lib/security-bookings";
import { requireBookingsAccess } from "@/lib/security-staff/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bookings overview" };

/**
 * The one page a security login may reach. Three tabs — Today, This Week and
 * Next Week (Sri Lanka time, Monday–Sunday) — all read-only, all sorted by
 * time.
 *
 * All three tabs' rows are fetched here, once, in parallel, and handed to
 * `BookingsOverviewTabs` (a client component) to switch between locally.
 * Every tab used to be its own page with its own `?tab=` search param, so
 * clicking between them was a full server round trip — `requireBookingsAccess`
 * plus two queries, on every click. Loading all three together costs about
 * the same as loading one (the auth check is shared, and the queries run
 * concurrently), and then switching is instant.
 *
 * `app/bookings/layout.tsx` also calls `requireBookingsAccess()`, but a
 * layout is not itself a security boundary here any more than
 * `app/admin/layout.tsx`'s `requireAdmin()` is for the admin panel (see that
 * file's own comment) — Next can skip re-running a layout on a
 * client-side navigation, and a crafted request is not obliged to go through
 * the layout at all. This call is what actually decides whether the names
 * and phone numbers below are sent, on every single request for this page.
 */
export default async function BookingsOverviewPage() {
  await requireBookingsAccess();

  const [todayData, weekData, nextWeekData, legendCourts] = await Promise.all([
    getBookingsOverview("today"),
    getBookingsOverview("week"),
    getBookingsOverview("nextWeek"),
    getCourtLegend(),
  ]);

  const initialData: Record<
    BookingsOverviewTab,
    Awaited<ReturnType<typeof getBookingsOverview>>
  > = {
    today: todayData,
    week: weekData,
    nextWeek: nextWeekData,
  };

  return (
    <BookingsOverviewTabs
      initialData={initialData}
      legendCourts={legendCourts}
    />
  );
}
