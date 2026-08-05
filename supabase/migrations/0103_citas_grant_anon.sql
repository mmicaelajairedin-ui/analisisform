-- ===================================================================
-- GRANT permissions for citas table to anon/authenticated roles
--
-- Fixes: 401 errors on GET /rest/v1/citas from reservar.html
-- Cause: RLS policies exist but anon role was missing GRANT to SELECT
-- ===================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.citas TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

COMMENT ON GRANT SELECT ON public.citas TO anon IS
  'Anon users can view citas (filtered by RLS policy for availability checks)';

COMMENT ON GRANT INSERT ON public.citas TO anon IS
  'Anon users can create new citas (reservations from reservar.html)';

COMMENT ON GRANT UPDATE ON public.citas TO anon IS
  'Anon users can update citas (cancel reservations via token)';
