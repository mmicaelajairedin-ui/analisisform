-- citas — RESERVAS desde el link público de agenda (agendar.html)
-- Cuando alguien abre el link de reservas de un coach, elige día/hora y confirma,
-- guardamos la solicitud acá (best-effort). El mecanismo principal sigue siendo la
-- invitación de Google Calendar (que cae en el calendario del coach y aparece en su
-- agenda), pero esta tabla deja registro aunque la persona no use Google.
--
-- Aplicar una sola vez en Supabase (SQL Editor).

CREATE TABLE IF NOT EXISTS citas (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_id  TEXT,                          -- usuarios.id del coach
  nombre    TEXT,                          -- quién reserva
  email     TEXT,
  tipo      TEXT,                          -- etiqueta del tipo de evento
  inicio    TIMESTAMPTZ,                   -- fecha/hora elegida
  estado    TEXT DEFAULT 'pendiente',      -- pendiente | confirmada | cancelada
  creada_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS citas_coach_idx  ON citas (coach_id, inicio DESC);

-- RLS: anon puede INSERTAR (es lo que hace el visitante que reserva). La lectura
-- queda para el coach autenticado sobre SUS citas (cuando migremos el panel a
-- Supabase Auth). Por ahora, sin policy de SELECT para anon => nadie baja la tabla.
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS citas_insert ON citas;
CREATE POLICY citas_insert ON citas
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Revisar reservas de un coach:
--   SELECT inicio, nombre, email, tipo, estado
--   FROM citas WHERE coach_id = '<coach_id>' ORDER BY inicio;
