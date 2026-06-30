-- ===================================================================
-- REPARACIÓN: clientes que el coach agregó pero NO aparecieron.
--
-- Causa: el alta inline ("Sumar un cliente") creaba el candidato con
-- resolution=merge-duplicates → bajo RLS estricto eso es un upsert que pedía
-- policy de UPDATE para anon → 403. Se creaba la cuenta de login (usuarios,
-- rol=cliente) pero NO la fila `candidatos` (la que tiene el coach_id y la que
-- el panel lista). Resultado: cuentas "huérfanas" sin link a ningún coach.
--
-- Ya está arreglado en el panel (ahora usa ignore-duplicates). Este script
-- RECUPERA los que se perdieron antes del fix.
--
-- Cómo se reasigna el coach: el alta creaba la cuenta (usuarios.created_at) y a
-- la vez intentaba el POST a candidatos que fallaba; ese 403 quedó registrado
-- en client_errors con el EMAIL DEL COACH y su timestamp. Matcheamos cada
-- cuenta huérfana con el coach cuyo error de candidatos está más cerca (≤60s).
--
-- CORRER POR PARTES en Supabase Studio → SQL Editor. Revisar los SELECT de
-- diagnóstico ANTES de correr el INSERT.
-- ===================================================================

-- ── PASO 1 (diagnóstico, solo lectura): cuentas de cliente sin ficha ─────────
SELECT u.email, u.nombre, u.created_at,
       coalesce(u.configuracion->>'coach_type','carrera') AS nicho
FROM usuarios u
WHERE u.rol = 'cliente'
  AND NOT EXISTS (SELECT 1 FROM candidatos c WHERE lower(c.email) = lower(u.email))
ORDER BY u.created_at DESC;

-- ── PASO 2 (diagnóstico, solo lectura): coaches que pegaron el 403 al crear ──
SELECT email AS coach_email, count(*) AS intentos, min(ts) AS primero, max(ts) AS ultimo
FROM client_errors
WHERE detail ILIKE '%candidatos%' AND kind LIKE 'http_4%'
GROUP BY email
ORDER BY max(ts) DESC;

-- ── PASO 3 (preview, solo lectura): cómo quedaría la reasignación ────────────
-- Revisá que cada cliente quede bajo el coach correcto antes del PASO 4.
WITH orphans AS (
  SELECT u.email, u.nombre, u.created_at,
         coalesce(u.configuracion->>'coach_type','carrera') AS nicho
  FROM usuarios u
  WHERE u.rol = 'cliente'
    AND NOT EXISTS (SELECT 1 FROM candidatos c WHERE lower(c.email) = lower(u.email))
),
fails AS (
  SELECT ce.ts,
         (SELECT cu.id FROM usuarios cu
           WHERE lower(cu.email) = lower(ce.email) AND cu.rol IN ('coach','admin')
           LIMIT 1) AS coach_id,
         ce.email AS coach_email
  FROM client_errors ce
  WHERE ce.detail ILIKE '%candidatos%' AND ce.kind LIKE 'http_4%'
),
matched AS (
  SELECT o.email, o.nombre, o.nicho, o.created_at,
         f.coach_id, f.coach_email,
         abs(extract(epoch FROM (f.ts - o.created_at))) AS dt_seg,
         row_number() OVER (
           PARTITION BY o.email
           ORDER BY abs(extract(epoch FROM (f.ts - o.created_at)))
         ) AS rn
  FROM orphans o
  JOIN fails f ON f.coach_id IS NOT NULL
              AND abs(extract(epoch FROM (f.ts - o.created_at))) < 60
)
SELECT email AS cliente_email, nombre AS cliente, coach_email, round(dt_seg) AS seg_de_diff, nicho
FROM matched
WHERE rn = 1
ORDER BY coach_email, cliente_email;

-- ── PASO 4 (ESCRITURA): recrear las fichas candidatos con su coach ──────────
-- Solo después de revisar el PASO 3. Crea la ficha activa, semana 1.
WITH orphans AS (
  SELECT u.email, u.nombre, u.created_at,
         coalesce(u.configuracion->>'coach_type','carrera') AS nicho
  FROM usuarios u
  WHERE u.rol = 'cliente'
    AND NOT EXISTS (SELECT 1 FROM candidatos c WHERE lower(c.email) = lower(u.email))
),
fails AS (
  SELECT ce.ts,
         (SELECT cu.id FROM usuarios cu
           WHERE lower(cu.email) = lower(ce.email) AND cu.rol IN ('coach','admin')
           LIMIT 1) AS coach_id
  FROM client_errors ce
  WHERE ce.detail ILIKE '%candidatos%' AND ce.kind LIKE 'http_4%'
),
matched AS (
  SELECT o.email, o.nombre, o.nicho, f.coach_id,
         row_number() OVER (
           PARTITION BY o.email
           ORDER BY abs(extract(epoch FROM (f.ts - o.created_at)))
         ) AS rn
  FROM orphans o
  JOIN fails f ON f.coach_id IS NOT NULL
              AND abs(extract(epoch FROM (f.ts - o.created_at))) < 60
)
INSERT INTO candidatos (nombre, email, coach_id, nicho, semana_activa, activo)
SELECT nombre, email, coach_id, nicho, 1, true
FROM matched
WHERE rn = 1
ON CONFLICT DO NOTHING;

-- ── PASO 5 (verificación): cuántas cuentas siguen sin ficha ─────────────────
-- Las que queden acá no tuvieron match de coach (≤60s) → reasignarlas a mano:
-- el coach las vuelve a agregar desde el panel (ya funciona).
SELECT u.email, u.nombre, u.created_at
FROM usuarios u
WHERE u.rol = 'cliente'
  AND NOT EXISTS (SELECT 1 FROM candidatos c WHERE lower(c.email) = lower(u.email))
ORDER BY u.created_at DESC;
