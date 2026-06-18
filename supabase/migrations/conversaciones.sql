-- ─────────────────────────────────────────────────────────────
-- Conversación in-app lead ↔ coach (link mágico por token).
-- Se monta sobre `solicitudes` (no creamos tabla nueva): cada solicitud
-- tipo "mensaje" pasa a tener un hilo de mensajes + un token de acceso.
-- El lead entra a su conversación por /c/<token> SIN cuenta (el token es la llave).
-- Aplicar una vez en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS token          TEXT;       -- llave del link mágico del lead
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS mensajes       JSONB DEFAULT '[]'::jsonb;  -- hilo: [{from:'lead'|'coach', texto, ts}]
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS lead_ultimo_at TIMESTAMPTZ; -- última respuesta del lead (para badges)
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS coach_ultimo_at TIMESTAMPTZ;-- última respuesta del coach

CREATE INDEX IF NOT EXISTS idx_solicitudes_token ON solicitudes(token);

-- La lectura/escritura del lead pasa SIEMPRE por la edge function `conversacion`
-- (service role, filtra por token) → no hace falta abrir RLS de solicitudes a anon.
