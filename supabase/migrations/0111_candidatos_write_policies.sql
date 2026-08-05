-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0111: Add write policies to candidatos table
-- ═══════════════════════════════════════════════════════════════════════
-- Defensively add INSERT/UPDATE/DELETE policies to candidatos.
-- Note: Edge functions use SERVICE ROLE and bypass RLS, so these are
-- for future authenticated user operations and defensive programming.

-- Policy: Coaches can update assigned clients
CREATE POLICY "rls_candidatos_coach_updates_assigned"
  ON candidatos
  FOR UPDATE
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

-- Policy: Owners can update clients in their org
CREATE POLICY "rls_candidatos_owner_updates_org_clients"
  ON candidatos
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
  );

-- Policy: Owners can insert clients to their org (defensive)
-- Note: agregar-cliente-red uses SERVICE ROLE and bypasses this,
-- but this protects future frontend inserts
CREATE POLICY "rls_candidatos_owner_creates"
  ON candidatos
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

COMMENT ON POLICY "rls_candidatos_coach_updates_assigned" ON candidatos IS
  'Coach puede actualizar clientes asignados a él.';

COMMENT ON POLICY "rls_candidatos_owner_updates_org_clients" ON candidatos IS
  'Owner puede actualizar todos los clientes de su org.';

COMMENT ON POLICY "rls_candidatos_owner_creates" ON candidatos IS
  'Owner puede crear clientes en su org (defensivo - agregar-cliente-red usa SERVICE ROLE).';
