-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0106: RLS for coach_client_assignments
-- ═══════════════════════════════════════════════════════════════════════
-- Políticas para que coaches y owners puedan leer y gestionar asignaciones.
--
-- Lógica:
--   1. Coach ve sus propias asignaciones
--   2. Owner ve todas las asignaciones de su org
--   3. Admin ve todas
--

-- Enable RLS
ALTER TABLE coach_client_assignments ENABLE ROW LEVEL SECURITY;

-- Policy 1: Coach reads own assignments
CREATE POLICY "rls_assignments_coach_reads_own"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = (
      SELECT id FROM usuarios
      WHERE auth_id = auth.uid()
      LIMIT 1
    )
  );

-- Policy 2: Owner reads org assignments
CREATE POLICY "rls_assignments_owner_reads_org"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'owner'
      LIMIT 1
    )
    AND org_id IS NOT NULL
  );

-- Policy 3: Admin reads all
CREATE POLICY "rls_assignments_admin_reads_all"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'admin'
    )
  );

-- Policy 4: Owner can INSERT assignments in their org
CREATE POLICY "rls_assignments_owner_inserts_org"
  ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'owner'
      LIMIT 1
    )
    AND org_id IS NOT NULL
  );

-- Policy 5: Owner can UPDATE assignments in their org
CREATE POLICY "rls_assignments_owner_updates_org"
  ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'owner'
      LIMIT 1
    )
    AND org_id IS NOT NULL
  )
  WITH CHECK (
    org_id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'owner'
      LIMIT 1
    )
    AND org_id IS NOT NULL
  );

-- Policy 6: Owner can DELETE assignments in their org
CREATE POLICY "rls_assignments_owner_deletes_org"
  ON coach_client_assignments
  FOR DELETE
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'owner'
      LIMIT 1
    )
    AND org_id IS NOT NULL
  );

-- Admin can INSERT/UPDATE/DELETE (opcional para MVP, pero útil)
CREATE POLICY "rls_assignments_admin_full_access"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'admin'
    )
  );

-- Anon can't do anything
ALTER TABLE coach_client_assignments FORCE ROW LEVEL SECURITY;

COMMENT ON POLICY "rls_assignments_coach_reads_own" ON coach_client_assignments IS
  'Un coach puede ver sus propias asignaciones de clientes.';

COMMENT ON POLICY "rls_assignments_owner_reads_org" ON coach_client_assignments IS
  'Un owner puede ver todas las asignaciones de su organización.';

COMMENT ON POLICY "rls_assignments_admin_reads_all" ON coach_client_assignments IS
  'Admin puede ver todas las asignaciones.';

COMMENT ON POLICY "rls_assignments_owner_inserts_org" ON coach_client_assignments IS
  'Un owner puede crear asignaciones dentro de su organización.';

COMMENT ON POLICY "rls_assignments_owner_updates_org" ON coach_client_assignments IS
  'Un owner puede actualizar asignaciones en su organización (ej: cambiar estado).';

COMMENT ON POLICY "rls_assignments_owner_deletes_org" ON coach_client_assignments IS
  'Un owner puede eliminar asignaciones de su organización.';

COMMENT ON POLICY "rls_assignments_admin_full_access" ON coach_client_assignments IS
  'Admin de Pathway tiene acceso total a todas las asignaciones.';
