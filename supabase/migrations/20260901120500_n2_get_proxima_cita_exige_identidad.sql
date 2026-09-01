-- N-2 · `get_proxima_cita` deja de ser un oraculo por email sin autenticar.
--
-- QUE CIERRA
-- La funcion es SECURITY DEFINER con EXECUTE para `anon` y su unico filtro era
-- `WHERE lower(c.email) = lower(trim(p_email))`. No miraba `auth.uid()` ni
-- `pw_email()`, asi que cualquiera con la anon key publica podia preguntar
-- "cuando es la proxima cita de <email>" de CUALQUIER persona. Devuelve 2
-- columnas y como mucho 1 fila, y no permite enumerar emails (filtra por
-- igualdad exacta), pero es informacion de terceros y no deberia salir.
--
-- LOS TRES CAMINOS LEGITIMOS QUE SE CONSERVAN
--   1. El propio cliente: `pw_email()` coincide con `p_email`. Es el caso de
--      cliente.html / pathway-fit-cliente.html / pathway-fin-cliente.html, que
--      llaman con `_hdr()` y adjuntan el JWT cuando hay sesion.
--   2. Admin: `pw_is_admin()`.
--   3. El coach de esa cita: `pw_coach_id()` coincide con `citas.coach_id`.
--
-- DOS MODOS DE FALLO DISTINTOS, Y ES DELIBERADO
--   · SIN identidad ninguna (anon) -> EXCEPTION con ERRCODE 42501, que PostgREST
--     traduce a HTTP 403. Es RUIDOSO a proposito: se ve en el panel de red, en
--     los edge logs y lo recoge `pw-observe.js` en `client_errors`. No se elige
--     devolver vacio para no anadir otro fallo silencioso a un sistema que ya
--     tiene cinco documentados.
--   · CON identidad pero pidiendo el email de otro -> 0 filas, sin error. Asi un
--     autenticado no puede distinguir "no tiene cita" de "no es suya", que es lo
--     que evita convertir el guard en un oraculo mas fino.
--
-- POR QUE ESTO NO ROMPE NINGUN PORTAL QUE HOY FUNCIONE
-- Un portal sin sesion de Supabase ya esta muerto ANTES de llegar aqui: se pinta
-- desde `candidatos`, que devuelve 0 filas a `anon` desde la Fase 3. Medido. Es
-- decir, el caso "portal funcionando sin sesion" no existe: si no hay sesion no
-- hay portal, y `_authExpired()` / `_authGone` ya estan para mandar al login.
-- Ademas, los tres consumidores se tragan cualquier respuesta no-OK
-- (`r.ok ? r.json() : []`), asi que el 403 no cambia nada de lo que ve el
-- usuario; solo lo hace visible para quien opera.
--
-- ALCANCE MEDIDO EN EL MOMENTO DEL CAMBIO
-- Citas futuras no canceladas en produccion: 0. La funcion no devuelve hoy ni
-- una fila a nadie, asi que el cambio no puede alterar ninguna pantalla ahora
-- mismo; el guard queda puesto para cuando vuelva a haber agenda.
--
-- ROLLBACK: recrear la funcion sin el bloque de identidad (el resto es identico).

CREATE OR REPLACE FUNCTION public.get_proxima_cita(p_email text)
RETURNS TABLE(inicio timestamp with time zone, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pedido text;
  v_yo     text;
BEGIN
  IF p_email IS NULL
     OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  THEN
    RETURN;
  END IF;

  v_pedido := lower(btrim(p_email));
  v_yo     := pw_email();

  -- Sin identidad ninguna: no se responde, y se dice en voz alta.
  IF coalesce(v_yo, '') = '' AND NOT pw_is_admin() THEN
    RAISE EXCEPTION 'sesion_requerida'
      USING ERRCODE = '42501',
            HINT = 'get_proxima_cita solo responde al propio cliente, a su coach o a un admin.';
  END IF;

  -- Con identidad, pero pidiendo lo de otro: 0 filas, indistinguible de "no hay".
  IF v_pedido IS DISTINCT FROM v_yo
     AND NOT pw_is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.citas c
        WHERE lower(c.email) = v_pedido
          AND c.coach_id = (pw_coach_id())::text
     )
  THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT c.inicio, c.estado
      FROM public.citas c
     WHERE lower(c.email) = v_pedido
       AND c.estado <> 'cancelada'
       AND c.inicio > now()
     ORDER BY c.inicio
     LIMIT 1;
END;
$function$;
