-- Migration: RLS Phase 2 — red_canales read-only policy
-- Fecha: 2026-08-05
-- Propósito: Permitir lectura de canales en la org (writes siguen via edge function)
--
-- SITUACIÓN ACTUAL: red_canales tiene RLS pero sin policies (cerrado a todos)
-- MEJORA: Permitir que usuarios en la org LEAN canales de su org (no modificar)
--
-- CAMBIO:
-- Antes: RLS enabled pero sin policies = solo service role puede acceder
-- Después: users en org pueden SELECT canales, pero writes/deletes via edge function solo

-- ============================================================================
-- Add READ-ONLY policy for org members
-- ============================================================================

DROP POLICY IF EXISTS "red_canales_org_read" ON red_canales;

CREATE POLICY "red_canales_org_read" ON red_canales
FOR SELECT
USING (
  -- User debe pertenecer a la org
  org_id = (
    SELECT org_id FROM usuarios
    WHERE id = auth.uid()
    LIMIT 1
  )
);

-- ============================================================================
-- Keep writes/deletes via edge function (no policy = only service role)
-- ============================================================================
-- Nota: INSERT, UPDATE, DELETE no tienen policy
-- → Solo edge function (service role + verificación propia) puede modificar

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- DROP POLICY IF EXISTS "red_canales_org_read" ON red_canales;
