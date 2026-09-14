-- Special requests: a signed-in user's manual request for a court. Never a
-- booking — an admin reads it in /admin/special-requests and follows up by hand.

CREATE TYPE "SpecialRequestStatus" AS ENUM ('new', 'contacted', 'resolved');

CREATE TABLE IF NOT EXISTS public."SpecialRequest" (
  "id"            UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "userId"        UUID,
  "courtId"       UUID,
  "courtName"     TEXT                   NOT NULL,
  "name"          TEXT,
  "email"         TEXT                   NOT NULL,
  "phone"         TEXT,
  "preferredDate" DATE                   NOT NULL,
  "preferredTime" TIME(6)                NOT NULL,
  "playerCount"   INTEGER                NOT NULL,
  "message"       TEXT                   NOT NULL,
  "status"        "SpecialRequestStatus" NOT NULL DEFAULT 'new',
  "createdAt"     TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)           NOT NULL,

  CONSTRAINT "SpecialRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpecialRequest_playerCount_positive" CHECK ("playerCount" > 0),
  CONSTRAINT "SpecialRequest_message_present" CHECK (LENGTH(TRIM("message")) > 0)
);

-- SET NULL on both: removing an account or a court keeps the request, which
-- still reads correctly from its snapshot columns.
ALTER TABLE public."SpecialRequest"
  ADD CONSTRAINT "SpecialRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."SpecialRequest"
  ADD CONSTRAINT "SpecialRequest_courtId_fkey"
  FOREIGN KEY ("courtId") REFERENCES public."Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "SpecialRequest_createdAt_idx" ON public."SpecialRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "SpecialRequest_status_idx"    ON public."SpecialRequest"("status");
CREATE INDEX IF NOT EXISTS "SpecialRequest_userId_idx"    ON public."SpecialRequest"("userId");
CREATE INDEX IF NOT EXISTS "SpecialRequest_courtId_idx"   ON public."SpecialRequest"("courtId");

-- RLS. The app writes through Prisma (which bypasses RLS) after its own checks;
-- these policies constrain the anon-key path. Signed-out visitors get nothing.
-- A signed-in user may only insert a request in their own name; reading,
-- changing status and deleting are admin-only.

ALTER TABLE public."SpecialRequest" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."SpecialRequest" FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SpecialRequest" TO authenticated;

DROP POLICY IF EXISTS "specialrequest_own_insert" ON public."SpecialRequest";
CREATE POLICY "specialrequest_own_insert" ON public."SpecialRequest"
  FOR INSERT TO authenticated
  WITH CHECK ("userId" = auth.uid() AND "status" = 'new');

DROP POLICY IF EXISTS "specialrequest_admin_read" ON public."SpecialRequest";
CREATE POLICY "specialrequest_admin_read" ON public."SpecialRequest"
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "specialrequest_admin_update" ON public."SpecialRequest";
CREATE POLICY "specialrequest_admin_update" ON public."SpecialRequest"
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "specialrequest_admin_delete" ON public."SpecialRequest";
CREATE POLICY "specialrequest_admin_delete" ON public."SpecialRequest"
  FOR DELETE TO authenticated
  USING (public.is_admin());
