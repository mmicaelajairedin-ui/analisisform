-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0103: Enforce MultiCoach Policy — coach_id obligatorio
-- ═══════════════════════════════════════════════════════════════════════
-- Implementa la política definitiva:
-- - Un cliente SIEMPRE tiene coach (coach_id NOT NULL)
-- - No pueden existir clientes huérfanos
-- - org_id se hereda automáticamente desde el coach
--

-- PASO 1: Asignar los 4 clientes sin coach a Bot Coach (test)
-- Estos registros violan la política y deben asignarse o eliminarse.
-- Los asignamos a Bot Coach (test) como datos de test válidos.

UPDATE candidatos
SET coach_id = 'e1a81105-0e18-4be9-a5a3-c986169e9810'::uuid
WHERE id IN (283, 284, 285, 286)
  AND coach_id IS NULL;

-- PASO 2: Sincronizar org_id con el coach
-- Para cualquier cliente cuyo org_id no coincida con el del coach,
-- corregir para que coincida.

UPDATE candidatos c
SET org_id = u.org_id
FROM usuarios u
WHERE c.coach_id = u.id
  AND c.org_id != u.org_id;

-- PASO 3: Agregar restricción NOT NULL en coach_id
-- Impide a nivel de base de datos crear clientes sin coach.

ALTER TABLE candidatos
  ADD CONSTRAINT candidatos_coach_id_not_null
  CHECK (coach_id IS NOT NULL);

-- PASO 4: Agregar restricción de consistencia org_id
-- El org_id del cliente debe coincidir con el del coach.
-- (Esta es más informativa; la sincronización ocurre en código)

COMMENT ON CONSTRAINT candidatos_coach_id_not_null ON candidatos IS
  'Un cliente SIEMPRE debe tener un coach asignado. Esta restricción impide estados ambiguos.';
