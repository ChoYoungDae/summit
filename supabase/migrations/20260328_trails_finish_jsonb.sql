-- ============================================================
-- Migration: trails — finish JSONB consolidation
-- 1. Drop old flat columns (title_en, title_ko)
-- 2. Drop all overloaded insert_trail functions, recreate clean
-- ============================================================

ALTER TABLE trails
  DROP COLUMN IF EXISTS title_en,
  DROP COLUMN IF EXISTS title_ko;

-- Drop ALL overloaded versions of insert_trail, then recreate
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT oid FROM pg_proc WHERE proname = 'insert_trail' LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS insert_trail(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
  END LOOP;
END $$;

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
