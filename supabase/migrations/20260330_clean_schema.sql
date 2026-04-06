-- ============================================================
-- Clean schema — run this to reset the database from scratch.
-- Safe to re-run (DROP IF EXISTS + CREATE IF NOT EXISTS).
-- ============================================================

-- ── Drop existing RPCs ────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid FROM pg_proc WHERE proname IN ('insert_trail', 'update_trail') LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;

-- ── Drop existing tables (cascade removes FKs/indexes) ────────
DROP TABLE IF EXISTS waypoints CASCADE;
DROP TABLE IF EXISTS trails    CASCADE;
DROP TABLE IF EXISTS mountains CASCADE;

-- ── mountains ─────────────────────────────────────────────────
CREATE TABLE mountains (
  id   SERIAL PRIMARY KEY,
  name JSONB NOT NULL
);

-- ── trails ────────────────────────────────────────────────────
CREATE TABLE trails (
  id               SERIAL PRIMARY KEY,
  slug             TEXT UNIQUE,
  name             JSONB NOT NULL,
  -- track: [[lon, lat, ele], ...] stored as JSONB array
  track            JSONB NOT NULL DEFAULT '[]',
  start_lat        DOUBLE PRECISION,
  start_lon        DOUBLE PRECISION,
  mountain_id      INT  REFERENCES mountains(id) ON DELETE SET NULL,
  ascent_time_min  INT,
  descent_time_min INT,
  difficulty       SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  description      JSONB
);

-- ── waypoints ─────────────────────────────────────────────────
CREATE TABLE waypoints (
  id              SERIAL PRIMARY KEY,
  trail_id        INT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  order_index     INT NOT NULL DEFAULT 0,   -- GPX point sequence; sort key
  lon             DOUBLE PRECISION NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  ele             DOUBLE PRECISION NOT NULL DEFAULT 0,
  name            JSONB NOT NULL,
  -- type: peak | summit | direction | danger | scenic_rest | rest
  type            TEXT NOT NULL DEFAULT 'peak',
  photo           TEXT,
  description     JSONB
);

CREATE INDEX ON waypoints (trail_id, order_index);

-- ── insert_trail RPC ──────────────────────────────────────────
CREATE FUNCTION insert_trail(
  p_name             JSONB,
  p_gpx_data         JSONB,
  p_start_lat        DOUBLE PRECISION,
  p_start_lon        DOUBLE PRECISION,
  p_slug             TEXT     DEFAULT NULL,
  p_mountain_id      INT      DEFAULT NULL,
  p_ascent_time_min  INT      DEFAULT NULL,
  p_descent_time_min INT      DEFAULT NULL,
  p_difficulty       SMALLINT DEFAULT NULL,
  p_description      JSONB    DEFAULT NULL
)
RETURNS TABLE (id INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO trails (name, track, start_lat, start_lon,
                      slug, mountain_id, ascent_time_min, descent_time_min,
                      difficulty, description)
  VALUES (p_name, p_gpx_data, p_start_lat, p_start_lon,
          p_slug, p_mountain_id, p_ascent_time_min, p_descent_time_min,
          p_difficulty, p_description)
  RETURNING trails.id;
END;
$$;

-- ── update_trail RPC ──────────────────────────────────────────
CREATE FUNCTION update_trail(
  p_id               INT,
  p_slug             TEXT     DEFAULT NULL,
  p_name             JSONB    DEFAULT NULL,
  p_difficulty       SMALLINT DEFAULT NULL,
  p_ascent_time_min  INT      DEFAULT NULL,
  p_descent_time_min INT      DEFAULT NULL,
  p_mountain_id      INT      DEFAULT NULL,
  p_description      JSONB    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE trails
  SET
    slug             = CASE WHEN p_slug IS NOT NULL THEN p_slug ELSE slug END,
    name             = COALESCE(p_name,             name),
    difficulty       = COALESCE(p_difficulty,       difficulty),
    ascent_time_min  = COALESCE(p_ascent_time_min,  ascent_time_min),
    descent_time_min = COALESCE(p_descent_time_min, descent_time_min),
    mountain_id      = CASE WHEN p_mountain_id IS NOT NULL THEN p_mountain_id ELSE mountain_id END,
    description      = CASE WHEN p_description IS NOT NULL THEN p_description ELSE description END
  WHERE id = p_id;
END;
$$;
