-- Prueba de consentimiento (RGPD art. 7.1 — el responsable debe poder demostrar
-- que el interesado aceptó). Se captura en el PRIMER INGRESO del cliente al
-- portal (no por email): acepta Términos + Política de Privacidad con un clic y
-- queda registrado quién, cuándo y qué versión de la política aceptó.
--
-- Distinción legal:
--   consent_terms (Términos + Privacidad)  -> base: ejecución del contrato.
--       Es obligatorio para usar el servicio (puede ser "sí o sí").
--   consent_marketing (emails/testimonios) -> base: consentimiento LIBRE.
--       Es opcional: el cliente puede rechazarlo y seguir usando el servicio.
--
-- Correr UNA vez en Supabase (SQL Editor) antes de desplegar el onboarding nuevo.

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS consent_at        TIMESTAMPTZ;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS consent_version   TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS consent_marketing BOOLEAN DEFAULT false;
