-- eventos — EVENT STORE (Pathway OS Core · Nivel 0 · Foundation)
-- El corazon del "event bus": cada accion del negocio deja un evento aca. De
-- estos eventos se derivan despues la activacion, el health score, los embudos
-- y el dashboard del CEO (Nivel 1). Es ADITIVO: no toca ninguna tabla existente.
--
-- Lo escribe pw-events.js (cliente) y las edge functions (server, service role).
-- Copia el patron de `client_errors`: cualquiera puede INSERTAR, NADIE lee con
-- la anon key. La lectura para embudos/dashboard se hace con service role (una
-- edge function, que ignora RLS) — se agrega en el Nivel 1.
--
-- Aplicar UNA sola vez en Supabase (SQL Editor). Hasta que se corra, la tabla
-- no existe y nada cambia.

CREATE TABLE IF NOT EXISTS eventos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo         TEXT NOT NULL,   -- nombre del evento: SessionCompleted, TrialStarted, PaymentSucceeded...
  dominio      TEXT,            -- dominio que lo emite: Coaching, Billing, Commercial, Client...
  actor_email  TEXT,            -- quien lo disparo (best-effort)
  actor_rol    TEXT,            -- coach | cliente | owner | admin | empleado | anon
  actor_id     TEXT,            -- id del usuario si se conoce
  entidad_tipo TEXT,            -- sobre que: cliente, sesion, pago, programa, coach...
  entidad_id   TEXT,            -- id de la entidad afectada
  payload      JSONB,           -- datos extra del evento (libres)
  page         TEXT,            -- desde donde ocurrio (cliente) o la funcion (server)
  source       TEXT,            -- client | server:<funcion>
  ts           TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eventos_ts_idx      ON eventos (ts DESC);
CREATE INDEX IF NOT EXISTS eventos_tipo_idx    ON eventos (tipo);
CREATE INDEX IF NOT EXISTS eventos_dominio_idx ON eventos (dominio);
CREATE INDEX IF NOT EXISTS eventos_actor_idx   ON eventos (actor_email);
CREATE INDEX IF NOT EXISTS eventos_entidad_idx ON eventos (entidad_tipo, entidad_id);

-- RLS: cualquiera (anon) puede INSERTAR un evento (es lo que hace el navegador),
-- pero NADIE puede leerlos con la anon key. Igual que client_errors: la lectura
-- para embudos/health/dashboard se hara con service role desde una edge function.
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventos_insert ON eventos;
CREATE POLICY eventos_insert ON eventos
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- (Sin policy de SELECT para anon => nadie puede bajarse la tabla de eventos.)

-- Consulta util (SQL Editor / service role) para ver el flujo:
--   SELECT ts, tipo, dominio, actor_rol, entidad_tipo, entidad_id
--   FROM eventos ORDER BY ts DESC LIMIT 100;
--
-- Embudo comercial (ejemplo, cuando esten cableados los eventos):
--   SELECT tipo, count(*) FROM eventos
--   WHERE tipo IN ('TrialStarted','ClientInvited','WowReached','PaymentSucceeded')
--   GROUP BY tipo;
