-- ============================================================
-- Add slug columns to waypoints and segments
-- ============================================================

-- ── waypoints.slug ───────────────────────────────────────────
ALTER TABLE waypoints ADD COLUMN IF NOT EXISTS slug TEXT;

-- Auto-generate slugs from English name for existing rows
UPDATE waypoints
SET slug = lower(regexp_replace(trim(name->>'en'), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL AND name->>'en' IS NOT NULL;

-- Partial unique index: enforces uniqueness only on non-null slugs
-- (allows existing rows without slugs to coexist during migration)
CREATE UNIQUE INDEX IF NOT EXISTS waypoints_slug_unique
  ON waypoints(slug)
  WHERE slug IS NOT NULL;

-- ── segments.slug ────────────────────────────────────────────
ALTER TABLE segments ADD COLUMN IF NOT EXISTS slug TEXT;

-- Auto-generate slugs for existing rows by joining mountains + waypoints
UPDATE segments s
SET slug =
  m.slug
  || '-' ||
  CASE s.segment_type
    WHEN 'APPROACH' THEN 'go'
    WHEN 'ASCENT'   THEN 'go'
    WHEN 'DESCENT'  THEN 'back'
    WHEN 'RETURN'   THEN 'back'
  END
  || '-' ||
  CASE s.segment_type
    WHEN 'APPROACH' THEN 'apr'
    WHEN 'ASCENT'   THEN 'asc'
    WHEN 'DESCENT'  THEN 'des'
    WHEN 'RETURN'   THEN 'ret'
  END
  || '-' || sw.slug
  || '-' || ew.slug
FROM mountains m
JOIN waypoints sw ON sw.id = s.start_waypoint_id
JOIN waypoints ew ON ew.id = s.end_waypoint_id
WHERE s.slug IS NULL
  AND m.id = s.mountain_id
  AND sw.slug IS NOT NULL
  AND ew.slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS segments_slug_unique
  ON segments(slug)
  WHERE slug IS NOT NULL;
