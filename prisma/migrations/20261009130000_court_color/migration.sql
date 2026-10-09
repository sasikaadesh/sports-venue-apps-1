-- Court colour-coding, for the /bookings grid and the admin Bookings table —
-- see docs/ARCHITECTURE.md -> "Court colour" and lib/court-colors.ts for the
-- 9-swatch palette this backfill assigns from (kept in sync by hand: this
-- migration is the one-time seed, lib/court-colors.ts is what the app reads
-- going forward for any court created since).

ALTER TABLE "Court" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#0E7A34';

-- Give every EXISTING court a distinct colour, in the same order the public
-- site and every admin list already use (COURT_DISPLAY_ORDER: displayOrder,
-- then name) — so adjacent courts in any list get visually distinct dots
-- from the start, rather than nine different courts all defaulting to the
-- same green. Cycles through the palette if there are ever more than 9.
WITH palette (hex, ord) AS (
  VALUES
    ('#0E7A34', 0), -- Green
    ('#C99A2E', 1), -- Gold / Ochre
    ('#1B3A5C', 2), -- Navy
    ('#7A2E2E', 3), -- Burgundy
    ('#2E6B6B', 4), -- Teal
    ('#8B5A2B', 5), -- Terracotta
    ('#5C6B2E', 6), -- Olive
    ('#44576B', 7), -- Slate
    ('#6B4A3A', 8)  -- Walnut
),
ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY "displayOrder", name) - 1) % 9 AS ord
  FROM "Court"
)
UPDATE "Court" c
SET "color" = p.hex
FROM ranked r
JOIN palette p ON p.ord = r.ord
WHERE c.id = r.id;
