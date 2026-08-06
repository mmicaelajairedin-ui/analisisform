-- Migration: RLS Phase 2 — mensajes_red_canal org-based access
-- Fecha: 2026-08-05
-- Propósito: Proteger mensajes de la red — solo miembros de org pueden leer
--
-- SITUACIÓN ACTUAL: mensajes_red_canal podría estar sin suficiente RLS
-- RIESGO: Usuario de otra org podría acceder mensajes si conoce org_id
--
-- CAMBIO:
-- Antes: policies posiblemente insuficientes
-- Después: user solo ve mensajes de su org (org_id = su org_id)

-- ============================================================================
-- Enable RLS (if not already)
-- ============================================================================

ALTER TABLE mensajes_red_canal ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Drop existing policies
-- ============================================================================

DROP POLICY IF EXISTS "mensajes_red_canal_org_access" ON mensajes_red_canal;
DROP POLICY IF EXISTS "mensajes_red_canal_read" ON mensajes_red_canal;
DROP POLICY IF EXISTS "mensajes_red_canal_write" ON mensajes_red_canal;

-- ============================================================================
-- NEW: Org-based RLS policies
-- ============================================================================

-- SELECT: Only users in the same org can read messages
CREATE POLICY "mensajes_red_canal_org_read" ON mensajes_red_canal
FOR SELECT
USING (
  org_id = (
    SELECT org_id FROM usuarios
    WHERE id = auth.uid()
    LIMIT 1
  )
);

-- INSERT: Only users in the same org (via edge function, pero this sets baseline)
CREATE POLICY "mensajes_red_canal_insert" ON mensajes_red_canal
FOR INSERT
WITH CHECK (
  -- Verify user is in the org
  org_id = (
    SELECT org_id FROM usuarios
    WHERE id = auth.uid()
    LIMIT 1
  )
  AND
  -- Verify sender_id is the authenticated user (anti-spoofing)
  sender_id = auth.uid()
);

-- UPDATE/DELETE: Handled by edge function (service role)
-- No policy = only service role can modify

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- DROP POLICY IF EXISTS "mensajes_red_canal_org_read" ON mensajes_red_canal;
-- DROP POLICY IF EXISTS "mensajes_red_canal_insert" ON mensajes_red_canal;
