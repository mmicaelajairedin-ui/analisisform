-- ===================================================================
-- coach_scoring_config — Versionado de pesos para Health Score
--
-- Permite ajustar los pesos del Health Score sin cambiar código:
--   Health Score = Retention(X%) + Utilization(Y%) + Satisfaction(Z%) + Engagement(W%)
--
-- Cada versión es un snapshot de los pesos aplicables a ciertos coaches.
-- Versión 1 = pesos base: 40/25/20/15
--
-- Aplicar una vez en Supabase Studio → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL,
  name TEXT NOT NULL,

  -- Pesos del Health Score (deben sumar ~100)
  weight_retention DECIMAL DEFAULT 0.40,
  weight_utilization DECIMAL DEFAULT 0.25,
  weight_satisfaction DECIMAL DEFAULT 0.20,
  weight_engagement DECIMAL DEFAULT 0.15,

  -- Sub-pesos del Engagement (deben sumar ~100)
  engagement_login_weight DECIMAL DEFAULT 0.40,
  engagement_sessions_weight DECIMAL DEFAULT 0.30,
  engagement_reports_weight DECIMAL DEFAULT 0.20,
  engagement_messages_weight DECIMAL DEFAULT 0.10,

  -- Scope
  applies_to_role TEXT, -- NULL = todos, 'pro' = solo pro, etc.
  applies_to_coach_ids UUID[], -- NULL = todos, [uuid1, uuid2] = específicos

  -- Estado
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  notes TEXT,

  UNIQUE(version, applies_to_role, applies_to_coach_ids)
);

-- Seed: versión base
INSERT INTO scoring_config (version, name, weight_retention, weight_utilization, weight_satisfaction, weight_engagement, active, notes)
VALUES (1, 'Health Score v1 (base)', 0.40, 0.25, 0.20, 0.15, true, 'Pesos iniciales: Retention 40%, Utilization 25%, Satisfaction 20%, Engagement 15%')
ON CONFLICT DO NOTHING;

-- RLS: admin y owner pueden leer + escribir
ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoring_config_admin_rw" ON scoring_config
  FOR ALL USING (auth.jwt() ->> 'rol' IN ('admin', 'owner'))
  WITH CHECK (auth.jwt() ->> 'rol' IN ('admin', 'owner'));

CREATE POLICY "scoring_config_anon_read" ON scoring_config
  FOR SELECT USING (active = true);
