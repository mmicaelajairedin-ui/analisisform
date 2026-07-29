-- Migration: Crear tabla plan_limits
-- Fecha: 2026-07-29
-- Objetivo: Tabla de referencia con features y limites por plan

BEGIN;

CREATE TABLE plan_limits (
  plan TEXT PRIMARY KEY,
  max_coaches INT,
  max_clients INT,
  features JSONB NOT NULL,
  description TEXT,
  price_usd DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS para lectura pública (cualquiera puede verla)
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_limits_read_anon" ON plan_limits
  FOR SELECT USING (true);

CREATE POLICY "plan_limits_read_auth" ON plan_limits
  FOR SELECT USING (true);

-- Seed: 3 planes
INSERT INTO plan_limits (plan, max_coaches, max_clients, features, description, price_usd) VALUES
  (
    'boutique',
    3,
    45,
    '{
      "white_label": false,
      "analytics_equipo": false,
      "comunidad": false,
      "dominio_custom": false,
      "integraciones": false,
      "onboarding_personalizado": false,
      "soporte_prioritario": false
    }'::jsonb,
    'Para equipos pequeños que arrancan',
    149.00
  ),
  (
    'studio',
    8,
    120,
    '{
      "white_label": true,
      "analytics_equipo": true,
      "comunidad": true,
      "dominio_custom": false,
      "integraciones": false,
      "onboarding_personalizado": false,
      "soporte_prioritario": true
    }'::jsonb,
    'Para equipos en crecimiento',
    249.00
  ),
  (
    'pro',
    NULL,
    NULL,
    '{
      "white_label": true,
      "analytics_equipo": true,
      "comunidad": true,
      "dominio_custom": true,
      "integraciones": true,
      "onboarding_personalizado": true,
      "soporte_prioritario": true
    }'::jsonb,
    'Para agencias y equipos sin límites',
    399.00
  );

COMMIT;
