-- ============================================================
-- Reparación: Asignar informe y CV de demo al coach demo
-- ============================================================
-- Ejecutar UNA VEZ en Supabase SQL Editor.
-- Necesario porque el demo-cliente.sql original no incluía
-- coach_id en los INSERT de informes y cv_publicados.
--
-- Resultado esperado: María y Carlos solo visibles al
-- coach demo (demo.coach@pathway.com), no a Micaela (admin).
-- ============================================================

-- Ver estado actual antes de reparar:
SELECT 'informes' AS tabla, email, coach_id
FROM informes
WHERE email IN ('maria.demo@pathway.com', 'carlos.demo@pathway.com')
UNION ALL
SELECT 'cv_publicados', email, coach_id::text
FROM cv_publicados
WHERE email IN ('maria.demo@pathway.com', 'carlos.demo@pathway.com')
UNION ALL
SELECT 'candidatos', email, coach_id::text
FROM candidatos
WHERE email IN ('maria.demo@pathway.com', 'carlos.demo@pathway.com');

-- Reparar informes sin coach_id del demo:
UPDATE informes
SET coach_id = (SELECT id FROM usuarios WHERE email = 'demo.coach@pathway.com' LIMIT 1)
WHERE email IN ('maria.demo@pathway.com', 'carlos.demo@pathway.com')
  AND coach_id IS NULL;

-- Reparar cv_publicados sin coach_id del demo:
UPDATE cv_publicados
SET coach_id = (SELECT id FROM usuarios WHERE email = 'demo.coach@pathway.com' LIMIT 1)
WHERE email IN ('maria.demo@pathway.com', 'carlos.demo@pathway.com')
  AND coach_id IS NULL;

-- Verificar que quedó bien (debe mostrar coach_id NOT NULL en todas):
SELECT 'informes' AS tabla, email,
       CASE WHEN coach_id IS NULL THEN 'HUERFANO ✗' ELSE 'OK ✓' END AS estado
FROM informes
WHERE email IN ('maria.demo@pathway.com', 'carlos.demo@pathway.com')
UNION ALL
SELECT 'cv_publicados', email,
       CASE WHEN coach_id IS NULL THEN 'HUERFANO ✗' ELSE 'OK ✓' END
FROM cv_publicados
WHERE email IN ('maria.demo@pathway.com', 'carlos.demo@pathway.com')
UNION ALL
SELECT 'candidatos', email,
       CASE WHEN coach_id IS NULL THEN 'HUERFANO ✗' ELSE 'OK ✓' END
FROM candidatos
WHERE email IN ('maria.demo@pathway.com', 'carlos.demo@pathway.com');
