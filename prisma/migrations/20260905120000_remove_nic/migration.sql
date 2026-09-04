-- Remove the NIC from the profile entirely.
--
-- The venue no longer collects it, so the honest thing is to stop storing it
-- rather than to stop displaying it: the column is dropped, which destroys
-- every NIC already on file. That is the point of this migration and it is
-- irreversible — there is no down migration that can bring the values back.
--
-- `affiliation` is untouched. Only the NIC is going.
--
-- Order matters. The signup trigger writes the column, so it is rewritten
-- FIRST; dropping the column out from under a live trigger would break every
-- signup in the window between the two statements.

-- ---------------------------------------------------------------------------
-- 1. Signup trigger, without the NIC
-- ---------------------------------------------------------------------------
-- Same contract as before (20260803120000): the app never INSERTs the profile
-- row, it passes signup values as Supabase Auth user metadata and this trigger
-- copies them into public."User".
--
-- The EXCEPTION block that used to be here is gone with the column. It existed
-- only because `nic` was UNIQUE: a duplicate raised inside a trigger on
-- auth.users would abort the account creation itself, so the insert was
-- retried without the NIC. Nothing left in this function is unique except the
-- primary key, which `ON CONFLICT (id) DO NOTHING` already absorbs.

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
  v_affiliation "Affiliation";
BEGIN
  v_name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    ''
  )), '');
  v_phone   := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  v_address := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'address', '')), '');

  BEGIN
    v_affiliation := NULLIF(TRIM(COALESCE(
      NEW.raw_user_meta_data->>'affiliation', ''
    )), '')::"Affiliation";
  EXCEPTION WHEN invalid_text_representation THEN
    v_affiliation := NULL;
  END;

  INSERT INTO public."User" (id, email, role, name, phone, address, affiliation)
  VALUES (NEW.id, NEW.email, 'user', v_name, v_phone, v_address, v_affiliation)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Drop the column and everything hanging off it
-- ---------------------------------------------------------------------------
-- The format CHECK and the UNIQUE index would go automatically with the
-- column; they are dropped explicitly so this migration reads as a complete
-- account of what is being removed, and so a re-run after a partial failure
-- still succeeds.

ALTER TABLE public."User" DROP CONSTRAINT IF EXISTS "User_nic_format";
DROP INDEX IF EXISTS public."User_nic_key";
ALTER TABLE public."User" DROP COLUMN IF EXISTS "nic";

-- ---------------------------------------------------------------------------
-- 3. Signup metadata
-- ---------------------------------------------------------------------------
-- A NIC submitted by an older client also survives in auth.users'
-- raw_user_meta_data, which the trigger above now ignores but does not clear.
-- Strip it there too, or the data we just deleted would still be sitting in
-- the auth schema.

-- Wrapped, because `auth` is Supabase's schema rather than ours: on a database
-- where the migration role cannot write it, this one statement must not fail
-- the migration and leave the column half-dropped. The profile column is the
-- copy that matters; if this is skipped it is logged, not fatal.
DO $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data - 'nic'
  WHERE raw_user_meta_data ? 'nic';
EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
  RAISE WARNING 'Could not strip nic from auth.users metadata: %', SQLERRM;
END
$$;
