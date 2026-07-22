-- ===================================================================
-- mensajes_red_canal — CANAL DE EQUIPO de una red (multicoach). Un solo hilo
-- grupal por organización: el DUEÑO + TODOS sus coaches escriben y leen en el
-- mismo lugar (la "sala del equipo"). Distinto de mensajes_owner_coach, que es
-- 1-a-1 (dueño ↔ un coach).
--
-- Cada fila es un mensaje del canal: autor_id/autor_nombre/autor_rol
-- (denormalizados para pintar la burbuja sin otra query), body, fecha.
-- Escrituras y lecturas: SOLO por la edge function canal-red (service role,
-- gateada a los miembros de esa org — dueño o coach con ese org_id). RLS
-- estricto queda para el hardening general; por eso NO se abren políticas
-- públicas acá (nadie con la anon key lee/escribe directo).
-- Aplicar una vez: Supabase → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS mensajes_red_canal (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  autor_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_nombre TEXT,                          -- nombre para mostrar (denormalizado)
  autor_rol    TEXT,                          -- 'owner' | 'coach' (para el estilo/etiqueta)
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensajes_red_canal_idx
  ON mensajes_red_canal(org_id, created_at DESC);

ALTER TABLE mensajes_red_canal ENABLE ROW LEVEL SECURITY;
-- Sin políticas: la tabla queda cerrada a la anon key. Solo la edge function
-- canal-red (service role) puede leer/escribir, tras verificar que quien llama
-- es el dueño o un coach de esa misma red.
