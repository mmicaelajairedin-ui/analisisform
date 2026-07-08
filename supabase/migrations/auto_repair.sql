-- ============================================================================
-- AUTO-REPARACIÓN de datos — se ejecuta sola (pg_cron) y también a mano.
-- ============================================================================
-- Complementa al health-check (que AVISA). Esto ARREGLA, pero SOLO lo que es
-- 100% determinístico y seguro:
--   • Ligar auth_id de un usuario a su cuenta de Supabase Auth (match por email
--     verificado). Sin esto, con RLS prendido no verían nada.
--   • Completar el nicho de un cliente desde el tipo de SU coach — pero SOLO si
--     el coach tiene coach_type explícito (nunca adivina 'carrera').
-- Lo AMBIGUO (¿de qué coach es este huérfano? ¿borro este duplicado?) NO se toca:
-- eso lo avisa el health-check para que lo resuelvas vos. Así jamás crea datos mal.
-- Cada corrida queda registrada en repair_log (auditoría).
--
-- Aplicar: pegar todo en Supabase → SQL Editor y correr.
-- ============================================================================

-- Registro de cada auto-reparación (qué y cuándo) ---------------------------
CREATE TABLE IF NOT EXISTS repair_log (
  id                 bigserial PRIMARY KEY,
  ts                 timestamptz DEFAULT now(),
  auth_id_ligados    int DEFAULT 0,
  nichos_completados int DEFAULT 0,
  detalle            jsonb
);

CREATE OR REPLACE FUNCTION public.pw_auto_repair()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  n_auth  int := 0;
  n_nicho int := 0;
BEGIN
  -- 1) Ligar auth_id: cada usuario sin auth_id que YA tiene cuenta en auth.users
  --    (match por email verificado). Determinístico: no adivina nada.
  WITH upd AS (
    UPDATE usuarios u
    SET auth_id = a.id
    FROM auth.users a
    WHERE u.auth_id IS NULL
      AND lower(a.email) = lower(u.email)
    RETURNING u.id
  )
  SELECT count(*) INTO n_auth FROM upd;

  -- 2) Completar nicho del cliente desde el coach_type de SU coach — SOLO cuando
  --    el coach tiene coach_type explícito. Si no lo tiene, se deja NULL y el
  --    health-check lo reporta para revisión manual (nunca asume 'carrera').
  WITH upd AS (
    UPDATE candidatos c
    SET nicho = u.configuracion->>'coach_type'
    FROM usuarios u
    WHERE c.coach_id = u.id
      AND (c.nicho IS NULL OR c.nicho = '')
      AND NULLIF(u.configuracion->>'coach_type', '') IS NOT NULL
    RETURNING c.id
  )
  SELECT count(*) INTO n_nicho FROM upd;

  INSERT INTO repair_log(auth_id_ligados, nichos_completados, detalle)
  VALUES (n_auth, n_nicho, jsonb_build_object('auth_id', n_auth, 'nicho', n_nicho));

  RETURN jsonb_build_object('auth_id_ligados', n_auth, 'nichos_completados', n_nicho);
END;
$$;

-- Correr A MANO cuando quieras:
--   SELECT pw_auto_repair();
-- Ver el historial de reparaciones:
--   SELECT * FROM repair_log ORDER BY ts DESC LIMIT 20;

-- ── PROGRAMARLA SOLA (nightly) con pg_cron ──────────────────────────────────
-- (Opcional: cuando quieras que corra sola cada noche. Correr estas 2 líneas.)
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule('pw-auto-repair', '0 6 * * *', $$ SELECT public.pw_auto_repair(); $$);
-- Corre 6:00 UTC (antes del health-check de las 8:00), así el email diario ya
-- refleja lo que se auto-reparó. Para desprogramarla:
--   SELECT cron.unschedule('pw-auto-repair');
