-- ===================================================================
-- posts_red — la REVISTA / novedades de una red (multicoach). El DUEÑO publica
-- avisos, fotos y novedades; sus coaches y clientes las ven en su portal. Una
-- fila = un post.
--
-- 'para' define la audiencia: 'todos' | 'clientes' | 'coaches'. El cliente solo
-- ve 'todos' + 'clientes'; coaches/owner ven todo. 'reacts' guarda los contadores
-- de reacción (JSONB {emoji: count}) — best-effort, se incrementa desde la edge
-- function comunidad-red.
--
-- Escrituras y lecturas: SOLO por la edge function comunidad-red (service role,
-- gateada a los miembros de esa org — dueño publica; coach/cliente de esa org
-- leen). RLS habilitado SIN políticas públicas → nadie con la anon key lee/escribe
-- directo (misma línea que mensajes_red_canal).
-- Aplicar una vez: Supabase → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS posts_red (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  autor_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_nombre TEXT,                          -- nombre de la red para mostrar (denormalizado)
  titulo       TEXT,                          -- título opcional (se ve en negrita)
  body         TEXT NOT NULL,                 -- texto del post (puede traer <b>/<br> del composer)
  foto         TEXT,                          -- URL o data: de la imagen (opcional)
  emo          TEXT DEFAULT '📸',             -- emoji de portada cuando no hay foto
  para         TEXT DEFAULT 'todos',          -- 'todos' | 'clientes' | 'coaches'
  reacts       JSONB DEFAULT '{}'::jsonb,     -- {emoji: count}
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_red_idx
  ON posts_red(org_id, created_at DESC);

ALTER TABLE posts_red ENABLE ROW LEVEL SECURITY;
-- Sin políticas: cerrada a la anon key. Solo la edge function comunidad-red
-- (service role) lee/escribe, tras verificar que quien llama es miembro de la red.
