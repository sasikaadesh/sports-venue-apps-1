-- Phase 4 — Auth & roles.
--
-- Two things happen here:
--   1. Every Supabase Auth user automatically gets a matching public."User"
--      profile row (which is where `role` lives).
--   2. Row Level Security is enabled and policed on every table.
--
-- IMPORTANT — how RLS relates to the rest of the app:
--   Prisma connects as the `postgres` role, which BYPASSES RLS. So these
--   policies do NOT constrain Prisma queries; application-level checks
--   (`requireUser` / `requireAdmin` in lib/auth.ts) do. RLS is the second
--   layer: it constrains everything reaching Postgres through the Supabase
--   anon key (i.e. anything a browser could call directly). Both layers are
--   required — see CLAUDE.md.
--
--   We deliberately do NOT use FORCE ROW LEVEL SECURITY: forcing it would
--   apply policies to the table owner too, and Prisma has no Supabase JWT, so
--   auth.uid() would be NULL and every server-side query would fail.

-- ---------------------------------------------------------------------------
-- 1. Auth user -> profile row
-- ---------------------------------------------------------------------------

-- Creates the public."User" profile whenever Supabase Auth creates a user.
-- SECURITY DEFINER so it runs as the function owner and is not blocked by the
-- RLS policies defined further down.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."User" (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any auth users that already exist.
INSERT INTO public."User" (id, email, role)
SELECT u.id, u.email, 'user'
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Keep the profile row from outliving the auth user.
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public."User" WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();

-- ---------------------------------------------------------------------------
-- 2. Role helper
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER is essential: this reads public."User", and it is used
-- inside public."User"'s own policies. Without it, evaluating the policy would
-- re-trigger the policy and recurse infinitely.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u.id = auth.uid() AND u.role = 'admin'::"Role"
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 3. Table grants (coarse); RLS below narrows them per row
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Public catalogue: anyone may read courts, types and slot templates.
GRANT SELECT ON public."Court", public."CourtType", public."SlotTemplate"
  TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public."Court", public."CourtType", public."SlotTemplate", public."Booking"
  TO authenticated;

GRANT SELECT ON public."User", public."Payment" TO authenticated;
GRANT UPDATE ON public."User" TO authenticated;  -- narrowed to admins by RLS

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CourtType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Court" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SlotTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;

-- --- User -------------------------------------------------------------------
-- A user may read their own profile; admins may read and edit every profile.
-- Users get NO write policy at all, so they cannot set their own role to
-- 'admin' through the anon key. Promotion happens with the service-role key
-- (scripts/make-admin.mjs) or by an existing admin.

DROP POLICY IF EXISTS "user_select_own" ON public."User";
CREATE POLICY "user_select_own" ON public."User"
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_admin_write" ON public."User";
CREATE POLICY "user_admin_write" ON public."User"
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- CourtType / Court / SlotTemplate ---------------------------------------
-- Public read (the booking site is browsable signed-out); admin-only writes.

DROP POLICY IF EXISTS "courttype_public_read" ON public."CourtType";
CREATE POLICY "courttype_public_read" ON public."CourtType"
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "courttype_admin_write" ON public."CourtType";
CREATE POLICY "courttype_admin_write" ON public."CourtType"
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "court_public_read" ON public."Court";
CREATE POLICY "court_public_read" ON public."Court"
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "court_admin_write" ON public."Court";
CREATE POLICY "court_admin_write" ON public."Court"
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "slottemplate_public_read" ON public."SlotTemplate";
CREATE POLICY "slottemplate_public_read" ON public."SlotTemplate"
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "slottemplate_admin_write" ON public."SlotTemplate";
CREATE POLICY "slottemplate_admin_write" ON public."SlotTemplate"
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- --- Booking ----------------------------------------------------------------
-- Users see and manage only their own bookings; admins see and manage all
-- (including status='blocked' rows, which have userId IS NULL).

DROP POLICY IF EXISTS "booking_select_own" ON public."Booking";
CREATE POLICY "booking_select_own" ON public."Booking"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid() OR public.is_admin());

-- A user may only create a booking owned by themselves, and only as 'pending'.
-- 'confirmed' is reachable only from the verified PayHere webhook (server
-- side), and 'blocked' only by an admin.
DROP POLICY IF EXISTS "booking_insert_own" ON public."Booking";
CREATE POLICY "booking_insert_own" ON public."Booking"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR ("userId" = auth.uid() AND status = 'pending'::"BookingStatus")
  );

DROP POLICY IF EXISTS "booking_update_own" ON public."Booking";
CREATE POLICY "booking_update_own" ON public."Booking"
  FOR UPDATE TO authenticated
  USING ("userId" = auth.uid() OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      "userId" = auth.uid()
      -- A user may cancel their own booking, nothing more.
      AND status IN ('pending'::"BookingStatus", 'cancelled'::"BookingStatus")
    )
  );

DROP POLICY IF EXISTS "booking_delete_admin" ON public."Booking";
CREATE POLICY "booking_delete_admin" ON public."Booking"
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- --- Payment ----------------------------------------------------------------
-- Read-only for clients: a user sees payments for their own bookings, admins
-- see all. There is no client write policy — payment rows are created and
-- updated only server-side (PayHere hash generation + notify_url webhook).

DROP POLICY IF EXISTS "payment_select_own" ON public."Payment";
CREATE POLICY "payment_select_own" ON public."Payment"
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b.id = "Payment"."bookingId" AND b."userId" = auth.uid()
    )
  );
