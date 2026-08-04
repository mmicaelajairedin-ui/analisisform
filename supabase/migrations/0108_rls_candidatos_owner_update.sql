-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0108: RLS UPDATE/DELETE for candidatos — Add owner permissions
-- ═══════════════════════════════════════════════════════════════════════
-- Propósito: Permitir que owners (multicoach) actualicen/eliminen clientes
--           de su organización. Actualmente fallaban silenciosamente.
--
-- Lógica:
--   SELECT: ya cubierto por 0105 (owner ve todos los clientes de su org)
--   UPDATE: agregar rule para owner (org_id match)
--   DELETE: agregar rule para owner (org_id match)
--
-- Nota: rls_strict.sql define candidatos_update para coach/admin/cliente.
--       Aquí extendemos para incluir owner (multicoach).

-- UPDATE: owner puede actualizar clientes de su org
DROP POLICY IF EXISTS candidatos_owner_update ON candidatos;
CREATE POLICY candidatos_owner_update ON candidatos FOR UPDATE
  USING (
    -- Owner de la org que contiene este cliente
    org_id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'owner'
      LIMIT 1
    )
    AND org_id IS NOT NULL
  )
  WITH CHECK (
    -- Mismo check: no puede mover el cliente a otra org
    org_id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'owner'
      LIMIT 1
    )
    AND org_id IS NOT NULL
  );

-- DELETE: owner puede eliminar clientes de su org
DROP POLICY IF EXISTS candidatos_owner_delete ON candidatos;
CREATE POLICY candidatos_owner_delete ON candidatos FOR DELETE
  USING (
    org_id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'owner'
      LIMIT 1
    )
    AND org_id IS NOT NULL
  );

COMMENT ON POLICY "candidatos_owner_update" ON candidatos IS
  'Un owner (multicoach) puede actualizar clientes de su organización.';

COMMENT ON POLICY "candidatos_owner_delete" ON candidatos IS
  'Un owner (multicoach) puede eliminar clientes de su organización.';
