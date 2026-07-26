-- Phase 5 — Supabase Storage bucket for court images.
--
-- Created here rather than by hand in the dashboard so a fresh environment
-- (a new Supabase project, a teammate's clone) comes up fully configured by
-- running migrations. Idempotent, so re-running is safe.

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------
-- Public read: court photos are shown on the public site to signed-out
-- visitors, and public objects are served straight from the CDN (cheaper and
-- faster than minting signed URLs on every page render). Nothing private is
-- ever put in this bucket.
--
-- The size/mime limits are enforced by Storage itself, so they hold even if an
-- application-level check is ever missed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'court-images',
  'court-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Storage RLS
-- ---------------------------------------------------------------------------
-- Uploads run server-side with the service-role key (which bypasses RLS) after
-- a requireAdmin() check, so these policies are the second layer — they decide
-- what is possible for anyone talking to Storage directly with the anon key.

-- Anyone may read court images (public site).
DROP POLICY IF EXISTS "court_images_public_read" ON storage.objects;
CREATE POLICY "court_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'court-images');

-- Only admins may add or remove them. public.is_admin() is the same helper the
-- Phase 4 table policies use.
DROP POLICY IF EXISTS "court_images_admin_insert" ON storage.objects;
CREATE POLICY "court_images_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'court-images' AND public.is_admin());

DROP POLICY IF EXISTS "court_images_admin_update" ON storage.objects;
CREATE POLICY "court_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'court-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'court-images' AND public.is_admin());

DROP POLICY IF EXISTS "court_images_admin_delete" ON storage.objects;
CREATE POLICY "court_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'court-images' AND public.is_admin());
