-- Recalculate order_index for route_photos based on GPS position along route.
--
-- Strategy:
--   1. Photos without GPS (lat/lon NULL) → 999999 (sorted to end)
--   2. Photos with GPS → cumulative metres from route start, computed via PostGIS:
--        • Build each route's full LineString from segments in segment_ids order
--        • ST_LineLocatePoint returns 0–1 fraction; multiply by route length (m)
--        • Result stored as integer metres → used as order_index

-- ── Step 1: GPS-less photos go to the end ────────────────────────────────────
UPDATE route_photos
SET order_index = 999999
WHERE lat IS NULL OR lon IS NULL;

-- ── Step 2: Recalculate GPS-tagged photos ────────────────────────────────────
WITH route_lines AS (
  -- Build one 2D LineString per route, honouring segment_ids array order.
  -- ST_Force2D strips the elevation Z so LineLocatePoint works correctly.
  SELECT
    r.id AS route_id,
    ST_Force2D(
      ST_MakeLine(
        array_agg(
          ST_GeomFromGeoJSON(s.track_data::text)
          ORDER BY array_position(r.segment_ids, s.id)
        )
      )
    ) AS line
  FROM routes r
  JOIN segments s ON s.id = ANY(r.segment_ids)
  WHERE array_length(r.segment_ids, 1) > 0
    AND s.track_data IS NOT NULL
  GROUP BY r.id
)
UPDATE route_photos rp
SET order_index = ROUND(
  ST_LineLocatePoint(
    rg.line,
    ST_Force2D(ST_SetSRID(ST_Point(rp.lon, rp.lat), 4326))
  )
  * ST_Length(rg.line::geography)  -- metres from route start
)::int
FROM route_lines rg
WHERE rg.route_id = rp.route_id
  AND rp.lat IS NOT NULL
  AND rp.lon IS NOT NULL;
