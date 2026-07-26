import { timeToMinutes } from "@/lib/time";

/**
 * Consecutive-hour logic, shared by the availability view and the booking
 * service so both agree on what "N consecutive hours" means.
 *
 * Pure functions over an ordered list of slot templates — no DB, no server-only
 * imports — because the same walk has to happen when showing durations and
 * again when validating a submitted booking.
 *
 * The central rule: **contiguity is judged against the clock, not against
 * position in the list.** A court with 09:00–10:00 and then 14:00–15:00 has two
 * slots that are adjacent in the ordered array but are not two consecutive
 * hours, and must never be sold as a 2-hour booking.
 */

/** Everything the chain walk needs from a slot template. */
export type ChainableSlot = {
  id: string;
  startTime: Date;
  endTime: Date;
};

/** How many hours a single booking may span. */
export const MAX_DURATION_HOURS = 8;

/** True when `b` starts exactly when `a` ends. */
export function isContiguous(a: ChainableSlot, b: ChainableSlot): boolean {
  return timeToMinutes(a.endTime) === timeToMinutes(b.startTime);
}

/**
 * The `duration` slots starting at `startIndex`, or null if that run does not
 * exist — it runs off the end of the day, or hits a gap in the clock.
 *
 * `templates` must be ordered by `startTime` and contain only slots that are
 * actually offered (active, right court, right weekday).
 */
export function chainFrom<T extends ChainableSlot>(
  templates: T[],
  startIndex: number,
  duration: number
): T[] | null {
  if (
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > MAX_DURATION_HOURS
  ) {
    return null;
  }
  if (startIndex < 0 || startIndex + duration > templates.length) return null;

  const chain = templates.slice(startIndex, startIndex + duration);

  for (let i = 1; i < chain.length; i++) {
    if (!isContiguous(chain[i - 1], chain[i])) return null;
  }

  return chain;
}

/**
 * The longest bookable run starting at `startIndex` — i.e. the largest N for
 * which every hour is contiguous and free. Returns 0 when the start slot
 * itself is not free, so the caller can skip offering it entirely.
 *
 * This is what turns availability into a duration dropdown: offer 1..N.
 */
export function maxChainLength<T extends ChainableSlot>(
  templates: T[],
  startIndex: number,
  isFree: (slot: T) => boolean
): number {
  if (startIndex < 0 || startIndex >= templates.length) return 0;
  if (!isFree(templates[startIndex])) return 0;

  let length = 1;

  while (
    length < MAX_DURATION_HOURS &&
    startIndex + length < templates.length &&
    isContiguous(templates[startIndex + length - 1], templates[startIndex + length]) &&
    isFree(templates[startIndex + length])
  ) {
    length++;
  }

  return length;
}
