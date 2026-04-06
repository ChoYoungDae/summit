-- ============================================================
-- Migration: trails — name_en / name_ko → name (JSONB)
-- Also recreates the insert_trail RPC with the new signature.
-- Run AFTER 20260328_waypoints_jsonb.sql.
-- ============================================================

-- Drop old flat columns
ALTER TABLE trails
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS name_ko;

-- Add new JSONB column
ALTER TABLE trails
  ADD COLUMN IF NOT EXISTS name JSONB NOT NULL DEFAULT '{"en":""}';

ALTER TABLE trails
  ALTER COLUMN name DROP DEFAULT;

-- ── Recreate insert_trail RPC ─────────────────────────────────────────────
-- p_name example: '{"en": "Gwanaksan — SNU Route", "ko": "관악산 공대 코스"}'
CREATE OR REPLACE FUNCTION insert_trail(
  p_name             JSONB,
  p_gpx_data         JSONB,
  p_start_lat        DOUBLE PRECISION,
  p_start_lon        DOUBLE PRECISION,
  p_mountain_id      INT              DEFAULT NULL,
  p_ascent_time_min  INT              DEFAULT NULL,
  p_descent_time_min INT              DEFAULT NULL,
  p_difficulty       TEXT             DEFAULT NULL
)
RETURNS TABLE (id INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO trails (name, track, start_lat, start_lon,
                      mountain_id, ascent_time_min, descent_time_min, difficulty)
  VALUES (p_name, p_gpx_data, p_start_lat, p_start_lon,
          p_mountain_id, p_ascent_time_min, p_descent_time_min, p_difficulty)
  RETURNING trails.id;
END;
$$;
