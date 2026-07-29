-- Migration: Agregar stripe_customer_id a tabla usuarios (idempotente)
-- Fecha: 2026-07-29
-- Objetivo: Guardar el Stripe customer ID para vincular webhooks

BEGIN;

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_usuarios_stripe_customer ON usuarios(stripe_customer_id);

COMMIT;
