-- Agregar google_event_id a citas (para rastrear eventos en Google Calendar)
-- Julio 2026: se guarda cuando gcal-push crea/actualiza el evento en Google Calendar
-- Permite actualizar el evento después sin necesitar el ID nuevamente

ALTER TABLE citas ADD COLUMN IF NOT EXISTS google_event_id TEXT;
CREATE INDEX IF NOT EXISTS citas_google_event_id_idx ON citas (google_event_id);

-- Nota: meet_link se guarda cuando Google genera automáticamente el Meet link
-- google_event_id se guarda como referencia al evento de Google para futuras updates
