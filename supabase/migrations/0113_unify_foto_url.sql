-- ============================================================================
-- Migration 0113: Unify photo/avatar — usuarios.foto_url as single source of truth
-- ============================================================================
-- Migrates existing foto_url values from configuracion JSONB to usuarios.foto_url column.
-- Makes usuario.foto_url the official source for coach/user photos.
-- Removes duplicate foto_perfil_url column (added by error).
--
-- Idempotent: can be run multiple times safely.
-- ============================================================================

-- 1) Migrate existing values: configuracion.foto_url → usuarios.foto_url
--    Only if usuario.foto_url is empty
UPDATE usuarios
   SET foto_url = configuracion->>'foto_url'
 WHERE (foto_url IS NULL OR foto_url = '')
   AND configuracion->>'foto_url' IS NOT NULL
   AND configuracion->>'foto_url' <> '';

-- 2) Drop duplicate column if it exists
ALTER TABLE usuarios DROP COLUMN IF EXISTS foto_perfil_url;

-- 3) Ensure foto_url column exists and is not nullable for coaches/admins
--    (Optional: can add NOT NULL constraint later after validating data)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- 4) Index for efficient lookups (needed for usuarios_publicos_view and coach directory)
CREATE INDEX IF NOT EXISTS idx_usuarios_foto_url ON usuarios(foto_url) WHERE foto_url IS NOT NULL;

-- Verification query (run manually to check migration):
-- SELECT email, nombre, foto_url, configuracion->>'foto_url' AS cfg_foto_url
-- FROM usuarios
-- WHERE rol IN ('coach', 'admin')
-- ORDER BY created_at DESC
-- LIMIT 10;
