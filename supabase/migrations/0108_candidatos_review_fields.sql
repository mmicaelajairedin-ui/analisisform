-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0108: Add review fields to candidatos table
-- ═══════════════════════════════════════════════════════════════════════
-- Propósito: El código en cliente.html intenta guardar y consultar
--           review_rating, review_texto, review_fecha en la tabla candidatos,
--           pero estas columnas no existen. Agregar columnas para que el
--           sistema de reseñas (nudge + guardado) funcione correctamente.
--
-- Impacto: Cliente verá nudge de reseña solo UNA vez (cuando ya reseña,
--          estas columnas quedan populadas y _yaReseño() retorna true).

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS review_rating INT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS review_texto TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS review_fecha TIMESTAMPTZ;

-- Índice para búsquedas rápidas (si necesitamos reportes por rating)
CREATE INDEX IF NOT EXISTS idx_candidatos_review_rating ON candidatos (review_rating) WHERE review_rating IS NOT NULL;

COMMENT ON COLUMN candidatos.review_rating IS
  'Rating numérico (1-5) de la reseña del cliente sobre el coaching de Pathway.';

COMMENT ON COLUMN candidatos.review_texto IS
  'Texto/comentario de la reseña del cliente (guardar aquí y también en tabla reviews para el perfil público del coach).';

COMMENT ON COLUMN candidatos.review_fecha IS
  'Timestamp de cuándo el cliente hizo la reseña.';
