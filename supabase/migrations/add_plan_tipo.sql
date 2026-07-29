-- Migration: Agregar plan_tipo a tabla usuarios
-- Fecha: 2026-07-29
-- Objetivo: Diferenciar Boutique, Studio, Pro

BEGIN;

-- Agregar columna plan_tipo con default 'boutique'
ALTER TABLE usuarios
ADD COLUMN plan_tipo TEXT DEFAULT 'boutique'
CHECK (plan_tipo IN ('boutique', 'studio', 'pro'));

-- Agregar timestamp de cambio
ALTER TABLE usuarios
ADD COLUMN plan_changed_at TIMESTAMPTZ DEFAULT now();

-- Indice para queries rápidas por plan
CREATE INDEX idx_usuarios_plan ON usuarios(plan_tipo);

-- plan_tipo SOLO aplica a coaches multicoach (con org_id)
-- Admin siempre Pro (si tiene org_id)
UPDATE usuarios SET plan_tipo = 'pro' WHERE rol = 'admin' AND org_id IS NOT NULL;

-- Coaches multicoach (org_id NOT NULL) → default Boutique
UPDATE usuarios SET plan_tipo = 'boutique' WHERE org_id IS NOT NULL AND plan_tipo IS NULL;

-- Coaches Pathway simple (org_id IS NULL) → plan_tipo NULL (sin restricciones)
UPDATE usuarios SET plan_tipo = NULL WHERE org_id IS NULL;

COMMIT;
