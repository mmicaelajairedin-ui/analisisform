-- Fix: Allow anon role to read citas table (GET /rest/v1/citas)
-- Error: 7× HTTP 401 on reservar.html
-- Cause: RLS policy denies access to anon users
-- Solution: Open read-only access for anon to active bookings

-- Create policy for anon SELECT on citas
CREATE POLICY "citas_anon_select"
  ON citas
  FOR SELECT
  TO anon
  USING (estado IS NOT NULL);

-- Create policy for authenticated SELECT (coaches/admins)
CREATE POLICY "citas_authenticated_select"
  ON citas
  FOR SELECT
  TO authenticated
  USING (
    -- Coach can see citas they created or are assigned to
    coach_id = auth.uid() OR
    -- Admin can see all
    auth.jwt() ->> 'role' = 'admin'
  );

-- Ensure RLS is enabled
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

-- Note: INSERT/UPDATE/DELETE policies already exist from previous migrations
