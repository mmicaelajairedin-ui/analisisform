-- Tabla de tokens de recuperación de contraseña.
--
-- La usa la edge function `password-reset`:
--   action="request"  → inserta un token (guardamos solo el HASH del token,
--                        no el token en claro, para que un leak de la DB no
--                        sirva para resetear cuentas).
--   action="confirm"  → valida token (no usado + no vencido) y marca used=true.
--
-- Aplicar una sola vez en Supabase (SQL editor o `supabase db push`).

CREATE TABLE IF NOT EXISTS password_resets (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_lookup
  ON password_resets (email, token_hash);

-- RLS prendido SIN políticas: nadie con la anon key puede leer/escribir.
-- Solo la edge function (service role) accede a esta tabla. Así un atacante
-- con la anon key no puede listar tokens ni insertarlos.
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
