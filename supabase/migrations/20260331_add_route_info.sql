-- ============================================================
-- Add access_detail column to trails
-- (description, start_station, access_mode already exist)
--
-- access_detail JSONB structure:
-- {
--   "track": [[lon, lat], ...],   -- GPS approach route (distance auto-calculated)
--   "steps": [                    -- Junction / decision points
--     { "coords": [lon, lat], "photo": "url", "direction": "left"|"right"|"straight" }
--   ]
-- }
-- ============================================================

ALTER TABLE trails
  ADD COLUMN IF NOT EXISTS access_detail JSONB;
