-- Add hero_images column to routes for carousel display on the route list screen
ALTER TABLE routes ADD COLUMN IF NOT EXISTS hero_images text[] DEFAULT '{}';
