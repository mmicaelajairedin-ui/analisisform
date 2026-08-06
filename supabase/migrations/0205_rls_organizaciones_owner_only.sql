-- Migration: RLS Phase 2 — organizaciones table owner-only edits
-- Fecha: 2026-08-05
-- Propósito: Cerrar gap — solo Owner puede editar marca, plan, config de la org
--
-- SITUACIÓN ACTUAL: Falta RLS en edits de organizaciones
-- RIESGO: Coach o Collaborator podrían editar marca/plan/config si direct REST call
--
-- CAMBIO:
-- Antes: sin RLS de update (cualquiera en org podría editar)
-- Después: solo Owner (owner_user_id = auth.uid()) puede update/delete

-- ============================================================================
-- Enable RLS (if not already enabled)
-- ============================================================================

ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Drop existing policies
-- ============================================================================

DROP POLICY IF EXISTS "org_owner_access" ON organizaciones;
DROP POLICY IF EXISTS "org_admin_read_access" ON organizaciones;
DROP POLICY IF EXISTS "org_all_read" ON organizaciones;

-- ============================================================================
-- NEW: Role-based RLS policies for organizaciones
-- ============================================================================

-- SELECT: Owner + any user in org can see org config (no secrets here)
CREATE POLICY "organizaciones_org_read" ON organizaciones
FOR SELECT
USING (
  -- Owner ve su org
  owner_user_id = auth.uid()
  OR
  -- Anyone in the org can read org info (no secrets)
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE org_id = organizaciones.id
    AND id = auth.uid()
  )
);

-- INSERT: Owner only (should be rare, handled via edge function)
CREATE POLICY "organizaciones_owner_insert" ON organizaciones
FOR INSERT
WITH CHECK (
  owner_user_id = auth.uid()
);

-- UPDATE: Owner only
CREATE POLICY "organizaciones_owner_update" ON organizaciones
FOR UPDATE
USING (
  owner_user_id = auth.uid()
)
WITH CHECK (
  owner_user_id = auth.uid()
);

-- DELETE: Owner only
CREATE POLICY "organizaciones_owner_delete" ON organizaciones
FOR DELETE
USING (
  owner_user_id = auth.uid()
);

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- DROP POLICY IF EXISTS "organizaciones_org_read" ON organizaciones;
-- DROP POLICY IF EXISTS "organizaciones_owner_insert" ON organizaciones;
-- DROP POLICY IF EXISTS "organizaciones_owner_update" ON organizaciones;
-- DROP POLICY IF EXISTS "organizaciones_owner_delete" ON organizaciones;
