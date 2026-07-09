-- Tareas de la semana editables por el coach (portal fitness).
-- El coach las carga en la ficha del cliente (Perfil) y el cliente las ve/marca
-- en su portal (pathway-fit-cliente.html → #dash-tareas). JSON array de strings.
-- Si un cliente no tiene tareas cargadas, el portal muestra un aviso (no ejemplos).
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fit_tareas TEXT;
