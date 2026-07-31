-- Agregar meet_link a citas (Google Meet link autogenerado desde Google Calendar)
-- Julio 2026: cambio de sala.html a Google Meet como sistema de videosesiones
-- El link se guarda cuando se sincroniza la cita desde Google Calendar
ALTER TABLE citas ADD COLUMN IF NOT EXISTS meet_link text;
CREATE INDEX IF NOT EXISTS citas_meet_link_idx ON citas (meet_link);

-- NOTA: El coach configura su Google Calendar en Configuración.
-- Cuando agendan una cita en el panel, se sincroniza a su Google Calendar.
-- Google genera automáticamente el Meet link.
-- Ese link se guarda acá para poder mostrarlo en el panel.
