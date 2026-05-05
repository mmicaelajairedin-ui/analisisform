-- ============================================================
-- Migración: Separar datos por coach (reasignación de huérfanos)
-- ============================================================
-- Ejecutar SOLO UNA VEZ después de que el schema-marketplace.sql
-- esté aplicado y exista al menos un coach en la tabla `coaches`.
--
-- PASO 0: Verificar coaches existentes
-- ============================================================
SELECT id, email, nombre, plan, estado
FROM coaches
ORDER BY created_at;

-- ============================================================
-- PASO 1: Reasignar candidatos huérfanos (coach_id IS NULL)
-- ============================================================
-- Ver cuántos hay:
SELECT COUNT(*) AS huerfanos
FROM candidatos
WHERE coach_id IS NULL;

-- Asignar al coach principal (Micaela):
-- REEMPLAZAR 'EMAIL-DE-MICAELA' con el email real
UPDATE candidatos
SET coach_id = (SELECT id FROM coaches WHERE email = 'EMAIL-DE-MICAELA' LIMIT 1)
WHERE coach_id IS NULL;

-- Verificar que no quedan huérfanos:
SELECT COUNT(*) AS huerfanos_restantes
FROM candidatos
WHERE coach_id IS NULL;

-- ============================================================
-- PASO 2: Reasignar informes huérfanos (coach_id IS NULL)
-- ============================================================
-- Ver cuántos hay:
SELECT COUNT(*) AS huerfanos
FROM informes
WHERE coach_id IS NULL;

-- Asignar por matching de email con candidatos:
UPDATE informes i
SET coach_id = c.coach_id
FROM candidatos c
WHERE (i.email = c.email OR i.candidato_id = c.id)
  AND i.coach_id IS NULL
  AND c.coach_id IS NOT NULL;

-- Asignar los restantes (sin match) al coach principal:
UPDATE informes
SET coach_id = (SELECT id FROM coaches WHERE email = 'EMAIL-DE-MICAELA' LIMIT 1)
WHERE coach_id IS NULL;

-- Verificar:
SELECT COUNT(*) AS huerfanos_restantes FROM informes WHERE coach_id IS NULL;

-- ============================================================
-- PASO 3: Reasignar cv_publicados huérfanos (coach_id IS NULL)
-- ============================================================
SELECT COUNT(*) AS huerfanos FROM cv_publicados WHERE coach_id IS NULL;

-- Asignar por matching de email con candidatos:
UPDATE cv_publicados cv
SET coach_id = c.coach_id
FROM candidatos c
WHERE (cv.email = c.email OR cv.candidato_id = c.id)
  AND cv.coach_id IS NULL
  AND c.coach_id IS NOT NULL;

-- Asignar restantes al coach principal:
UPDATE cv_publicados
SET coach_id = (SELECT id FROM coaches WHERE email = 'EMAIL-DE-MICAELA' LIMIT 1)
WHERE coach_id IS NULL;

SELECT COUNT(*) AS huerfanos_restantes FROM cv_publicados WHERE coach_id IS NULL;

-- ============================================================
-- PASO 4: Verificación final
-- ============================================================
SELECT
  'candidatos' AS tabla,
  COUNT(*) FILTER (WHERE coach_id IS NOT NULL) AS con_coach,
  COUNT(*) FILTER (WHERE coach_id IS NULL) AS sin_coach
FROM candidatos
UNION ALL
SELECT
  'informes',
  COUNT(*) FILTER (WHERE coach_id IS NOT NULL),
  COUNT(*) FILTER (WHERE coach_id IS NULL)
FROM informes
UNION ALL
SELECT
  'cv_publicados',
  COUNT(*) FILTER (WHERE coach_id IS NOT NULL),
  COUNT(*) FILTER (WHERE coach_id IS NULL)
FROM cv_publicados;

-- ============================================================
-- PASO 5 (OPCIONAL): Activar RLS para máxima seguridad
-- ============================================================
-- Si se quiere añadir Row Level Security a nivel de BD
-- (actualmente la seguridad se maneja en el cliente JS):

-- ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY coach_own_candidatos ON candidatos
--   USING (coach_id = auth.uid()::uuid);

-- ALTER TABLE informes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY coach_own_informes ON informes
--   USING (coach_id = auth.uid()::uuid);

-- ALTER TABLE cv_publicados ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY coach_own_cvs ON cv_publicados
--   USING (coach_id = auth.uid()::uuid);
