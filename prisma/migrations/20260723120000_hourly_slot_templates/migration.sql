-- Phase 5–7 fix — enforce strictly 1-hour slot templates.
--
-- The schedule model is now hourly: every SlotTemplate is exactly one bookable
-- hour, generated across a weekday's operating range (see docs/ARCHITECTURE.md
-- "Admin panel"). Any pre-existing template that spans more than an hour — the
-- seed "Centre Court, Monday 06:00–22:00 @ LKR 1,000" is the one this project
-- shipped with — is oversized under the new model and must go, so no slot can
-- ever offer a multi-hour block again.
--
-- Data-only migration (no schema change). Apply with `prisma migrate deploy`;
-- `prisma migrate dev` needs a shadow DB, which this project's Supabase `auth`
-- dependency cannot provide (see 20260722120000).

-- The FK from BookingSlot -> SlotTemplate is RESTRICT, so drop any hour-rows
-- pointing at an oversized template first. In practice these are dev-seed
-- reservations only: a real hold/booking is always a genuine 1-hour slot.
DELETE FROM "BookingSlot" bs
USING "SlotTemplate" s
WHERE bs."slotId" = s."id"
  AND (s."endTime" - s."startTime") > INTERVAL '1 hour';

-- Now the oversized templates themselves.
DELETE FROM "SlotTemplate" s
WHERE (s."endTime" - s."startTime") > INTERVAL '1 hour';
