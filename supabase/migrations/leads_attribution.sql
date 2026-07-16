-- leads_attribution — ORIGEN DE LOS LEADS (tracking de anuncios / campañas).
-- Agrega una columna `origen` (JSONB) a las tablas por donde entran leads, para
-- guardar DE DÓNDE vino cada persona: utm_source/medium/campaign/content/term,
-- fbclid (Meta), gclid (Google), referrer y la página de aterrizaje.
-- Lo escribe pw-pixel.js (window.pwAttr()) al momento de guardar el lead.
--
-- Así el panel puede responder: "¿qué anuncio me trae leads que después pagan?"
--
-- Aplicar una sola vez en Supabase (SQL Editor). Es idempotente.

-- 1) Chatbot de la landing / leads de contacto.
ALTER TABLE contactos_chat  ADD COLUMN IF NOT EXISTS origen JSONB;

-- 2) Embudo de pricing (trial / pago). Puede no existir en instalaciones viejas;
--    si tu proyecto ya tiene leads_pricing, esto le suma la columna.
ALTER TABLE leads_pricing   ADD COLUMN IF NOT EXISTS origen JSONB;

-- Índices para agrupar por campaña sin escanear toda la tabla (expression index
-- sobre el campo utm_campaign del JSONB).
CREATE INDEX IF NOT EXISTS contactos_chat_campaign_idx
  ON contactos_chat ((origen->>'utm_campaign'));
CREATE INDEX IF NOT EXISTS leads_pricing_campaign_idx
  ON leads_pricing  ((origen->>'utm_campaign'));

-- NOTA sobre permisos: la columna hereda las policies existentes de cada tabla.
-- El navegador ya inserta filas en contactos_chat con la anon key (INSERT), así
-- que solo suma este campo al mismo INSERT — no requiere policy nueva.
--
-- Consulta útil (leads por campaña, últimos 30 días):
--   SELECT origen->>'utm_source' AS fuente,
--          origen->>'utm_campaign' AS campania,
--          count(*) AS leads
--   FROM contactos_chat
--   WHERE fecha > now() - interval '30 days'
--   GROUP BY 1, 2 ORDER BY leads DESC;
