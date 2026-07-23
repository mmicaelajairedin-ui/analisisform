-- ============================================================================
-- usuarios_admin_fix.sql — ROOT FIX del RLS que bloqueaba al ADMIN
-- ============================================================================
-- SÍNTOMA (días con esto): el admin no puede "Extender trial" ni "Marcar pagado"
-- de un coach desde el panel. El PATCH a usuarios (configuracion: estado_sub /
-- fecha_fin_prueba, activo) "no hace nada" o "no deja".
--
-- CAUSA RAÍZ (no es la sesión): usuarios_hardening.sql ASUME que existe una
-- política `coach_ve_todo` (FOR ALL para el admin) y por eso NO la crea
-- ("Se CONSERVAN: usuario_ve_solo_su_fila y coach_ve_todo"). Pero NINGUNA
-- migración de este repo la crea. Si en tu proyecto esa política no existe (o se
-- perdió), el admin se queda SIN ninguna policy de UPDATE que matchee la fila de
-- un COACH:
--   · usuarios_self_update           → solo TU propia fila (y rol <> 'admin')
--   · usuarios_coach_gestiona_cliente → solo filas rol='cliente' del coach
--   · usuarios_activacion_anon        → solo filas sin contraseña (invitados)
-- Ninguna cubre "admin edita a un coach" → el UPDATE afecta 0 filas → falla.
-- (Con RLS, un UPDATE que no matchea NO es error de permiso: simplemente no
--  escribe. Por eso el panel, que ahora VERIFICA el guardado, lo reporta como
--  "no se pudo".)
--
-- FIX: crear el set de políticas de ADMIN en usuarios usando pw_is_admin().
-- Las políticas son PERMISSIVE (se combinan con OR), así que esto SOLO AGREGA
-- capacidad al admin — no afloja nada para anon/coach/cliente. Idempotente.
--
-- REQUISITO para que surta efecto: el admin tiene que entrar con su sesión de
-- Supabase Auth y su fila usuarios debe tener auth_id = su auth.uid() (lo enlaza
-- login.html vía pw_link_auth_id al iniciar sesión). pw_is_admin() lee:
--     SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin'
-- Si el admin arrastra una sesión vieja (sin JWT), pw_is_admin() da false aunque
-- exista la política → cerrar sesión y volver a entrar UNA vez deja el auth_id
-- enlazado y a partir de ahí todo funciona.
--
-- Deploy: correr este SQL en Supabase (SQL Editor). Después, el admin re-loguea
-- una vez y prueba Extender trial / Marcar pagado.
-- ============================================================================

-- Helper (idempotente; igual al de rls_strict.sql / rls_close_*). SECURITY
-- DEFINER: lee usuarios sin chocar con la RLS de la propia tabla (no recursion).
CREATE OR REPLACE FUNCTION public.pw_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin'
  )
$$;
GRANT EXECUTE ON FUNCTION public.pw_is_admin() TO anon, authenticated;

-- RLS ya debería estar activo (usuarios_hardening). Idempotente por las dudas.
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- ── Política de ADMIN: gestiona CUALQUIER usuario (coaches incluidos) ─────────
-- FOR ALL cubre SELECT/INSERT/UPDATE/DELETE en un solo lugar. Reemplaza/crea la
-- que usuarios_hardening daba por sentada (coach_ve_todo).
DROP POLICY IF EXISTS usuarios_admin_all ON usuarios;
CREATE POLICY usuarios_admin_all ON usuarios FOR ALL
  TO authenticated
  USING (public.pw_is_admin())
  WITH CHECK (public.pw_is_admin());

-- ============================================================================
-- VERIFICACIÓN (correr después, como el ADMIN logueado en el panel):
--   1) En el panel: Extender trial +30 y Marcar pagado de un coach de prueba → OK.
--   2) En SQL Editor, confirmar que la política quedó:
--        SELECT policyname, cmd, roles FROM pg_policies
--        WHERE tablename = 'usuarios' AND policyname = 'usuarios_admin_all';
--   3) Sanidad anti-fuga (como ANON, sin login): que un coach de prueba NO pueda
--      marcarse pagado a sí mismo con la anon key:
--        -- PATCH /usuarios?id=eq.<coach> {configuracion:{estado_sub:'activa'}}
--        -- esperado: 0 filas / denegado (usuarios_admin_all pide pw_is_admin()).
-- ============================================================================
-- ROLLBACK (si hiciera falta): DROP POLICY IF EXISTS usuarios_admin_all ON usuarios;
-- ============================================================================
