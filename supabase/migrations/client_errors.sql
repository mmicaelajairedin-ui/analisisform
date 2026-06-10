-- client_errors — DETECTOR DE HUMO (observabilidad)
-- Guarda los errores que ocurren en el navegador de coaches y clientes para que
-- la coach se entere cuando algo falla en produccion (guardados que no llegan,
-- errores de JS, etc.), en vez de operar a ciegas. Lo escribe pw-observe.js.
--
-- Aplicar una sola vez en Supabase (SQL Editor).

CREATE TABLE IF NOT EXISTS client_errors (
  id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind    TEXT,                         -- http_400, neterror, jserror, promise...
  detail  TEXT,                         -- mensaje / endpoint
  page    TEXT,                         -- /panel-v2.html#clientes
  email   TEXT,                         -- quien lo vivio (best-effort)
  ua      TEXT,                         -- navegador
  ts      TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_errors_ts_idx   ON client_errors (ts DESC);
CREATE INDEX IF NOT EXISTS client_errors_kind_idx ON client_errors (kind);

-- RLS: cualquiera (anon) puede INSERTAR su propio error (es lo que hace el
-- navegador), pero NADIE puede leerlos con la anon key. Para revisarlos, la
-- coach entra por el SQL Editor o le agregamos una vista admin en el panel.
ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_errors_insert ON client_errors;
CREATE POLICY client_errors_insert ON client_errors
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- (Sin policy de SELECT para anon => nadie puede bajarse la tabla.)

-- Consulta util para revisar los ultimos errores:
--   SELECT ts, kind, email, page, detail
--   FROM client_errors ORDER BY ts DESC LIMIT 100;
