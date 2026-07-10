-- Recordatorios de citas + datos para WhatsApp.
-- - rem_24h_at / rem_1h_at: cuándo se mandó cada recordatorio (idempotencia; la
--   edge function recordatorios-citas no repite si ya está seteado).
-- - telefono: teléfono opcional que deja quien reserva → habilita el botón
--   "Recordar por WhatsApp" en el panel del coach.
-- - cliente_tz: zona horaria de quien reservó (para mostrar la hora en SU hora
--   en el email de recordatorio).
ALTER TABLE citas ADD COLUMN IF NOT EXISTS rem_24h_at timestamptz;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS rem_1h_at  timestamptz;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS telefono   text;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS cliente_tz text;

-- Índice para que la function encuentre rápido las citas próximas sin recordar.
CREATE INDEX IF NOT EXISTS citas_inicio_idx ON citas (inicio);
