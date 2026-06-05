-- ===================================================================
-- Identificar el nicho en cada candidato (carrera / fitness / financiero).
-- Lo setean: la invitación (según el tipo del coach) y el form del nicho.
-- El panel lo lee para mostrar la ficha correcta sin ambigüedad
-- (incluso en vistas de admin que cruzan coaches).
-- Base de career. Aplicar una vez. IF NOT EXISTS = seguro de re-correr.
-- ===================================================================
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS nicho TEXT;
