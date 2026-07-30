-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0103: RLS for organizaciones
-- ═══════════════════════════════════════════════════════════════════════
-- Políticas básicas:
--   1. Owner lee su propia org
--   2. Admin (Pathway) lee todas
--   3. Coach lee su org
--
-- Nota: estos son SELECT policies. UPDATE/DELETE vienen en Fase 2.
--

-- Enable RLS
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;

-- Policy 1: Owner reads own org
CREATE POLICY "rls_org_owner_reads_own"
  ON organizaciones
  FOR SELECT
  TO authenticated
  USING (
    owner_email = (SELECT email FROM usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );

-- Policy 2: Coach reads their org
CREATE POLICY "rls_org_coach_reads_own"
  ON organizaciones
  FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND org_id IS NOT NULL
      LIMIT 1
    )
  );

-- Policy 3: Admin reads all orgs
CREATE POLICY "rls_org_admin_reads_all"
  ON organizaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'admin'
    )
  );

-- Anon can't read
ALTER TABLE organizaciones FORCE ROW LEVEL SECURITY;

COMMENT ON POLICY "rls_org_owner_reads_own" ON organizaciones IS
  'El dueño lee su propia organización (match por owner_email).';

COMMENT ON POLICY "rls_org_coach_reads_own" ON organizaciones IS
  'Un coach lee la organización a la que pertenece (via usuarios.org_id).';

COMMENT ON POLICY "rls_org_admin_reads_all" ON organizaciones IS
  'Admin de Pathway puede leer todas las organizaciones.';
