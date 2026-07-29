-- ===================================================================
-- red_canales — GRUPOS/CANALES de una red (multicoach). Antes había UN solo
-- canal de equipo por organización (mensajes_red_canal, canal_id NULL = ese
-- canal "General"). Ahora el dueño (y los coaches) pueden crear GRUPOS: cada
-- grupo es un canal aparte con sus miembros. Ej: "Nutricionistas", "Zona Norte".
--
--   · canal_id NULL en mensajes_red_canal  = canal GENERAL (toda la red).
--   · canal_id = red_canales.id            = un grupo con miembros propios.
--
-- Miembros: array de usuarios.id (dueño + coaches). Vacío = abierto a toda la
-- red. Lecturas/escrituras SOLO por la edge function canal-red (service role,
-- gateada a los miembros del grupo). RLS estricto: sin políticas públicas.
-- Aplicar una vez: Supabase → SQL Editor.  (idempotente)
-- ===================================================================

CREATE TABLE IF NOT EXISTS red_canales (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  creado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  miembros    JSONB DEFAULT '[]'::jsonb,   -- array de usuarios.id; vacío = toda la red
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS red_canales_org_idx ON red_canales(org_id, created_at);

ALTER TABLE red_canales ENABLE ROW LEVEL SECURITY;
-- Sin políticas: cerrado a la anon key. Solo canal-red (service role) opera,
-- tras verificar que quien llama es miembro de esa red / de ese grupo.

-- El canal al que pertenece cada mensaje (NULL = canal General de la red).
ALTER TABLE mensajes_red_canal
  ADD COLUMN IF NOT EXISTS canal_id UUID REFERENCES red_canales(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS mensajes_red_canal_canal_idx
  ON mensajes_red_canal(canal_id, created_at DESC);
