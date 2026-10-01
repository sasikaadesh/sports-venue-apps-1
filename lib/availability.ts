import "server-only";

import { prisma } from "@/lib/prisma";
import { getOccupyingSlots, sharedHourLoad } from "@/lib/booking-service";
import type { BookingMode } from "@/lib/generated/prisma/enums";
import { maxChainLength } from "@/lib/slots";
import { isSameDayClosed, sameDayClosedMessage } from "@/lib/same-day-cutoff";
import {
  dateToDateString,
  dateToTimeString,
  dayOfWeekForDate,
  nowAtVenue,
  timeToMinutes,
} from "@/lib/time";

/**
 * Availability for a court on a date, per docs/ARCHITECTURE.md.
 *
 * Slots are templates, not per-day rows. An hour is open on a given date when
 * no booking occupies it — where "occupies" means status `confirmed`,
 * `blocked`, or `pending` with an unexpired hold. That set is defined once, in
 * `getOccupyingSlots`, so the public site and the admin panel can never
 * disagree about what is taken.
 *
 * On top of per-hour availability this computes `maxDuration`: how many
 * consecutive hours are bookable starting at each slot. That is what the
 * duration dropdown offers, and the booking service re-derives the same walk
 * server-side before it writes anything.
 */

export type SlotAvailability = {
  slotId: string;
  startTime: string; // "09:00"
  endTime: string; // "10:00"
  price: string;
  available: boolean;
  /**
   * Why it is not available. Undefined when it is. `closed` = today, after the
   * same-day booking cutoff (see lib/same-day-cutoff.ts).
   */
  reason?: "booked" | "blocked" | "past" | "closed" | "full";
  /**
   * Shared facilities only: places left in this hour, or null when the
   * facility has no capacity limit. Undefined on an exclusive court.
   */
  spotsLeft?: number | null;
  /**
   * Longest run of consecutive free hours starting here (0 when this hour is
   * itself taken). Offer durations 1..maxDuration.
   */
  maxDuration: number;
};

export type CourtAvailability = {
  date: string;
  /** Exclusive court (one booking per hour) or shared facility (many). */
  bookingMode: BookingMode;
  slots: SlotAvailability[];
  openCount: number;
  /**
   * Set when the date is today and the same-day cutoff has passed: why the
   * whole day is closed for booking. Undefined otherwise.
   */
  closedMessage?: string;
};

export async function getCourtAvailability(
  courtId: string,
  bookingDate: Date
): Promise<CourtAvailability> {
  const dayOfWeek = dayOfWeekForDate(bookingDate);

  const [court, templates, occupying] = await Promise.all([
    // Read live alongside the slots rather than from the catalogue cache: how
    // an hour is counted must never lag behind the rows being counted.
    prisma.court.findUnique({
      where: { id: courtId },
      select: { bookingMode: true, capacity: true },
    }),
    // Only active templates are offered publicly — an admin switching a slot
    // off should take it off the site immediately.
    prisma.slotTemplate.findMany({
      where: { courtId, dayOfWeek, isActive: true },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        price: true,
      },
    }),
    getOccupyingSlots(courtId, bookingDate),
  ]);

  const bookingMode = court?.bookingMode ?? "exclusive";
  const capacity = court?.capacity ?? null;

  // Exclusive: at most one row per hour, and any row means taken.
  const occupiedBySlot = new Map(occupying.map((o) => [o.slotId, o]));

  // Shared: every row for an hour, counted against capacity — the same
  // `sharedHourLoad` the booking service counts with before it writes.
  const sharedLoad = (slotId: string) =>
    sharedHourLoad(occupying.filter((o) => o.slotId === slotId));

  // A slot earlier today is gone, even though nothing booked it. Compared at
  // the venue's wall clock, so this is correct regardless of where the server
  // or the visitor is.
  const now = nowAtVenue();
  const dateString = dateToDateString(bookingDate);
  const isToday = dateString === now.date;
  const isPastDate = dateString < now.date;
  // Same rule, same clock reading as the booking service's check.
  const sameDayClosed = isSameDayClosed(dateString, now);

  /** One hour, judged on its own. The duration walk builds on this. */
  function freeness(template: (typeof templates)[number]): {
    available: boolean;
    reason?: SlotAvailability["reason"];
  } {
    if (isPastDate || (isToday && timeToMinutes(template.startTime) <= now.minutes)) {
      return { available: false, reason: "past" };
    }

    if (sameDayClosed) {
      return { available: false, reason: "closed" };
    }

    // Shared facility: bookings do not close the hour — a block or a full
    // capacity does.
    if (bookingMode === "shared") {
      const load = sharedLoad(template.id);
      if (load.blocked) return { available: false, reason: "blocked" };
      if (capacity !== null && load.people >= capacity) {
        return { available: false, reason: "full" };
      }
      return { available: true };
    }

    const occupied = occupiedBySlot.get(template.id);
    if (occupied) {
      return {
        available: false,
        reason: occupied.status === "blocked" ? "blocked" : "booked",
      };
    }

    return { available: true };
  }

  const isFree = (template: (typeof templates)[number]) =>
    freeness(template).available;

  const slots: SlotAvailability[] = templates.map((template, index) => {
    const { available, reason } = freeness(template);

    return {
      slotId: template.id,
      startTime: dateToTimeString(template.startTime),
      endTime: dateToTimeString(template.endTime),
      price: template.price.toString(),
      available,
      reason,
      spotsLeft:
        bookingMode === "shared"
          ? capacity === null
            ? null
            : Math.max(capacity - sharedLoad(template.id).people, 0)
          : undefined,
      // Walks forward from this slot, stopping at the first hour that is
      // taken or not contiguous on the clock.
      maxDuration: maxChainLength(templates, index, isFree),
    };
  });

  return {
    date: dateString,
    bookingMode,
    slots,
    openCount: slots.filter((s) => s.available).length,
    closedMessage: sameDayClosed ? sameDayClosedMessage() : undefined,
  };
}
