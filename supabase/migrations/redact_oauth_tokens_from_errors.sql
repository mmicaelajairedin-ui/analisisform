-- redact_oauth_tokens_from_errors.sql
-- SECURITY FIX: Remove OAuth tokens from client_errors table
--
-- This migration redacts all stored OAuth tokens, refresh tokens, and session
-- tokens that were accidentally logged via pw-observe.js before the sanitization
-- fix was deployed. This prevents unauthorized session hijacking via database leaks.
--
-- Redacts: access_token, refresh_token, provider_token, id_token, session, code, state
--
-- Apply once in Supabase SQL Editor to clean up existing data.

-- Update all rows where OAuth tokens were captured in the URL hash
UPDATE client_errors
SET page = REGEXP_REPLACE(
  page,
  '#[^?]*(?:access_token|refresh_token|provider_token|id_token|session|code|state)=[^&]*(&[^&]*)*',
  '#[REDACTED-OAUTH-TOKENS]',
  'g'
)
WHERE page LIKE '%access_token%'
   OR page LIKE '%refresh_token%'
   OR page LIKE '%provider_token%'
   OR page LIKE '%id_token%'
   OR page LIKE '%session=%'
   OR page LIKE '%code=%'
   OR page LIKE '%state=%';

-- Log the cleanup action for audit trail
INSERT INTO client_errors (kind, detail, page, email, ts)
VALUES (
  'security_audit',
  'Redacted ' || (SELECT COUNT(*) FROM client_errors WHERE page LIKE '%[REDACTED-OAUTH-TOKENS]%') || ' OAuth tokens from error logs',
  '/security/redaction-complete',
  'admin',
  NOW()
) ON CONFLICT DO NOTHING;
