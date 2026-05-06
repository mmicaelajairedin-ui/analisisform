-- ============================================================
-- Migración: Reasignar huérfanos al coach principal (Micaela)
-- ============================================================
-- Ejecutar SOLO UNA VEZ. Asigna registros con coach_id IS NULL
-- a Micaela (admin). Los del demo ya tienen coach_id correcto
-- si se corrió reparar-demo-coach.sql antes.
--
-- ANTES DE CORRER: reemplazar EMAIL-DE-MICAELA con el email real.
-- Usa la tabla `usuarios` (NO `coaches` — no existe en esta app).
-- ============================================================

-- PASO 0: Ver cuántos huérfanos hay por tabla
SELECT
  'candidatos' AS tabla,
  COUNT(*) FILTER (WHERE coach_id IS NOT NULL) AS con_coach,
  COUNT(*) FILTER (WHERE coach_id IS NULL)     AS sin_coach
FROM candidatos
UNION ALL
SELECT 'informes',
  COUNT(*) FILTER (WHERE coach_id IS NOT NULL),
  COUNT(*) FILTER (WHERE coach_id IS NULL)
FROM informes
UNION ALL
SELECT 'cv_publicados',
  COUNT(*) FILTER (WHERE coach_id IS NOT NULL),
  COUNT(*) FILTER (WHERE coach_id IS NULL)
FROM cv_publicados;

-- PASO 1: Reasignar candidatos huérfanos a Micaela
-- REEMPLAZAR 'EMAIL-DE-MICAELA' con el email real (ej: micaela@pathway.com)
UPDATE candidatos
SET coach_id = (SELECT id FROM usuarios WHERE email = 'EMAIL-DE-MICAELA' LIMIT 1)
WHERE coach_id IS NULL;

-- PASO 2: Reasignar informes huérfanos — primero por matching con candidatos
UPDATE informes i
SET coach_id = c.coach_id
FROM candidatos c
WHERE i.email = c.email
  AND i.coach_id IS NULL
  AND c.coach_id IS NOT NULL;

-- Luego los restantes (sin match de email) van a Micaela
UPDATE informes
SET coach_id = (SELECT id FROM usuarios WHERE email = 'EMAIL-DE-MICAELA' LIMIT 1)
WHERE coach_id IS NULL;

-- PASO 3: Reasignar cv_publicados huérfanos — igual que informes
UPDATE cv_publicados cv
SET coach_id = c.coach_id
FROM candidatos c
WHERE cv.email = c.email
  AND cv.coach_id IS NULL
  AND c.coach_id IS NOT NULL;

UPDATE cv_publicados
SET coach_id = (SELECT id FROM usuarios WHERE email = 'EMAIL-DE-MICAELA' LIMIT 1)
WHERE coach_id IS NULL;

-- PASO 4: Verificación final — debe mostrar 0 en sin_coach
SELECT
  'candidatos' AS tabla,
  COUNT(*) FILTER (WHERE coach_id IS NOT NULL) AS con_coach,
  COUNT(*) FILTER (WHERE coach_id IS NULL)     AS sin_coach
FROM candidatos
UNION ALL
SELECT 'informes',
  COUNT(*) FILTER (WHERE coach_id IS NOT NULL),
  COUNT(*) FILTER (WHERE coach_id IS NULL)
FROM informes
UNION ALL
SELECT 'cv_publicados',
  COUNT(*) FILTER (WHERE coach_id IS NOT NULL),
  COUNT(*) FILTER (WHERE coach_id IS NULL)
FROM cv_publicados;
