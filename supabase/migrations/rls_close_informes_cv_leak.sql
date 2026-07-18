-- ============================================================================
-- Fase 6 — Cerrar la FUGA multicoach en informes + cv_publicados
-- ============================================================================
-- BUG (detectado 2026-07-18 con  SELECT * FROM pg_policies  en producción):
--   informes y cv_publicados YA tenían RLS estricto por coach_id (rls_strict.sql),
--   PERO convivían políticas PERMISIVAS abiertas  USING (true)  que lo anulaban.
--   En Postgres las políticas PERMISSIVE se combinan con OR: una sola con
--   `USING (true)` deja pasar a TODOS y neutraliza a las estrictas.
--   Origen: informes_rls.sql volvió a crear  informes_anon_all / cvpub_anon_*
--   DESPUÉS de la limpieza (rls_cleanup_open_policies.sql), para destrabar un
--   "permission denied" — reabriendo el candado sin querer.
--
--   Efecto real: con la anon key (pública en el JS del navegador) cualquiera
--   podía   SELECT * FROM informes    y   SELECT * FROM cv_publicados
--   y bajarse los diagnósticos/planes y los CVs de TODOS los clientes de TODOS
--   los coaches. Fuga de datos personales entre inquilinos. (CRÍTICO)
--
-- FIX: dejar SOLO las políticas estrictas. Se RE-CREAN (idempotente, por si en
--   prod se perdió alguna) y se DROPEAN las abiertas por nombre. Cubre:
--     · coach/admin → con su JWT   (pw_coach_id() / pw_is_admin())
--     · el propio cliente → con su JWT   (pw_email() = email de su ficha)
--     · edge function generar-informe → service_role (bypassa RLS, no la afecta)
--
-- ⚠️  ROLLOUT — correr en una ventana tranquila y VERIFICAR después:
--     1) Un coach entra al panel y ve SUS informes y SUS CVs (no vacío).
--     2) Un cliente entra a su portal, ve SU informe y edita/guarda su CV.
--     3) Generar un informe nuevo desde el panel del coach.
--     4) El bloque de VERIFICACIÓN (abajo) da 0 filas como anon.
--   Si algo se rompe → ROLLBACK (al final) y avisar.
--
-- Idempotente: se puede correr más de una vez sin efectos secundarios.
-- ============================================================================

-- 0) Helpers de identidad (idempotente; iguales a rls_strict.sql) -------------
CREATE OR REPLACE FUNCTION public.pw_coach_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.pw_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin')
$$;
CREATE OR REPLACE FUNCTION public.pw_email()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
GRANT EXECUTE ON FUNCTION public.pw_coach_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pw_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pw_email()    TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) informes
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE informes ENABLE ROW LEVEL SECURITY;

-- 1a) (re)crear las ESTRICTAS -------------------------------------------------
DROP POLICY IF EXISTS informes_select ON informes;
CREATE POLICY informes_select ON informes FOR SELECT
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin() OR lower(email) = public.pw_email());

DROP POLICY IF EXISTS informes_insert ON informes;
CREATE POLICY informes_insert ON informes FOR INSERT
  WITH CHECK (coach_id = public.pw_coach_id() OR public.pw_is_admin());

DROP POLICY IF EXISTS informes_update ON informes;
CREATE POLICY informes_update ON informes FOR UPDATE
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin())
  WITH CHECK (coach_id = public.pw_coach_id() OR public.pw_is_admin());

DROP POLICY IF EXISTS informes_delete ON informes;
CREATE POLICY informes_delete ON informes FOR DELETE
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin());

-- 1b) sacar las ABIERTAS/legacy (esto es lo que cerraba la fuga) --------------
DROP POLICY IF EXISTS informes_anon_all    ON informes;
DROP POLICY IF EXISTS informes_anon_select ON informes;
DROP POLICY IF EXISTS informes_anon_insert ON informes;
DROP POLICY IF EXISTS informes_anon_update ON informes;
DROP POLICY IF EXISTS "public insert"      ON informes;

-- ════════════════════════════════════════════════════════════════════════════
-- 2) cv_publicados   (el cliente publica/edita su propio CV → lo cubre pw_email)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE cv_publicados ENABLE ROW LEVEL SECURITY;

-- 2a) (re)crear las ESTRICTAS -------------------------------------------------
DROP POLICY IF EXISTS cv_publicados_select ON cv_publicados;
CREATE POLICY cv_publicados_select ON cv_publicados FOR SELECT
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin() OR lower(email) = public.pw_email());

DROP POLICY IF EXISTS cv_publicados_insert ON cv_publicados;
CREATE POLICY cv_publicados_insert ON cv_publicados FOR INSERT
  WITH CHECK (lower(email) = public.pw_email() OR coach_id = public.pw_coach_id() OR public.pw_is_admin());

DROP POLICY IF EXISTS cv_publicados_update ON cv_publicados;
CREATE POLICY cv_publicados_update ON cv_publicados FOR UPDATE
  USING (lower(email) = public.pw_email() OR coach_id = public.pw_coach_id() OR public.pw_is_admin())
  WITH CHECK (lower(email) = public.pw_email() OR coach_id = public.pw_coach_id() OR public.pw_is_admin());

DROP POLICY IF EXISTS cv_publicados_delete ON cv_publicados;
CREATE POLICY cv_publicados_delete ON cv_publicados FOR DELETE
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin());

-- 2b) sacar las ABIERTAS/legacy ----------------------------------------------
DROP POLICY IF EXISTS cvpub_anon_update                 ON cv_publicados;
DROP POLICY IF EXISTS cvpub_anon_select                 ON cv_publicados;
DROP POLICY IF EXISTS cvpub_anon_insert                 ON cv_publicados;
DROP POLICY IF EXISTS "public insert cv"                ON cv_publicados;
DROP POLICY IF EXISTS "candidato_puede_actualizar_su_cv" ON cv_publicados;

-- ════════════════════════════════════════════════════════════════════════════
-- 3) VERIFICACIÓN — correr APARTE, con la anon key (no logueado). Esperado: 0.
-- ════════════════════════════════════════════════════════════════════════════
--   SELECT count(*) AS anon_ve_informes FROM informes;       -- esperado: 0
--   SELECT count(*) AS anon_ve_cv       FROM cv_publicados;  -- esperado: 0
-- Y confirmar que NO quedó ninguna política abierta:
--   SELECT tablename, policyname, cmd, qual FROM pg_policies
--   WHERE tablename IN ('informes','cv_publicados') AND (qual='true' OR with_check='true');
--   -- esperado: 0 filas

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (SOLO si algún flujo legítimo se rompe y hay que reabrir YA)
-- ════════════════════════════════════════════════════════════════════════════
--   CREATE POLICY informes_anon_all ON informes
--     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY cvpub_anon_select ON cv_publicados
--     FOR SELECT TO anon, authenticated USING (true);
--   CREATE POLICY cvpub_anon_update ON cv_publicados
--     FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
-- (Reabrir es volver a la fuga: usar solo como parche temporal y volver a cerrar.)
