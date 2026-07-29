-- Migration: Agregar plan_tipo a tabla usuarios (idempotente)
-- Fecha: 2026-07-29
-- Objetivo: Diferenciar Boutique, Studio, Pro

BEGIN;

-- Agregar columna plan_tipo si no existe
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS plan_tipo TEXT DEFAULT 'boutique';

-- Verificar constraint (si no existe, agregarlo)
-- Note: Constraints no tienen IF NOT EXISTS en PostgreSQL, así que es manual

-- Agregar timestamp de cambio si no existe
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS plan_changed_at TIMESTAMPTZ DEFAULT now();

-- Indice para queries rápidas (si no existe)
CREATE INDEX IF NOT EXISTS idx_usuarios_plan ON usuarios(plan_tipo);

-- Asignar planes según org_id
-- Admin multicoach → Pro
UPDATE usuarios SET plan_tipo = 'pro' WHERE rol = 'admin' AND org_id IS NOT NULL AND plan_tipo IS NULL;

-- Coaches multicoach → default Boutique
UPDATE usuarios SET plan_tipo = 'boutique' WHERE org_id IS NOT NULL AND plan_tipo IS NULL;

-- Coaches Pathway simple → NULL (sin plan_tipo)
UPDATE usuarios SET plan_tipo = NULL WHERE org_id IS NULL AND plan_tipo IS NOT NULL;

COMMIT;
