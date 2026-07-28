-- Modalidad de la cita: Online (videollamada) vs Presencial, y formato 1:1 vs Grupal.
-- Todas las columnas son opcionales con default seguro → el código funciona aunque
-- la migración no esté aplicada (reintenta sin ellas), y al aplicarla queda completo.
--
--   • modalidad = 'online' (por defecto) | 'presencial'
--       - online     → el email/recordatorio lleva el botón "Entrar a la videollamada".
--       - presencial → NO manda link de video; muestra 'lugar' en su lugar.
--   • lugar     = dirección/referencia del encuentro presencial (texto libre, opcional).
--   • grupal    = false (por defecto) | true
--       - true → la Sala usa video multi-persona (JaaS), no el P2P 1:1
--         (clases, cursos, o una demo con varios). El link viaja con &grupal=1.
--
-- Aplicar en Supabase → SQL Editor (o supabase db push).

ALTER TABLE citas ADD COLUMN IF NOT EXISTS modalidad TEXT DEFAULT 'online';
ALTER TABLE citas ADD COLUMN IF NOT EXISTS lugar TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS grupal BOOLEAN DEFAULT false;
