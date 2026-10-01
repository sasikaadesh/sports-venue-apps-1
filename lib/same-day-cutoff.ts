import "server-only";

import { formatTime, nowAtVenue, timeStringToDate } from "@/lib/time";

/**
 * The same-day booking cutoff: bookings for *today* close at a fixed wall-clock
 * time at the venue (default 14:00). Bookings for any later date are never
 * affected.
 *
 * One definition, two callers — `quoteBooking` (which `createBooking` runs
 * immediately before writing the pending hold, so this is the enforcement) and
 * `getCourtAvailability` (so the page shows today as closed). Keeping the rule
 * here is what stops the view and the writer drifting apart.
 *
 * "Today" and "now" are the venue's (`nowAtVenue`, Asia/Colombo), never the
 * server's or the visitor's — a Vercel function runs in UTC, where 14:00 at the
 * venue is 08:30.
 *
 * Configurable without a code change via `SAME_DAY_BOOKING_CUTOFF` ("HH:MM",
 * 24h, venue time). "24:00" effectively switches the cutoff off. Anything
 * unparseable falls back to the default rather than failing open or closed.
 */

const DEFAULT_CUTOFF = "14:00";
const CUTOFF_RE = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;

/** The cutoff as "HH:MM", validated. */
function cutoffString(): string {
  const raw = process.env.SAME_DAY_BOOKING_CUTOFF?.trim();
  if (!raw) return DEFAULT_CUTOFF;
  if (CUTOFF_RE.test(raw)) return raw;

  console.warn(
    `SAME_DAY_BOOKING_CUTOFF="${raw}" is not HH:MM — using ${DEFAULT_CUTOFF}.`
  );
  return DEFAULT_CUTOFF;
}

/** The cutoff as minutes since midnight at the venue. */
export function sameDayCutoffMinutes(): number {
  const [h, m] = cutoffString().split(":").map(Number);
  return h * 60 + m;
}

/** The message shown wherever today is closed for booking. */
export function sameDayClosedMessage(): string {
  const label = formatTime(timeStringToDate(cutoffString()));
  return `Same-day bookings close at ${label} — please choose another day.`;
}

/**
 * Is `dateString` today at the venue, with the cutoff already reached?
 *
 * The cutoff instant itself is closed: "before 2:00 PM" means 13:59 books and
 * 14:00 does not. Future dates always return false; past dates are rejected
 * elsewhere as "passed", not here.
 */
export function isSameDayClosed(
  dateString: string,
  now: { date: string; minutes: number } = nowAtVenue()
): boolean {
  return dateString === now.date && now.minutes >= sameDayCutoffMinutes();
}
