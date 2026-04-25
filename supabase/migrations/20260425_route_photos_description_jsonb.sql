-- Migrate route_photos.description_en / description_ko → description JSONB
-- Consistent with waypoints.description, mountains.name, etc.

ALTER TABLE route_photos ADD COLUMN description JSONB;

UPDATE route_photos
SET description = jsonb_strip_nulls(jsonb_build_object(
  'en', description_en,
  'ko', description_ko
))
WHERE description_en IS NOT NULL OR description_ko IS NOT NULL;

ALTER TABLE route_photos
  DROP COLUMN description_en,
  DROP COLUMN description_ko;
