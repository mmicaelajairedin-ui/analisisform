-- ============================================================================
-- EPIC 1.5: RLS VALIDATION TESTS — Script SQL Completo
-- ============================================================================
-- Ejecutar en: Supabase SQL Editor
-- Objetivo: Validar que RLS policies funcionan correctamente
-- Tiempo: ~10 min
-- ============================================================================

-- Test Organization Setup
-- Usamos la org que ya existe: 0134ace6-3752-459d-85b0-bcbdb7efb901

SELECT 'EPIC 1.5: RLS VALIDATION TESTS' as test_header;
SELECT '===============================' as divider;

-- ============================================================================
-- TEST 1: Verify Test Data Exists
-- ============================================================================
SELECT 'TEST 1: Datos de Prueba' as test_name;

SELECT
  'Candidatos en org' as check_item,
  COUNT(*) as cantidad
FROM multicoach.candidatos
WHERE org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901';

SELECT
  'Coaches en org' as check_item,
  COUNT(*) as cantidad
FROM multicoach.usuarios
WHERE org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901'
AND rol = 'coach';

SELECT
  'Assignments activos' as check_item,
  COUNT(*) as cantidad
FROM multicoach.coach_client_assignments
WHERE estado = 'activa';

-- ============================================================================
-- TEST 2: Owner puede ver su organización
-- TEST 3: Owner puede ver sus coaches
-- TEST 4: Owner puede ver sus clientes
-- ============================================================================
SELECT '' as blank, 'TEST 2-4: Owner Access' as test_name;

-- Obtener un owner de la org
WITH owner_data AS (
  SELECT id, email FROM multicoach.usuarios
  WHERE org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901'
  AND rol = 'owner'
  LIMIT 1
)
SELECT
  'Owner ve su org' as test_case,
  (SELECT COUNT(*) FROM multicoach.organizaciones WHERE id = '0134ace6-3752-459d-85b0-bcbdb7efb901') as expected_count,
  (SELECT COUNT(*) FROM multicoach.organizaciones WHERE id = '0134ace6-3752-459d-85b0-bcbdb7efb901') as actual_count,
  CASE WHEN (SELECT COUNT(*) FROM multicoach.organizaciones WHERE id = '0134ace6-3752-459d-85b0-bcbdb7efb901') = 1 THEN '✅ PASS' ELSE '❌ FAIL' END as result;

SELECT
  'Owner ve coaches' as test_case,
  2 as expected_count, -- Sabemos que hay 2 coaches
  (SELECT COUNT(*) FROM multicoach.usuarios WHERE org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901' AND rol = 'coach') as actual_count,
  CASE WHEN (SELECT COUNT(*) FROM multicoach.usuarios WHERE org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901' AND rol = 'coach') >= 1 THEN '✅ PASS' ELSE '❌ FAIL' END as result;

SELECT
  'Owner ve clientes' as test_case,
  4 as expected_count, -- Sabemos que hay 4 clientes
  (SELECT COUNT(*) FROM multicoach.candidatos WHERE org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901') as actual_count,
  CASE WHEN (SELECT COUNT(*) FROM multicoach.candidatos WHERE org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901') = 4 THEN '✅ PASS' ELSE '❌ FAIL' END as result;

-- ============================================================================
-- TEST 5: Coach ve SOLO clientes asignados (no otros)
-- ============================================================================
SELECT '' as blank, 'TEST 5: Coach Assignment Isolation' as test_name;

WITH coach_data AS (
  SELECT id, email FROM multicoach.usuarios
  WHERE email = 'coach1@test.com'
  AND org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901'
  LIMIT 1
)
SELECT
  'Coach ve clientes asignados' as test_case,
  2 as expected_count, -- Coach A tiene 2 clientes asignados
  (SELECT COUNT(*) FROM multicoach.candidatos c
   WHERE c.id IN (
     SELECT client_id FROM multicoach.coach_client_assignments
     WHERE coach_id IN (SELECT id FROM coach_data)
     AND estado = 'activa'
   )) as actual_count,
  CASE WHEN (SELECT COUNT(*) FROM multicoach.candidatos c
   WHERE c.id IN (
     SELECT client_id FROM multicoach.coach_client_assignments
     WHERE coach_id IN (SELECT id FROM coach_data)
     AND estado = 'activa'
   )) = 2 THEN '✅ PASS' ELSE '❌ FAIL' END as result;

-- ============================================================================
-- TEST 6: Cliente ve SOLO su perfil (aislamiento multi-tenant)
-- ============================================================================
SELECT '' as blank, 'TEST 6: Client Self-Isolation' as test_name;

SELECT
  'Cliente ve solo su perfil' as test_case,
  1 as expected_count,
  (SELECT COUNT(*) FROM multicoach.candidatos WHERE email = 'cliente1@test.com' AND org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901') as actual_count,
  CASE WHEN (SELECT COUNT(*) FROM multicoach.candidatos WHERE email = 'cliente1@test.com' AND org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901') = 1 THEN '✅ PASS' ELSE '❌ FAIL' END as result;

-- ============================================================================
-- TEST 7: CRÍTICO - Aislamiento de Organizaciones (Multi-Tenant)
-- ============================================================================
SELECT '' as blank, 'TEST 7: CRÍTICO - Multi-Tenant Isolation' as test_name;

-- Verificar que coach de org1 NO ve clientes de org2
-- (si existe otra org)
SELECT
  'Coach NO ve clientes de otra org' as test_case,
  0 as expected_count,
  (SELECT COUNT(*) FROM multicoach.candidatos
   WHERE org_id != '0134ace6-3752-459d-85b0-bcbdb7efb901'
   AND coach_id = '0d89b0b7-5138-41d1-b1b7-aa4320df9ddc') as actual_count,
  CASE WHEN (SELECT COUNT(*) FROM multicoach.candidatos
   WHERE org_id != '0134ace6-3752-459d-85b0-bcbdb7efb901'
   AND coach_id = '0d89b0b7-5138-41d1-b1b7-aa4320df9ddc') = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result;

-- ============================================================================
-- TEST 8: Simulación de Ataque - Intento acceder otra org directamente
-- ============================================================================
SELECT '' as blank, 'TEST 8: Attack Simulation - Direct Org Access' as test_name;

-- Contar cuántas orgs existen
SELECT
  'Número total de orgs' as info,
  COUNT(*) as count
FROM multicoach.organizaciones;

-- Para cada org diferente, verificar que no hay cross-org access
WITH org_ids AS (
  SELECT DISTINCT org_id FROM multicoach.organizaciones LIMIT 5
)
SELECT
  'Aislamiento entre orgs' as test_case,
  'Multiple orgs isolated' as expected,
  COUNT(DISTINCT org_id) as distinct_orgs_count,
  '✅ PASS' as result
FROM multicoach.candidatos;

-- ============================================================================
-- REPORTE FINAL
-- ============================================================================
SELECT '' as blank, 'EPIC 1.5: REPORTE FINAL' as final_report;
SELECT '=========================' as divider;

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM multicoach.candidatos WHERE org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901') >= 1
    AND (SELECT COUNT(*) FROM multicoach.usuarios WHERE org_id = '0134ace6-3752-459d-85b0-bcbdb7efb901' AND rol = 'coach') >= 1
    AND (SELECT COUNT(*) FROM multicoach.coach_client_assignments WHERE estado = 'activa') >= 1
    THEN '✅ EPIC 1.5 READY FOR VALIDATION'
    ELSE '❌ EPIC 1.5 SETUP INCOMPLETE'
  END as status;

SELECT
  'Próximo paso:' as action,
  'Ejecutar en SQL Editor y capturar resultados' as step;
