-- RLS Policies: public read + admin write via SECURITY DEFINER

-- 1. admins table
CREATE TABLE IF NOT EXISTS admins (
  email text PRIMARY KEY
);

INSERT INTO admins (email) VALUES ('azucariya@gmail.com')
  ON CONFLICT DO NOTHING;

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 2. is_admin() helper — bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE email = auth.email()
  );
$$;

-- 3. Policies per table
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mountains','waypoints','segments','routes','route_photos']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- drop if exists to allow re-runs
    EXECUTE format('DROP POLICY IF EXISTS "Public read" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin write" ON %I', t);

    EXECUTE format(
      'CREATE POLICY "Public read" ON %I FOR SELECT USING (true)', t
    );
    EXECUTE format(
      'CREATE POLICY "Admin write" ON %I FOR ALL
       USING (is_admin()) WITH CHECK (is_admin())', t
    );
  END LOOP;
END;
$$;
