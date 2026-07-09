-- fit_fotos — Fotos de progreso del cliente fitness.
-- Array JSON de objetos { url, titulo, descripcion, fecha }.
-- El portal (pathway-fit-cliente.html) las sube a Supabase Storage (bucket
-- avatars) y guarda el array acá con un PATCH directo del cliente a SU ficha
-- (mismo patrón que fit_habitos / fit_nutri_log / sesiones_registro).
--
-- Aplicar una sola vez en el SQL editor de Supabase.

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fit_fotos TEXT;
