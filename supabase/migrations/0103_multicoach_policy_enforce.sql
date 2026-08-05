-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0103: Assign orphan clients to Bot Coach (test)
-- ═══════════════════════════════════════════════════════════════════════
-- Resuelve inconsistencia de datos para Sprint 1 de multicoach-v3:
-- Asigna los 4 clientes sin coach a Bot Coach (test).
--
-- Nota: La restricción NOT NULL en coach_id se aplicará después de validar
-- que todos los flujos de creación de cliente funcionan correctamente.
--

UPDATE candidatos
SET coach_id = 'e1a81105-0e18-4be9-a5a3-c986169e9810'::uuid
WHERE id IN (283, 284, 285, 286)
  AND coach_id IS NULL;
