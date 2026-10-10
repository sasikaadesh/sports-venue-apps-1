"use server";

import {
  getBookingsOverview,
  type BookingsOverview,
  type BookingsOverviewTab,
} from "@/lib/security-bookings";
import { requireBookingsAccess } from "@/lib/security-staff/auth";

/**
 * Re-fetches one tab's rows on demand — used only by the "Refresh" button on
 * `/bookings`. The three tabs are preloaded together on first render so
 * switching between them is instant and needs no round trip; this is the one
 * path that does a genuine fetch afterwards; see `BookingsOverviewTabs`.
 */
export async function refreshBookingsOverviewAction(
  tab: BookingsOverviewTab
): Promise<BookingsOverview> {
  await requireBookingsAccess();
  return getBookingsOverview(tab);
}
