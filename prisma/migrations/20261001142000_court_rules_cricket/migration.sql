-- Rules for the three cricket nets. The standard (court) set — non-marking
-- shoes, rackets — reads wrong for a net, so they get their own. Written only
-- where still NULL, so an admin's own text is never overwritten. On a fresh
-- database no court exists yet and this matches nothing.

UPDATE "Court" SET "rules" = E'Bring your own bats, balls, pads and protective gear.\nWear a helmet when batting against a hard ball.\nNo metal spikes on the astro or matting surface — rubber soles only.\nOne bowler runs in at a time; wait until the batter is ready.\nStay out of a net while someone is bowling in it.\nDo not damage the nets, netting poles or surface. Damage is charged to the booking holder.'
WHERE "name" IN ('Cricket Net - Astro', 'Cricket Net - Concrete', 'Cricket Nets - Double')
  AND "rules" IS NULL;
