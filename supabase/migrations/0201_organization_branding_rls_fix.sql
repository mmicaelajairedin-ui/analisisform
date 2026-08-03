-- CRITICAL FIX: Organization Branding RLS Consolidation
-- Resolves conflicts from multiple migrations (005, 007, 0200)
-- Timeline: Sprint B.6.1 validation
-- Rollback: Revert to previous state + manual RLS fix

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 1: Drop conflicting policies from previous migrations
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS branding_org_access ON organization_branding;
DROP POLICY IF EXISTS branding_owner_write ON organization_branding;
DROP POLICY IF EXISTS organization_branding_owner_access ON organization_branding;
DROP POLICY IF EXISTS organization_branding_anon_read ON organization_branding;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 2: Add UNIQUE constraint on organization_id (was missing!)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE organization_branding
ADD CONSTRAINT IF NOT EXISTS uk_organization_branding_org_id
UNIQUE (organization_id);

-- Drop old conditional index (replaced by constraint above)
DROP INDEX IF EXISTS idx_organization_branding_org_id_v2;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 3: Create definitive RLS policies (single source of truth)
-- ═══════════════════════════════════════════════════════════════════════

-- Policy 1: Owner of organization can SELECT/UPDATE their own branding
CREATE POLICY IF NOT EXISTS organization_branding_owner_access
ON organization_branding
FOR ALL
USING (
  -- Owner accessing their own org
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.org_id = organization_branding.organization_id
    AND usuarios.auth_id = auth.uid()
    AND usuarios.rol IN ('owner', 'admin')
  )
)
WITH CHECK (
  -- Prevent owner from modifying org_id to another org
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.org_id = organization_branding.organization_id
    AND usuarios.auth_id = auth.uid()
    AND usuarios.rol IN ('owner', 'admin')
  )
);

-- Policy 2: Anon/public can SELECT only (white-label landing pages)
-- WARNING: This allows unauthenticated read. Only use for public landing pages.
-- Restricting to future public_branding flag would be safer.
CREATE POLICY IF NOT EXISTS organization_branding_public_read
ON organization_branding
FOR SELECT
USING (true);

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 4: Verify RLS is still enabled
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 5: Ensure permissions are correct
-- ═══════════════════════════════════════════════════════════════════════

GRANT SELECT, UPDATE ON organization_branding TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 6: Verify data integrity
-- ═══════════════════════════════════════════════════════════════════════

-- Check for orphaned rows (org_id exists but organization_id is null)
-- These need to be manually migrated or deleted
-- SELECT id, org_id, organization_id FROM organization_branding
-- WHERE (org_id IS NOT NULL AND organization_id IS NULL)
--    OR (org_id IS NULL AND organization_id IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 7: Log completion
-- ═══════════════════════════════════════════════════════════════════════

-- All conflicting policies removed
-- UNIQUE constraint added to organization_id
-- RLS consolidated to 2 clear policies: owner_access + public_read
-- No more conflicts with 007, 0200, or 20260803 migrations
