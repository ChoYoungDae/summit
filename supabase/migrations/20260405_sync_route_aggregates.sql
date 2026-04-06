-- ============================================================
-- Trigger: auto-sync routes aggregate columns when segments change
-- Affected columns: total_duration_min, total_distance_m
-- NOTE: total_difficulty is managed manually — not synced by trigger
-- ============================================================

CREATE OR REPLACE FUNCTION sync_route_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE routes r
  SET
    total_duration_min = (
      SELECT SUM(s.estimated_time_min)
      FROM segments s
      WHERE r.segment_ids @> to_jsonb(s.id)
    ),
    total_distance_m = (
      SELECT SUM(s.distance_m)
      FROM segments s
      WHERE r.segment_ids @> to_jsonb(s.id)
    )
  WHERE r.segment_ids @> to_jsonb(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_route_aggregates ON segments;

CREATE TRIGGER trg_sync_route_aggregates
AFTER UPDATE OF estimated_time_min, distance_m ON segments
FOR EACH ROW EXECUTE FUNCTION sync_route_aggregates();

-- ── One-time backfill: resync duration and distance only ──────
UPDATE routes r
SET
  total_duration_min = agg.dur,
  total_distance_m   = agg.dist
FROM (
  SELECT
    r2.id,
    SUM(s.estimated_time_min) AS dur,
    SUM(s.distance_m)         AS dist
  FROM routes r2
  JOIN segments s ON r2.segment_ids @> to_jsonb(s.id)
  GROUP BY r2.id
) agg
WHERE r.id = agg.id;
