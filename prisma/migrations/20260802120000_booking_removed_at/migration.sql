-- "Remove" on the user's own bookings list.
--
-- A booking is a record — it may already carry Payment attempt rows, and RLS
-- grants DELETE on "Booking" to admins only (see the booking_delete_admin
-- policy). So the user's remove is a soft one: the row stays, and only the
-- account page's own list filters it out.
--
-- Removing a booking that is still holding hours releases them first — that is
-- a DELETE of its "BookingSlot" rows, exactly as an expired hold or a
-- cancellation does (docs/ARCHITECTURE.md → the paid/unpaid divide). The
-- existing booking_update_own policy already permits the owner to move their
-- own booking to 'cancelled', so no policy changes are needed here.

ALTER TABLE public."Booking"
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);

-- The account list reads (userId, removedAt IS NULL); keep it index-covered.
CREATE INDEX IF NOT EXISTS "Booking_userId_removedAt_idx"
  ON public."Booking" ("userId", "removedAt");
