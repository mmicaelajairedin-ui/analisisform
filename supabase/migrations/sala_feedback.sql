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

-- El cliente (anon, sin login) deja su feedback.
DROP POLICY IF EXISTS sala_feedback_insert ON sala_feedback;
CREATE POLICY sala_feedback_insert ON sala_feedback
  FOR INSERT TO anon WITH CHECK (true);

-- El panel del coach lo lee (mismo modelo que el resto del panel).
DROP POLICY IF EXISTS sala_feedback_select ON sala_feedback;
CREATE POLICY sala_feedback_select ON sala_feedback
  FOR SELECT TO anon USING (true);
