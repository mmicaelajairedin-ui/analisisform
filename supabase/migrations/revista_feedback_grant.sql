-- Grant SELECT and INSERT permissions on revista_feedback table to anon role
-- This allows the frontend (admin panel) to read feedback via Supabase REST API
-- Similar to ranking_mensual_grant.sql — required for RLS policies to work with anon key

GRANT SELECT ON revista_feedback TO anon;
GRANT INSERT ON revista_feedback TO anon;
