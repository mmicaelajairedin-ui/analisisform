-- ===================================================================
-- coach_alert_thresholds — Reglas versionadas para alertas operacionales
--
-- Define qué condiciones disparan alertas y qué acción recomendar.
-- Ejemplo: Si engagement < 30% AND last_login > 7d → alerta crítica "burnout"
--
-- Cada umbral es versionado, permite A/B testing y iteración.
--
-- Aplicar una vez en Supabase Studio → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS coach_alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL,
  alert_type TEXT NOT NULL, -- 'burnout', 'overload', 'underutilized', 'churn_high', etc.

  -- Condición principal
  threshold_value DECIMAL NOT NULL, -- Valor a comparar (e.g., 30 para engagement < 30)
  threshold_operator TEXT NOT NULL, -- '<', '>', '=', '<=', '>=', '<>'
  threshold_unit TEXT, -- '%', 'points', 'days', etc. (informativo)

  -- Condición secundaria (AND lógica)
  secondary_condition TEXT, -- NULL o ej. "last_login > 7d", "trend_7d < -10%"

  -- Severidad y acción
  severity TEXT DEFAULT 'warning', -- 'critical', 'warning', 'info'
  recommended_action_template TEXT, -- Template con {variables} para interpolar

  -- Scope
  applies_to_role TEXT, -- NULL = todos
  applies_to_coach_ids UUID[], -- NULL = todos

  -- Estado
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  notes TEXT,

  UNIQUE(version, alert_type, applies_to_role, applies_to_coach_ids)
);

-- Seed: alertas base
INSERT INTO coach_alert_thresholds (version, alert_type, threshold_value, threshold_operator, threshold_unit, secondary_condition, severity, recommended_action_template, active, notes)
VALUES
  (1, 'burnout', 30, '<', 'points', 'last_login > 7d', 'critical',
   'Posible burnout. Engagement {engagement_score}%, sin login hace {last_login_days}d. Contactá al coach para chequeo.',
   true, 'Coach disengaged — burnout risk'),

  (1, 'overload', 100, '>=', '%', NULL, 'critical',
   'Coach saturado: {utilization_pct}% de capacidad. No puede tomar nuevos clientes. Discutí la carga laboral.',
   true, 'Coach at max capacity'),

  (1, 'underutilized', 40, '<', '%', 'client_count > 0', 'info',
   'Coach poco utilizado ({utilization_pct}%). Disponible para nuevas asignaciones.',
   true, 'Opportunity to assign more clients'),

  (1, 'churn_high', 30, '>', '%', NULL, 'critical',
   'Churn alto ({churn_rate_7d}% esta semana). Investigá calidad, fit del coach, satisfacción del cliente.',
   true, 'High churn rate — quality issue?'),

  (1, 'capacity_warning', 80, '>=', '%', NULL, 'warning',
   'Coach acercándose a capacidad: {utilization_pct}%. Planificá distribución de carga.',
   true, 'Approaching overload — plan ahead'),

  (1, 'engagement_declining', 60, '<', 'points', 'trend_7d_pct < -10', 'warning',
   'Engagement en declive ({engagement_score}%, -{trend_7d_pct}% esta semana). Chequea estrés, carga laboral.',
   true, 'Engagement declining rapidly'),

  (1, 'retention_declining', 70, '<', '%', 'trend_7d_pct < -5', 'warning',
   'Retención bajando ({retention_pct}%, -{trend_7d_pct}% esta semana). Revisá calidad del coaching, fit con clientes.',
   true, 'Retention trending down')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE coach_alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thresholds_admin_rw" ON coach_alert_thresholds
  FOR ALL USING (auth.jwt() ->> 'rol' IN ('admin', 'owner'))
  WITH CHECK (auth.jwt() ->> 'rol' IN ('admin', 'owner'));

CREATE POLICY "thresholds_anon_read" ON coach_alert_thresholds
  FOR SELECT USING (active = true);
