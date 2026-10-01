-- Court.displayOrder — the one order every court list uses (the home page grid,
-- the booking bar's court selector, /courts and the admin lists), lowest first,
-- with the name as tiebreak. See COURT_DISPLAY_ORDER in lib/catalogue.ts.
--
-- Spaced in tens so a court can later be slotted between two others without
-- renumbering the rest. A court created in the admin panel is appended after
-- the current last one (createCourt); the column default only covers rows
-- written outside the app.
--
-- On a fresh database there are no courts yet: the UPDATEs match nothing and
-- the seed writes the same order.

ALTER TABLE "Court" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- Anything not named below (e.g. the retired single "Cricket Nets") sorts last.
UPDATE "Court" SET "displayOrder" = 1000;

UPDATE "Court" AS c SET "displayOrder" = v.ord
FROM (VALUES
  ('Badminton',              10),
  ('Basketball',             20),
  ('Tennis',                 30),
  ('Cricket Nets - Double',  40),
  ('Table Tennis',           50),
  ('Swimming Pool',          60),
  ('Fitness Center',         70),
  ('Cricket Net - Astro',    80),
  ('Cricket Net - Concrete', 90)
) AS v(name, ord)
WHERE c."name" = v.name;

CREATE INDEX "Court_displayOrder_idx" ON "Court"("displayOrder");
