-- P0 · C-3b (4/4) — fijar el search_path de `pw_notify_new_client`.
--
-- MISMO PATRON QUE C-3b, DEMOSTRADO:
-- · SECURITY DEFINER (owner postgres) · proconfig = NULL · advisor function_search_path_mutable
-- · Es la funcion del trigger `candidatos.pw_after_candidato_insert`.
-- · EXECUTE incluye `anon` — el alta de candidato por formulario es anonima —,
--   asi que el search_path mutable era alcanzable sin autenticar.
-- · Cuerpo: unica llamada externa `net.http_post(...)`, CUALIFICADA a dos partes
--   (schema `net` verificado en catalogo). El resto, builtins de pg_catalog.
--   => No depende de ningun otro search_path. Cambio no-op funcional.
-- · Se usa ALTER FUNCTION: NO se toca una sola linea del cuerpo.
--
-- NO SE TOCA `sync_activo_con_estado_sub`, la cuarta de la lista del advisor:
-- es SECURITY INVOKER, no DEFINER, asi que queda FUERA del patron autorizado.
--
-- ROLLBACK
--   ALTER FUNCTION public.pw_notify_new_client() RESET search_path;

ALTER FUNCTION public.pw_notify_new_client()
  SET search_path = public;