-- Index the admin views' sort/filter column.
--
-- Every other hot read is already index-covered: availability goes through
-- "BookingSlot" (courtId, bookingDate), the account list through
-- "Booking" (userId, removedAt), the expiry sweep through
-- "Booking" (status, holdExpiresAt).
--
-- The two admin reads are the exception. /admin orders upcoming bookings by
-- bookingDate with a status filter, and /admin/bookings sorts the whole table
-- by bookingDate DESC. Neither had an index on bookingDate at all, so both
-- scan and sort the table.
--
-- (bookingDate, status) serves both: the leading column carries the range scan
-- and the ordering, the second lets the overview's status filter be applied
-- from the index. Additive and non-blocking to write — it creates no
-- constraint and changes no existing behaviour.

CREATE INDEX IF NOT EXISTS "Booking_bookingDate_status_idx"
  ON public."Booking" ("bookingDate", "status");
