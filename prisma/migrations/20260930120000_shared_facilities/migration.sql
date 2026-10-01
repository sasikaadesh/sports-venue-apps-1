-- Shared facilities — a Court can now be EXCLUSIVE (one booking per hour, as
-- every court has always been) or SHARED (a gym, a pool: many people book the
-- same hour, optionally up to a capacity).
--
-- The anti-double-booking guarantee for exclusive courts is kept exactly as it
-- was, and is kept IN THE DATABASE. The unique key on BookingSlot gains a fourth
-- column, "exclusive", which a trigger derives from the court:
--
--   exclusive court -> "exclusive" = TRUE  (every row the same value, so
--                      UNIQUE (courtId, bookingDate, slotId, exclusive) is
--                      precisely the old UNIQUE (courtId, bookingDate, slotId))
--   shared court    -> "exclusive" = NULL  (NULLs are distinct in a Postgres
--                      unique index, so shared rows never collide)
--
-- Why not a partial unique index (WHERE ...)? Prisma 6 cannot express one, so
-- the next `prisma migrate` would see it as drift and drop it — silently
-- removing the guarantee. This shape is fully described in schema.prisma.
--
-- The trigger, not the app, decides the flag: application code cannot set it,
-- so no code path can accidentally switch a court's protection off. It falls
-- back to TRUE (exclusive) if the court cannot be read — fail closed.
--
-- Written by hand like the other migrations (the shadow DB has no Supabase
-- `auth` schema). Apply with `prisma migrate deploy`.

-- ---------------------------------------------------------------------------
-- 1. Court: booking mode + optional capacity
-- ---------------------------------------------------------------------------

CREATE TYPE "BookingMode" AS ENUM ('exclusive', 'shared');

ALTER TABLE "Court" ADD COLUMN "bookingMode" "BookingMode" NOT NULL DEFAULT 'exclusive';

-- Max people per hour for a SHARED facility; NULL = unlimited. Ignored for
-- exclusive courts, where the unique constraint already caps an hour at one.
ALTER TABLE "Court" ADD COLUMN "capacity" INTEGER;
ALTER TABLE "Court" ADD CONSTRAINT "Court_capacity_positive"
    CHECK ("capacity" IS NULL OR "capacity" >= 1);

-- ---------------------------------------------------------------------------
-- 2. BookingSlot: the "exclusive" flag and the widened unique key
-- ---------------------------------------------------------------------------

-- Every existing court is exclusive, so every existing row is TRUE.
ALTER TABLE "BookingSlot" ADD COLUMN "exclusive" BOOLEAN DEFAULT true;

-- Build the new key before dropping the old one, so there is no instant with
-- no guarantee at all.
CREATE UNIQUE INDEX "BookingSlot_courtId_bookingDate_slotId_exclusive_key"
    ON "BookingSlot"("courtId", "bookingDate", "slotId", "exclusive");

DROP INDEX "BookingSlot_courtId_bookingDate_slotId_key";

CREATE OR REPLACE FUNCTION public.booking_slot_set_exclusive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW."exclusive" := CASE
    WHEN (SELECT c."bookingMode" FROM public."Court" c WHERE c.id = NEW."courtId")
         = 'shared'::"BookingMode"
      THEN NULL
    ELSE TRUE
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_slot_set_exclusive ON public."BookingSlot";
CREATE TRIGGER booking_slot_set_exclusive
  BEFORE INSERT OR UPDATE ON public."BookingSlot"
  FOR EACH ROW EXECUTE FUNCTION public.booking_slot_set_exclusive();

-- ---------------------------------------------------------------------------
-- 3. A court's mode cannot change under live bookings
-- ---------------------------------------------------------------------------

-- The flag is denormalised onto each hour-row, so switching a court's mode
-- while it holds today's or future hours would leave those rows with the wrong
-- value (a court turned exclusive with three people in the 18:00 hour). Past
-- hours can never be booked again, so they do not block a switch; they keep
-- the flag they were written with, as history.
CREATE OR REPLACE FUNCTION public.court_guard_booking_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW."bookingMode" IS DISTINCT FROM OLD."bookingMode" AND EXISTS (
    SELECT 1 FROM public."BookingSlot" bs
    WHERE bs."courtId" = NEW.id
      AND bs."bookingDate" >= (now() AT TIME ZONE 'Asia/Colombo')::date
  ) THEN
    RAISE EXCEPTION 'Court % has upcoming bookings; its booking mode cannot change', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS court_guard_booking_mode ON public."Court";
CREATE TRIGGER court_guard_booking_mode
  BEFORE UPDATE OF "bookingMode" ON public."Court"
  FOR EACH ROW EXECUTE FUNCTION public.court_guard_booking_mode();

-- Trigger helpers are not API: nobody calls them directly.
REVOKE ALL ON FUNCTION public.booking_slot_set_exclusive() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_guard_booking_mode() FROM PUBLIC, anon, authenticated;
