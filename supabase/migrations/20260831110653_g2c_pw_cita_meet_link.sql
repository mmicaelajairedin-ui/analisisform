-- G2-C · panel-v2.html — el enlace de video de una cita recien creada.
--
-- `_sendAgEmailDelayed` sondeaba `citas?id=eq.<n>&select=meet_link` con la anon
-- key. El panel es una pantalla autenticada: no habia ninguna razon para pedirlo
-- como anonimo, y con `citas_anon_select` retirado dejaria de funcionar.
--
-- SECURITY INVOKER a proposito: asi la visibilidad la sigue decidiendo la RLS de
-- `citas` (rls_citas_coach_network para el coach dueno, rls_citas_owner_select
-- para el owner/admin de la organizacion), sin duplicar aqui esa logica ni
-- saltarsela. La funcion solo estrecha el resultado a UNA columna.
--
-- EXECUTE solo para `authenticated`: los ids de `citas` son bigint correlativos,
-- de modo que una version ejecutable por anon seria un enumerador de enlaces de
-- videollamada. Sin sesion no se responde.
--
-- OJO con el REVOKE a anon: no basta con quitar el EXECUTE de PUBLIC. Este
-- proyecto tiene un ALTER DEFAULT PRIVILEGES de `postgres` sobre `public` que
-- concede EXECUTE a anon, authenticated y service_role a TODA funcion nueva, o
-- sea que nace con un grant DIRECTO a anon. Medido en el catalogo al crearla.
--
-- Aplicada en produccion el 2026-08-31 (20260831110653 + 20260831110723).
CREATE OR REPLACE FUNCTION public.pw_cita_meet_link(p_cita_id bigint)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT c.meet_link
  FROM public.citas c
  WHERE p_cita_id IS NOT NULL
    AND c.id = p_cita_id
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.pw_cita_meet_link(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pw_cita_meet_link(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.pw_cita_meet_link(bigint) TO authenticated;
