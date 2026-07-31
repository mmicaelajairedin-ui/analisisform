-- ===================================================================
-- RLS policy for citas table: Owner access to org citas
--
-- Ensures owners can see all citas for their organization
-- ===================================================================

-- Drop old open policies if they exist
DROP POLICY IF EXISTS "citas_select" ON citas;
DROP POLICY IF EXISTS "citas_update" ON citas;
DROP POLICY IF EXISTS "citas_insert" ON citas;

-- Enable RLS (should already be on)
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

-- Owner SELECT policy: see all org citas
CREATE POLICY "rls_citas_owner_select" ON citas
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM usuarios
      WHERE (rol = 'owner' OR rol = 'admin')
        AND org_id IS NOT NULL
        AND org_id = citas.org_id
    )
  );

-- Owner INSERT policy: create citas for their org
CREATE POLICY "rls_citas_owner_insert" ON citas
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM usuarios
      WHERE (rol = 'owner' OR rol = 'admin')
        AND org_id IS NOT NULL
        AND org_id = citas.org_id
    )
  );

-- Owner UPDATE policy: update citas for their org
CREATE POLICY "rls_citas_owner_update" ON citas
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM usuarios
      WHERE (rol = 'owner' OR rol = 'admin')
        AND org_id IS NOT NULL
        AND org_id = citas.org_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM usuarios
      WHERE (rol = 'owner' OR rol = 'admin')
        AND org_id IS NOT NULL
        AND org_id = citas.org_id
    )
  );

-- Anon can still INSERT (for public booking links)
DROP POLICY IF EXISTS "citas_anon_insert" ON citas;
CREATE POLICY "citas_anon_insert" ON citas
  FOR INSERT
  TO anon
  WITH CHECK (true);

COMMENT ON POLICY "rls_citas_owner_select" ON citas IS
  'Owner sees all citas in their organization';

COMMENT ON POLICY "rls_citas_owner_insert" ON citas IS
  'Owner can create citas in their organization';

COMMENT ON POLICY "rls_citas_owner_update" ON citas IS
  'Owner can update citas in their organization';
