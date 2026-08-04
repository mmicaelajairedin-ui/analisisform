-- ═══════════════════════════════════════════════════════════════════════
-- CYCLE 4: organizaciones.owner_id — Nueva FK a usuarios.id
-- ═══════════════════════════════════════════════════════════════════════
-- Propósito: Reemplazar owner_email (TEXT) con owner_id (UUID FK) para
-- integridad referencial. Mantener owner_email para compatibilidad.
--
-- Flujo:
-- 1. Agregar columna owner_id (nullable inicialmente)
-- 2. Migrar datos: owner_id = usuarios.id donde usuarios.email = owner_email
-- 3. Crear FK constraint
-- 4. Edge functions escriben AMBOS campos (transición)
-- 5. Lectura sigue con owner_email hasta verificación completa
-- 6. Eliminar owner_email en ciclo posterior (no ahora)

-- Paso 1: Agregar columna owner_id (NULL inicialmente para safety)
ALTER TABLE organizaciones
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES usuarios(id);

COMMENT ON COLUMN organizaciones.owner_id IS
  'Nueva fuente de verdad: FK a usuarios.id. Reemplaza owner_email (que se mantiene por compatibilidad). Los edge functions escriben AMBOS campos durante transición.';

-- Paso 2: Migrar datos existentes
-- Busca cada org y encuentra el usuario con email matching
UPDATE organizaciones o
  SET owner_id = u.id
  FROM usuarios u
  WHERE u.email = (o.owner_email)::text
    AND o.owner_id IS NULL;

-- Paso 3: Índice para queries por owner_id
CREATE INDEX IF NOT EXISTS idx_organizaciones_owner_id ON organizaciones(owner_id);

-- Paso 4: Log de migración
-- Contar cuántos registros se migraron vs cuántos quedan NULL
-- (útil para debugging si hay owner_email huérfanos)
-- SELECT COUNT(*) as migrados FROM organizaciones WHERE owner_id IS NOT NULL;
-- SELECT COUNT(*) as sin_match FROM organizaciones WHERE owner_email IS NOT NULL AND owner_id IS NULL;
