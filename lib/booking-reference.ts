import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { dateToDateString } from "@/lib/time";

/**
 * The readable, stable `Booking.bookingReference` — e.g. "BAD-260915-003"
 * (Badminton, 15 Sep 2026, the 3rd booking made against that court on that
 * date).
 *
 * **Assigned exactly once**, inside the same transaction that writes the
 * `Booking` row, and never touched again — cancelling or deleting an earlier
 * booking on the same court/date does not renumber anything, because the
 * counter in `BookingSequence` only ever goes up (docs/ARCHITECTURE.md →
 * "Booking reference").
 *
 * **The date segment carries the year (`YYMMDD`, not `MMDD`).** An earlier
 * version used `MMDD` alone: `BookingSequence` is correctly keyed by the
 * *full* `bookingDate` (year included), so the counter itself never
 * collided — but the year-less *string* did, the moment the same court
 * reached the same calendar date a year later. `BAD-0915-001` from 2026 and
 * the genuinely different `BAD-0915-001` from 2027 are the same string, and
 * `Booking.bookingReference` is globally `@unique`, so the second one's
 * insert failed and rolled back the whole booking with it — taking the
 * counter back down too, so every retry hit the exact same collision again.
 * That court and date would have stayed permanently unbookable. `YYMMDD`
 * closes it structurally: nothing here depends on remembering to check.
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

/** How many numbered variants to try before giving up — see the loop below. */
const MAX_PREFIX_ATTEMPTS = 50;

/**
 * The court's prefix, computed once and persisted forever.
 *
 * Reads `Court.referencePrefix` first — the common case, either backfilled by
 * the migration or written by an earlier call to this function for the same
 * court. Only derives and claims a new one the first time a court is ever
 * booked without one, inside the same transaction as the booking that needed
 * it.
 *
 * `Court.referencePrefix` is `UNIQUE`. Two *different* courts whose names
 * derive the same prefix — "Badminton" and a later "Badminton 2" would both
 * derive `BAD` — must not both start writing references under it, or the
 * global uniqueness of `Booking.bookingReference` is only cosmetic. So this
 * tries the plain derived prefix, then numbered variants (`BAD2`, `BAD3`, …)
 * until one actually commits as free.
 *
 * **Each attempt is a single conditional `UPDATE`
 * (`WHERE id = … AND NOT EXISTS (… another court already has it …)`), never a
 * plain write wrapped in a try/catch for P2002.** A caught unique violation
 * cannot be retried inside the SAME transaction: Postgres aborts the whole
 * transaction the instant any statement in it errors — "current transaction
 * is aborted, commands ignored until end of transaction block" — so a
 * catch-and-try-the-next-candidate loop would only succeed on its first
 * attempt and throw a confusing, unrelated-looking error on every one after
 * that. The conditional `UPDATE` affects zero rows instead of erroring when
 * `candidate` is taken, which costs nothing and keeps the transaction alive
 * for the next iteration. (Two different courts getting their first-ever
 * booking at the exact same instant, deriving the exact same candidate, can
 * still race each other into a genuine unique-constraint error here — that
 * is a real, if vanishingly rare, conflict between two separate booking
 * attempts, correctly surfaced as a failure to retry, not something this
 * function should paper over.)
 *
 * Two concurrent first-time bookings on the SAME court are still safe and
 * still cheap: both derive the identical value from the identical name, the
 * `UPDATE`s target the identical row, and Postgres simply serialises them —
 * by the time the second one runs, the row already holds the value it is
 * about to be set to again.
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

  const base = derivePrefix(court.name);

  for (let attempt = 0; attempt < MAX_PREFIX_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;

    const rows = await tx.$queryRaw<{ referencePrefix: string }[]>`
      UPDATE "Court"
      SET "referencePrefix" = ${candidate}
      WHERE "id" = ${courtId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM "Court" other
          WHERE other."referencePrefix" = ${candidate} AND other."id" <> ${courtId}::uuid
        )
      RETURNING "referencePrefix"
    `;

    if (rows[0]) return rows[0].referencePrefix;
    // `candidate` belongs to another court already — try the next one.
  }

  throw new Error(
    `Could not find a free booking-reference prefix for court ${courtId} ` +
      `(tried "${base}" and ${MAX_PREFIX_ATTEMPTS - 1} numbered variants).`
  );
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
  // YYMMDD, not MMDD — see the module doc for why the year has to be in the
  // string itself, not just in the counter it is built from.
  const yymmdd =
    dateString.slice(2, 4) + dateString.slice(5, 7) + dateString.slice(8, 10);

  const rows = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "BookingSequence" ("id", "courtId", "bookingDate", "lastSeq")
    VALUES (gen_random_uuid(), ${courtId}::uuid, ${bookingDate}::date, 1)
    ON CONFLICT ("courtId", "bookingDate")
    DO UPDATE SET "lastSeq" = "BookingSequence"."lastSeq" + 1
    RETURNING "lastSeq"
  `;

  const seq = rows[0]?.lastSeq ?? 1;
  return `${prefix}-${yymmdd}-${String(seq).padStart(3, "0")}`;
}
