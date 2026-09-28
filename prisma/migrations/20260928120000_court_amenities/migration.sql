-- Add an optional free-text amenities field to Court, e.g.
-- "Floodlights, Changing rooms, Water". Shown as-is on the public court page;
-- no separate amenity taxonomy or migration of existing data needed.

ALTER TABLE public."Court" ADD COLUMN "amenities" TEXT;
