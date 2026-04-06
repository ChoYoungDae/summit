-- ============================================================
-- Migration: waypoints — per-language columns → JSONB
-- ============================================================

-- Drop old flat columns
ALTER TABLE waypoints
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS name_ko,
  DROP COLUMN IF EXISTS desc_en,
  DROP COLUMN IF EXISTS desc_ko,
  DROP COLUMN IF EXISTS direction_desc_en,
  DROP COLUMN IF EXISTS direction_desc_ko;

-- Add new JSONB columns
-- name is required; description and direction_guide are optional
ALTER TABLE waypoints
  ADD COLUMN IF NOT EXISTS name            JSONB NOT NULL DEFAULT '{"en":""}',
  ADD COLUMN IF NOT EXISTS description     JSONB,
  ADD COLUMN IF NOT EXISTS direction_guide JSONB;

-- Remove the temporary default so future INSERTs must supply a name explicitly
ALTER TABLE waypoints
  ALTER COLUMN name DROP DEFAULT;
