import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { nextBookingReference } from "@/lib/booking-reference";
import { chainFrom, MAX_DURATION_HOURS } from "@/lib/slots";
import { isSameDayClosed, sameDayClosedMessage } from "@/lib/same-day-cutoff";
import {
  addDays,
  dateToDateString,
  dateToTimeString,
  dayOfWeekForDate,
  nowAtVenue,
  timeToMinutes,
} from "@/lib/time";
import type { BookingMode, BookingStatus } from "@/lib/generated/prisma/enums";

/**
 * The booking service — the ONLY place in the app that writes `Booking` or
 * `BookingSlot`.
 *
 * Routes, server actions and components must call these functions rather than
 * touching `prisma.booking` directly (CLAUDE.md). Centralising the writes is
 * what makes the anti-double-booking guarantee reviewable in one file.
 *
 * The guarantee itself is the DB-level `UNIQUE (courtId, bookingDate, slotId)`
 * on `BookingSlot`, not an application-level "check then insert" — that would
 * race. We attempt the write and translate the constraint violation into a
 * friendly result.
 *
 * A booking spans N consecutive hours and owns one `BookingSlot` per hour, so
 * a multi-hour reservation is N protected rows written in ONE transaction:
 * all N, or none.
 *
 * Two kinds of court (docs/ARCHITECTURE.md → "Exclusive vs shared"):
 *  - EXCLUSIVE (every court): one booking per hour, guaranteed by the unique
 *    key above. This path is unchanged by shared facilities.
 *  - SHARED (gym, pool): many bookings per hour. The DB trigger writes their
 *    hour-rows with `exclusive = NULL`, which the unique key ignores; capacity
 *    and blocks are enforced here, under a per-hour advisory lock.
 * Everything else — pending holds, expiry, payment, confirmation, release — is
 * the same code for both.
 */

/** Statuses that hold their hours, so nothing else may take them. */
export const OCCUPYING_STATUSES: BookingStatus[] = [
  "confirmed",
  "pending",
  "blocked",
];

/** How long an unpaid hold survives before the hours are released. */
export const HOLD_MINUTES = 10;

/**
 * How long the hours are held once the user opens the payment popup.
 *
 * Longer than the initial hold because entering card details, waiting for an
 * OTP and the bank's redirect all happen inside it. If the hold lapsed
 * mid-payment the sweep would release the hours and the webhook would arrive
 * for a booking that no longer holds anything — see `confirmPaidBooking`,
 * which refuses to confirm in that state rather than selling an hour twice.
 */
export const PAYMENT_HOLD_MINUTES = 20;

/** How far ahead the public may book. */
export const BOOKING_WINDOW_DAYS = 60;

export type BookingResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; reason?: "taken" | "invalid" | "notfound" };

/**
 * Postgres unique-constraint violation, surfaced by Prisma as P2002.
 * Duck-typed rather than instanceof-checked so it keeps working across Prisma
 * client regenerations and bundling boundaries.
 */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * A P2002 specifically on `Booking.bookingReference` — the nested write in
 * `createBooking`/`blockSlot` can violate either that constraint or the
 * genuine anti-double-booking one, and only the latter means "that slot was
 * just taken". `lib/booking-reference.ts`'s year-qualified, collision-safe
 * generation means this should now be unreachable; it is kept as a loud
 * failure rather than a silently wrong user-facing message in case it ever
 * is reached (a hand-edited database, a future change to the format, …).
 */
function isBookingReferenceCollision(e: unknown): boolean {
  if (!isUniqueViolation(e)) return false;
  const target = (e as { meta?: { target?: unknown } }).meta?.target;
  const fields = Array.isArray(target)
    ? target
    : typeof target === "string"
      ? [target]
      : [];
  return fields.some(
    (f) => typeof f === "string" && f.toLowerCase().includes("bookingreference")
  );
}

/** The two statuses that mean "this booking is no longer holding its hours". */
type ReleasedStatus = Extract<BookingStatus, "cancelled" | "expired">;

/**
 * Move bookings to a released status AND delete the hours they were holding —
 * atomically, and only for the ones whose status still matches `guard`.
 *
 * **This is the shape every release path must use.** Releasing a booking is two
 * writes: flip the parent, delete its `BookingSlot` rows. The delete is the part
 * that actually frees the hour, because the unique index protects
 * (courtId, bookingDate, slotId) and cannot see the parent's status.
 *
 * Every caller here reads the booking, checks its status, and only then writes.
 * That read-then-write is a race with the PayHere webhook, which can confirm the
 * booking in between — and the webhook is a *different request*, so nothing in
 * this process serialises them. Guarding only the status flip is not enough: an
 * unguarded delete still strips the hour-rows off a booking that just became
 * `confirmed`, and the hour goes back on sale while the payer keeps their
 * `confirmed` booking. That is the double-sell this file exists to prevent.
 *
 * So both writes are guarded, in this order:
 *
 *   1. `updateMany` with the caller's status guard. If the webhook got there
 *      first, it matches nothing and returns 0.
 *   2. Only on a match, delete the hour-rows — and scope that delete to
 *      bookings that are *now* in the released status. A booking that is
 *      `cancelled` or `expired` must own no `BookingSlot` rows; one that is
 *      `confirmed` must keep every one of them.
 *
 * `removeOwnBooking` already does this by hand (it writes `removedAt` as part of
 * the same flip); it is left as it is because it is correct, and its comment
 * explains the same race from the caller's side.
 *
 * @returns how many bookings were actually released — 0 means every one of them
 *   changed underneath the caller, which is never a silent success.
 */
async function flipAndReleaseHours(params: {
  /** The bookings to release. */
  ids: string[];
  /** What each booking must STILL be for the release to apply. */
  guard: Prisma.BookingWhereInput;
  /** The released status to move them to. */
  status: ReleasedStatus;
  /** Anything else to write in the same flip. */
  alsoSet?: Omit<Prisma.BookingUpdateManyMutationInput, "status">;
}): Promise<number> {
  const { ids, guard, status, alsoSet } = params;

  if (ids.length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    const flip = await tx.booking.updateMany({
      // `id` last: a guard can narrow this set, never widen it.
      where: { ...guard, id: { in: ids } },
      data: { ...alsoSet, status },
    });

    if (flip.count === 0) return 0;

    await tx.bookingSlot.deleteMany({
      where: { bookingId: { in: ids }, booking: { status } },
    });

    return flip.count;
  });
}

/**
 * Release holds that were never paid for.
 *
 * This has to DELETE the `BookingSlot` rows, not just flip the parent's status:
 * the unique index protects (courtId, bookingDate, slotId) and cannot look at
 * the parent's status, so a lapsed hold that kept its hour-rows would lock that
 * hour forever. The parent stays behind as an `expired` record.
 *
 * Called by every writer before it inserts, scoped to the court and date being
 * touched, so a stale hold can never make a genuinely free hour un-bookable.
 * Phase 9 adds the Vercel Cron that does the same sweep globally.
 */
export async function releaseExpiredHolds(scope?: {
  courtId: string;
  bookingDate: Date;
}): Promise<number> {
  const cutoff = new Date();

  const stale = await prisma.booking.findMany({
    where: {
      status: "pending",
      holdExpiresAt: { lte: cutoff },
      ...(scope ?? {}),
    },
    select: { id: true },
  });

  if (stale.length === 0) return 0;

  // Re-assert the whole condition, not just the ids: a hold that was confirmed
  // — or extended for a payment attempt (`extendHoldForPayment`) — between the
  // read above and this write is no longer stale, and must keep its hours.
  // Returns the number actually swept, which can be fewer than were read.
  return flipAndReleaseHours({
    ids: stale.map((b) => b.id),
    guard: { status: "pending", holdExpiresAt: { lte: cutoff } },
    status: "expired",
  });
}

export type OccupyingSlot = {
  /** The SlotTemplate (hour) that is taken. */
  slotId: string;
  /** The booking holding it. */
  bookingId: string;
  status: BookingStatus;
  /** People on that booking — what a shared facility's capacity counts. */
  playerCount: number;
  userId: string | null;
  userEmail: string | null;
};

/**
 * A booking that is holding its hours right now: confirmed, blocked, or a
 * `pending` hold that has not lapsed. The one definition every occupancy read
 * uses, so the view and the shared-capacity check cannot disagree.
 */
function holdingBooking(now: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: { in: ["confirmed", "blocked"] } },
      { status: "pending", holdExpiresAt: { gt: now } },
    ],
  };
}

/**
 * The hours currently taken on a court for a given date — one entry per
 * occupied hour, whatever booking it belongs to.
 *
 * On an exclusive court that is at most one entry per hour (the unique key
 * guarantees it). On a SHARED facility an hour can carry many entries — one per
 * booking in it — and callers count them against capacity rather than treating
 * any entry as "taken".
 *
 * A `pending` hold only counts while it is unexpired: an abandoned hold must
 * not keep an hour locked. This is a read, so it filters expired holds out
 * rather than sweeping them; the writers do the sweeping.
 */
export async function getOccupyingSlots(
  courtId: string,
  bookingDate: Date
): Promise<OccupyingSlot[]> {
  const rows = await prisma.bookingSlot.findMany({
    where: { courtId, bookingDate, booking: holdingBooking(new Date()) },
    select: {
      slotId: true,
      booking: {
        select: {
          id: true,
          status: true,
          playerCount: true,
          userId: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    slotId: row.slotId,
    bookingId: row.booking.id,
    status: row.booking.status,
    playerCount: row.booking.playerCount,
    userId: row.booking.userId,
    userEmail: row.booking.user?.email ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Shared facilities
// ---------------------------------------------------------------------------

/**
 * How full one hour of a shared facility is, from its occupying rows.
 * Exported so the availability view counts exactly the way the writer does.
 */
export function sharedHourLoad(
  rows: { status: BookingStatus; playerCount: number }[]
): { blocked: boolean; people: number } {
  return {
    blocked: rows.some((r) => r.status === "blocked"),
    people: rows
      .filter((r) => r.status !== "blocked")
      .reduce((sum, r) => sum + r.playerCount, 0),
  };
}

/**
 * Why `playerCount` more people cannot join these hours of a shared facility,
 * or null when they can. A blocked hour is closed to everyone; otherwise the
 * only limit is `capacity` (null = unlimited).
 */
function sharedHoursProblem(
  hours: { slotId: string; startTime: string }[],
  occupying: { slotId: string; status: BookingStatus; playerCount: number }[],
  capacity: number | null,
  playerCount: number
): string | null {
  for (const hour of hours) {
    const load = sharedHourLoad(
      occupying.filter((o) => o.slotId === hour.slotId)
    );

    if (load.blocked) {
      return `The ${hour.startTime} session has been closed by the venue. Pick another time.`;
    }

    if (capacity !== null && load.people + playerCount > capacity) {
      const left = Math.max(capacity - load.people, 0);
      return left === 0
        ? `The ${hour.startTime} session is full. Pick another time.`
        : `Only ${left} ${left === 1 ? "place is" : "places are"} left in the ${hour.startTime} session.`;
    }
  }

  return null;
}

/**
 * Serialise every writer touching these hours of a shared facility on this
 * date, until the surrounding transaction ends.
 *
 * Shared hours have no unique key to lean on (that is the point of them), so
 * "count the people, then insert" would race: two requests could both see one
 * place left and both take it. A transaction-scoped advisory lock per
 * (hour, date) makes the count and the insert one step. Locks are taken in a
 * fixed order so two multi-hour requests cannot deadlock each other, and they
 * are released automatically on commit or rollback — nothing can leak. The key
 * is a hash, so an unrelated collision only costs a moment's extra waiting.
 *
 * Exclusive courts never come through here: their guarantee is the unique key.
 */
async function lockSharedHours(
  tx: Prisma.TransactionClient,
  dateString: string,
  slotIds: string[]
): Promise<void> {
  for (const slotId of [...slotIds].sort()) {
    const key = `shared-hour:${slotId}:${dateString}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}

/** The live rows on these hours, read inside a transaction that holds their locks. */
async function sharedOccupancyInTx(
  tx: Prisma.TransactionClient,
  courtId: string,
  bookingDate: Date,
  slotIds: string[]
) {
  const rows = await tx.bookingSlot.findMany({
    where: {
      courtId,
      bookingDate,
      slotId: { in: slotIds },
      booking: holdingBooking(new Date()),
    },
    select: {
      slotId: true,
      booking: { select: { status: true, playerCount: true } },
    },
  });

  return rows.map((r) => ({
    slotId: r.slotId,
    status: r.booking.status,
    playerCount: r.booking.playerCount,
  }));
}

export type BookingRequest = {
  courtId: string;
  bookingDate: Date;
  startSlotId: string;
  durationHours: number;
  playerCount: number;
};

/** A priced, validated booking request — what the user confirms. */
export type BookingQuote = {
  courtId: string;
  courtName: string;
  dateString: string;
  playerCount: number;
  durationHours: number;
  startTime: string;
  endTime: string;
  /** The individual hours, in order, each at the price it will be booked at. */
  hours: {
    slotId: string;
    startTime: string;
    endTime: string;
    price: string;
  }[];
  /** Sum of `hours[].price`, computed here — never accepted from a client. */
  totalPrice: string;
  /** Exclusive court or shared facility — decides how the hold is written. */
  bookingMode: BookingMode;
  /** Shared facilities: max people per hour, null = unlimited. */
  capacity: number | null;
};

/**
 * Validate and price a booking request without writing anything.
 *
 * This is the single definition of "is this a legal booking, and what does it
 * cost". The review page renders it, and `createBooking` calls it again
 * immediately before inserting, so the total the user confirmed and the total
 * that gets stored come from the same code path.
 *
 * The occupancy check here is for a good error message, NOT the guarantee —
 * between this read and the insert someone else can take the hour. The unique
 * constraint is what actually prevents the double booking.
 */
export async function quoteBooking(
  request: BookingRequest
): Promise<BookingResult<BookingQuote>> {
  const { courtId, bookingDate, startSlotId, playerCount } = request;
  const durationHours = Number(request.durationHours);

  if (
    !Number.isInteger(durationHours) ||
    durationHours < 1 ||
    durationHours > MAX_DURATION_HOURS
  ) {
    return {
      ok: false,
      error: `Choose a duration between 1 and ${MAX_DURATION_HOURS} hours.`,
      reason: "invalid",
    };
  }

  // --- The court, and the player counts its type allows --------------------
  const court = await prisma.court.findFirst({
    where: { id: courtId, isActive: true },
    select: {
      id: true,
      name: true,
      bookingMode: true,
      capacity: true,
      courtType: { select: { playerOptions: true } },
    },
  });

  if (!court) {
    return {
      ok: false,
      error: "That court is not available.",
      reason: "notfound",
    };
  }

  // Player options are data-driven (CourtType), so this is a real check, not a
  // dropdown formality — the form can be bypassed.
  if (!court.courtType.playerOptions.includes(playerCount)) {
    return {
      ok: false,
      error: "That number of players is not offered for this court.",
      reason: "invalid",
    };
  }

  // --- The date must be inside the bookable window -------------------------
  const now = nowAtVenue();
  const dateString = dateToDateString(bookingDate);

  if (dateString < now.date) {
    return { ok: false, error: "That date has passed.", reason: "invalid" };
  }

  if (dateString > addDays(now.date, BOOKING_WINDOW_DAYS)) {
    return {
      ok: false,
      error: `Bookings open ${BOOKING_WINDOW_DAYS} days ahead.`,
      reason: "invalid",
    };
  }

  // Same-day bookings close at the venue's cutoff (default 14:00). Checked
  // here, not only in the UI: `createBooking` re-runs this quote immediately
  // before writing the pending hold, so a stale page or a crafted request
  // after the cutoff reserves nothing. Future dates are never affected.
  if (isSameDayClosed(dateString, now)) {
    return { ok: false, error: sameDayClosedMessage(), reason: "invalid" };
  }

  // --- Resolve the chain of hours ------------------------------------------
  // Only active templates for this court and weekday, in clock order — the
  // exact list the availability view walks.
  const templates = await prisma.slotTemplate.findMany({
    where: {
      courtId,
      dayOfWeek: dayOfWeekForDate(bookingDate),
      isActive: true,
    },
    orderBy: { startTime: "asc" },
    select: { id: true, startTime: true, endTime: true, price: true },
  });

  const startIndex = templates.findIndex((t) => t.id === startSlotId);

  if (startIndex === -1) {
    return {
      ok: false,
      error: "That time slot is not offered on this date.",
      reason: "invalid",
    };
  }

  const chain = chainFrom(templates, startIndex, durationHours);

  if (!chain) {
    return {
      ok: false,
      error: `This court does not have ${durationHours} consecutive hours free from that time.`,
      reason: "invalid",
    };
  }

  // An hour that has already started cannot be sold, even though nothing
  // booked it. Judged at the venue's wall clock, like the availability view.
  if (
    dateString === now.date &&
    timeToMinutes(chain[0].startTime) <= now.minutes
  ) {
    return {
      ok: false,
      error: "That time has already passed.",
      reason: "invalid",
    };
  }

  const occupying = await getOccupyingSlots(courtId, bookingDate);

  // --- Shared facility: is there room in every hour? -----------------------
  // Advisory, like the exclusive check below. The guarantee for shared hours
  // is the locked re-count inside `createSharedBooking`.
  if (court.bookingMode === "shared") {
    const problem = sharedHoursProblem(
      chain.map((slot) => ({
        slotId: slot.id,
        startTime: dateToTimeString(slot.startTime),
      })),
      occupying,
      court.capacity,
      playerCount
    );
    if (problem) return { ok: false, error: problem, reason: "taken" };
  }

  // --- Is every hour in the range still free? ------------------------------
  // Advisory only. Between here and the INSERT another request can take one of
  // these hours; the unique constraint is what stops that becoming a double
  // booking. This check exists so the common case gets a clear message instead
  // of a constraint error.
  // Exclusive courts only — a shared hour being occupied is normal.
  const taken = new Set(
    court.bookingMode === "exclusive" ? occupying.map((o) => o.slotId) : []
  );

  if (chain.some((slot) => taken.has(slot.id))) {
    return {
      ok: false,
      error:
        durationHours === 1
          ? "That slot has already been taken."
          : "One of those hours has already been taken. Try a shorter booking or another start time.",
      reason: "taken",
    };
  }

  // --- Price: summed on the server, from the templates ---------------------
  // Decimal arithmetic, not floats — money must not pick up binary rounding
  // error. Each hour's price is copied onto its own BookingSlot at write time,
  // so a later edit to the template cannot retroactively change what was
  // booked and paid.
  const totalPrice = chain.reduce(
    (sum, slot) => sum.add(slot.price),
    new Prisma.Decimal(0)
  );

  return {
    ok: true,
    data: {
      courtId: court.id,
      courtName: court.name,
      dateString,
      playerCount,
      durationHours,
      startTime: dateToTimeString(chain[0].startTime),
      endTime: dateToTimeString(chain[chain.length - 1].endTime),
      hours: chain.map((slot) => ({
        slotId: slot.id,
        startTime: dateToTimeString(slot.startTime),
        endTime: dateToTimeString(slot.endTime),
        price: slot.price.toFixed(2),
      })),
      totalPrice: totalPrice.toFixed(2),
      bookingMode: court.bookingMode,
      capacity: court.capacity,
    },
  };
}

/**
 * Create a customer booking spanning N consecutive hours.
 *
 * Everything the client sent is re-derived here via `quoteBooking`: the slot
 * chain, the duration, and above all the price. A server action is a public
 * HTTP endpoint, so the only inputs trusted are the identifiers.
 *
 * The reservation is atomic. All N hour-rows are inserted in one transaction
 * with their parent, so the booking either holds every hour the user asked for
 * or none of them — never a partial range with the rest sold to someone else.
 */
export async function createBooking(
  request: BookingRequest & { userId: string }
): Promise<
  BookingResult<{
    id: string;
    totalPrice: string;
    durationHours: number;
    holdExpiresAt: Date;
  }>
> {
  const { courtId, bookingDate, userId } = request;

  // Clear any lapsed hold on this court/date first. Its leftover hour-rows
  // would otherwise fail the insert for hours that are genuinely free again.
  await releaseExpiredHolds({ courtId, bookingDate });

  const quote = await quoteBooking(request);
  if (!quote.ok) return quote;

  const { hours, durationHours, totalPrice, playerCount } = quote.data;
  const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);

  // Shared facilities (gym, pool) take many bookings per hour, so they are
  // written under a capacity lock instead of relying on the unique key. The
  // Booking row, the pending hold, payment and confirmation are all the same.
  if (quote.data.bookingMode === "shared") {
    return createSharedBooking({
      courtId,
      bookingDate,
      userId,
      quote: quote.data,
      holdExpiresAt,
    });
  }

  // --- Exclusive court: unchanged — the unique key is the guarantee. --------
  try {
    // An interactive transaction rather than a single nested write: the
    // booking reference's sequence number (lib/booking-reference.ts) has to
    // be taken in the same transaction as the insert, so a reference is
    // never assigned to a booking that then fails to write. If any one hour
    // collides with the unique index, the whole thing rolls back — no
    // partial reservation, no orphan rows, and no sequence number burned on
    // a booking that never existed.
    const booking = await prisma.$transaction(async (tx) => {
      const bookingReference = await nextBookingReference(
        tx,
        courtId,
        bookingDate
      );

      return tx.booking.create({
        data: {
          courtId,
          bookingDate,
          userId,
          playerCount,
          durationHours,
          totalPrice,
          bookingReference,
          status: "pending",
          holdExpiresAt,
          slots: {
            create: hours.map((hour) => ({
              slotId: hour.slotId,
              // Denormalised from the parent so the unique constraint can be
              // evaluated within one row — written in the same transaction.
              courtId,
              bookingDate,
              price: new Prisma.Decimal(hour.price),
            })),
          },
        },
        select: { id: true },
      });
    });

    return {
      ok: true,
      data: {
        id: booking.id,
        totalPrice,
        durationHours,
        holdExpiresAt,
      },
    };
  } catch (e) {
    // A reference collision is not "taken" — see isBookingReferenceCollision.
    // Rethrown rather than mapped to a user-facing message that would be
    // actively wrong about what happened.
    if (isBookingReferenceCollision(e)) throw e;

    // The race the pre-check above cannot close: someone else's transaction
    // committed one of these hours in between. This is the guarantee doing its
    // job, not an unexpected failure.
    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error:
          durationHours === 1
            ? "Sorry — that slot was just taken. Pick another time."
            : "Sorry — one of those hours was just taken. Pick another time or a shorter booking.",
        reason: "taken",
      };
    }
    throw e;
  }
}

/**
 * The shared-facility half of `createBooking`: same Booking row, same pending
 * hold, same one-BookingSlot-per-hour shape — so payment, confirmation, expiry
 * and every display work unchanged. What differs is the guarantee.
 *
 * The rows are written with `exclusive = NULL` (set by the DB trigger from the
 * court's mode), so the unique key lets many bookings share an hour. Capacity
 * is enforced here instead: lock the hours, re-count the people holding them,
 * insert only if there is room — all in one transaction, so two requests for
 * the last place cannot both get it.
 */
async function createSharedBooking(params: {
  courtId: string;
  bookingDate: Date;
  userId: string;
  quote: BookingQuote;
  holdExpiresAt: Date;
}): Promise<
  BookingResult<{
    id: string;
    totalPrice: string;
    durationHours: number;
    holdExpiresAt: Date;
  }>
> {
  const { courtId, bookingDate, userId, quote, holdExpiresAt } = params;
  const { hours, durationHours, totalPrice, playerCount, capacity } = quote;
  const slotIds = hours.map((h) => h.slotId);

  const outcome = await prisma.$transaction(async (tx) => {
    await lockSharedHours(tx, quote.dateString, slotIds);

    // Only a finite capacity or a block can refuse — read what holds the
    // hours now, after the lock, so nothing can slip in between.
    const occupying = await sharedOccupancyInTx(
      tx,
      courtId,
      bookingDate,
      slotIds
    );
    const problem = sharedHoursProblem(hours, occupying, capacity, playerCount);
    if (problem) return { ok: false as const, error: problem };

    const bookingReference = await nextBookingReference(
      tx,
      courtId,
      bookingDate
    );

    const booking = await tx.booking.create({
      data: {
        courtId,
        bookingDate,
        userId,
        playerCount,
        durationHours,
        totalPrice,
        bookingReference,
        status: "pending",
        holdExpiresAt,
        slots: {
          create: hours.map((hour) => ({
            slotId: hour.slotId,
            courtId,
            bookingDate,
            price: new Prisma.Decimal(hour.price),
          })),
        },
      },
      select: { id: true },
    });

    return { ok: true as const, id: booking.id };
  });

  if (!outcome.ok) {
    return { ok: false, error: outcome.error, reason: "taken" };
  }

  return {
    ok: true,
    data: { id: outcome.id, totalPrice, durationHours, holdExpiresAt },
  };
}

/**
 * Release a user's own pending hold — the "changed my mind" path.
 * Deleting the hour-rows is what actually frees the time (see
 * `releaseExpiredHolds`).
 */
export async function cancelOwnBooking(
  bookingId: string,
  userId: string
): Promise<BookingResult<{ id: string }>> {
  const booking = await prisma.booking.findFirst({
    // Scoped to the owner in the query itself, so another user's id cannot
    // cancel this booking even if they guess the uuid.
    where: { id: bookingId, userId },
    select: { id: true, status: true },
  });

  if (!booking) {
    return { ok: false, error: "Booking not found.", reason: "notfound" };
  }

  if (booking.status !== "pending") {
    return {
      ok: false,
      error: "Only a booking that is still on hold can be cancelled here.",
      reason: "invalid",
    };
  }

  // Guarded on `pending` AND on the owner, so the PayHere webhook confirming
  // this booking between the read above and here means the cancel matches
  // nothing rather than cancelling a booking that has just been paid for.
  const released = await flipAndReleaseHours({
    ids: [bookingId],
    guard: { userId, status: "pending" },
    status: "cancelled",
  });

  if (released === 0) {
    return {
      ok: false,
      error:
        "This booking changed while you were cancelling it. Reload the page to see where it stands.",
      reason: "invalid",
    };
  }

  return { ok: true, data: { id: bookingId } };
}

/** The only statuses a user may remove from their own list. */
const USER_REMOVABLE_STATUSES: BookingStatus[] = ["pending", "cancelled"];

/**
 * Remove a booking from the owner's list — the "clear this out" path.
 *
 * The paid/unpaid divide (docs/ARCHITECTURE.md) is enforced HERE, not by which
 * buttons the page draws: only `pending` (unpaid, still on hold) and
 * `cancelled` bookings can be removed, and only by the user who owns them. A
 * `confirmed` booking is money that changed hands and can only be released
 * through the admin-reviewed refund flow, so it is refused however the request
 * is crafted.
 *
 * A `pending` booking is still holding its hours, so removing it releases them
 * the same way every other release does — by DELETING the `BookingSlot` rows.
 * The parent is then marked `cancelled`, exactly as `cancelOwnBooking` leaves
 * it, so the availability queries and the sweep see nothing new.
 *
 * The booking row itself survives, stamped with `removedAt`: it is a record,
 * it may own `Payment` attempt rows, and RLS grants DELETE to admins only.
 * Only the user's own list filters on `removedAt`.
 */
export async function removeOwnBooking(
  bookingId: string,
  userId: string
): Promise<BookingResult<{ id: string; releasedHours: boolean }>> {
  const booking = await prisma.booking.findFirst({
    // Ownership is part of the query, not a check on the result — another
    // user's id cannot match this row even with the right uuid.
    where: { id: bookingId, userId },
    select: { id: true, status: true, removedAt: true },
  });

  if (!booking) {
    return { ok: false, error: "Booking not found.", reason: "notfound" };
  }

  if (booking.removedAt) {
    // Already gone from their list — a double submit, not an error.
    return { ok: true, data: { id: bookingId, releasedHours: false } };
  }

  if (!USER_REMOVABLE_STATUSES.includes(booking.status)) {
    return {
      ok: false,
      error:
        booking.status === "confirmed"
          ? "A paid booking cannot be removed here. Contact the sports office to request a refund."
          : "This booking cannot be removed.",
      reason: "invalid",
    };
  }

  const wasHolding = booking.status === "pending";

  // Interactive transaction, and the ORDER matters: the guarded status flip
  // goes first, and the hour-rows are only deleted if it actually matched. If
  // the PayHere webhook confirmed this booking in the instant between the read
  // above and here, the flip matches nothing and we must NOT delete the hours
  // — that would leave a paid booking holding nothing.
  const removed = await prisma.$transaction(async (tx) => {
    const flip = await tx.booking.updateMany({
      where: { id: bookingId, userId, status: { in: USER_REMOVABLE_STATUSES } },
      data: {
        status: "cancelled",
        holdExpiresAt: null,
        removedAt: new Date(),
      },
    });

    if (flip.count === 0) return false;

    // No-op for an already-released booking; the freeing act for a live hold.
    await tx.bookingSlot.deleteMany({ where: { bookingId } });
    return true;
  });

  if (!removed) {
    return {
      ok: false,
      error:
        "This booking changed while you were removing it. Reload the page to see where it stands.",
      reason: "invalid",
    };
  }

  return { ok: true, data: { id: bookingId, releasedHours: wasHolding } };
}

/**
 * Extend a pending hold for the duration of a payment attempt.
 *
 * Called when checkout starts, so the hours are not swept out from under a
 * user who is mid-way through entering card details. Scoped to the owner and
 * to `status: 'pending'` in the WHERE clause, and it only ever pushes the
 * expiry *later* — it cannot resurrect a hold that has already lapsed, because
 * `holdExpiresAt: { gt: now }` is part of the match.
 */
export async function extendHoldForPayment(
  bookingId: string,
  userId: string
): Promise<BookingResult<{ holdExpiresAt: Date }>> {
  const holdExpiresAt = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60_000);

  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      userId,
      status: "pending",
      holdExpiresAt: { gt: new Date() },
    },
    data: { holdExpiresAt },
  });

  if (result.count === 0) {
    return {
      ok: false,
      error: "This hold has lapsed. Pick your slot again.",
      reason: "invalid",
    };
  }

  return { ok: true, data: { holdExpiresAt } };
}

/**
 * Mark a booking paid. **Only the verified `notify_url` webhook may call this**
 * (CLAUDE.md): the `return_url` redirect can be spoofed, so nothing on the
 * browser's path is allowed to reach it.
 *
 * The flip is a compare-and-set: `updateMany` matching `status: 'pending'`
 * either updates exactly one row or none. That makes it safe against the
 * expiry sweep running in the same instant — whichever lands first wins, and
 * there is no read-then-write window in between.
 *
 * Three outcomes the caller must distinguish:
 *  - `confirmed: true`  — this call did the flip; send the confirmation email.
 *  - `confirmed: false` — it was already confirmed (PayHere retried the
 *    webhook). Idempotent: nothing changes and no second email goes out.
 *  - `ok: false`        — the booking no longer holds its hours (the hold
 *    lapsed and the sweep released them). We must NOT confirm: the hours may
 *    already belong to someone else. The payment is still recorded as
 *    successful, and the caller escalates for a manual refund.
 */
export async function confirmPaidBooking(
  bookingId: string
): Promise<BookingResult<{ id: string; confirmed: boolean }>> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true },
  });

  if (!booking) {
    return { ok: false, error: "Booking not found.", reason: "notfound" };
  }

  if (booking.status === "confirmed") {
    return { ok: true, data: { id: bookingId, confirmed: false } };
  }

  const result = await prisma.booking.updateMany({
    where: { id: bookingId, status: "pending" },
    // The hold is over — this booking now owns its hours outright.
    data: { status: "confirmed", holdExpiresAt: null },
  });

  if (result.count === 0) {
    // Either the sweep expired it, or the user released it, between the read
    // above and here. Both mean the BookingSlot rows are gone.
    return {
      ok: false,
      error: `Booking ${bookingId} could not be confirmed — it no longer holds its hours (status ${booking.status}).`,
      reason: "invalid",
    };
  }

  return { ok: true, data: { id: bookingId, confirmed: true } };
}

/*
 * There is deliberately no `releaseUnpaidBooking` here any more.
 *
 * It existed for one caller — the webhook's `-1`/`-2` branch — and it flipped
 * the booking to `cancelled`, which meant a single declined card destroyed the
 * hold and left the user unable to retry. A failed payment attempt is not a
 * release: the only two things that end a hold are the user releasing it
 * (`removeOwnBooking`) and `holdExpiresAt` passing (`releaseExpiredHolds`).
 * See the comment on `settleUnpaid` in lib/payment-service.ts.
 */

/**
 * Block a court + date + slot so nobody can book it (maintenance, a match,
 * whatever). Stored as a `Booking` with status `blocked` plus its one
 * `BookingSlot`, so the availability query treats it like any other occupied
 * hour — no special-casing anywhere else in the app.
 *
 * Owned by the admin who created it (CLAUDE.md), which gives a free audit
 * trail of who blocked what.
 */
export async function blockSlot(input: {
  courtId: string;
  slotId: string;
  bookingDate: Date;
  adminId: string;
}): Promise<BookingResult<{ id: string }>> {
  const { courtId, slotId, bookingDate, adminId } = input;

  // The slot must actually belong to this court, and must recur on this
  // date's weekday — otherwise we would create a block that no availability
  // query could ever match, i.e. an invisible ghost row.
  const slot = await prisma.slotTemplate.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      courtId: true,
      dayOfWeek: true,
      price: true,
      court: { select: { bookingMode: true } },
    },
  });

  if (!slot || slot.courtId !== courtId) {
    return {
      ok: false,
      error: "That slot does not belong to this court.",
      reason: "invalid",
    };
  }

  if (slot.dayOfWeek !== dayOfWeekForDate(bookingDate)) {
    return {
      ok: false,
      error: "That slot does not run on the selected day.",
      reason: "invalid",
    };
  }

  await releaseExpiredHolds({ courtId, bookingDate });

  // A shared hour has no unique key to refuse a second block or a block over
  // live bookings, so the same rule is applied under the capacity lock: block
  // only an hour nobody holds — as on an exclusive court, a real booking is
  // never silently overridden; cancel it first.
  if (slot.court.bookingMode === "shared") {
    return prisma.$transaction(async (tx) => {
      await lockSharedHours(tx, dateToDateString(bookingDate), [slotId]);

      const occupying = await sharedOccupancyInTx(tx, courtId, bookingDate, [
        slotId,
      ]);
      if (occupying.length > 0) {
        return {
          ok: false as const,
          error: sharedHourLoad(occupying).blocked
            ? "That slot is already blocked for this date."
            : "That session already has bookings. Cancel them before blocking it.",
          reason: "taken" as const,
        };
      }

      const bookingReference = await nextBookingReference(
        tx,
        courtId,
        bookingDate
      );

      const booking = await tx.booking.create({
        data: {
          courtId,
          bookingDate,
          userId: adminId,
          playerCount: 0,
          durationHours: 1,
          totalPrice: 0,
          bookingReference,
          status: "blocked",
          slots: { create: [{ slotId, courtId, bookingDate, price: 0 }] },
        },
        select: { id: true },
      });

      return { ok: true as const, data: booking };
    });
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const bookingReference = await nextBookingReference(
        tx,
        courtId,
        bookingDate
      );

      return tx.booking.create({
        data: {
          courtId,
          bookingDate,
          userId: adminId,
          playerCount: 0, // a block has no players
          durationHours: 1,
          totalPrice: 0, // nor a price
          bookingReference,
          status: "blocked",
          slots: {
            create: [{ slotId, courtId, bookingDate, price: 0 }],
          },
        },
        select: { id: true },
      });
    });

    return { ok: true, data: booking };
  } catch (e) {
    // See the identical guard in createBooking above.
    if (isBookingReferenceCollision(e)) throw e;

    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error: "That slot is already booked or blocked for this date.",
        reason: "taken",
      };
    }
    throw e;
  }
}

/**
 * Block every slot a court runs on a given date, in one action.
 *
 * Thin wrapper around `blockSlot`, called once per slot template for that
 * weekday — so it inherits all of that function's guards (slot ownership,
 * shared-vs-exclusive handling, the unique-constraint race) rather than
 * duplicating them. A slot that already has a real booking is left alone,
 * same as blocking one slot at a time; it is reported back as skipped, not
 * treated as an error, since "most of the day" is still a useful result.
 */
export async function blockFullDay(input: {
  courtId: string;
  bookingDate: Date;
  adminId: string;
}): Promise<BookingResult<{ blocked: number; skipped: number }>> {
  const { courtId, bookingDate, adminId } = input;

  const slots = await prisma.slotTemplate.findMany({
    where: { courtId, dayOfWeek: dayOfWeekForDate(bookingDate) },
    select: { id: true },
  });

  if (slots.length === 0) {
    return {
      ok: false,
      error: "This court has no slots on this day.",
      reason: "invalid",
    };
  }

  let blocked = 0;
  let skipped = 0;

  for (const slot of slots) {
    const result = await blockSlot({
      courtId,
      slotId: slot.id,
      bookingDate,
      adminId,
    });
    if (result.ok) blocked++;
    else skipped++;
  }

  if (blocked === 0) {
    return {
      ok: false,
      error: "Every slot on this day is already booked or blocked.",
      reason: "taken",
    };
  }

  return { ok: true, data: { blocked, skipped } };
}

/**
 * Remove an admin block, freeing the slot.
 *
 * Scoped to `status: 'blocked'` in the WHERE clause, so this can never delete
 * a real customer booking even if handed the wrong id. The `BookingSlot` rows
 * go with it via ON DELETE CASCADE, which is what frees the hour.
 */
export async function unblockSlot(
  bookingId: string
): Promise<BookingResult<{ id: string }>> {
  const result = await prisma.booking.deleteMany({
    where: { id: bookingId, status: "blocked" },
  });

  if (result.count === 0) {
    return {
      ok: false,
      error: "That block no longer exists.",
      reason: "notfound",
    };
  }

  return { ok: true, data: { id: bookingId } };
}

/**
 * Thrown inside `adminDeleteBooking`'s transaction to roll it back when a guard
 * matches nothing. A real `Error` subclass rather than a sentinel value: Prisma
 * rethrows what an interactive transaction throws, and only an `Error` survives
 * that trip with its identity intact. Never escapes the function.
 */
class BookingChanged extends Error {}

/**
 * The statuses an admin may permanently delete.
 *
 * `confirmed` is deliberately absent, and so is `blocked`. A confirmed booking
 * is a payment record — the fix for one of those is a refund, never a delete —
 * and a block has its own control, "Unblock", which frees the hour and removes
 * the row in one step.
 *
 * Exported because the UI decides which button to *draw* from the same list the
 * server decides with. Drawing is a courtesy; the guard below is the boundary.
 */
export const DELETABLE_STATUSES: BookingStatus[] = [
  "pending",
  "cancelled",
  "expired",
];

/**
 * Permanently delete a booking row. Admin-only, and narrower than it looks.
 *
 * Cancelling keeps the row as history; this is the other thing an admin
 * sometimes wants — a test booking, a duplicate, an abandoned hold — gone. It
 * is refused for anything that represents money:
 *
 *   - status must still be one of `DELETABLE_STATUSES`;
 *   - the booking must have no **successful** payment. Status alone is not
 *     enough to decide that: `adminCancelBooking` can cancel a *paid* booking
 *     (the refund happens outside the app) and deliberately leaves the success
 *     `Payment` behind as the record of what was charged. That row is exactly
 *     what must never be deleted, so a `cancelled` booking carrying one is
 *     refused here as firmly as a `confirmed` one.
 *
 * Deleting a `pending` booking is also how its hours are released: the
 * `BookingSlot` rows go with the parent via ON DELETE CASCADE, and those rows
 * are the hold — the unique index protects (courtId, bookingDate, slotId) and
 * cannot see the parent's status.
 *
 * Unsuccessful payment attempts (pending, failed, cancelled) are deleted with
 * the booking. `Payment.bookingId` has no cascade, so they would otherwise
 * block the delete; and an attempt that never took money is not a record worth
 * keeping once the booking it belonged to is gone.
 *
 * ## The race
 *
 * The read below and the write after it are separate statements, and the
 * PayHere webhook is a different request that can confirm this booking in
 * between — the same race `flipAndReleaseHours` exists for. Deleting a booking
 * the webhook just confirmed would destroy a paid reservation outright, which
 * is worse than the double-sell. So the read is only for the error message: the
 * delete itself is guarded on the status *and* scoped so a success payment
 * appearing mid-flight cannot be swept up, and if either guard finds nothing
 * the whole transaction rolls back rather than leaving a confirmed booking
 * stripped of its payment attempts.
 */
export async function adminDeleteBooking(
  bookingId: string
): Promise<BookingResult<{ id: string }>> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      _count: { select: { payments: { where: { status: "success" } } } },
    },
  });

  if (!booking) {
    return { ok: false, error: "Booking not found.", reason: "notfound" };
  }

  if (booking.status === "blocked") {
    return {
      ok: false,
      error: "Use unblock to remove an admin block.",
      reason: "invalid",
    };
  }

  if (!DELETABLE_STATUSES.includes(booking.status)) {
    return {
      ok: false,
      error:
        "A confirmed booking is a payment record and cannot be deleted. Cancel it instead, and refund outside the app.",
      reason: "invalid",
    };
  }

  if (booking._count.payments > 0) {
    return {
      ok: false,
      error:
        "This booking has a successful payment, so it stays as a record. Refund it outside the app rather than deleting it.",
      reason: "invalid",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Scoped to the parent's status as well as its own, so an attempt row is
      // never removed from a booking that has meanwhile been confirmed.
      await tx.payment.deleteMany({
        where: {
          bookingId,
          status: { not: "success" },
          booking: { status: { in: DELETABLE_STATUSES } },
        },
      });

      const deleted = await tx.booking.deleteMany({
        where: { id: bookingId, status: { in: DELETABLE_STATUSES } },
      });

      if (deleted.count === 0) throw new BookingChanged();
    });
  } catch (e) {
    if (e instanceof BookingChanged) {
      return {
        ok: false,
        error:
          "That booking changed while you were deleting it. Reload the page to see where it stands.",
        reason: "invalid",
      };
    }

    // A success payment created between the check above and the delete leaves
    // its foreign key behind, and Postgres refuses the delete (P2003). That is
    // the correct outcome — say so rather than surfacing a driver error.
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: unknown }).code === "P2003"
    ) {
      return {
        ok: false,
        error:
          "This booking was just paid for, so it stays as a record. Reload the page.",
        reason: "invalid",
      };
    }

    throw e;
  }

  return { ok: true, data: { id: bookingId } };
}

/**
 * Admin-initiated cancellation of a real booking, freeing its hours.
 *
 * v1 does not refund money (see PRD "out of scope"), so this only moves the
 * booking's status — any successful `Payment` row is left untouched as a
 * record of what was actually charged. The `BookingSlot` rows are deleted:
 * a cancelled booking that kept them would leave the hours permanently
 * unsellable, since the unique index cannot see the parent's status.
 */
export async function adminCancelBooking(
  bookingId: string
): Promise<BookingResult<{ id: string }>> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true },
  });

  if (!booking) {
    return { ok: false, error: "Booking not found.", reason: "notfound" };
  }

  if (booking.status === "cancelled" || booking.status === "expired") {
    return {
      ok: false,
      error: "That booking is already cancelled.",
      reason: "invalid",
    };
  }

  if (booking.status === "blocked") {
    return {
      ok: false,
      error: "Use unblock to remove an admin block.",
      reason: "invalid",
    };
  }

  // Guarded on exactly the statuses the checks above accepted. Note this is NOT
  // `pending` only: cancelling a *paid* booking is a legitimate admin act (the
  // refund happens outside the app), so a webhook confirming the booking
  // mid-cancel does not invalidate the admin's decision — it is already in the
  // guard. What the guard does stop is cancelling a booking that has meanwhile
  // become `cancelled`, `expired` or `blocked`, which is what the read above
  // rejected and the write used to allow.
  const released = await flipAndReleaseHours({
    ids: [bookingId],
    guard: { status: { in: ["pending", "confirmed"] } },
    status: "cancelled",
  });

  if (released === 0) {
    return {
      ok: false,
      error:
        "That booking changed while you were cancelling it. Reload the page to see where it stands.",
      reason: "invalid",
    };
  }

  return { ok: true, data: { id: bookingId } };
}
