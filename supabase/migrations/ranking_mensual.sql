-- ═══════════════════════════════════════════════════════════════════════════
-- Ranking mensual de coaches ("Los coaches del mes" — revista + perfil).
-- Cuenta los puntos ganados EN EL MES en curso y se reinicia cada mes nuevo.
-- Se actualiza solo (el panel suma en cada acción); cero mantenimiento manual.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ranking_mensual (
  coach_id   TEXT NOT NULL,
  ym         TEXT NOT NULL,            -- mes: 'YYYY-MM'
  nombre     TEXT,
  pts        INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (coach_id, ym)
);
CREATE INDEX IF NOT EXISTS idx_ranking_mensual_ym ON ranking_mensual(ym, pts DESC);

-- Suma atómica de puntos al mes en curso del coach (upsert-incremento).
CREATE OR REPLACE FUNCTION pw_add_month_pts(p_coach TEXT, p_ym TEXT, p_n INT, p_nombre TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO ranking_mensual (coach_id, ym, nombre, pts, updated_at)
  VALUES (p_coach, p_ym, p_nombre, GREATEST(p_n, 0), now())
  ON CONFLICT (coach_id, ym) DO UPDATE
    SET pts        = ranking_mensual.pts + GREATEST(EXCLUDED.pts, 0),
        nombre     = COALESCE(EXCLUDED.nombre, ranking_mensual.nombre),
        updated_at = now();
$$;

-- RLS: anon lee el ranking (para pintar el podio) y ejecuta la función de suma.
ALTER TABLE ranking_mensual ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ranking_mensual_select ON ranking_mensual;
CREATE POLICY ranking_mensual_select ON ranking_mensual FOR SELECT TO anon USING (true);
GRANT EXECUTE ON FUNCTION pw_add_month_pts(TEXT, TEXT, INT, TEXT) TO anon;

-- Ver el ranking del mes en curso:
--   SELECT nombre, pts FROM ranking_mensual WHERE ym = to_char(now(),'YYYY-MM') ORDER BY pts DESC;
