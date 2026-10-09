import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { dateToDateString } from "@/lib/time";

/**
 * The readable, stable `Booking.bookingReference` — e.g. "BAD-0915-003"
 * (Badminton, 15 Sep, the 3rd booking made against that court on that date).
 *
 * **Assigned exactly once**, inside the same transaction that writes the
 * `Booking` row, and never touched again — cancelling or deleting an earlier
 * booking on the same court/date does not renumber anything, because the
 * counter in `BookingSequence` only ever goes up (docs/ARCHITECTURE.md →
 * "Booking reference").
 */

/**
 * Known facility → prefix, matching the migration's backfill
 * (`20261009120000_security_staff_and_booking_reference`). Kept here too so a
 * court whose name matches one of these gets the *same* prefix a human would
 * expect, even if `Court.referencePrefix` was somehow cleared.
 */
const KNOWN_PREFIXES: { test: RegExp; prefix: string }[] = [
  { test: /^badminton/i, prefix: "BAD" },
  { test: /^basketball/i, prefix: "BAS" },
  { test: /^tennis/i, prefix: "TEN" },
  { test: /astro/i, prefix: "CRA" },
  { test: /concrete/i, prefix: "CRC" },
  { test: /double/i, prefix: "CRD" },
  { test: /^table tennis/i, prefix: "TT" },
  { test: /^swimming pool/i, prefix: "POOL" },
  { test: /^fitness/i, prefix: "FIT" },
  { test: /^cricket nets/i, prefix: "CRN" },
];

/**
 * Derive a short prefix from a court name we have never seen before —
 * initials of up to the first three words, uppercased, letters/digits only.
 * "Volleyball Court 2" -> "VC2"; a single word falls back to its first three
 * letters: "Squash" -> "SQU".
 */
function derivePrefix(name: string): string {
  const known = KNOWN_PREFIXES.find((k) => k.test.test(name));
  if (known) return known.prefix;

  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (words.length >= 2) {
    const initials = words
      .slice(0, 4)
      .map((w) => w[0]!.toUpperCase())
      .join("");
    return initials.slice(0, 4) || "CRT";
  }

  const word = words[0] ?? "COURT";
  return word.slice(0, 4).toUpperCase() || "CRT";
}

/**
 * The court's prefix, computed once and persisted forever.
 *
 * Reads `Court.referencePrefix` first — the common case, either backfilled by
 * the migration or written by an earlier call to this function for the same
 * court. Only derives and writes a new one the first time a court is ever
 * booked without one, inside the same transaction as the booking that needed
 * it, so two concurrent first-time bookings on the same new court cannot
 * write two different prefixes: the second write is a no-op `UPDATE`, not a
 * race, because both derive the same deterministic value from the same name.
 */
export async function ensureCourtReferencePrefix(
  tx: Prisma.TransactionClient,
  courtId: string
): Promise<string> {
  const court = await tx.court.findUniqueOrThrow({
    where: { id: courtId },
    select: { name: true, referencePrefix: true },
  });

  if (court.referencePrefix) return court.referencePrefix;

  const prefix = derivePrefix(court.name);

  await tx.court.update({
    where: { id: courtId },
    data: { referencePrefix: prefix },
  });

  return prefix;
}

/**
 * Atomically take the next sequence number for a court + date, and build the
 * reference string from it.
 *
 * The increment is a single `INSERT ... ON CONFLICT ... DO UPDATE ...
 * RETURNING`, which takes Postgres's own row lock on the `(courtId,
 * bookingDate)` counter — exactly the same shape as `lockSharedHours`'s
 * advisory lock, but backed by a real row rather than a hash, since this one
 * also has to persist a number. Two bookings created concurrently for the
 * same court and date therefore always get two different, gapless-within-a-
 * transaction sequence numbers, never the same one.
 */
export async function nextBookingReference(
  tx: Prisma.TransactionClient,
  courtId: string,
  bookingDate: Date
): Promise<string> {
  const prefix = await ensureCourtReferencePrefix(tx, courtId);
  const dateString = dateToDateString(bookingDate);
  const mmdd = dateString.slice(5, 7) + dateString.slice(8, 10);

  const rows = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "BookingSequence" ("id", "courtId", "bookingDate", "lastSeq")
    VALUES (gen_random_uuid(), ${courtId}::uuid, ${bookingDate}::date, 1)
    ON CONFLICT ("courtId", "bookingDate")
    DO UPDATE SET "lastSeq" = "BookingSequence"."lastSeq" + 1
    RETURNING "lastSeq"
  `;

  const seq = rows[0]?.lastSeq ?? 1;
  return `${prefix}-${mmdd}-${String(seq).padStart(3, "0")}`;
}
