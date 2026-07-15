-- ===================================================================
-- coach_nudges — registro de "empujones" automáticos de ciclo de vida
-- enviados a cada coach por la edge function `coach-lifecycle`.
--
-- Sirve de memoria anti-spam: antes de mandar un nudge, la function mira
-- si ya lo mandó (one-time) o si está dentro del cooldown (recurrentes
-- como la reactivación). Así un coach NUNCA recibe el mismo empujón dos
-- veces de gusto.
--
-- Lo escribe SOLO la edge function con el service role (bypass RLS).
-- Nadie más lee ni escribe esta tabla.
--
-- Aplicar una vez: Supabase Studio → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS coach_nudges (
  id           BIGSERIAL PRIMARY KEY,
  coach_id     UUID NOT NULL,
  -- onb_bienvenida | onb_referido | onb_funciones | onb_review | reactivacion |
  -- admin_churn_alert | trial_por_vencer | trial_vencido | trial_vencido_2 |
  -- admin_trial_vencido
  plantilla_id TEXT NOT NULL,
  canal        TEXT,            -- email | push | email+push | admin
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup por (coach, plantilla) ordenado por fecha — es la query que hace
-- la function para decidir si reenvía o no.
CREATE INDEX IF NOT EXISTS idx_coach_nudges_lookup
  ON coach_nudges (coach_id, plantilla_id, sent_at DESC);

-- RLS: cerrado. Solo el service role (que ignora RLS) puede tocarla.
ALTER TABLE coach_nudges ENABLE ROW LEVEL SECURITY;
-- (sin políticas = anon/authenticated no pueden leer ni escribir)
