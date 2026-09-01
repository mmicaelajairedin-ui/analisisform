-- P0 · C-3a — endurecer `ranking_mensual`.
--
-- QUE CIERRA
-- La tabla tenia `relrowsecurity = false`: su unica policy (`ranking_mensual_select`)
-- estaba HUERFANA, nunca se evaluaba, y mandaban los GRANT. Con la anon key
-- publica se podia SELECT, INSERT, UPDATE, DELETE y TRUNCATE el podio.
-- Dos advisors en nivel ERROR: `rls_disabled_in_public` y `policy_exists_rls_disabled`.
--
-- POR QUE NO ROMPE NADA
-- No hay ningun consumidor anonimo:
--   · lectura  → panel-v2.html:10903/10904 via `_sb()` → `_hdr()` → PWAUTH.headers() = JWT
--   · escritura→ SOLO `rpc/pw_add_month_pts` (panel-v2.html:10899) via `_hdr()` = JWT
-- `pw_add_month_pts` es SECURITY DEFINER y su owner es `postgres` (superusuario),
-- asi que sigue escribiendo con la RLS encendida: no necesita policy de INSERT/UPDATE.
--
-- QUE NO SE TOCA, A PROPOSITO
-- · El GRANT de SELECT a anon se DEJA: con la RLS encendida y sin policy para
--   anon, la lectura ya devuelve 0 filas. Revocar el privilegio cambiaria 200-con-
--   cero-filas por 403 y es un cambio de comportamiento innecesario para contener.
-- · No se toca `pw_add_month_pts` aqui (va en su propia migracion).
--
-- ROLLBACK
--   ALTER TABLE public.ranking_mensual DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS ranking_mensual_select_auth ON public.ranking_mensual;
--   CREATE POLICY ranking_mensual_select ON public.ranking_mensual
--     FOR SELECT TO anon USING (true);
--   GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.ranking_mensual TO anon;

ALTER TABLE public.ranking_mensual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ranking_mensual_select ON public.ranking_mensual;

CREATE POLICY ranking_mensual_select_auth ON public.ranking_mensual
  FOR SELECT TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ranking_mensual FROM anon;