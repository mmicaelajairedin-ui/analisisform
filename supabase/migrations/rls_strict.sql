-- ============================================================================
-- Fase 3 del cierre de RLS — Candado estricto en las tablas con datos personales
-- ============================================================================
-- Cierra el GAP DE SEGURIDAD: hoy cualquiera con la anon key (pública en el JS
-- del navegador) puede hacer  fetch('/rest/v1/candidatos?select=*')  y bajarse
-- TODOS los candidatos de TODOS los coaches. Esta migration activa RLS estricto
-- en candidatos / informes / cv_publicados.
--
-- ⚠️ NO CORRER hasta haber deployado y PROBADO la Fase A (frontend con sesión
--    autenticada: pw-auth.js + login.html con signInWithPassword + panel-v2 /
--    cliente / cv / carta usando PWAUTH.headers()). Si se corre antes, el panel
--    y el portal del cliente dejan de ver datos.
--
-- ORDEN DE ROLLOUT (ver runbook al final):
--   1) Deploy Fase A a producción.
--   2) Verificar: coach entra al panel y ve sus clientes; cliente entra y ve su
--      portal; un candidato nuevo completa el formulario y se guarda.
--   3) Recién entonces correr ESTE archivo en Supabase → SQL Editor.
--   4) Re-verificar lo mismo. Si algo falla → ROLLBACK (al final del archivo).
--
-- Modelo de identidad:
--   auth.uid()  = id de la fila en auth.users (Supabase Auth)
--   usuarios.auth_id = auth.uid()  (lo setea la migración perezosa del login)
--   candidatos.coach_id = usuarios.id  (el dueño de los datos)
--   un CLIENTE accede a su propia fila por email (auth.email() == candidatos.email)
-- ============================================================================

-- ── Helpers (SECURITY DEFINER para no chocar con RLS al resolver identidad) ──
-- Son STABLE + SECURITY DEFINER: corren con privilegios del owner, así que la
-- subconsulta sobre usuarios no queda bloqueada por la RLS del propio usuario
-- (evita recursión / “no veo nada”).

CREATE OR REPLACE FUNCTION public.pw_coach_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.pw_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.pw_email()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

GRANT EXECUTE ON FUNCTION public.pw_coach_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pw_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pw_email()   TO anon, authenticated;

-- ============================================================================
-- candidatos
-- ============================================================================
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;

-- Lectura: el coach dueño, el admin, o el propio candidato (por email).
DROP POLICY IF EXISTS candidatos_select ON candidatos;
CREATE POLICY candidatos_select ON candidatos FOR SELECT
  USING (
    coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
    OR lower(email) = public.pw_email()
  );

-- Alta: ANÓNIMA permitida (el formulario de intake lo completa gente que NO
-- está logueada). Es write-only: insertar no deja leer filas ajenas.
-- IMPORTANTE: el intake debe usar INSERT (no upsert merge-duplicates), porque
-- merge-duplicates haría un UPDATE en conflicto y eso pediría policy de UPDATE
-- para anon. Usar  Prefer: resolution=ignore-duplicates  (ya cambiado en
-- formulario.html). Así no hace falta dar UPDATE a anon.
DROP POLICY IF EXISTS candidatos_insert ON candidatos;
CREATE POLICY candidatos_insert ON candidatos FOR INSERT
  WITH CHECK (true);

-- Update: coach dueño, admin, o el propio candidato (edita su foto, progreso…).
DROP POLICY IF EXISTS candidatos_update ON candidatos;
CREATE POLICY candidatos_update ON candidatos FOR UPDATE
  USING (
    coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
    OR lower(email) = public.pw_email()
  )
  WITH CHECK (
    coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
    OR lower(email) = public.pw_email()
  );

-- Borrado: solo coach dueño o admin.
DROP POLICY IF EXISTS candidatos_delete ON candidatos;
CREATE POLICY candidatos_delete ON candidatos FOR DELETE
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin());

-- ============================================================================
-- informes   (tiene coach_id + email; los inserta la edge function
--             generar-informe con service_role → bypassea RLS)
-- ============================================================================
ALTER TABLE informes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS informes_select ON informes;
CREATE POLICY informes_select ON informes FOR SELECT
  USING (
    coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
    OR lower(email) = public.pw_email()
  );

-- Insert/update desde el frontend solo coach/admin (la edge function usa
-- service_role y no pasa por estas policies).
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

-- ============================================================================
-- cv_publicados   (coach_id + email; el cliente publica su propio CV)
-- ============================================================================
ALTER TABLE cv_publicados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cv_publicados_select ON cv_publicados;
CREATE POLICY cv_publicados_select ON cv_publicados FOR SELECT
  USING (
    coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
    OR lower(email) = public.pw_email()
  );

DROP POLICY IF EXISTS cv_publicados_insert ON cv_publicados;
CREATE POLICY cv_publicados_insert ON cv_publicados FOR INSERT
  WITH CHECK (
    lower(email) = public.pw_email()
    OR coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
  );

DROP POLICY IF EXISTS cv_publicados_update ON cv_publicados;
CREATE POLICY cv_publicados_update ON cv_publicados FOR UPDATE
  USING (
    lower(email) = public.pw_email()
    OR coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
  )
  WITH CHECK (
    lower(email) = public.pw_email()
    OR coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
  );

DROP POLICY IF EXISTS cv_publicados_delete ON cv_publicados;
CREATE POLICY cv_publicados_delete ON cv_publicados FOR DELETE
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin());

-- ============================================================================
-- usuarios  →  NO se toca en esta migration (a propósito)
-- ============================================================================
-- Bloquear la lectura anónima de usuarios rompería:
--   • el login viejo (login.html consulta usuarios?email=eq&password_hash=eq
--     con la anon key ANTES de tener sesión), y
--   • formulario.html / coach.html que leen la config pública de coaches.
-- El dato sensible de usuarios es password_hash. El cierre correcto es:
--   1) Migrar login.html para que NO consulte password_hash con anon, sino que
--      llame siempre a migrate-user-to-auth (verifica server-side con
--      service_role) y después signInWithPassword.
--   2) Recién entonces: ENABLE RLS en usuarios + policies (perfil público de
--      coaches legible, password_hash nunca expuesto).
-- Queda como Fase 4 (otra migration), para no romper el login en este paso.

-- ============================================================================
-- VERIFICACIÓN (correr como anon para confirmar el candado)
-- ============================================================================
-- Con la anon key, esto AHORA debe devolver 0 filas (antes devolvía todo):
--   SELECT count(*) FROM candidatos;     -- esperado: 0 sin sesión
-- Logueado como coach (JWT), debe devolver SOLO sus candidatos.
-- Logueado como admin, todos.

-- ============================================================================
-- ROLLBACK (si algo se rompe en producción, pegar esto y listo)
-- ============================================================================
-- ALTER TABLE candidatos    DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE informes      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE cv_publicados DISABLE ROW LEVEL SECURITY;
