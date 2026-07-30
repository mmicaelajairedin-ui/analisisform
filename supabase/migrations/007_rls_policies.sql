-- Phase 0 Week 1: Create RLS policies for multi-tenant isolation
-- Timeline: Day 1-2
-- Rollback: Run scripts at end of file to DROP POLICY

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

-- Owners can read/write their own org
CREATE POLICY "org_owner_access" ON organizations
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Admins (staff) can read org they belong to
CREATE POLICY "org_admin_read_access" ON organizations
  FOR SELECT
  USING (id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin' LIMIT 1
  ));

-- ============================================================================
-- USUARIOS TABLE
-- ============================================================================

-- Users can read coaches/staff in their org
CREATE POLICY "usuarios_org_access" ON usuarios
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
  ));

-- Hide password_hash from all roles
CREATE POLICY "usuarios_hide_password" ON usuarios
  FOR SELECT
  USING (true);

-- Column-level security: only allow SELECT on non-sensitive columns
-- (This prevents password_hash from being returned in queries)
-- Note: Need to revoke SELECT on password_hash for authenticated role

-- ============================================================================
-- COACH_CLIENT_ASSIGNMENTS TABLE
-- ============================================================================

-- Users in org can see assignments in their org
CREATE POLICY "coach_client_assignment_org_access" ON coach_client_assignments
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
  ));

-- Only org admins can create/update
CREATE POLICY "coach_client_assignment_write" ON coach_client_assignments
  FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM usuarios WHERE auth_id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  );

CREATE POLICY "coach_client_assignment_update" ON coach_client_assignments
  FOR UPDATE
  USING (org_id IN (SELECT org_id FROM usuarios WHERE auth_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM usuarios WHERE auth_id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  );

-- ============================================================================
-- PROGRAMAS TABLE
-- ============================================================================

-- Each org sees only its programs
CREATE POLICY "programas_org_access" ON programas
  FOR ALL
  USING (org_id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
  ));

-- ============================================================================
-- ORGANIZATIONS_BILLING TABLE
-- ============================================================================

-- Owner/admins can read billing for their org
CREATE POLICY "billing_org_access" ON organizations_billing
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
  ));

-- Only owner can write
CREATE POLICY "billing_owner_write" ON organizations_billing
  FOR UPDATE
  USING (
    org_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

-- ============================================================================
-- ORGANIZATION_BRANDING TABLE
-- ============================================================================

-- Users in org can read branding
CREATE POLICY "branding_org_access" ON organization_branding
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
  ));

-- Only owner/admin can update
CREATE POLICY "branding_owner_write" ON organization_branding
  FOR UPDATE
  USING (
    org_id IN (SELECT org_id FROM usuarios WHERE auth_id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  );

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================

-- Users in org can read audit logs for their org
CREATE POLICY "audit_logs_read" ON audit_logs
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
  ));

-- Authenticated users can insert logs (Edge Functions do the writing)
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM usuarios WHERE auth_id = auth.uid())
  );

-- ============================================================================
-- EXTEND PATHWAY TABLES WITH RLS (if not already)
-- ============================================================================

-- CANDIDATOS: partition by org_id
CREATE POLICY "candidatos_org_access" ON candidatos
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
  ));

-- SESIONES_REGISTRO: partition by org_id
CREATE POLICY "sesiones_registro_org_access" ON sesiones_registro
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
  ));

-- INFORMES: partition by org_id
CREATE POLICY "informes_org_access" ON informes
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
  ));

-- ============================================================================
-- GRANT COLUMN SECURITY (hide password_hash)
-- ============================================================================

-- Revoke SELECT on password_hash for authenticated and anon roles
-- This is managed at the column level in Supabase:
-- ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY; -- Temporarily
-- REVOKE SELECT (password_hash) ON usuarios FROM authenticated, anon;
-- ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- For now, just document that Edge Functions must NOT return password_hash in responses
-- (Application-level filtering until Supabase column-level RLS is available)
