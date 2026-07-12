-- Diario de nutrición del CLIENTE: lo que comió de verdad, por día de la semana.
-- El cliente lo anota en su portal (saveNutriLog → fit_nutri_log) y el coach lo
-- ve en la pestaña Nutrición de la ficha (tarjeta "Lo que comió el cliente").
-- Forma: { "lun": "Desayuno… Almuerzo…", "mar": "...", ... }
-- Sin esta columna el guardado del cliente fallaba y el coach no veía nada.
-- Idempotente.
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fit_nutri_log TEXT DEFAULT '{}';
