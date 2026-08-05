-- Migration: RLS Phase 2 — candidatos table role-based access control
-- Fecha: 2026-08-05
-- Propósito: Cerrar gap de seguridad — coach solo ve sus clientes, collaborator respeta permisos
--
-- CAMBIO:
-- Antes: policy solo filtraba org_id (todos en org veían todos los clientes)
-- Después: filtra por rol
--   * Owner: ve TODO
--   * Coach: ve SOLO sus clientes (coach_id = auth.uid())
--   * Collaborator: dinámico según cfg.permisos.CLIENT_VIEW (si existe)

-- ============================================================================
-- Drop existing policies (si existen) para reemplazar
-- ============================================================================

DROP POLICY IF EXISTS "candidatos_org_access" ON candidatos;
DROP POLICY IF EXISTS "candidatos_read_org" ON candidatos;
DROP POLICY IF EXISTS "candidatos_coach_access" ON candidatos;

-- ============================================================================
-- NEW: Role-based RLS policies
-- ============================================================================

-- SELECT: Owner ve TODO, Coach ve sus clientes, Collaborator con permiso
CREATE POLICY "candidatos_role_based_read" ON candidatos
FOR SELECT
USING (
  -- Owner de la organización puede ver TODO
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = candidatos.org_id
    AND rol = 'owner'
  )
  OR
  -- Coach solo ve sus propios clientes
  (
    coach_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND org_id = candidatos.org_id
      AND rol != 'owner'
    )
  )
  OR
  -- Collaborator con permiso CLIENT_VIEW
  (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.org_id = candidatos.org_id
      AND (u.configuracion->>'member_role')::text = 'colaborador'
      AND (u.configuracion->'permisos'->>'CLIENT_VIEW')::boolean = true
    )
  )
);

-- INSERT: Owner + Collaborator con CLIENT_CREATE
CREATE POLICY "candidatos_role_based_insert" ON candidatos
FOR INSERT
WITH CHECK (
  -- Owner puede crear clientes
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = candidatos.org_id
    AND rol = 'owner'
  )
  OR
  -- Collaborator con permiso CLIENT_CREATE
  (
    org_id = (SELECT org_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.configuracion->'permisos'->>'CLIENT_CREATE')::boolean = true
    )
  )
);

-- UPDATE: Coach puede editar sus clientes, Owner puede editar TODO, Collaborator con permiso
CREATE POLICY "candidatos_role_based_update" ON candidatos
FOR UPDATE
USING (
  -- Owner
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = candidatos.org_id
    AND rol = 'owner'
  )
  OR
  -- Coach: solo sus clientes
  (
    coach_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND org_id = candidatos.org_id
    )
  )
  OR
  -- Collaborator con permiso CLIENT_EDIT
  (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.org_id = candidatos.org_id
      AND (u.configuracion->'permisos'->>'CLIENT_EDIT')::boolean = true
    )
  )
)
WITH CHECK (
  org_id = (SELECT org_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
);

-- DELETE: Owner solo
CREATE POLICY "candidatos_role_based_delete" ON candidatos
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND org_id = candidatos.org_id
    AND rol = 'owner'
  )
);

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- DROP POLICY IF EXISTS "candidatos_role_based_read" ON candidatos;
-- DROP POLICY IF EXISTS "candidatos_role_based_insert" ON candidatos;
-- DROP POLICY IF EXISTS "candidatos_role_based_update" ON candidatos;
-- DROP POLICY IF EXISTS "candidatos_role_based_delete" ON candidatos;
