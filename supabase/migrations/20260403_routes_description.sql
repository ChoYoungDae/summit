-- Add multilingual description column to routes
ALTER TABLE routes ADD COLUMN IF NOT EXISTS description JSONB;
