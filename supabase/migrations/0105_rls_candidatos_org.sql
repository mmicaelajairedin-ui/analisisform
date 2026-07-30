-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0105: RLS for candidatos (organization + assignment context)
-- ═══════════════════════════════════════════════════════════════════════
-- Políticas para que coaches y owners vean clientes según org + assignment.
--
-- Lógica:
--   1. Cliente ve su propio registro
--   2. Coach ve clientes asignados (via coach_client_assignments)
--   3. Owner ve todos los clientes de su org
--   4. Admin ve todos
--
-- Nota: estas policies asumen que coach_client_assignments existe (0102).
--

-- Enable RLS
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;

-- Policy 1: Client reads themselves
CREATE POLICY "rls_candidatos_client_reads_self"
  ON candidatos
  FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );

-- Policy 2: Coach reads assigned clients (via assignments table)
CREATE POLICY "rls_candidatos_coach_reads_assigned"
  ON candidatos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments a
      JOIN usuarios u ON u.id = a.coach_id
      WHERE a.client_id = candidatos.id
        AND u.auth_id = auth.uid()
        AND a.estado = 'activa'
    )
  );

-- Policy 3: Owner reads all clients in their org
CREATE POLICY "rls_candidatos_owner_reads_org_clients"
  ON candidatos
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

-- Policy 4: Admin reads all
CREATE POLICY "rls_candidatos_admin_reads_all"
  ON candidatos
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
ALTER TABLE candidatos FORCE ROW LEVEL SECURITY;

COMMENT ON POLICY "rls_candidatos_client_reads_self" ON candidatos IS
  'Un cliente puede leer su propio registro (match por email).';

COMMENT ON POLICY "rls_candidatos_coach_reads_assigned" ON candidatos IS
  'Un coach puede leer clientes asignados a él (via coach_client_assignments).';

COMMENT ON POLICY "rls_candidatos_owner_reads_org_clients" ON candidatos IS
  'Un owner puede leer todos los clientes de su organización.';

COMMENT ON POLICY "rls_candidatos_admin_reads_all" ON candidatos IS
  'Admin puede leer todos los clientes.';
