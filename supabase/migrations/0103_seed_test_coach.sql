-- ===================================================================
-- Seed test coach for Phase 1 validation
-- Inserta un coach de prueba para validar la integración end-to-end
-- ===================================================================

-- UUID fijo para el coach de prueba (usable en las pruebas)
WITH coach_data AS (
  SELECT
    '550e8400-e29b-41d4-a716-446655440000'::uuid as id,
    'test-coach@example.com' as email,
    'Test Coach' as nombre,
    'test-coach' as slug,
    'Business Coach' as titulo_profesional,
    'Especializado en transformación de equipos' as tagline,
    'Ayudo a equipos de alto rendimiento a alcanzar sus objetivos' as bio,
    true as activo,
    'coach' as rol,
    NOW() as created_at,
    NOW() as updated_at
)
INSERT INTO usuarios (
  id, email, nombre, slug, titulo_profesional, tagline, bio,
  activo, rol, created_at, updated_at
)
SELECT * FROM coach_data
ON CONFLICT (id) DO NOTHING;

-- Insertar 3 candidatos activos asociados al coach de prueba
WITH candidatos_data AS (
  SELECT
    gen_random_uuid() as id,
    '550e8400-e29b-41d4-a716-446655440000'::uuid as coach_id,
    'candidato1@example.com' as email,
    'Candidato Prueba 1' as nombre,
    'active' as estado,
    NOW()::date - INTERVAL '10 days' as fecha_inicio,
    5 as sesiones_completadas,
    true as pago_confirmado,
    NOW() as created_at
  UNION ALL
  SELECT
    gen_random_uuid(),
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    'candidato2@example.com',
    'Candidato Prueba 2',
    'active',
    NOW()::date - INTERVAL '7 days',
    3,
    true,
    NOW()
  UNION ALL
  SELECT
    gen_random_uuid(),
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    'candidato3@example.com',
    'Candidato Prueba 3',
    'completed',
    NOW()::date - INTERVAL '25 days',
    8,
    true,
    NOW()
)
INSERT INTO candidatos (
  id, coach_id, email, nombre, estado, fecha_inicio, sesiones_completadas,
  pago_confirmado, created_at
)
SELECT * FROM candidatos_data
ON CONFLICT (id) DO NOTHING;

-- Insertar registros de sesiones para el coach
WITH sesiones_data AS (
  SELECT
    gen_random_uuid() as id,
    '550e8400-e29b-41d4-a716-446655440000'::uuid as coach_id,
    (SELECT id FROM candidatos WHERE coach_id = '550e8400-e29b-41d4-a716-446655440000'::uuid LIMIT 1) as candidato_id,
    'Sesión 1: Diagnostico' as titulo,
    'Conversación inicial' as notas,
    NOW()::date - INTERVAL '5 days' as fecha,
    45 as duracion_minutos,
    NOW() as created_at
  UNION ALL
  SELECT
    gen_random_uuid(),
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    (SELECT id FROM candidatos WHERE coach_id = '550e8400-e29b-41d4-a716-446655440000'::uuid ORDER BY created_at DESC LIMIT 1 OFFSET 1),
    'Sesión 2: Estrategia',
    'Plan de acción 2024',
    NOW()::date - INTERVAL '3 days',
    60,
    NOW()
  UNION ALL
  SELECT
    gen_random_uuid(),
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    (SELECT id FROM candidatos WHERE coach_id = '550e8400-e29b-41d4-a716-446655440000'::uuid LIMIT 1),
    'Sesión 3: Seguimiento',
    'Revisión de progreso',
    NOW()::date - INTERVAL '1 day',
    30,
    NOW()
)
INSERT INTO sesiones_registro (
  id, coach_id, candidato_id, titulo, notas, fecha, duracion_minutos, created_at
)
SELECT * FROM sesiones_data
ON CONFLICT (id) DO NOTHING;

-- Insertar una métrica diaria para hoy
INSERT INTO coach_metrics_daily (
  id, coach_id, date, health_score, retention_pct, utilization_pct,
  satisfaction_pct, engagement_pct, client_count_current,
  sesiones_ultima_semana, informes_ultima_semana, churn_rate_7d_pct,
  forecast_health_30d, created_at
)
VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  NOW()::date,
  75,  -- health_score: Bueno (verde)
  92,  -- retention_pct: Muy buena retención
  78,  -- utilization_pct: Buen uso
  85,  -- satisfaction_pct: Satisfacción alta
  80,  -- engagement_pct: Buen engagement
  3,   -- client_count_current: 3 clientes activos
  3,   -- sesiones_ultima_semana: 3 sesiones esta semana
  0,   -- informes_ultima_semana: sin informes esta semana
  5.0, -- churn_rate_7d_pct: 5% de churn
  78,  -- forecast_health_30d: proyección en 30 días
  NOW()
)
ON CONFLICT (coach_id, date) DO NOTHING;

-- Insertar alertas para el coach
INSERT INTO coach_alerts (
  id, coach_id, alert_type, severity, triggered_at, context, recommended_action
)
VALUES
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000'::uuid, 'engagement_declining', 'warning', NOW() - INTERVAL '1 day', '{"current": 80, "previous": 85}'::jsonb, 'Considera aumentar la frecuencia de sesiones'),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000'::uuid, 'capacity_warning', 'info', NOW() - INTERVAL '2 hours', '{"current_clients": 3, "capacity": 10}'::jsonb, 'Tienes capacidad para más clientes')
ON CONFLICT (id) DO NOTHING;

-- Insertar un benchmark para hoy
INSERT INTO coach_benchmarks (
  id, coach_id, date, health_score, retention_pct, utilization_pct,
  satisfaction_pct, engagement_pct, percentile_health, percentile_retention,
  percentile_utilization, percentile_satisfaction, percentile_engagement,
  rank_overall, total_coaches, team_median_health, team_median_retention,
  team_median_utilization, team_median_satisfaction, team_median_engagement,
  created_at
)
VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  NOW()::date,
  75, 92, 78, 85, 80,  -- métricas del coach
  75, 88, 70, 80, 75,  -- percentiles (posición vs otros coaches)
  5, 20,  -- rank: 5 de 20 coaches
  70, 85, 65, 75, 70,  -- team medians
  NOW()
)
ON CONFLICT (coach_id, date) DO NOTHING;

-- Insertar trends para hoy
INSERT INTO coach_trends (
  id, coach_id, date, health_score_7d_change, health_score_30d_change,
  health_score_90d_change, health_score_7d_velocity, health_score_forecast_30d,
  retention_7d_change, utilization_7d_change, created_at
)
VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  NOW()::date,
  5.0, 8.0, 12.0,  -- cambios en últimos 7, 30, 90 días
  2.5,  -- velocidad diaria de cambio
  80,   -- proyección en 30 días
  3.0, -2.0,  -- cambios en retention y utilization
  NOW()
)
ON CONFLICT (coach_id, date) DO NOTHING;

-- Nota: estas inserciones son idempotentes (ON CONFLICT DO NOTHING)
-- Puedes re-ejecutar este script sin problemas
