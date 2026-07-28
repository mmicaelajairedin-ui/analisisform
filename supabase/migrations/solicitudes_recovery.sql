-- Recuperación de solicitudes abandonadas — marcas anti-repetición.
--
-- La edge function `recuperar-solicitudes` manda dos recordatorios a los
-- candidatos que empezaron a pagar y no completaron (solo si tenemos su email):
--   · rec_link_at  → cuándo se le mandó el mail con el LINK (~30 min).
--   · rec_call_at  → cuándo se le mandó el mail de llamada/escribir (~12 h).
-- Idempotente: con la marca puesta, no se repite aunque el cron corra de más.
--
-- Aplicar UNA vez en el SQL Editor de Supabase (idempotente).

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS rec_link_at timestamptz;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS rec_call_at timestamptz;
