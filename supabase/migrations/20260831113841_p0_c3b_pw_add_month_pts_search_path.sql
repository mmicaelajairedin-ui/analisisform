-- P0 · C-3b — fijar el search_path de `pw_add_month_pts`.
--
-- QUE CIERRA
-- La funcion es SECURITY DEFINER (corre como `postgres`) y su `proconfig` era
-- NULL: sin `search_path` fijo, el schema de resolucion lo elige quien llama.
-- Advisor `function_search_path_mutable`.
--
-- POR QUE NO ROMPE NADA
-- El cuerpo solo referencia `ranking_mensual`, que vive en `public`. Con
-- `search_path = public` resuelve exactamente al mismo objeto que hoy.
-- Es un cambio de metadatos: NO altera el cuerpo (se usa ALTER FUNCTION, no
-- CREATE OR REPLACE, para no reescribir una linea de logica).
--
-- QUE NO SE TOCA, A PROPOSITO
-- · NO se anade la validacion de identidad (C-3c). `p_coach` sigue siendo un
--   parametro libre. Esa correccion esta explicitamente NO autorizada hasta
--   determinar si existe un flujo legitimo que sume puntos a terceros.
--
-- ROLLBACK
--   ALTER FUNCTION public.pw_add_month_pts(text,text,integer,text) RESET search_path;

ALTER FUNCTION public.pw_add_month_pts(text, text, integer, text)
  SET search_path = public;