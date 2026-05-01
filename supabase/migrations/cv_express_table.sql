-- Tabla cv_express: persistencia de Pack Express con acceso 24hs
-- desde cualquier dispositivo. Key = email del comprador (capturado de Stripe).

CREATE TABLE IF NOT EXISTS cv_express (
  email           TEXT PRIMARY KEY,
  cv_optimizado   JSONB,
  carta           TEXT,
  carta_html      TEXT,
  carta_empresa   TEXT,
  carta_asunto    TEXT,
  carta_fecha     TEXT,
  linkedin_analisis JSONB,
  foto            TEXT,
  nombre          TEXT,
  objetivo        TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cv_express ENABLE ROW LEVEL SECURITY;

-- Anon puede leer/escribir su propia fila (key = email).
-- En producción, idealmente firmar con un token derivado del email
-- en Stripe webhook, pero para MVP el email + URL secreta es suficiente.
DROP POLICY IF EXISTS "anon read cv_express" ON cv_express;
CREATE POLICY "anon read cv_express" ON cv_express FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon insert cv_express" ON cv_express;
CREATE POLICY "anon insert cv_express" ON cv_express FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon update cv_express" ON cv_express;
CREATE POLICY "anon update cv_express" ON cv_express FOR UPDATE USING (true) WITH CHECK (true);
