-- ia_feedback — LO QUE LA IA PATHWAY NO PUDO RESOLVER
-- Cada vez que el chat IA no puede ayudar (escala a WhatsApp), la Edge Function
-- ia-pathway guarda acá el caso: la pregunta del usuario, qué respondió la IA, en
-- qué página y quién. Sirve para VER qué le falta a la gente / qué está roto y
-- mejorarlo (cierra el círculo de "lo dejé anotado para mejorarlo").
--
-- Aplicar una sola vez en Supabase (SQL Editor).

CREATE TABLE IF NOT EXISTS ia_feedback (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mode      TEXT,                 -- coach | cliente
  page      TEXT,                 -- /cliente.html, /panel-v2.html, ...
  email     TEXT,                 -- quién (best-effort)
  pregunta  TEXT,                 -- último mensaje del usuario
  respuesta TEXT,                 -- lo que contestó la IA
  ts        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ia_feedback_ts_idx ON ia_feedback (ts DESC);

-- RLS: la escribe SOLO la Edge Function con la service role (que ignora RLS).
-- No hay policies para anon => nadie puede leerla ni escribirla con la anon key.
-- Para revisarla, entrás por el SQL Editor.
ALTER TABLE ia_feedback ENABLE ROW LEVEL SECURITY;

-- Consulta útil para revisar lo que la IA no resolvió:
--   SELECT ts, mode, page, email, pregunta, respuesta
--   FROM ia_feedback ORDER BY ts DESC LIMIT 100;
