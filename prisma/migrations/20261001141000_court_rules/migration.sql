-- Court.rules — the court-specific rules shown on a court's public page.
--
-- Free text, one rule per line, edited in the admin court form — the same
-- shape as `amenities`. NULL (or blank) means "use the standard set", which
-- lives in code (STANDARD_COURT_RULES in lib/court-rules.ts) so that every
-- court shows sensible rules from day one without anyone typing them nine
-- times. The venue-wide rules (parking, medical, weather) are on /rules, not
-- here.

ALTER TABLE "Court" ADD COLUMN "rules" TEXT;

-- The two shared facilities need rules the standard (court) set gets wrong —
-- a pool is not about non-marking shoes. Written only where still NULL, so a
-- re-run or an admin's own text is never overwritten.
UPDATE "Court" SET "rules" = E'Shower before entering the pool.\nSwimwear only — no outdoor clothing in the water.\nNo running, diving or rough play on the pool deck.\nFollow the lifeguard''s instructions at all times.\nChildren under 12 must be accompanied by an adult in the water.\nNo food, glass or chewing gum on the pool deck.'
WHERE "name" = 'Swimming Pool' AND "rules" IS NULL;

UPDATE "Court" SET "rules" = E'Clean training shoes only — no outdoor footwear on the gym floor.\nBring a towel and wipe down equipment after use.\nReturn weights and equipment to their racks.\nUse a spotter for heavy free-weight lifts.\nNo dropping weights except on the lifting platform.\nAsk staff if you are unsure how to use a machine.'
WHERE "name" = 'Fitness Center' AND "rules" IS NULL;
