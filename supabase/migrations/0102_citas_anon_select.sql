-- ===================================================================
-- RLS policy for citas table: Anon SELECT access (public booking)
--
-- Allows anonymous users to view available appointment slots
-- (filtered by coach_id) so they can see what times are taken
-- ===================================================================

-- Anon SELECT policy: view citas for a specific coach (public booking page)
-- Used by reservar.html to show available time slots
CREATE POLICY "citas_anon_select" ON citas
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "citas_anon_select" ON citas IS
  'Anon users can view all citas (used by reservar.html to show booked slots). coach_id filtering happens at app layer.';
