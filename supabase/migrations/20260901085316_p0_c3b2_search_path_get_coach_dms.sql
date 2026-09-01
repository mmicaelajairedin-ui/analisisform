-- P0 · C-3b (2/4) — fijar el search_path de `get_coach_dms`.
--
-- MISMO PATRON QUE C-3b, DEMOSTRADO:
-- · SECURITY DEFINER (owner postgres)  · proconfig = NULL  · advisor function_search_path_mutable
-- · Cuerpo: LANGUAGE sql. TODAS sus referencias van CUALIFICADAS —
--   `public.mensajes_dm`, `public.usuarios`— y el resto son builtins
--   (CASE, COALESCE, MAX) que viven en pg_catalog, siempre implicito.
--   => No depende de ningun otro search_path. El cambio es un no-op funcional.
-- · Se usa ALTER FUNCTION: NO se toca una sola linea del cuerpo.
-- · Consumidor: supabase/functions/canal-red/index.ts:199 (rpc/get_coach_dms).
-- · EXECUTE se deja como esta (authenticated, postgres, service_role).
--
-- ROLLBACK
--   ALTER FUNCTION public.get_coach_dms(uuid, uuid) RESET search_path;

ALTER FUNCTION public.get_coach_dms(uuid, uuid)
  SET search_path = public;