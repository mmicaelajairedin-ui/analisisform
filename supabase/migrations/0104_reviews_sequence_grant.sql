-- ===================================================================
-- Fix: GRANT USAGE on reviews sequence to anon/authenticated
--
-- The reviews_insert_portal.sql migration grants INSERT on the table,
-- but if the table uses serial/bigserial (not GENERATED ... AS IDENTITY),
-- the anon role also needs GRANT USAGE on the sequence to increment the ID.
-- Without this, client reviews fail silently (INSERT fails on sequence access).
--
-- Symptom: clients can't post reviews, nothing appears in portal, no error shown
-- Fix: grant usage on the sequence
-- ===================================================================

GRANT USAGE ON SEQUENCE public.reviews_id_seq TO anon, authenticated;

COMMENT ON GRANT USAGE ON SEQUENCE public.reviews_id_seq TO anon IS
  'Allow anon users to increment the sequence when inserting reviews via the client portal';
