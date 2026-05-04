-- Fix: evitar reportes duplicados de la misma semana en analytics_reports
--
-- Cuando se dispara el workflow analytics-weekly multiple veces dentro
-- de la misma semana (ej: testing manual + cron del lunes), se crean
-- reportes duplicados con datos casi identicos. El agente despues los
-- lee como "histórico" y piensa que la misma semana se repitio.
--
-- Fix: unique constraint en (zone, period_end) + upsert en edge function.
-- Si ya existe un reporte para esa semana/zona, lo actualiza en vez de
-- crear uno nuevo.

-- 1. Limpiar duplicados existentes manteniendo solo el mas reciente por (zone, period_end)
DELETE FROM analytics_reports a
USING analytics_reports b
WHERE a.zone = b.zone
  AND a.period_end = b.period_end
  AND a.id < b.id;

-- 2. Agregar unique constraint
ALTER TABLE analytics_reports
  ADD CONSTRAINT analytics_reports_zone_period_end_unique
  UNIQUE (zone, period_end);
