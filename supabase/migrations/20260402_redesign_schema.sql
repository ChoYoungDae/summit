-- ============================================================
-- Full schema redesign — 4-table structure
-- Replaces: mountains, trails, waypoints + all RPCs
-- Safe to re-run (DROP IF EXISTS + CREATE IF NOT EXISTS)
-- ============================================================

-- ── Drop existing RPCs ────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid FROM pg_proc
    WHERE proname IN ('insert_trail', 'update_trail')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;

-- ── Drop existing tables (order matters for FK deps) ──────────
DROP TABLE IF EXISTS routes    CASCADE;
DROP TABLE IF EXISTS segments  CASCADE;
DROP TABLE IF EXISTS waypoints CASCADE;
DROP TABLE IF EXISTS trails    CASCADE;
DROP TABLE IF EXISTS mountains CASCADE;

-- ── ① mountains ───────────────────────────────────────────────
-- One row per distinct mountain massif.
CREATE TABLE mountains (
  id              SERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            JSONB NOT NULL,          -- { "en": "Bukhansan", "ko": "북한산" }
  image_url       TEXT,
  region          TEXT,                    -- e.g. "Seoul", "Gyeonggi"
  max_elevation_m INT
);

-- ── ② waypoints ───────────────────────────────────────────────
-- Physical points on (or near) the mountain: stations, trailheads,
-- summits, junctions, shelters, etc.
-- Each waypoint belongs to one mountain and carries its own
-- photo and description for the detail popup / guide card.
CREATE TABLE waypoints (
  id            SERIAL PRIMARY KEY,
  mountain_id   INT NOT NULL REFERENCES mountains(id) ON DELETE CASCADE,

  name          JSONB NOT NULL,            -- { "en": "Bukhansanseong Fortress Gate", "ko": "북한산성 입구" }
  type          TEXT NOT NULL,             -- STATION | TRAILHEAD | SUMMIT | JUNCTION | SHELTER

  lat           DOUBLE PRECISION NOT NULL,
  lon           DOUBLE PRECISION NOT NULL,
  elevation_m   INT,

  image_url     TEXT,                      -- representative photo for this point
  description   JSONB                      -- { "en": "...", "ko": "..." }
);

CREATE INDEX ON waypoints (mountain_id);
CREATE INDEX ON waypoints (type);

-- ── ③ segments ────────────────────────────────────────────────
-- Directed path between two waypoints.
-- segment_type encodes the role of this leg within a route.
CREATE TABLE segments (
  id                  SERIAL PRIMARY KEY,
  mountain_id         INT NOT NULL REFERENCES mountains(id) ON DELETE CASCADE,
  segment_type        TEXT NOT NULL,       -- APPROACH | ASCENT | DESCENT | RETURN

  start_waypoint_id   INT NOT NULL REFERENCES waypoints(id),
  end_waypoint_id     INT NOT NULL REFERENCES waypoints(id),

  -- GeoJSON LineString: { "type": "LineString", "coordinates": [[lon,lat,ele], ...] }
  track_data          JSONB NOT NULL DEFAULT '{"type":"LineString","coordinates":[]}',

  distance_m          INT,
  total_ascent_m      INT,
  total_descent_m     INT,
  estimated_time_min  INT,
  difficulty          SMALLINT CHECK (difficulty BETWEEN 1 AND 5),

  -- Directional guidance shown to the hiker at the end of this segment
  -- e.g. { "en": "At the junction, take the left path", "ko": "삼거리에서 왼쪽" }
  guide_note          JSONB
);

CREATE INDEX ON segments (mountain_id);
CREATE INDEX ON segments (start_waypoint_id);
CREATE INDEX ON segments (end_waypoint_id);

-- ── ④ routes ──────────────────────────────────────────────────
-- Named, publishable course built from an ordered list of segments.
-- segment_ids caches the ordered composition so the app can
-- reconstruct the full track without joining every time.
CREATE TABLE routes (
  id                  SERIAL PRIMARY KEY,
  mountain_id         INT NOT NULL REFERENCES mountains(id) ON DELETE CASCADE,

  name                JSONB NOT NULL,      -- { "en": "Bukhansan Classic Loop", "ko": "북한산 클래식 루프" }

  -- ordered segment IDs: [approach_id, ascent_id, descent_id, return_id]
  segment_ids         JSONB NOT NULL DEFAULT '[]',

  -- cached aggregates (recompute when segments change)
  total_duration_min  INT,
  total_distance_m    INT,
  total_difficulty    SMALLINT CHECK (total_difficulty BETWEEN 1 AND 5),
  route_preview_img   TEXT                 -- static map thumbnail URL
);

CREATE INDEX ON routes (mountain_id);
