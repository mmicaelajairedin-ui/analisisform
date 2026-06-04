-- ===================================================================
-- Intake fitness: campos estructurados en la tabla `candidatos`
-- (base de career, ddxnrsnjdvtqhxunxnwj).
--
-- Estos campos los edita el coach fitness en la pestaña Perfil de la
-- ficha del cliente (panel-v2.html) y alimentan el informe de IA
-- (edge function generar-informe ya los lee: rw.edad, rw.nivel, etc.).
--
-- Aplicar UNA vez en el SQL editor de Supabase. IF NOT EXISTS = seguro
-- de re-correr. Carrera no los usa (queda igual que siempre).
-- ===================================================================

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS edad TEXT;           -- edad del cliente
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS peso TEXT;           -- peso inicial (kg)
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS altura TEXT;         -- altura (cm)
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS nivel TEXT;          -- experiencia entrenando (principiante/intermedio/avanzado)
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS dias TEXT;           -- dias por semana disponibles
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS lugar TEXT;          -- donde entrena (gimnasio/casa/aire libre)
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS equipo TEXT;         -- equipamiento disponible
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS lesiones TEXT;       -- lesiones o condiciones medicas
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS medicacion TEXT;     -- medicacion relevante
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS restricciones TEXT;  -- restricciones alimentarias
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS nutricion TEXT;      -- habitos de alimentacion actuales
