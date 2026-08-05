-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0110: Ensure semana_activa column exists in candidatos
-- ═══════════════════════════════════════════════════════════════════════
-- The agregar-cliente-red edge function sets semana_activa = 1 when creating
-- clients. This migration ensures the column exists and has proper defaults.

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS semana_activa INT DEFAULT 1;

COMMENT ON COLUMN candidatos.semana_activa IS
  'Semana activa del cliente en el programa (1-4). Comienza en 1 al agregarse. Incrementa automáticamente.';
