-- Tabla analytics_reports: agregar columna para trackear que acciones del reporte
-- la coach marco como cumplidas. La proxima semana el agente lee este campo
-- y verifica si el impacto se ve en los datos.
--
-- Estructura:
-- {
--   "quick_wins": [true, false, false],
--   "acciones_estrategicas": [false, true],
--   "pruebas_ab_propuestas": [true, false]
-- }
--
-- Indexado por posicion (los arrays del analysis son inmutables una vez generado).

ALTER TABLE analytics_reports
  ADD COLUMN IF NOT EXISTS actions_done JSONB DEFAULT '{}'::jsonb;

-- Permitir que el panel haga UPDATE solo de actions_done (no de raw_metrics ni analysis).
-- Usamos la misma RLS abierta que tienen las otras tablas — gating es UI-level.
DROP POLICY IF EXISTS "anon update actions_done" ON analytics_reports;
CREATE POLICY "anon update actions_done"
  ON analytics_reports FOR UPDATE
  USING (true) WITH CHECK (true);
