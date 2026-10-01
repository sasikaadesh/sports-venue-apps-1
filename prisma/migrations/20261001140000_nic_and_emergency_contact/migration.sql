-- NIC (again) and an emergency contact number on the profile.
--
-- The NIC was collected once before (20260803120000) and removed
-- (20260905120000), which destroyed the stored values. The venue has asked for
-- it back. This restores the original design rather than inventing a new one:
-- one NIC per account (UNIQUE), the same format CHECK, and the same signup
-- trigger fallback for a duplicate. Nothing is recovered — every existing
-- account starts with no NIC and is asked for one (see below).
--
-- The emergency contact is a phone number to ring if something happens to the
-- member during a session. Not unique: family members can share one.
--
-- Both columns are NULLable for the same reason affiliation was: the profile
-- row is created by a trigger the instant Supabase Auth makes the user, Google
-- supplies neither value, and every existing account has neither. NOT NULL
-- would fail this migration on the live database and break existing logins.
-- Instead `profileIsComplete()` now requires both, so an account without them
-- is routed once through /complete-profile after it signs in. Logins are
-- unaffected — the gate lives after authentication.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "nic"              TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;

-- One NIC, one account. NULLs are distinct in a unique index, so every
-- existing (NULL) row coexists under this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "User_nic_key" ON public."User"("nic");

-- Format guard behind the Zod schema. Old NIC = 9 digits then V or X (stored
-- upper-cased); new NIC = 12 digits. NULL passes.
ALTER TABLE public."User" DROP CONSTRAINT IF EXISTS "User_nic_format";
ALTER TABLE public."User"
  ADD CONSTRAINT "User_nic_format"
  CHECK ("nic" IS NULL OR "nic" ~ '^([0-9]{9}[VX]|[0-9]{12})$');

-- ---------------------------------------------------------------------------
-- 2. Carry both through signup
-- ---------------------------------------------------------------------------
-- Same contract as ever: the app never INSERTs the profile row; signup values
-- travel as Supabase Auth user metadata and this trigger copies them.
--
-- The EXCEPTION block is back, for the reason it existed originally: `nic` is
-- UNIQUE, so a duplicate raised inside a trigger on auth.users would abort the
-- account creation itself with an unreadable database error. Instead the row
-- is retried without the NIC — the account is created, the profile is
-- incomplete, and /complete-profile asks for the NIC with a readable message.
-- The signup action pre-checks for a taken NIC, so this is only a race path.

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
  v_emergency   TEXT;
  v_affiliation "Affiliation";
BEGIN
  v_name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    ''
  )), '');
  v_phone     := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  v_address   := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'address', '')), '');
  v_emergency := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'emergencyContact', '')), '');

  -- Upper-cased so the old-format letter has one spelling: '123456789v' and
  -- '123456789V' must not be two different people. A malformed value is
  -- dropped rather than allowed to fail the CHECK and abort the signup.
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
    INSERT INTO public."User" (id, email, role, name, phone, address, nic, "emergencyContact", affiliation)
    VALUES (NEW.id, NEW.email, 'user', v_name, v_phone, v_address, v_nic, v_emergency, v_affiliation)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- Someone already holds that NIC. Create the account without it rather
    -- than failing the signup outright.
    INSERT INTO public."User" (id, email, role, name, phone, address, "emergencyContact", affiliation)
    VALUES (NEW.id, NEW.email, 'user', v_name, v_phone, v_address, v_emergency, v_affiliation)
    ON CONFLICT (id) DO NOTHING;
  END;

  RETURN NEW;
END;
$$;
