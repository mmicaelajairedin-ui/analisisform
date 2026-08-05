-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0112: Ensure foto_perfil column exists in candidatos
-- ═══════════════════════════════════════════════════════════════════════
-- The mi-red edge function selects foto_perfil when loading organization clients.
-- This migration ensures the column exists for that query.

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

CREATE INDEX IF NOT EXISTS idx_candidatos_foto_perfil ON candidatos (foto_perfil) WHERE foto_perfil IS NOT NULL;

COMMENT ON COLUMN candidatos.foto_perfil IS
  'URL de la foto de perfil del cliente. Se puede obtener de CV o subirse directamente.';
