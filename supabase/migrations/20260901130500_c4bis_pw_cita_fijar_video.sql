-- C-4-bis · `reservar.html` deja de intentar un PATCH anonimo para guardar el
-- video que se acabo usando.
--
-- QUE ARREGLA
-- `_persistir()` hacia `PATCH /rest/v1/citas?id=eq.<id>` con la anon key para
-- dejar en la fila el `video_proveedor` y el `meet_link` REALES (los que se
-- resuelven DESPUES del alta: el caso Meet->Sala solo se conoce cuando Google
-- responde). Ninguna policy de UPDATE aplica a `anon`, asi que la peticion
-- afectaba 0 filas, devolvia 200 y un `.catch` vacio remataba el silencio.
--
-- Medido antes del arreglo: de 65 citas creadas por `reservar.html`, solo 1
-- tenia `video_proveedor` y 2 `meet_link` — y esos 2 son el caso Zoom, que se
-- escribe en el INSERT. El PATCH posterior no aterrizo practicamente nunca.
--
-- POR QUE POR TOKEN Y NO REABRIENDO EL UPDATE
-- Reabrir UPDATE a `anon` sobre `citas` deshace lo que se acaba de cerrar en C-1
-- y le daria a cualquiera capacidad de escritura sobre la tabla. El token de la
-- cita ya lo tiene quien acaba de reservar —lo devuelve `crear_cita`— y es
-- secreto, largo y de un solo uso logico: es la misma frontera que ya usan
-- `cancelar_cita_by_token` y `get_cita_by_token`.
--
-- LO QUE LA FUNCION NO DEJA HACER
-- · Solo toca DOS columnas. Nada de fecha, coach, email, estado ni notas.
-- · `proveedor` va contra lista blanca; cualquier otro valor se rechaza.
-- · `meet_link` solo se acepta si es https. Un `javascript:` no entra.
-- · No toca citas canceladas ni completadas.
-- · No revela nada: devuelve un booleano.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.pw_cita_fijar_video(text, text, text);

CREATE OR REPLACE FUNCTION public.pw_cita_fijar_video(
  p_token     text,
  p_proveedor text,
  p_meet_link text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_filas integer := 0;
  v_prov  text;
  v_link  text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN false;
  END IF;

  v_prov := lower(btrim(coalesce(p_proveedor, '')));
  IF v_prov NOT IN ('sala', 'meet', 'zoom', 'presencial') THEN
    RETURN false;
  END IF;

  -- Solo https. Sin esto, quien tuviera el token podria dejar un `javascript:`
  -- en el enlace que el coach pulsa desde su panel.
  v_link := nullif(btrim(coalesce(p_meet_link, '')), '');
  IF v_link IS NOT NULL AND v_link !~* '^https://' THEN
    RETURN false;
  END IF;

  UPDATE public.citas c
     SET video_proveedor = v_prov,
         meet_link       = coalesce(v_link, c.meet_link)
   WHERE c.token = p_token
     AND c.estado NOT IN ('cancelada', 'completada');

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.pw_cita_fijar_video(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pw_cita_fijar_video(text, text, text) TO anon, authenticated, service_role;
