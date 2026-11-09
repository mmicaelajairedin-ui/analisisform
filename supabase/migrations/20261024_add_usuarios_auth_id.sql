-- Migration: Add auth_id to usuarios table for proper Auth ↔ DB user linking
--
-- ISSUE: check-entitlement inserts auth.uid() as usuario_id FK to usuarios(id),
-- but in some accounts auth.uid() ≠ usuarios.id. This breaks production RLS.
--
-- SOLUTION: Add usuarios.auth_id = auth.users.id, resolve userId through it,
-- update RLS to use auth_id lookup.

BEGIN;

-- 1. Add auth_id column (nullable initially)
ALTER TABLE usuarios
ADD COLUMN auth_id UUID;

-- 2. Create index for faster lookups
CREATE INDEX idx_usuarios_auth_id ON usuarios(auth_id);

-- 3. Populate auth_id by matching email with auth.users
-- For each usuario, find the matching auth.users by email and set auth_id
UPDATE usuarios u
SET auth_id = au.id
FROM auth.users au
WHERE LOWER(u.email) = LOWER(au.email);

-- 4. Keep auth_id NULLABLE (do NOT add NOT NULL constraint)
-- Reason: Some usuarios may not have matches in auth.users yet.
-- Audit before production: SELECT id, email FROM usuarios WHERE auth_id IS NULL;
-- Production safeguard: check for unlinked usuarios before deploying check-entitlement

-- 5. Update RLS policy to allow check-entitlement to write usuario_id using Auth id
-- The webhook will insert usuario_id resolved from auth_id lookup, not raw auth.uid()
-- RLS: users can only read/write their own rows via auth_id
DROP POLICY IF EXISTS select_own ON usuarios;
CREATE POLICY select_own ON usuarios
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid());

DROP POLICY IF EXISTS update_own ON usuarios;
CREATE POLICY update_own ON usuarios
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid());

-- 6. Grant check-entitlement (service role) to resolve auth_id → usuarios.id mapping
-- Service role can read auth_id to resolve, then insert usuario_id
GRANT SELECT (id, auth_id) ON usuarios TO service_role;

COMMIT;
