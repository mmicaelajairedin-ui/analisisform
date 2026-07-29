-- ===================================================================
-- comunidad_extra — extiende posts_red para guardar TODA la Comunidad de una red
-- (multicoach), no solo la revista: también avisos, clases y retos. Antes esos
-- vivían en memoria y se perdían al recargar.
--
-- Se reusa la MISMA tabla posts_red con dos columnas:
--   tipo : 'post' | 'aviso' | 'clase' | 'reto'   (default 'post')
--   data : JSONB con los campos propios de cada tipo
--          · clase → {dia,hora,coach,cupo}
--          · reto  → {pts,parti,prog}
--          · aviso → (usa 'para' + 'body')
--
-- Idempotente. Aplicar una vez: Supabase → SQL Editor.
-- ===================================================================

ALTER TABLE posts_red ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'post';
ALTER TABLE posts_red ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS posts_red_tipo_idx
  ON posts_red(org_id, tipo, created_at DESC);
