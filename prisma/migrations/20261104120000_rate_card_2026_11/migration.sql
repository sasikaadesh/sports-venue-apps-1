-- Data migration — the November 2026 rate card (LKR per hour).
--
--   Cricket Nets - Double   2,800      Cricket Net - Astro     1,700
--   Basketball              2,200      Cricket Net - Concrete  1,400
--   Badminton               1,700      Table Tennis (both)     1,200
--   Tennis - Main           1,700      Swimming Pool           1,200
--   Fitness Center            700
--
-- Tennis - Mini (the junior court) is deliberately NOT on this card and keeps
-- its own rate.
--
-- Unlike the Rs.200 rise (20261001120000), every rate here is an absolute SET,
-- so the migration is idempotent and leaves every hour of a court at one price.
-- Courts are matched by current name or a former name (prisma/seed.mts
-- `aliases`); a court not found is simply skipped.
--
-- Existing bookings are untouched, by construction: only SlotTemplate.price
-- changes. What a booking costs is frozen on BookingSlot.price and
-- Booking.totalPrice — the amount sent to PayHere (lib/payment-service.ts) —
-- so a pending hold placed before this runs is still charged what it was
-- quoted.
--
-- The public catalogue is cached (lib/catalogue.ts) and a migration cannot call
-- revalidateCatalogue(): changes show within the 5-minute safety-net TTL, or at
-- once after a server restart.

UPDATE "SlotTemplate" AS st
SET "price" = rate.price
FROM "Court" AS c,
  (VALUES
    ('Cricket Nets - Double', 2800),
    ('Basketball', 2200),
    ('Badminton', 1700),
    ('Badminton Court 1', 1700),
    ('Tennis - Main', 1700),
    ('Centre Court', 1700),
    ('Tennis', 1700),
    ('Cricket Net - Astro', 1700),
    ('Cricket Net - Concrete', 1400),
    ('Table Tennis - Arena 1', 1200),
    ('Table Tennis', 1200),
    ('Table Tennis - Arena 2', 1200),
    ('Swimming Pool', 1200),
    ('Fitness Center', 700)
  ) AS rate(name, price)
WHERE st."courtId" = c."id"
  AND c."name" = rate.name;
