-- ===================================================================
-- coach_metrics_daily — Snapshot diario de métricas por coach
--
-- Tabla inmutable: cada día genera un registro (coach_id, date) con:
--   - Conteos (clientes, sesiones, informes)
--   - Porcentajes (retention%, utilization%, satisfaction%, engagement%)
--   - Health Score agregado
--
-- Usada por: benchmarks, trends, alertas, queries en tiempo real.
-- Guardada por: Edge Function `coach-metrics-daily` diaria 02:00/04:00/05:00/06:00/07:00 UTC.
--
-- Aplicar una vez en Supabase Studio → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS coach_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Conteos
  client_count_current INT, -- Clientes activos hoy
  sesiones_ultima_semana INT, -- Sesiones en últimos 7 días
  informes_ultima_semana INT, -- Informes en últimos 7 días
  mensajes_ultima_semana INT, -- Mensajes/chats en últimos 7 días

  -- Porcentajes (0-100)
  retention_pct DECIMAL, -- % de clientes que se mantienen de los últimos 90 días
  utilization_pct DECIMAL, -- % de capacidad utilizada
  satisfaction_pct DECIMAL, -- Proxy o NPS promedio
  engagement_pct DECIMAL, -- Engagement score (0-100)

  -- Agregados
  health_score INT, -- (retention × 0.4) + (utilization × 0.25) + (satisfaction × 0.20) + (engagement × 0.15)
  churn_rate_7d_pct DECIMAL, -- % de clientes perdidos en últimos 7 días

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE(coach_id, date),
  CONSTRAINT valid_percentages CHECK (
    retention_pct >= 0 AND retention_pct <= 100 AND
    utilization_pct >= 0 AND utilization_pct <= 100 AND
    satisfaction_pct >= 0 AND satisfaction_pct <= 100 AND
    engagement_pct >= 0 AND engagement_pct <= 100 AND
    health_score >= 0 AND health_score <= 100
  )
);

-- Índices para queries comunes
CREATE INDEX IF NOT EXISTS idx_coach_metrics_daily_coach_date ON coach_metrics_daily(coach_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_coach_metrics_daily_date ON coach_metrics_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_coach_metrics_daily_health_score ON coach_metrics_daily(health_score DESC);

-- RLS: coaches ven sus propios datos, admin/owner ven todo
ALTER TABLE coach_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metrics_coach_read" ON coach_metrics_daily
  FOR SELECT USING (
    coach_id = auth.uid()
    OR auth.jwt() ->> 'rol' IN ('admin', 'owner')
  );

CREATE POLICY "metrics_admin_all" ON coach_metrics_daily
  FOR ALL USING (auth.jwt() ->> 'rol' IN ('admin', 'owner'))
  WITH CHECK (auth.jwt() ->> 'rol' IN ('admin', 'owner'));
