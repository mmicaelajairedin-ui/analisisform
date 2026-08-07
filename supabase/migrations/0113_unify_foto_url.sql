-- ============================================================================
-- Migration 0113: Unify photo/avatar — usuarios.foto_url as single source of truth
-- ============================================================================
-- Migrates existing foto_url values from configuracion JSONB to usuarios.foto_url column.
-- Makes usuario.foto_url the official source for coach/user photos.
--
-- NOTE: foto_perfil_url column is left in place (used by edge functions).
-- It can be migrated/dropped in a future migration after updating API layer.
--
-- Idempotent: can be run multiple times safely.
-- ============================================================================

-- 1) Migrate existing values: configuracion.foto_url → usuarios.foto_url
--    Only if usuario.foto_url is empty (preserve any existing direct column values)
UPDATE usuarios
   SET foto_url = configuracion->>'foto_url'
 WHERE (foto_url IS NULL OR foto_url = '')
   AND configuracion->>'foto_url' IS NOT NULL
   AND configuracion->>'foto_url' <> '';

-- 2) Ensure foto_url column exists (should already exist from initial schema)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- 3) Optional: Also sync to foto_perfil_url for backward compatibility with edge functions
--    (Only fill if foto_perfil_url is empty but foto_url now has a value)
UPDATE usuarios
   SET foto_perfil_url = foto_url
 WHERE (foto_perfil_url IS NULL OR foto_perfil_url = '')
   AND foto_url IS NOT NULL
   AND foto_url <> '';

-- Verification query (run manually to check migration):
-- SELECT email, nombre, foto_url, foto_perfil_url, configuracion->>'foto_url' AS cfg_foto_url
-- FROM usuarios
-- WHERE rol IN ('coach', 'admin')
-- ORDER BY created_at DESC
-- LIMIT 10;
