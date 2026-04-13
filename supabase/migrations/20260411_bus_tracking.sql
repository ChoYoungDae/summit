-- ============================================================
-- Migration: Add Bus + Walk tracking features
-- ============================================================

-- 1. Add ars_id to waypoints
ALTER TABLE waypoints
ADD COLUMN IF NOT EXISTS ars_id TEXT;

-- 2. Add bus combined tracking details to segments
ALTER TABLE segments
ADD COLUMN IF NOT EXISTS is_bus_combined BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bus_details JSONB,
ADD COLUMN IF NOT EXISTS sub_segments JSONB;
