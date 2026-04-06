-- ============================================================
-- Migration: trails.difficulty  TEXT → SMALLINT (1–5 scale)
-- 1=Easy  2=Novice  3=Intermediate  4=Advanced  5=Expert
-- Run AFTER 20260328_trails_jsonb.sql.
-- ============================================================

-- Step 1: Convert existing text values to integers, drop the text column,
--         add a new integer column.
ALTER TABLE trails
  ADD COLUMN IF NOT EXISTS difficulty_new SMALLINT;

UPDATE trails SET difficulty_new =
  CASE difficulty
    WHEN 'Easy'     THEN 1
    WHEN 'Moderate' THEN 3
    WHEN 'Hard'     THEN 5
    ELSE NULL
  END;

ALTER TABLE trails DROP COLUMN IF EXISTS difficulty;
ALTER TABLE trails RENAME COLUMN difficulty_new TO difficulty;

-- Step 2: Recreate insert_trail RPC with SMALLINT difficulty
CREATE OR REPLACE FUNCTION insert_trail(
  p_name             JSONB,
  p_gpx_data         JSONB,
  p_start_lat        DOUBLE PRECISION,
  p_start_lon        DOUBLE PRECISION,
  p_mountain_id      INT              DEFAULT NULL,
  p_ascent_time_min  INT              DEFAULT NULL,
  p_descent_time_min INT              DEFAULT NULL,
  p_difficulty       SMALLINT         DEFAULT NULL
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
