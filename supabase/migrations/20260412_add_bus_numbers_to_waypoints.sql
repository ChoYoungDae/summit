-- ============================================================
-- Migration: Add bus_numbers specifically to waypoints
-- ============================================================

ALTER TABLE waypoints
ADD COLUMN IF NOT EXISTS bus_numbers TEXT;
