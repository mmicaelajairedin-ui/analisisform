-- Mensajes admin ↔ coach (panel-v2)
--
-- Hilo de mensajes entre el admin de Pathway (Mica) y cada coach.
-- - from_admin=true  → mensaje de Mica al coach
-- - from_admin=false → respuesta del coach
--
-- UI:
--   - Admin: en panel-v2 → tab Coaches → "Ver" sobre un coach abre la
--     ficha y al final muestra el hilo con cuadro para escribir.
--   - Coach: en panel-v2 sidebar aparece "Mensajes" con badge si tiene
--     no leídos. Lleva a una sección con el hilo + cuadro para responder.
--
-- Notificaciones: cada send dispara send-email (a Mica o al coach según
-- corresponda) avisando que hay un mensaje nuevo en el panel.

CREATE TABLE IF NOT EXISTS mensajes_admin_coach (
  id BIGSERIAL PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  from_admin BOOLEAN NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  leido_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS mensajes_admin_coach_coach_idx
  ON mensajes_admin_coach(coach_id, created_at DESC);

-- Permisos (RLS abierto a anon — alineado con el resto del proyecto;
-- el aislamiento es por frontend filtering hoy. Cuando se cierre el
-- gap de RLS estricto, este policy se cambia con el resto.)
ALTER TABLE mensajes_admin_coach ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mensajes_admin_coach_all ON mensajes_admin_coach
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
