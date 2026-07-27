-- client_errors — columna notified_at para la GUARDIA DE ERRORES
--
-- La edge function `error-guard` revisa client_errors cada ~30 min y le manda a
-- la coach un email cuando hay errores NUEVOS. Para no repetir el mismo aviso,
-- marca las filas ya notificadas con notified_at. La próxima corrida solo mira
-- las que siguen en NULL.
--
-- Aplicar una sola vez en Supabase (SQL Editor).

ALTER TABLE client_errors ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Índice parcial: la guardia siempre consulta "las que faltan avisar"
-- (notified_at IS NULL), así la query es instantánea aunque la tabla crezca.
CREATE INDEX IF NOT EXISTS client_errors_notified_idx
  ON client_errors (ts) WHERE notified_at IS NULL;
