-- Tabla para que los coaches confirmen su asistencia a los encuentros
-- mensuales de la Comunidad Pathway. Se expone una vista publica sin
-- email para listar los confirmados en /comunidad.html.

CREATE TABLE IF NOT EXISTS comunidad_rsvps (
  id          BIGSERIAL PRIMARY KEY,
  event_id    TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  practica    TEXT,
  asistencia  TEXT NOT NULL DEFAULT 'si'
              CHECK (asistencia IN ('si','tal_vez')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comunidad_rsvps_event_email_unique UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS comunidad_rsvps_event_idx
  ON comunidad_rsvps (event_id, created_at DESC);

ALTER TABLE comunidad_rsvps ENABLE ROW LEVEL SECURITY;

-- Cualquiera con la anon key puede crear su RSVP.
DROP POLICY IF EXISTS comunidad_rsvps_insert_anon ON comunidad_rsvps;
CREATE POLICY comunidad_rsvps_insert_anon
  ON comunidad_rsvps
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Permite actualizar el RSVP propio (cambiar de "tal_vez" a "si", etc.)
-- via upsert con on_conflict=event_id,email.
DROP POLICY IF EXISTS comunidad_rsvps_update_anon ON comunidad_rsvps;
CREATE POLICY comunidad_rsvps_update_anon
  ON comunidad_rsvps
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- No hay policy de SELECT en la tabla -> el email queda privado.

-- Permisos a nivel tabla (necesarios ademas de las policies de RLS).
-- Sin estos GRANTs, PostgREST devuelve 401 al rol anon aunque las
-- policies sean permisivas.
GRANT INSERT, UPDATE ON comunidad_rsvps TO anon, authenticated;
GRANT USAGE ON SEQUENCE comunidad_rsvps_id_seq TO anon, authenticated;

-- Vista publica: solo los campos seguros para mostrar en la pagina.
CREATE OR REPLACE VIEW comunidad_rsvps_publicos AS
  SELECT id, event_id, nombre, practica, asistencia, created_at
  FROM comunidad_rsvps;

GRANT SELECT ON comunidad_rsvps_publicos TO anon, authenticated;
