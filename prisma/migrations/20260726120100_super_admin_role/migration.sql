-- The `super_admin` role: an admin who may also manage other admins.
--
-- Runs as its own migration because it USES the 'super_admin' enum value that
-- 20260726120000 added — Postgres forbids using a new enum value in the same
-- transaction that created it.
--
-- Role ladder:
--   user        — books courts, edits own profile
--   admin       — everything about courts, slots, bookings, messages, and may
--                 remove *user* accounts. May NOT touch admins.
--   super_admin — admin, plus: promote a user to admin, demote an admin, and
--                 remove an admin account.

-- ---------------------------------------------------------------------------
-- 1. Role helpers
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER on both: they read public."User" and are used inside
-- public."User"'s own policies, which would otherwise recurse.

-- is_admin() now means "admin OR super_admin", so every existing admin policy
-- (courts, types, templates, bookings, contact messages) covers super admins
-- for free. Nothing else in the schema needs to know the ladder exists.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin'::"Role", 'super_admin'::"Role")
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u.id = auth.uid() AND u.role = 'super_admin'::"Role"
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin()       TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 2. Who may write a User row
-- ---------------------------------------------------------------------------
-- This replaces the old "any admin may update any profile" policy, which would
-- have let a plain admin promote themselves the moment `super_admin` existed.
--
-- USING is checked against the row BEFORE the update, WITH CHECK against the
-- row AFTER it. Requiring role = 'user' on both sides means a plain admin can
-- neither modify an existing admin nor turn a user into one — the escalation
-- path is closed in both directions by construction.
--
-- Users still have NO write policy of their own. Editing your name/phone/
-- address goes through a server action (Prisma, service-side), never the anon
-- key, so "nobody can promote themselves through the anon key" still holds
-- literally: there is no self-UPDATE path to abuse.

DROP POLICY IF EXISTS "user_admin_write" ON public."User";
CREATE POLICY "user_admin_write" ON public."User"
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (public.is_admin() AND role = 'user'::"Role")
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.is_admin() AND role = 'user'::"Role")
  );

-- Note there is deliberately NO grant of DELETE on public."User" to
-- authenticated. Account removal runs server-side against auth.users with the
-- service-role key (after requireAdmin/requireSuperAdmin), and the existing
-- on_auth_user_deleted trigger clears the profile row. Leaving the anon-key
-- path without DELETE at all is stricter than any policy could be.

-- ---------------------------------------------------------------------------
-- 3. The venue must never be left without a super admin
-- ---------------------------------------------------------------------------
-- Deletion happens through auth.users with the service-role key, which
-- bypasses RLS entirely, so this guard is a trigger rather than a policy —
-- it is the only layer that sees that path. It fires for the profile DELETE
-- cascaded by on_auth_user_deleted, so removing the last super admin fails
-- before the auth user is gone.

CREATE OR REPLACE FUNCTION public.protect_last_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only a row that IS a super admin, and is about to stop being one, matters.
  IF OLD.role <> 'super_admin'::"Role" THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role = 'super_admin'::"Role" THEN
    RETURN NEW;
  END IF;

  IF (SELECT COUNT(*) FROM public."User" WHERE role = 'super_admin'::"Role") <= 1 THEN
    RAISE EXCEPTION
      'Refusing to remove the last super admin (%). Promote another super admin first.',
      OLD.email
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS protect_last_super_admin ON public."User";
CREATE TRIGGER protect_last_super_admin
  BEFORE UPDATE OR DELETE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_super_admin();

-- ---------------------------------------------------------------------------
-- 4. Seed the first super admin
-- ---------------------------------------------------------------------------
-- No-op on a database where that account has not signed up yet; run
-- `npm run make-admin -- <email> super_admin` afterwards in that case.

UPDATE public."User"
SET role = 'super_admin'::"Role"
WHERE LOWER(email) = 'sasikaadesh@gmail.com';
