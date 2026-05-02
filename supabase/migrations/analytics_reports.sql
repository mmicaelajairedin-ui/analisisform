-- Tabla analytics_reports: histórico de reportes semanales generados por
-- la edge function analytics-weekly. Permite que el agente compare semana
-- contra semana y detecte tendencias / si las hipótesis previas se cumplieron.

CREATE TABLE IF NOT EXISTS analytics_reports (
  id              SERIAL PRIMARY KEY,
  generated_at    TIMESTAMPTZ DEFAULT now(),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  zone            TEXT NOT NULL,        -- 'micaelajairedin.com' | 'pathwaycareercoach.com'
  raw_metrics     JSONB,                -- payload crudo de Cloudflare GraphQL
  analysis        JSONB,                -- output estructurado de Claude (resumen, hipótesis, acciones)
  email_sent_to   TEXT,
  email_status    TEXT                  -- 'ok' | 'error: <msg>'
);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_zone_period
  ON analytics_reports (zone, period_end DESC);

ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;

-- Sólo service_role puede leer/escribir. La edge function usa service_role.
-- No exponer al anon: contiene métricas internas del negocio.
DROP POLICY IF EXISTS "service_role full access analytics_reports" ON analytics_reports;
CREATE POLICY "service_role full access analytics_reports"
  ON analytics_reports
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
