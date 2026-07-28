-- ===================================================================
-- rls_mensajes_admin_coach.sql — CIERRA una fuga real.
--
-- Antes: la tabla mensajes_admin_coach tenía UNA sola política
--   `mensajes_admin_coach_all`  →  roles {public}, cmd ALL, USING (true)
-- Es decir: CUALQUIERA con la anon key (que está en el frontend, a la vista)
-- podía LEER, ESCRIBIR, ACTUALIZAR y BORRAR todos los mensajes del chat
-- admin↔coach — sin estar logueado. Fuga confirmada al auditar las políticas.
--
-- Ahora: mismo patrón que `candidatos` (que ya está bien cerrado):
--   · Cada coach ve/escribe SOLO su propio hilo  (coach_id = pw_coach_id())
--   · El admin ve/escribe todo                    (pw_is_admin())
--   · Un anónimo (sin JWT) → pw_coach_id() = null → no matchea nada → 0 filas.
--
-- El panel ya manda el JWT del coach en TODAS las lecturas y escrituras
-- (_sb / _sbw → _hdr → PWAUTH.headers), así que pw_coach_id()/pw_is_admin()
-- resuelven bien y el chat sigue funcionando. Sin JWT válido, no hay acceso.
--
-- Deploy: se aplica sola al mergear a main (workflow supabase-migrations),
-- o a mano en Supabase → SQL Editor pegando este archivo.
-- ===================================================================

ALTER TABLE mensajes_admin_coach ENABLE ROW LEVEL SECURITY;

-- Fuera la política abierta.
DROP POLICY IF EXISTS mensajes_admin_coach_all ON mensajes_admin_coach;

-- Lectura: tu hilo (coach) o todo (admin).
DROP POLICY IF EXISTS mensajes_admin_coach_select ON mensajes_admin_coach;
CREATE POLICY mensajes_admin_coach_select ON mensajes_admin_coach FOR SELECT
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin());

-- Alta: solo en tu propio hilo (coach) o en cualquiera (admin).
DROP POLICY IF EXISTS mensajes_admin_coach_insert ON mensajes_admin_coach;
CREATE POLICY mensajes_admin_coach_insert ON mensajes_admin_coach FOR INSERT
  WITH CHECK (coach_id = public.pw_coach_id() OR public.pw_is_admin());

-- Actualización (marcar leído, leido_en): tu hilo o admin.
DROP POLICY IF EXISTS mensajes_admin_coach_update ON mensajes_admin_coach;
CREATE POLICY mensajes_admin_coach_update ON mensajes_admin_coach FOR UPDATE
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin())
  WITH CHECK (coach_id = public.pw_coach_id() OR public.pw_is_admin());

-- Borrado: solo el admin (nadie más necesita borrar el historial).
DROP POLICY IF EXISTS mensajes_admin_coach_delete ON mensajes_admin_coach;
CREATE POLICY mensajes_admin_coach_delete ON mensajes_admin_coach FOR DELETE
  USING (public.pw_is_admin());
