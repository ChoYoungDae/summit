-- Add name column (JSONB) to segments table for admin distinction
ALTER TABLE segments ADD COLUMN name JSONB;

-- Comment for clarity
COMMENT ON COLUMN segments.name IS 'Internal trail name for admins to distinguish between alternative paths (e.g. { "en": "Standard", "ko": "일반" })';
