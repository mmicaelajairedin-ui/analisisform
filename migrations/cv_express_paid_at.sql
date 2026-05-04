-- ─────────────────────────────────────────────────────────────────
-- Migration: cv_express.paid_at + stripe_session_id
-- ─────────────────────────────────────────────────────────────────
-- Agregar columnas para validar acceso al Pack Express.
--
-- Sin estas columnas, cualquiera con el URL '?paid=1&email=X' accedía
-- gratis al Pack. Ahora cv-express.html valida que el email tenga
-- paid_at != NULL antes de mostrar el form.
--
-- El stripe-webhook Edge Function setea paid_at automáticamente cuando
-- detecta un pago de €40 o €10 (suplemento regen).
--
-- Para usuarios que pagaron ANTES de esta migración, NO tienen paid_at,
-- pero SÍ tienen cv_optimizado generado. cv-express.html acepta esos
-- como legacy (mira AMBOS campos para validar acceso).
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE cv_express ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE cv_express ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE cv_express ADD COLUMN IF NOT EXISTS pago_monto NUMERIC;

-- Backfill: usuarios legacy que ya generaron Pack se marcan como pagados.
-- Asumimos que si tienen cv_optimizado, es porque pagaron en su momento.
UPDATE cv_express
SET paid_at = COALESCE(paid_at, created_at, NOW())
WHERE cv_optimizado IS NOT NULL AND paid_at IS NULL;
