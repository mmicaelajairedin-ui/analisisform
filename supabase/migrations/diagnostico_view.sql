-- Diagnostico View for Dashboard Phase 2C
-- Aggregates coach inactivity and client session inactivity alerts
-- Used by dashboard Edge Function to generate alerts

DROP VIEW IF EXISTS diagnostico_view CASCADE;

CREATE VIEW diagnostico_view AS
WITH coach_activity AS (
  SELECT
    org_id,
    CAST(id AS TEXT) AS entity_id,
    nombre AS entity_name,
    'coach_inactivo' AS tipo,
    EXTRACT(EPOCH FROM (NOW() - last_seen)) / 3600 AS days_since_issue
  FROM usuarios
  WHERE activo = true
    AND rol = 'coach'
    AND last_seen IS NOT NULL
    AND (NOW() - last_seen) > INTERVAL '24 hours'
),
client_sessions AS (
  SELECT
    c.org_id,
    CAST(c.id AS TEXT) AS entity_id,
    c.nombre AS entity_name,
    'cliente_sin_actividad' AS tipo,
    COALESCE(
      EXTRACT(EPOCH FROM (NOW() - c.cliente_last_seen)) / 86400,
      EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 86400
    ) AS days_since_issue
  FROM candidatos c
  WHERE c.activo = true
    AND (
      c.cliente_last_seen IS NULL
      OR (NOW() - c.cliente_last_seen) > INTERVAL '7 days'
    )
)
SELECT
  org_id,
  entity_id,
  entity_name,
  tipo,
  days_since_issue,
  CASE
    WHEN tipo = 'coach_inactivo' THEN 3
    ELSE 5
  END AS impact_score,
  LEAST(10, CEIL(days_since_issue * 0.4)) AS urgency_score,
  CASE
    WHEN tipo = 'coach_inactivo' THEN 3
    ELSE 5
  END + LEAST(10, CEIL(days_since_issue * 0.4)) AS combined_score
FROM (
  SELECT org_id, entity_id, entity_name, tipo, days_since_issue FROM coach_activity
  UNION ALL
  SELECT org_id, entity_id, entity_name, tipo, days_since_issue FROM client_sessions
) alerts
ORDER BY combined_score DESC, days_since_issue DESC;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_diagnostico_view_org ON usuarios(org_id) WHERE activo = true AND rol = 'coach';
CREATE INDEX IF NOT EXISTS idx_diagnostico_view_clients ON candidatos(org_id) WHERE activo = true;
