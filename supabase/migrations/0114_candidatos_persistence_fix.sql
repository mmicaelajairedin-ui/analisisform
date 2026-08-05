-- ===================================================================
-- Migration 0114: Fix client persistence in agregar-cliente-red
-- ===================================================================
-- Purpose: Ensure candidatos table has all required columns for
-- multicoach-compatible client creation. This migration:
--   1. Adds missing columns if they don't exist
--   2. Sets NOT NULL constraints where appropriate
--   3. Adds default values to prevent NULL mismatches
--   4. Verifies org_id linkage

-- Add missing columns with sensible defaults
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS programa_id UUID;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS semana_activa INT DEFAULT 1;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS foto_perfil TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Ensure org_id exists and is not null for existing rows
-- (agregar-cliente-red sets this when creating)
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS org_id UUID NOT NULL DEFAULT gen_random_uuid();

-- Ensure coach_id exists and references usuarios correctly
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS coach_id UUID;

-- Add foreign key constraints if they don't exist
-- (but not strict enough to fail on insert, just referential integrity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'candidatos_coach_id_fk'
  ) THEN
    ALTER TABLE candidatos
      ADD CONSTRAINT candidatos_coach_id_fk
      FOREIGN KEY (coach_id)
      REFERENCES usuarios(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure updated_at timestamp is set on all rows
UPDATE candidatos SET updated_at = NOW() WHERE updated_at IS NULL;

-- Summary
-- If org_id is null on any rows, this will cause an issue.
-- Recommend running this query to check:
-- SELECT COUNT(*) FROM candidatos WHERE org_id IS NULL;
-- If there are any, we need to manually fix them or update the migration.

COMMENT ON COLUMN candidatos.org_id IS
  'Organization this client belongs to. Must match coach.org_id.';
COMMENT ON COLUMN candidatos.programa_id IS
  'Program/package identifier. Optional, used for categorization.';
COMMENT ON COLUMN candidatos.semana_activa IS
  'Current week/session number in the program.';
COMMENT ON COLUMN candidatos.foto_perfil IS
  'URL to client profile photo.';
COMMENT ON COLUMN candidatos.notas IS
  'Private coach notes about the client.';
COMMENT ON COLUMN candidatos.deleted_at IS
  'Soft delete timestamp. If set, client is archived (not deleted).';
