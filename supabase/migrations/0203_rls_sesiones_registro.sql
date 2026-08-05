-- Migration: RLS Phase 2 — sesiones_registro table (CRITICAL: NO RLS CURRENTLY)
-- Fecha: 2026-08-05
-- Propósito: Proteger sesiones de coaches — coach solo ve sus sesiones, owner ve TODO
--
-- SITUACIÓN ACTUAL: sesiones_registro NO TIENE RLS
-- RIESGO: Cualquiera en la org puede leer/editar sesiones de otros coaches
--
-- CAMBIO:
-- Antes: sin protección
-- Después: filtra por rol
--   * Owner: ve/edita TODO
--   * Coach: ve/edita SOLO sus sesiones (coach_id = auth.uid())
--   * Collaborator: sin acceso (sesiones es core del coach)

-- ============================================================================
-- Enable RLS (if not already enabled)
-- ============================================================================

ALTER TABLE sesiones_registro ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Drop existing policies (if any)
-- ============================================================================

DROP POLICY IF EXISTS "sesiones_owner_access" ON sesiones_registro;
DROP POLICY IF EXISTS "sesiones_coach_access" ON sesiones_registro;

-- ============================================================================
-- NEW: Role-based RLS policies for sesiones_registro
-- ============================================================================

-- SELECT: Owner ve TODO, Coach ve sus sesiones
CREATE POLICY "sesiones_role_based_read" ON sesiones_registro
FOR SELECT
USING (
  -- Owner de la organización puede ver TODO
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = sesiones_registro.org_id
    AND rol = 'owner'
  )
  OR
  -- Coach solo ve sus propias sesiones
  (
    coach_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND org_id = sesiones_registro.org_id
    )
  )
);

-- INSERT: Owner + Coach (propia sesión)
CREATE POLICY "sesiones_role_based_insert" ON sesiones_registro
FOR INSERT
WITH CHECK (
  -- Owner puede crear sesiones para cualquier coach
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = sesiones_registro.org_id
    AND rol = 'owner'
  )
  OR
  -- Coach puede crear SUS propias sesiones
  (
    coach_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND org_id = sesiones_registro.org_id
    )
  )
);

-- UPDATE: Owner + Coach (propia sesión)
CREATE POLICY "sesiones_role_based_update" ON sesiones_registro
FOR UPDATE
USING (
  -- Owner
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = sesiones_registro.org_id
    AND rol = 'owner'
  )
  OR
  -- Coach: solo sus sesiones
  (
    coach_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND org_id = sesiones_registro.org_id
    )
  )
)
WITH CHECK (
  coach_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = sesiones_registro.org_id
    AND rol = 'owner'
  )
);

-- DELETE: Owner solo
CREATE POLICY "sesiones_role_based_delete" ON sesiones_registro
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = sesiones_registro.org_id
    AND rol = 'owner'
  )
);

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- DROP POLICY IF EXISTS "sesiones_role_based_read" ON sesiones_registro;
-- DROP POLICY IF EXISTS "sesiones_role_based_insert" ON sesiones_registro;
-- DROP POLICY IF EXISTS "sesiones_role_based_update" ON sesiones_registro;
-- DROP POLICY IF EXISTS "sesiones_role_based_delete" ON sesiones_registro;
-- ALTER TABLE sesiones_registro DISABLE ROW LEVEL SECURITY;
