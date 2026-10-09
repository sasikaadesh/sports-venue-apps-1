-- Security staff login + stored booking reference.
--
-- Three independent pieces:
--   1. `Court.referencePrefix` + `Booking.bookingReference` + `BookingSequence`
--      — the readable, stable booking code (docs/ARCHITECTURE.md → "Booking
--      reference").
--   2. `SecurityStaff` — individual username+PIN logins for security staff.
--      Deliberately NOT a Supabase Auth user and NOT a `Role` value: see the
--      model's doc comment in schema.prisma and docs/ARCHITECTURE.md →
--      "Security staff". Only `lib/security-staff/*` (service-role-equivalent,
--      Prisma) ever touches this table — anon and authenticated get nothing.
--   3. Handwritten rather than `prisma migrate dev` output: the project's
--      shadow database has no `auth` schema (Supabase-only), so the shadow-DB
--      diff this command normally runs fails before it reaches Postgres at
--      all. Applied with `prisma migrate deploy`, which does not need one.

-- ---------------------------------------------------------------------------
-- 1. Booking reference
-- ---------------------------------------------------------------------------

ALTER TABLE "Court" ADD COLUMN "referencePrefix" TEXT;

-- Known facilities get their prefix now, matching the mapping in
-- lib/booking-reference.ts. Anything not matched here (a court created later,
-- or one renamed since) stays NULL — the first reference ever generated for
-- it derives one from the name and writes it back
-- (`ensureCourtReferencePrefix`), so this list only has to be right once.
UPDATE "Court" SET "referencePrefix" = CASE
  WHEN name ILIKE 'Badminton%'      THEN 'BAD'
  WHEN name ILIKE 'Basketball%'     THEN 'BAS'
  WHEN name ILIKE 'Tennis%'         THEN 'TEN'
  WHEN name ILIKE '%Astro%'         THEN 'CRA'
  WHEN name ILIKE '%Concrete%'      THEN 'CRC'
  WHEN name ILIKE '%Double%'        THEN 'CRD'
  WHEN name ILIKE 'Table Tennis%'   THEN 'TT'
  WHEN name ILIKE 'Swimming Pool%'  THEN 'POOL'
  WHEN name ILIKE 'Fitness%'        THEN 'FIT'
  WHEN name ILIKE 'Cricket Nets%'   THEN 'CRN'
  ELSE NULL
END;

ALTER TABLE "Booking" ADD COLUMN "bookingReference" TEXT;
CREATE UNIQUE INDEX "Booking_bookingReference_key" ON "Booking"("bookingReference");

CREATE TABLE "BookingSequence" (
    "id" UUID NOT NULL,
    "courtId" UUID NOT NULL,
    "bookingDate" DATE NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BookingSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingSequence_courtId_bookingDate_key" ON "BookingSequence"("courtId", "bookingDate");

ALTER TABLE "BookingSequence" ADD CONSTRAINT "BookingSequence_courtId_fkey"
  FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Read/write only through Prisma (lib/booking-reference.ts), same trust level
-- as BookingSlot's denormalised columns. RLS with no policies at all is the
-- deny-everything default for the anon-key path; Supabase's default
-- privileges would otherwise hand anon SELECT on this table the moment it is
-- created (see the SecurityStaff grants below for the same concern spelled
-- out in full).
ALTER TABLE "BookingSequence" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "BookingSequence" FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Security staff logins
-- ---------------------------------------------------------------------------

CREATE TABLE "SecurityStaff" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "SecurityStaff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecurityStaff_username_key" ON "SecurityStaff"("username");

ALTER TABLE "SecurityStaff" ADD CONSTRAINT "SecurityStaff_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- This table holds a PIN hash. Nobody reaches it through the anon key, ever —
-- not even to check a username exists. RLS is enabled with ZERO policies
-- (the deny-everything default for `authenticated`/`anon`), and the grant is
-- revoked explicitly rather than assumed absent: Supabase's
-- `ALTER DEFAULT PRIVILEGES` hands `anon` full DML on every new table in
-- `public` the moment it is created (docs/ARCHITECTURE.md → "Conduct
-- ratings" hit the same thing with UserRating), so a table this sensitive
-- gets the explicit REVOKE rather than relying on "no policy" alone.
-- `lib/security-staff/*` is server-only and uses Prisma (the `postgres`
-- role), which bypasses RLS entirely — that is the one path that may ever
-- read or write this table.
ALTER TABLE "SecurityStaff" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "SecurityStaff" FROM anon, authenticated;
