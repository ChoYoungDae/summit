-- ============================================================
-- Migration: Add specific subway details to waypoints
-- ============================================================

ALTER TABLE waypoints
ADD COLUMN IF NOT EXISTS subway_line TEXT,
ADD COLUMN IF NOT EXISTS subway_station TEXT;
