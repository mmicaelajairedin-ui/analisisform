-- COBROS DE LA RED (multicoach) — julio 2026
-- Pagos de clientes que llegan por la página pública de la red (/red/<slug>).
-- Modelo: UNA sola cuenta de Stripe, la del DUEÑO. El dinero entra a su cuenta
-- (cargo directo, Stripe-Account) y Pathway retiene 2% como application fee.
-- El dueño le paga a sus coaches por fuera. Distinto de `solicitudes` (que es el
-- carril del coach individual, con hold + aceptar y comisión escalonada 5-18%).
--
-- La fila se crea al iniciar el checkout (estado 'pendiente') y se concilia
-- contra Stripe desde la edge function red-checkout (action=sync): pagado/expirado.
--
-- Aplicar en el SQL Editor de Supabase (idempotente).

CREATE TABLE IF NOT EXISTS cobros_red (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID REFERENCES organizaciones(id),
  coach_id              UUID,                       -- coach elegido por el cliente
  coach_nombre          TEXT,
  servicio_titulo       TEXT,
  servicio_idx          INT,
  monto                 NUMERIC,                    -- precio bruto (en su moneda)
  moneda                TEXT DEFAULT 'eur',
  comision              NUMERIC,                    -- 2% de monto (lo de Pathway)
  cliente_nombre        TEXT,
  cliente_email         TEXT,
  estado                TEXT DEFAULT 'pendiente',   -- pendiente | pagado | expirado
  stripe_account_id     TEXT,                       -- la cuenta del DUEÑO
  stripe_session_id     TEXT,
  stripe_payment_intent TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cobros_red_org_idx   ON cobros_red(org_id);
CREATE INDEX IF NOT EXISTS cobros_red_estado_idx ON cobros_red(estado);

-- RLS: NADIE lee/escribe directo con la anon key. Solo la edge function
-- red-checkout (service role, que bypassa RLS) toca esta tabla. Así los cobros
-- de una red no se filtran a otra ni al público.
ALTER TABLE cobros_red ENABLE ROW LEVEL SECURITY;

-- Slug público de la red para servir /red/<slug> (página pública de la empresa).
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS organizaciones_slug_key
  ON organizaciones(slug) WHERE slug IS NOT NULL;

COMMENT ON TABLE cobros_red IS
  'Pagos de clientes a la cuenta del dueño de la red (2% Pathway). Solo service role (red-checkout).';
COMMENT ON COLUMN organizaciones.slug IS
  'Slug público para /red/<slug> (página pública de la red, feature del plan Pro).';
