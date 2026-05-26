-- Visibilidad por cliente: el coach puede ocultar secciones (CV, Carta,
-- LinkedIn, Recursos, Sesiones) en el portal del cliente desde el panel
-- (Gestión → "Qué ve el cliente"). Cuando una sección está apagada, el
-- cliente directamente no la ve (no aparece candado, desaparece).
--
-- Estructura: JSON con keys booleanas. Default (NULL o {}) = todo visible.
--   {"cv":true,"carta":true,"linkedin":false,"recursos":true,"sesiones":true}
--
-- Correr una vez en Supabase → SQL Editor.

ALTER TABLE candidatos
  ADD COLUMN IF NOT EXISTS visibilidad TEXT;

-- Diagnóstico opcional:
-- SELECT id, nombre, visibilidad FROM candidatos WHERE visibilidad IS NOT NULL;
