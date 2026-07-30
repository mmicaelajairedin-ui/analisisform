-- ===================================================================
-- coach_alerts — Alertas operacionales generadas automáticamente
--
-- Basadas en thresholds + coach_metrics_daily. Se crean cuando se
-- dispara una condición, se cierran cuando se invierte.
--
-- Guardada por: Edge Function `coach-alerts-hourly` cada hora.
--
-- Aplicar una vez en Supabase Studio → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS coach_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'burnout', 'overload', 'churn_high', etc.
  severity TEXT DEFAULT 'warning', -- 'critical', 'warning', 'info'

  -- Ciclo de vida
  triggered_at TIMESTAMP DEFAULT now(), -- Cuándo se disparó
  resolved_at TIMESTAMP, -- NULL = abierta, timestamp = cerrada

  -- Contexto + acción
  context JSONB, -- { engagement_score: 28, threshold: 30, last_login_days: 8, ... }
  recommended_action TEXT, -- Interpolada del template (con variables reemplazadas)

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_coach_alerts_coach_severity ON coach_alerts(coach_id, severity, resolved_at);
CREATE INDEX IF NOT EXISTS idx_coach_alerts_triggered ON coach_alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_alerts_open ON coach_alerts(resolved_at IS NULL, triggered_at DESC);

-- RLS: coaches ven sus alertas, admin/owner ven todo
ALTER TABLE coach_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_coach_read" ON coach_alerts
  FOR SELECT USING (
    coach_id = auth.uid()
    OR auth.jwt() ->> 'rol' IN ('admin', 'owner')
  );

CREATE POLICY "alerts_admin_all" ON coach_alerts
  FOR ALL USING (auth.jwt() ->> 'rol' IN ('admin', 'owner'))
  WITH CHECK (auth.jwt() ->> 'rol' IN ('admin', 'owner'));
