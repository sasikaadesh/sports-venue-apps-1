-- Standard court rules now live in code per court type (standardRulesForType
-- in lib/court-rules.ts), so each sport names its own equipment. The cricket
-- nets, pool and gym were given stored rules by 20261001141000 /
-- 20261001142000; those copies would hide the corrected per-type text.
-- Clear them back to NULL (= "use the type's standard set") only where the
-- text is still exactly what those migrations wrote, so an admin's own edits
-- are never touched. Content only — no schema change.

UPDATE "Court" SET "rules" = NULL
WHERE "name" IN ('Cricket Net - Astro', 'Cricket Net - Concrete', 'Cricket Nets - Double')
  AND "rules" = E'Bring your own bats, balls, pads and protective gear.\nWear a helmet when batting against a hard ball.\nNo metal spikes on the astro or matting surface — rubber soles only.\nOne bowler runs in at a time; wait until the batter is ready.\nStay out of a net while someone is bowling in it.\nDo not damage the nets, netting poles or surface. Damage is charged to the booking holder.';

UPDATE "Court" SET "rules" = NULL
WHERE "name" = 'Swimming Pool'
  AND "rules" = E'Shower before entering the pool.\nSwimwear only — no outdoor clothing in the water.\nNo running, diving or rough play on the pool deck.\nFollow the lifeguard''s instructions at all times.\nChildren under 12 must be accompanied by an adult in the water.\nNo food, glass or chewing gum on the pool deck.';

UPDATE "Court" SET "rules" = NULL
WHERE "name" = 'Fitness Center'
  AND "rules" = E'Clean training shoes only — no outdoor footwear on the gym floor.\nBring a towel and wipe down equipment after use.\nReturn weights and equipment to their racks.\nUse a spotter for heavy free-weight lifts.\nNo dropping weights except on the lifting platform.\nAsk staff if you are unsure how to use a machine.';
