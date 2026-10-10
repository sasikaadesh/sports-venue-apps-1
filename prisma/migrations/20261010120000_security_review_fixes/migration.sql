-- Fixes from the code-reviewer's pass on the security-staff / booking-reference
-- feature (docs/ARCHITECTURE.md -> "Security staff", "Booking reference"):
--
--   M1: SecurityStaff.sessionVersion — bumped on PIN reset / disable, carried
--       in the session cookie, so a reset/disabled account's old cookie stops
--       working on its very next request rather than surviving to its own
--       12-hour expiry.
--   H3: Court.referencePrefix made UNIQUE — two courts whose names derive the
--       same prefix must not both start writing the same booking references.

ALTER TABLE "SecurityStaff" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Court_referencePrefix_key" ON "Court"("referencePrefix");
