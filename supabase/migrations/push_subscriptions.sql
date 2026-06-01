-- Push subscriptions: una fila por dispositivo/navegador suscripto a notificaciones.
-- Un mismo user_email puede tener varias filas (móvil + escritorio + tablet, etc).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,   -- URL del push service (FCM/Mozilla); única por suscripción
  p256dh TEXT NOT NULL,            -- llave pública del navegador (URL-safe base64)
  auth TEXT NOT NULL,              -- secreto de autenticación (URL-safe base64)
  ua TEXT,                         -- user-agent para debug (opcional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_email);

-- RLS: cualquiera puede INSERT su propia suscripción y DELETE por endpoint.
-- La edge function 'send-push' usa el service-role key, así que las lecturas
-- desde el server no pasan por RLS.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_insert_anyone ON push_subscriptions;
CREATE POLICY push_insert_anyone ON push_subscriptions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS push_delete_anyone ON push_subscriptions;
CREATE POLICY push_delete_anyone ON push_subscriptions
  FOR DELETE USING (true);

-- IMPORTANTE: las policies RLS son solo el filtro de filas. Para que el rol
-- 'anon' pueda llegar a esa policy, primero necesita el GRANT a nivel tabla.
-- Sin esto el cliente recibe 401 desde la REST API de Supabase.
GRANT INSERT, DELETE ON push_subscriptions TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE push_subscriptions_id_seq TO anon, authenticated;

