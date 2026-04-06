-- ============================================================
-- Migration: insert_trail RPC — add p_slug parameter
-- ============================================================

CREATE OR REPLACE FUNCTION insert_trail(
  p_name             JSONB,
  p_gpx_data         JSONB,
  p_start_lat        DOUBLE PRECISION,
  p_start_lon        DOUBLE PRECISION,
  p_slug             TEXT             DEFAULT NULL,
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
                      slug, mountain_id, ascent_time_min, descent_time_min, difficulty)
  VALUES (p_name, p_gpx_data, p_start_lat, p_start_lon,
          p_slug, p_mountain_id, p_ascent_time_min, p_descent_time_min, p_difficulty)
  RETURNING trails.id;
END;
$$;
