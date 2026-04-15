-- Add features to routes table
ALTER TABLE routes ADD COLUMN is_oneway BOOLEAN DEFAULT FALSE;
ALTER TABLE routes ADD COLUMN hide_safe_start BOOLEAN DEFAULT FALSE;

-- Optional: Add comments explaining the columns
COMMENT ON COLUMN routes.is_oneway IS 'Whether the route is a one-way (point-to-point) course rather than a loop.';
COMMENT ON COLUMN routes.hide_safe_start IS 'Whether to hide the "Last Safe Start" safety alert for this route.';
