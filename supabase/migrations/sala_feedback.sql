-- Feedback del CLIENTE al terminar CUALQUIER llamada de la Sala (los 4 modos).
-- Así el coach/Pathway tiene una idea de cómo estuvo cada sesión, no solo las de
-- conversión. Se guarda por `room` (Pathway-<coach_id>-<inicio_ms>, determinística)
-- para poder cruzarla con la cita en el panel.
--
-- Aditivo y seguro. El cliente entra a la Sala SIN login → deja su feedback con la
-- anon key (INSERT). El panel lo lee (SELECT). Sin datos sensibles.
CREATE TABLE IF NOT EXISTS sala_feedback (
  id          BIGSERIAL PRIMARY KEY,
  room        TEXT NOT NULL,
  email       TEXT,
  rating      INT,          -- 1..5 (cómo estuvo la sesión, según el cliente)
  nota        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sala_feedback_room_idx  ON sala_feedback (room);
CREATE INDEX IF NOT EXISTS sala_feedback_email_idx ON sala_feedback (lower(email));

ALTER TABLE sala_feedback ENABLE ROW LEVEL SECURITY;

-- ⚠️ anon Y authenticated en AMBAS policies + GRANT. Misma familia que
-- `notificaciones.sql`/`reviews_insert_portal.sql`: los coaches migrados a
-- Supabase Auth mandan JWT (rol `authenticated`); si la policy es `to anon`
-- sola, ninguna matchea → el panel del coach NO PODÍA LEER el feedback (la
-- tarjeta "Llamadas de la Sala" salía vacía aunque el cliente sí lo hubiera
-- dejado). El INSERT del cliente ya funcionaba (anon key), pero se cubre igual
-- por si un cliente logueado (portal, authenticated) deja su valoración.
grant select, insert on public.sala_feedback to anon, authenticated;

-- El cliente deja su feedback (anon sin login, o authenticated desde el portal).
DROP POLICY IF EXISTS sala_feedback_insert ON sala_feedback;
CREATE POLICY sala_feedback_insert ON sala_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- El panel del coach lo lee (mismo modelo que el resto del panel).
DROP POLICY IF EXISTS sala_feedback_select ON sala_feedback;
CREATE POLICY sala_feedback_select ON sala_feedback
  FOR SELECT TO anon, authenticated USING (true);
