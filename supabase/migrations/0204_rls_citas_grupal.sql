-- Migration: RLS Phase 2 — citas table grupal (group events) protection
-- Fecha: 2026-08-05
-- Propósito: Mejorar protección de eventos grupales — solo owner puede crear/editar grupal
--
-- SITUACIÓN ACTUAL: citas tiene RLS pero no protege grupal events
-- RIESGO: Coach individual podría crear grupal=true events (afecta a toda la red)
--
-- CAMBIO:
-- Antes: Coach puede crear citas con grupal=true (side effect: afecta otros coaches)
-- Después: solo Owner puede crear/editar grupal=true

-- ============================================================================
-- Drop existing policies to replace (si existen)
-- ============================================================================

DROP POLICY IF EXISTS "citas_coach_access" ON citas;
DROP POLICY IF EXISTS "citas_grupal_protection" ON citas;

-- ============================================================================
-- NEW: Improved RLS policy for citas with grupal protection
-- ============================================================================

-- SELECT: Coach ve sus citas + grupal (group events); Owner ve TODO
CREATE POLICY "citas_role_based_read" ON citas
FOR SELECT
USING (
  -- Owner ve TODO (sus citas + grupal + todos)
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = citas.org_id
    AND rol = 'owner'
  )
  OR
  -- Coach ve sus citas (coach_id = auth.uid())
  (
    coach_id = auth.uid()
    AND NOT citas.grupal  -- Coach NO ve grupal events que no son suyas
  )
  OR
  -- Coach ve grupal events de su org (puede asistir/ver)
  (
    citas.grupal = true
    AND citas.org_id = (SELECT org_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
  )
);

-- INSERT: Owner puede crear TODO, Coach solo citas personales (grupal=false)
CREATE POLICY "citas_role_based_insert" ON citas
FOR INSERT
WITH CHECK (
  -- Owner puede crear cualquier tipo (personal o grupal)
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = citas.org_id
    AND rol = 'owner'
  )
  OR
  -- Coach solo puede crear citas personales (grupal MUST be false/null)
  (
    coach_id = auth.uid()
    AND (citas.grupal IS NULL OR citas.grupal = false)
    AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND org_id = citas.org_id
    )
  )
);

-- UPDATE: Owner puede editar TODO, Coach solo sus citas personales, no puede cambiar grupal
CREATE POLICY "citas_role_based_update" ON citas
FOR UPDATE
USING (
  -- Owner
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = citas.org_id
    AND rol = 'owner'
  )
  OR
  -- Coach: solo sus citas (y NO grupal)
  (
    coach_id = auth.uid()
    AND (citas.grupal IS NULL OR citas.grupal = false)
    AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND org_id = citas.org_id
    )
  )
)
WITH CHECK (
  -- No puede cambiar grupal=true si es coach
  (
    coach_id = auth.uid()
    AND (citas.grupal IS NULL OR citas.grupal = false)
  )
  OR
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = citas.org_id
    AND rol = 'owner'
  )
);

-- DELETE: Owner solo
CREATE POLICY "citas_role_based_delete" ON citas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = citas.org_id
    AND rol = 'owner'
  )
);

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- DROP POLICY IF EXISTS "citas_role_based_read" ON citas;
-- DROP POLICY IF EXISTS "citas_role_based_insert" ON citas;
-- DROP POLICY IF EXISTS "citas_role_based_update" ON citas;
-- DROP POLICY IF EXISTS "citas_role_based_delete" ON citas;
