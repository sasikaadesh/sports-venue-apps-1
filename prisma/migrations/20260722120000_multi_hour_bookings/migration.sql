-- Phase 7 — multi-hour bookings.
--
-- Splits the one-booking-is-one-hour model into the two tables ARCHITECTURE.md
-- describes:
--
--   Booking      one reservation, spanning N consecutive hours
--   BookingSlot  one row per reserved HOUR — the row the unique constraint
--                protects
--
-- The anti-double-booking guarantee therefore moves from Booking to
-- BookingSlot, unchanged in shape: UNIQUE (courtId, bookingDate, slotId).
-- A 3-hour booking now owns three independently-protected rows, and inserting
-- them in one transaction is what makes a multi-hour reservation atomic.
--
-- Written by hand rather than generated: `prisma migrate dev` needs a shadow
-- database, and replaying 20260721120000 there fails because the shadow DB has
-- no Supabase `auth` schema. Apply with `prisma migrate deploy`.

-- ---------------------------------------------------------------------------
-- 1. New parent columns
-- ---------------------------------------------------------------------------

ALTER TABLE "Booking" ADD COLUMN "durationHours" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. The hour table
-- ---------------------------------------------------------------------------

CREATE TABLE "BookingSlot" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "courtId" UUID NOT NULL,
    "bookingDate" DATE NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "BookingSlot_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3. Carry existing rows across
-- ---------------------------------------------------------------------------

-- Every pre-existing booking was exactly one hour, so it becomes one child row.
-- Only statuses that actually HOLD the hour are carried over: a cancelled or
-- expired booking must not keep occupying the unique key (see note 5 below).
INSERT INTO "BookingSlot" ("id", "bookingId", "slotId", "courtId", "bookingDate", "price")
SELECT
    gen_random_uuid(),
    b."id",
    b."slotId",
    b."courtId",
    b."bookingDate",
    COALESCE(s."price", 0)
FROM "Booking" b
LEFT JOIN "SlotTemplate" s ON s."id" = b."slotId"
WHERE b."status" IN ('confirmed', 'pending', 'blocked');

-- Freeze the total from the hours just created. Blocks stay at 0.
UPDATE "Booking" b
SET "totalPrice" = COALESCE(
        (SELECT SUM(bs."price") FROM "BookingSlot" bs WHERE bs."bookingId" = b."id"),
        0
    )
WHERE b."status" <> 'blocked';

-- ---------------------------------------------------------------------------
-- 4. Retire the per-hour columns on the parent
-- ---------------------------------------------------------------------------

ALTER TABLE "Booking" DROP CONSTRAINT "Booking_slotId_fkey";
DROP INDEX "Booking_courtId_bookingDate_slotId_key";
ALTER TABLE "Booking" DROP COLUMN "slotId";

-- ---------------------------------------------------------------------------
-- 5. Constraints and indexes
-- ---------------------------------------------------------------------------

-- THE anti-double-booking guarantee. Note it cannot reference the parent's
-- status, which is why releasing a booking deletes its BookingSlot rows rather
-- than leaving them behind.
CREATE UNIQUE INDEX "BookingSlot_courtId_bookingDate_slotId_key"
    ON "BookingSlot"("courtId", "bookingDate", "slotId");

CREATE INDEX "BookingSlot_bookingId_idx" ON "BookingSlot"("bookingId");
CREATE INDEX "BookingSlot_courtId_bookingDate_idx" ON "BookingSlot"("courtId", "bookingDate");

-- Sweeping expired holds scans on exactly this pair.
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

-- Deleting the parent releases every hour it held.
ALTER TABLE "BookingSlot" ADD CONSTRAINT "BookingSlot_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingSlot" ADD CONSTRAINT "BookingSlot_slotId_fkey"
    FOREIGN KEY ("slotId") REFERENCES "SlotTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingSlot" ADD CONSTRAINT "BookingSlot_courtId_fkey"
    FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. RLS for the new table (second layer — see 20260721120000 for the why)
-- ---------------------------------------------------------------------------

-- No UPDATE grant: a held hour is never edited in place. It is created with
-- its booking and deleted when the booking releases it.
GRANT SELECT, INSERT, DELETE ON public."BookingSlot" TO authenticated;

ALTER TABLE public."BookingSlot" ENABLE ROW LEVEL SECURITY;

-- Visibility follows the parent booking: your own hours, or everything if admin.
DROP POLICY IF EXISTS "bookingslot_select_own" ON public."BookingSlot";
CREATE POLICY "bookingslot_select_own" ON public."BookingSlot"
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b.id = "BookingSlot"."bookingId" AND b."userId" = auth.uid()
    )
  );

-- A user may only add hours to their own, still-pending booking. Attaching an
-- hour to a confirmed booking would extend a paid reservation for free.
DROP POLICY IF EXISTS "bookingslot_insert_own" ON public."BookingSlot";
CREATE POLICY "bookingslot_insert_own" ON public."BookingSlot"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b.id = "BookingSlot"."bookingId"
        AND b."userId" = auth.uid()
        AND b.status = 'pending'::"BookingStatus"
    )
  );

DROP POLICY IF EXISTS "bookingslot_delete_own" ON public."BookingSlot";
CREATE POLICY "bookingslot_delete_own" ON public."BookingSlot"
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b.id = "BookingSlot"."bookingId" AND b."userId" = auth.uid()
    )
  );
