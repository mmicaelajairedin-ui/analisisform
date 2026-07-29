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

-- Coaches con rol 'admin' siempre Pro
UPDATE usuarios SET plan_tipo = 'pro' WHERE rol = 'admin';

-- Coaches que ya pagaron (estado_sub='activa') → Pro
UPDATE usuarios SET plan_tipo = 'pro' WHERE estado_sub = 'activa' AND plan_tipo IS NULL;

-- Coaches en prueba (estado_sub='prueba') → Boutique
UPDATE usuarios SET plan_tipo = 'boutique' WHERE estado_sub = 'prueba' AND plan_tipo IS NULL;

-- Fallback: cualquier coach restante → Boutique
UPDATE usuarios SET plan_tipo = 'boutique' WHERE plan_tipo IS NULL;

COMMIT;
