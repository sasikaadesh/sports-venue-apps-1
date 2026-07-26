-- Profile fields, the Contact Us inbox, and the new `super_admin` enum value.
--
-- WHY THIS IS SPLIT ACROSS TWO MIGRATIONS
--   Postgres will not let a transaction *use* an enum value that the same
--   transaction added. Prisma runs each migration file in its own transaction,
--   so `super_admin` is added at the very bottom of this file and is first
--   referenced in the next migration (20260726120100_super_admin_role), which
--   runs in a later, separate transaction. Merging the two would fail with
--   "unsafe use of new value of enum type".

-- ---------------------------------------------------------------------------
-- 1. Profile fields on User
-- ---------------------------------------------------------------------------
-- Nullable: the profile row is created by a trigger the instant Supabase Auth
-- creates the user, and a Google sign-in carries no phone or address. The app
-- routes a user with a missing phone/address through /complete-profile.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "name"    TEXT,
  ADD COLUMN IF NOT EXISTS "phone"   TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT;

-- ---------------------------------------------------------------------------
-- 2. Carry signup profile fields into the profile row
-- ---------------------------------------------------------------------------
-- The app still never INSERTs the profile row itself — it passes name/phone/
-- address as Supabase Auth user metadata at signup and this trigger copies
-- them across, so profile creation remains unskippable.
--
-- Google's OIDC claims land in raw_user_meta_data as `full_name` / `name`, so
-- both are read; there is no phone or address claim, which is exactly why
-- those two stay NULL and drive the "Complete your profile" step.
--
-- NULLIF(..., '') keeps an empty metadata string from counting as a filled-in
-- field — an empty address must read as "missing", or the completion gate
-- would be bypassed by submitting blanks.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."User" (id, email, role, name, phone, address)
  VALUES (
    NEW.id,
    NEW.email,
    'user',
    NULLIF(TRIM(COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      ''
    )), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'address', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. ContactMessage — the Contact Us inbox
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ContactMessage" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"      TEXT         NOT NULL,
  "email"     TEXT         NOT NULL,
  "message"   TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt"    TIMESTAMP(3),

  CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "ContactMessage_readAt_idx"    ON "ContactMessage"("readAt");

-- RLS. The app writes these rows through Prisma (which bypasses RLS), but the
-- table is reachable with the anon key too, so it gets its own policies:
-- anyone may POST a message, only admins may read, mark read, or delete one.
-- Note there is deliberately no SELECT policy for anon/authenticated — a
-- sender cannot read back the inbox, not even their own message.

ALTER TABLE "ContactMessage" ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public."ContactMessage" TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public."ContactMessage" TO authenticated;

DROP POLICY IF EXISTS "contactmessage_public_insert" ON public."ContactMessage";
CREATE POLICY "contactmessage_public_insert" ON public."ContactMessage"
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "contactmessage_admin_read" ON public."ContactMessage";
CREATE POLICY "contactmessage_admin_read" ON public."ContactMessage"
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "contactmessage_admin_update" ON public."ContactMessage";
CREATE POLICY "contactmessage_admin_update" ON public."ContactMessage"
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "contactmessage_admin_delete" ON public."ContactMessage";
CREATE POLICY "contactmessage_admin_delete" ON public."ContactMessage"
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. The new role value — added last, USED only in the next migration
-- ---------------------------------------------------------------------------

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'super_admin';
