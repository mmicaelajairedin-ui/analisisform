-- P0 · C-3b (3/4) — fijar el search_path de `notify_nuevo_contacto`.
--
-- MISMO PATRON QUE C-3b, DEMOSTRADO:
-- · SECURITY DEFINER (owner postgres) · proconfig = NULL · advisor function_search_path_mutable
-- · Es la funcion del trigger `contactos_chat.trg_notify_contacto`.
-- · EXECUTE incluye `anon` — el trigger corre en el INSERT publico de leads —,
--   lo que hace que el search_path mutable SI sea alcanzable por un no autenticado.
-- · Cuerpo: la unica llamada externa es `net.http_post(...)`, CUALIFICADA a dos
--   partes. Verificado en catalogo: el schema `net` existe y `net.http_post`
--   tambien. Una referencia cualificada no se resuelve por search_path, asi que
--   fijarlo NO puede cambiar a que objeto apunta. El resto —jsonb_build_object,
--   coalesce— son builtins de pg_catalog, siempre implicito.
--   => No depende de ningun otro search_path. Cambio no-op funcional.
-- · Se usa ALTER FUNCTION: NO se toca una sola linea del cuerpo.
--   (En el cuerpo hay una anon key incrustada. NO se toca: modificarla seria
--    cambiar el cuerpo, fuera de la frontera autorizada. Queda documentada.)
--
-- ROLLBACK
--   ALTER FUNCTION public.notify_nuevo_contacto() RESET search_path;

ALTER FUNCTION public.notify_nuevo_contacto()
  SET search_path = public;