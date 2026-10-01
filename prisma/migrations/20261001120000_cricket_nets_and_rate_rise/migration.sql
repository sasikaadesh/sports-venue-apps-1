-- Data migration — two content changes, applied exactly once.
--
-- 1. A Rs.200 rise on every hourly rate.
-- 2. The single "Cricket Nets" court is replaced by three separate nets:
--    "Cricket Net - Astro", "Cricket Net - Concrete", "Cricket Nets - Double".
--
-- Why a migration and not a script: the rate rise is not idempotent (a second
-- run would add another 200), and `_prisma_migrations` is what guarantees it
-- runs once per database.
--
-- Existing bookings are untouched, by construction:
--  - Only SlotTemplate.price changes. What a booking costs is frozen on the
--    booking itself — BookingSlot.price per hour and Booking.totalPrice, which
--    is also the amount sent to PayHere (lib/payment-service.ts) — and neither
--    column is written here. A pending hold placed before this runs is still
--    charged what it was quoted.
--  - "Cricket Nets" is DEACTIVATED, not renamed or deleted. Its bookings,
--    payments and special requests keep pointing at it and keep reading
--    "Cricket Nets"; inactive only stops new bookings and hides it from the
--    public pages (the admin panel still lists it, marked Inactive).
--
-- On a fresh database (migrations run before `npm run db:seed`) there are no
-- templates and no Cricket court type yet, so every step below is a no-op and
-- the seed — which already carries the new courts and rates — fills things in.
--
-- The public catalogue is cached (lib/catalogue.ts) and a migration cannot call
-- revalidateCatalogue(): changes show within the 5-minute safety-net TTL, or at
-- once after a server restart.

-- ---------------------------------------------------------------------------
-- 1. Rs.200 on every hourly rate — every court and facility, active or not, so
--    an hour an admin switches back on later comes back at the new rate.
--    Runs BEFORE the new nets are inserted, which are given their final rate.
-- ---------------------------------------------------------------------------

UPDATE "SlotTemplate" SET "price" = "price" + 200;

-- ---------------------------------------------------------------------------
-- 2. Retire the old single court.
-- ---------------------------------------------------------------------------

UPDATE "Court" SET "isActive" = false WHERE "name" = 'Cricket Nets';

-- ---------------------------------------------------------------------------
-- 3. The three nets — Cricket type, exclusive (the default), 18:00–21:00 every
--    day as three 1-hour slots, the same window as every other court.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  cricket_type uuid;
  net record;
  new_court uuid;
BEGIN
  SELECT id INTO cricket_type FROM "CourtType" WHERE "name" = 'Cricket';
  IF cricket_type IS NULL THEN
    RETURN; -- fresh database: the seed creates these
  END IF;

  FOR net IN
    SELECT * FROM (VALUES
      (
        'Cricket Net - Astro',
        'Synthetic astro-turf practice net with a true, consistent bounce close to a grass pitch. Floodlit for evening sessions — book the lane for batting or bowling practice.',
        ARRAY[
          'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&w=1600&q=80',
          'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1600&q=80'
        ],
        1700
      ),
      (
        'Cricket Net - Concrete',
        'Concrete practice strip laid with matting, giving pace and an even, predictable bounce. Well suited to quick bowling and back-foot work. Floodlit for evening sessions.',
        ARRAY[
          'https://images.unsplash.com/photo-1593341646782-e0b495cff86d?auto=format&fit=crop&w=1600&q=80',
          'https://images.unsplash.com/photo-1589801258579-18e091f4ca26?auto=format&fit=crop&w=1600&q=80'
        ],
        1400
      ),
      (
        'Cricket Nets - Double',
        'Two adjoining practice nets booked together — room for a full squad session, with batters and bowlers rotating across both lanes. Floodlit for evening sessions.',
        ARRAY[
          'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1600&q=80',
          'https://images.unsplash.com/photo-1607734834519-d8576ae60ea6?auto=format&fit=crop&w=1600&q=80'
        ],
        2800
      )
    ) AS v(name, description, images, price)
  LOOP
    -- Court.name is not unique: skip a net that already exists rather than
    -- duplicate it (e.g. one an admin created by hand before this ran).
    IF EXISTS (SELECT 1 FROM "Court" WHERE "name" = net.name) THEN
      CONTINUE;
    END IF;

    INSERT INTO "Court" ("id", "name", "courtTypeId", "description", "amenities", "images", "isActive")
    VALUES (gen_random_uuid(), net.name, cricket_type, net.description, 'Floodlights', net.images, true)
    RETURNING "id" INTO new_court;

    -- TIME columns hold wall-clock values (lib/time.ts), so make_time is exact.
    INSERT INTO "SlotTemplate" ("id", "courtId", "dayOfWeek", "startTime", "endTime", "price", "isActive")
    SELECT gen_random_uuid(), new_court, d, make_time(h, 0, 0), make_time(h + 1, 0, 0), net.price, true
    FROM generate_series(0, 6) AS d, generate_series(18, 20) AS h;
  END LOOP;
END
$$;
