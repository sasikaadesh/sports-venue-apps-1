/**
 * Time and date helpers.
 *
 * Two Postgres column types need careful handling, because Prisma maps both to
 * a JS `Date` even though neither is a moment in time:
 *
 *   - `SlotTemplate.startTime/endTime` are `TIME(6)` — a wall-clock time with
 *     no date and no zone. Prisma hands back a Date on 1970-01-01 whose time
 *     is in **UTC**.
 *   - `Booking.bookingDate` is `DATE` — a calendar day. Prisma hands back a
 *     Date at **UTC midnight**.
 *
 * Everything here therefore reads and writes via the UTC accessors. Using the
 * local-time ones (`getHours`, `new Date("2026-01-01")` + local offset) is the
 * bug that makes a 09:00 slot show as 14:30, or a booking land on the wrong
 * day for anyone east/west of the server. Never mix the two.
 */

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_NAMES_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/** "09:00" -> Date(1970-01-01T09:00:00Z), the shape Prisma writes to TIME. */
export function timeStringToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
}

/** Date from a TIME column -> "09:00" (24h, zero-padded). */
export function dateToTimeString(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Date from a TIME column -> "9:00 AM", for display. */
export function formatTime(date: Date): string {
  const h24 = date.getUTCHours();
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m} ${period}`;
}

/** Minutes since midnight — for comparing/ordering slot times. */
export function timeToMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/** "2026-07-21" -> Date(2026-07-21T00:00:00Z), the shape Prisma writes to DATE. */
export function dateStringToDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date from a DATE column -> "2026-07-21" (also the <input type="date"> format). */
export function dateToDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Date from a DATE column -> "Tue, 21 Jul 2026", for display. */
export function formatDate(date: Date): string {
  return `${DAY_NAMES_SHORT[date.getUTCDay()]}, ${date.getUTCDate()} ${
    [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

/**
 * Day of week (0=Sun..6=Sat) for a DATE-column value.
 * `getUTCDay()`, not `getDay()` — the latter would shift the day for anyone
 * whose local offset is negative, silently matching the wrong slot templates.
 */
export function dayOfWeekForDate(date: Date): number {
  return date.getUTCDay();
}

/**
 * The venue's timezone. Slot times are wall-clock times at the venue, so
 * "is this slot in the past?" has to be judged there — not in UTC, and not in
 * whatever zone the server or the visitor's browser happens to be in.
 */
export const VENUE_TIME_ZONE = "Asia/Colombo";

/** Today as "2026-07-21", in the given IANA zone (defaults to the venue's). */
export function todayString(timeZone = VENUE_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** Current date and minutes-since-midnight at the venue. */
export function nowAtVenue(timeZone = VENUE_TIME_ZONE): {
  date: string;
  minutes: number;
} {
  const now = new Date();

  // hourCycle "h23" so midnight is 00, not 24 — some locales report the latter
  // with hour12:false, which would make every slot look like it had passed.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return {
    date: todayString(timeZone),
    minutes: hour * 60 + minute,
  };
}

/**
 * Is this timestamp still in the future? Used for "is the hold still live?".
 *
 * Reading the clock lives here rather than inline in a component: a server
 * component that renders per request (`force-dynamic`) is exactly where a
 * fresh `Date.now()` is correct, but the React purity lint — rightly — does
 * not want that call sitting in render.
 */
export function isFuture(date: Date | null | undefined): boolean {
  return date != null && date.getTime() > Date.now();
}

/** Add N days to a "YYYY-MM-DD" string, staying on the calendar. */
export function addDays(yyyymmdd: string, days: number): string {
  const date = dateStringToDate(yyyymmdd);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToDateString(date);
}

/**
 * A TIMESTAMP (createdAt, readAt) rendered at the venue's wall clock —
 * "21 Jul 2026, 14:05".
 *
 * Distinct from `formatDate`, which is for DATE columns and reads them via UTC
 * accessors. A timestamp is a real instant, so it has to be *converted* to the
 * venue's zone; using the UTC accessors here would show a message sent at
 * 02:00 Colombo time as the previous day.
 */
export function formatDateTime(date: Date, timeZone = VENUE_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/**
 * The same instant without the clock — "21 Jul 2026".
 *
 * For table cells where the day is the answer and the minute is noise. The
 * full `formatDateTime` string goes in the cell's `title`, so the time is one
 * hover away rather than gone.
 */
export function formatDateOnly(date: Date, timeZone = VENUE_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** LKR money formatting for display. */
export function formatPrice(amount: number | string): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}
