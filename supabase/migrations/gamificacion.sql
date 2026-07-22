-- ═══════════════════════════════════════════════════════════════════════════
-- Gamificación de Pathway — persistencia (puntos · badges · referidos · feedback)
-- Ver docs/gamificacion-pathway.md. El panel escribe estas columnas best-effort;
-- con esta migración dejan de vivir solo en el navegador (localStorage).
-- ═══════════════════════════════════════════════════════════════════════════

-- Puntos por acciones (se SUMAN a game_pts de la cabra) y colección de badges.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb;

-- Referidos: qué coach trajo a este coach (para el badge Comunidad).
-- Se setea en el registro cuando llega con ?ref=<id-del-coach-que-lo-invitó>.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS referido_por TEXT;
CREATE INDEX IF NOT EXISTS idx_usuarios_referido_por ON usuarios(referido_por);

-- Feedback de la revista Novedades: ideas ("Tu voz"), votos de encuesta,
-- inscripciones al sorteo. Una sola tabla, distinguida por `tipo`.
CREATE TABLE IF NOT EXISTS revista_feedback (
  id         BIGSERIAL PRIMARY KEY,
  coach_id   TEXT,
  tipo       TEXT NOT NULL,          -- 'idea' | 'encuesta' | 'sorteo'
  valor      TEXT,                   -- texto de la idea / opción votada
  semana     INTEGER,                -- edición de la revista (isoWeek % 8)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: anon puede INSERT (el panel usa la anon key) y SELECT (el admin lee el
-- feedback desde la pestaña Novedades del panel — mismo modelo de frontend
-- filtering que el resto de la app, sin auth server-side todavía).
ALTER TABLE revista_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS revista_feedback_insert ON revista_feedback;
CREATE POLICY revista_feedback_insert ON revista_feedback FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS revista_feedback_select ON revista_feedback;
CREATE POLICY revista_feedback_select ON revista_feedback FOR SELECT TO anon USING (true);

-- Consultar feedback (desde el panel de admin / SQL):
--   SELECT tipo, valor, count(*) FROM revista_feedback GROUP BY 1,2 ORDER BY 3 DESC;
