-- ===================================================================
-- coach_benchmarks — Percentiles y rankings diarios
--
-- Para cada coach, percentil vs equipo en cada métrica.
-- Ej: Coach A retención 88% es 77th percentile = mejor que 77% del equipo.
--
-- Guardada por: Edge Function `coach-benchmarks-daily` diaria 05:30 UTC.
--
-- Aplicar una vez en Supabase Studio → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS coach_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Raw metrics (copiados de coach_metrics_daily para referencia)
  health_score INT,
  retention_pct DECIMAL,
  utilization_pct DECIMAL,
  satisfaction_pct DECIMAL,
  engagement_pct DECIMAL,

  -- Percentile ranks (0-100: qué % del equipo está debajo)
  percentile_health INT,
  percentile_retention INT,
  percentile_utilization INT,
  percentile_satisfaction INT,
  percentile_engagement INT,

  -- Team aggregates (mismas para todos en la misma date)
  team_median_health INT,
  team_median_retention DECIMAL,
  team_median_utilization DECIMAL,
  team_median_satisfaction DECIMAL,
  team_median_engagement DECIMAL,

  -- Ranking
  rank_overall INT, -- 1 = top, N = lowest
  total_coaches INT, -- Cuántos coaches había ese día

  created_at TIMESTAMP DEFAULT now(),

  UNIQUE(coach_id, date)
);

CREATE INDEX IF NOT EXISTS idx_coach_benchmarks_coach_date ON coach_benchmarks(coach_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_coach_benchmarks_rank ON coach_benchmarks(date DESC, rank_overall ASC);

-- ===================================================================
-- coach_trends — Tendencias y forecasts
--
-- Para cada métrica: cambios 7d/30d/90d, velocidad, proyección 30d.
-- Una row = (coach_id, metric_name, date).
--
-- Guardada por: Edge Function `coach-trends-daily` diaria 07:00 UTC.
-- ===================================================================

CREATE TABLE IF NOT EXISTS coach_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL, -- 'health_score', 'retention_pct', 'engagement_pct', etc.
  date DATE NOT NULL,

  -- Valores puntuales en el tiempo
  value_current DECIMAL,
  value_7d_ago DECIMAL,
  value_30d_ago DECIMAL,
  value_90d_ago DECIMAL,

  -- Cambios
  change_7d DECIMAL, -- value_current - value_7d_ago
  change_7d_pct DECIMAL, -- ((value_current / value_7d_ago) - 1) × 100
  change_30d_pct DECIMAL,
  change_90d_pct DECIMAL,

  -- Señales
  direction_7d TEXT, -- 'up', 'down', 'flat'
  velocity DECIMAL, -- (change_7d) / 7 = cambio diario promedio
  forecast_30d DECIMAL, -- value_current + (velocity × 30)

  created_at TIMESTAMP DEFAULT now(),

  UNIQUE(coach_id, metric_name, date)
);

CREATE INDEX IF NOT EXISTS idx_coach_trends_coach_metric_date ON coach_trends(coach_id, metric_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_coach_trends_direction ON coach_trends(date DESC, direction_7d);

-- RLS
ALTER TABLE coach_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "benchmarks_coach_read" ON coach_benchmarks
  FOR SELECT USING (
    coach_id = auth.uid()
    OR auth.jwt() ->> 'rol' IN ('admin', 'owner')
  );

CREATE POLICY "benchmarks_admin_all" ON coach_benchmarks
  FOR ALL USING (auth.jwt() ->> 'rol' IN ('admin', 'owner'))
  WITH CHECK (auth.jwt() ->> 'rol' IN ('admin', 'owner'));

CREATE POLICY "trends_coach_read" ON coach_trends
  FOR SELECT USING (
    coach_id = auth.uid()
    OR auth.jwt() ->> 'rol' IN ('admin', 'owner')
  );

CREATE POLICY "trends_admin_all" ON coach_trends
  FOR ALL USING (auth.jwt() ->> 'rol' IN ('admin', 'owner'))
  WITH CHECK (auth.jwt() ->> 'rol' IN ('admin', 'owner'));
