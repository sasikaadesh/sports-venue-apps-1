-- NIC + affiliation on the profile, and the admin-only conduct rating system.
--
-- Two unrelated-looking things in one migration because they share a subject:
-- both are about who a member *is* to the venue. The NIC is sensitive personal
-- data; the ratings are private staff notes. Neither is ever public, and the
-- policies at the bottom are what make that true independently of the app.
--
-- Note this file CREATEs the "Affiliation" enum and uses it immediately, which
-- is fine — Postgres only forbids using a value ADDed to an *existing* enum in
-- the same transaction (see 20260726120000 for that case).

-- ---------------------------------------------------------------------------
-- 1. Affiliation
-- ---------------------------------------------------------------------------
-- Exactly four options, closed set, enforced by the type itself so a bad value
-- cannot be written by any path — app, psql, or a future import script.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Affiliation') THEN
    CREATE TYPE "Affiliation" AS ENUM ('old_boy', 'parent', 'staff', 'outsider');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Profile columns
-- ---------------------------------------------------------------------------
-- Both NULLable, and that is deliberate rather than lax: the profile row is
-- created by a trigger the instant Supabase Auth makes the user, and every
-- account that existed before today has neither value. Making either NOT NULL
-- would fail the migration on a live database and, worse, would break the
-- login of everyone already registered. Instead they arrive as NULL and
-- `profileIsComplete()` routes those accounts through /complete-profile.

ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "nic"         TEXT,
  ADD COLUMN IF NOT EXISTS "affiliation" "Affiliation";

-- One NIC, one account. Postgres treats NULLs as distinct in a unique index,
-- so every pre-existing (NULL) row coexists happily under this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "User_nic_key" ON public."User"("nic");

-- Format guard, second layer behind the Zod schema. Old NIC = 9 digits then V
-- or X (stored upper-cased by the app); new NIC = 12 digits. NULL passes, so
-- existing rows are untouched.
ALTER TABLE public."User" DROP CONSTRAINT IF EXISTS "User_nic_format";
ALTER TABLE public."User"
  ADD CONSTRAINT "User_nic_format"
  CHECK ("nic" IS NULL OR "nic" ~ '^([0-9]{9}[VX]|[0-9]{12})$');

-- ---------------------------------------------------------------------------
-- 3. Carry the two new fields through signup
-- ---------------------------------------------------------------------------
-- Same contract as before: the app never INSERTs the profile row, it passes
-- signup values as Supabase Auth user metadata and this trigger copies them.
--
-- The EXCEPTION block is the important part. `nic` is UNIQUE, so a duplicate
-- would raise inside a trigger on auth.users and abort the *account creation*
-- itself — leaving the person unable to sign up with a confusing database
-- error. Instead the row is retried without the NIC: the account is created,
-- the profile is flagged incomplete, and /complete-profile asks for the NIC
-- again with a readable message. The app pre-checks for a taken NIC too, so
-- this path is only reached on a genuine race.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name        TEXT;
  v_phone       TEXT;
  v_address     TEXT;
  v_nic         TEXT;
  v_affiliation "Affiliation";
BEGIN
  v_name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    ''
  )), '');
  v_phone   := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  v_address := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'address', '')), '');

  -- Upper-cased so the old-format trailing letter has one canonical spelling;
  -- '123456789v' and '123456789V' must not be two different people.
  v_nic := UPPER(NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'nic', '')), ''));
  IF v_nic IS NOT NULL AND v_nic !~ '^([0-9]{9}[VX]|[0-9]{12})$' THEN
    v_nic := NULL;
  END IF;

  BEGIN
    v_affiliation := NULLIF(TRIM(COALESCE(
      NEW.raw_user_meta_data->>'affiliation', ''
    )), '')::"Affiliation";
  EXCEPTION WHEN invalid_text_representation THEN
    v_affiliation := NULL;
  END;

  BEGIN
    INSERT INTO public."User" (id, email, role, name, phone, address, nic, affiliation)
    VALUES (NEW.id, NEW.email, 'user', v_name, v_phone, v_address, v_nic, v_affiliation)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- Someone already holds that NIC. Create the account without it rather
    -- than failing the signup outright.
    INSERT INTO public."User" (id, email, role, name, phone, address, affiliation)
    VALUES (NEW.id, NEW.email, 'user', v_name, v_phone, v_address, v_affiliation)
    ON CONFLICT (id) DO NOTHING;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. UserRating — private admin conduct notes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public."UserRating" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID         NOT NULL,
  "adminId"   UUID,
  "rating"    INTEGER      NOT NULL,
  "comment"   TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserRating_pkey" PRIMARY KEY ("id"),

  -- The star range is a database rule, not just a Zod one: an average is only
  -- meaningful if every term is inside the scale.
  CONSTRAINT "UserRating_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  -- A star with no reason is an unaccountable mark on someone's record.
  CONSTRAINT "UserRating_comment_present" CHECK (LENGTH(TRIM("comment")) > 0)
);

-- CASCADE on the subject: notes about a deleted account have no subject left.
-- SET NULL on the author: removing a member of staff must not erase the
-- venue's conduct history — the note survives, it just stops naming them.
ALTER TABLE public."UserRating" DROP CONSTRAINT IF EXISTS "UserRating_userId_fkey";
ALTER TABLE public."UserRating"
  ADD CONSTRAINT "UserRating_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."UserRating" DROP CONSTRAINT IF EXISTS "UserRating_adminId_fkey";
ALTER TABLE public."UserRating"
  ADD CONSTRAINT "UserRating_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "UserRating_userId_createdAt_idx"
  ON public."UserRating"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserRating_adminId_idx"
  ON public."UserRating"("adminId");

-- ---------------------------------------------------------------------------
-- 5. RLS — admin-only, with no exception for the person being rated
-- ---------------------------------------------------------------------------
-- The app reads and writes these through Prisma (which bypasses RLS) behind
-- `requireAdmin()`. This is the second, independent layer for the anon-key
-- path — anything a browser could call directly.
--
-- The thing to notice is what is NOT here: there is no "select own" policy.
-- Everywhere else in this schema a user may read the rows that name them
-- (their profile, their bookings, their payments). Conduct notes are the
-- deliberate exception — a rated user reading their own file would defeat the
-- purpose of a private staff record, so a signed-in user querying this table
-- gets zero rows even for notes written about them.
--
-- The REVOKE is not decoration. Supabase ships `ALTER DEFAULT PRIVILEGES` that
-- grants `anon` and `authenticated` full DML on every new table in `public`,
-- so this table arrives with a signed-out role already holding SELECT on it —
-- verified by querying information_schema after the first apply, not assumed.
-- RLS would still refuse `anon` (no policy below is granted to it), but a
-- private conduct file is exactly the wrong place to let a single missing
-- policy be the only thing standing in the way. Taking the grant away means a
-- signed-out request cannot reach the table at all.

ALTER TABLE public."UserRating" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."UserRating" FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."UserRating" TO authenticated;

DROP POLICY IF EXISTS "userrating_admin_read" ON public."UserRating";
CREATE POLICY "userrating_admin_read" ON public."UserRating"
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- WITH CHECK also pins `adminId` to the caller: an admin may only sign a note
-- as themselves, so the audit trail cannot be forged through the anon key.
DROP POLICY IF EXISTS "userrating_admin_insert" ON public."UserRating";
CREATE POLICY "userrating_admin_insert" ON public."UserRating"
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND "adminId" = auth.uid());

DROP POLICY IF EXISTS "userrating_admin_update" ON public."UserRating";
CREATE POLICY "userrating_admin_update" ON public."UserRating"
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "userrating_admin_delete" ON public."UserRating";
CREATE POLICY "userrating_admin_delete" ON public."UserRating"
  FOR DELETE TO authenticated
  USING (public.is_admin());
