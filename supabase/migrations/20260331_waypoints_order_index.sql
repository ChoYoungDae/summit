-- ============================================================
-- Waypoints: add order_index, drop direction/direction_guide
-- order_index = GPX point sequence (0-based); used for sort order
-- ============================================================

-- 1. Add order_index (default 0 so existing rows don't break)
ALTER TABLE waypoints
  ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0;

-- 2. Drop direction columns — arrows are drawn directly on photos
ALTER TABLE waypoints
  DROP COLUMN IF EXISTS direction,
  DROP COLUMN IF EXISTS direction_guide;

-- 3. Replace ele-based index with trail + order composite index
DROP INDEX IF EXISTS waypoints_trail_id_idx;
CREATE INDEX IF NOT EXISTS waypoints_trail_order_idx ON waypoints (trail_id, order_index);
