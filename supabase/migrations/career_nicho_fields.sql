-- ===================================================================
-- Campos de nicho (fitness / financiero) en la tabla `candidatos`
-- de la base de CAREER (ddxnrsnjdvtqhxunxnwj).
--
-- El panel (panel-v2.html) es el MISMO para todos los coaches; solo
-- cambia el contenido de la ficha del cliente segun coach_type.
-- Estos campos solo se completan para clientes de coaches
-- fitness/financiero. Carrera no los usa (queda igual que siempre).
--
-- Aplicar UNA vez en el SQL editor de Supabase (base de career).
-- IF NOT EXISTS = seguro de re-correr.
-- ===================================================================

-- Fitness: historial de mediciones antropometricas.
-- JSON array: [{fecha,peso,grasa,musculo,oseo,pliegues,imo}, ...]
-- El cliente lo ve en su portal (solo lectura / graficos).
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fit_antro TEXT;

-- Fitness: rutina de entrenamiento (texto libre que escribe el coach).
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fit_rutina TEXT;

-- Fitness: habitos diarios que marca el cliente desde su portal.
-- JSON {"2026-06-03":{"agua":true,"sueno":true,"pasos":false}, ...}
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fit_habitos TEXT;

-- Financiero: presupuesto recomendado.
-- JSON: {vivienda, alimentacion, ocio, ahorro}
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fin_pres TEXT;
