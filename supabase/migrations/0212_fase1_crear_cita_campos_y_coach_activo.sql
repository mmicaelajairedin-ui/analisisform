-- FASE 1 — `crear_cita` pasa a cubrir el payload real de reservar.html.
--
-- Por que DROP + CREATE y no CREATE OR REPLACE: anadir parametros cambia la
-- firma, asi que REPLACE dejaria DOS sobrecargas vivas y PostgREST no sabria
-- cual invocar. Verificado antes de borrar: `crear_cita` no tenia NINGUN
-- llamador (ni repo, ni edge functions, ni scripts, ni tests).
--
-- Cambios respecto a la version anterior:
--   1. Acepta los 8 campos que hoy manda reservar.html por INSERT directo.
--   2. Valida que el coach este ACTIVO (antes solo comprobaba que existiera:
--      medido, crear_cita() contra un coach inactivo devolvia exito).
--   3. `org_id` se DERIVA aqui, en la misma consulta que valida el coach. Ya no
--      se delega en el trigger citas_set_org_id: el trigger no es una frontera
--      de seguridad (solo rellena cuando llega NULL, asi que un valor impuesto
--      sobrevive). Aqui el navegador no puede imponerlo porque no existe
--      parametro para ello.
--   4. La comprobacion de hueco pasa de `estado <> 'cancelada'` a
--      `IS DISTINCT FROM`, para que una fila con estado NULL tambien ocupe el
--      hueco. (NULL <> 'cancelada' es NULL, es decir "no ocupado": era la via
--      para colar citas invisibles.)
--
-- Se MANTIENE: estado='pendiente', grupal=false, token server-side, validacion
-- de email, fecha futura, disponibilidad, y el contrato de retorno
-- (id, token, inicio) exactamente igual.
--
-- NO se toca ninguna policy en esta fase.

DROP FUNCTION IF EXISTS public.crear_cita(text, text, text, text, timestamptz, text);

CREATE FUNCTION public.crear_cita(
  p_coach_id        text,
  p_nombre          text,
  p_email           text,
  p_tipo            text,
  p_inicio          timestamptz,
  p_cliente_tz      text  DEFAULT NULL,
  p_telefono        text  DEFAULT NULL,
  p_origen          text  DEFAULT NULL,
  p_modalidad       text  DEFAULT NULL,
  p_video_proveedor text  DEFAULT NULL,
  p_lugar           text  DEFAULT NULL,
  p_lang            text  DEFAULT NULL,
  p_respuestas      jsonb DEFAULT NULL,
  p_kind            text  DEFAULT NULL
)
RETURNS TABLE (id bigint, token text, inicio timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id     bigint;
  v_token  text;
  v_org    uuid;
  v_activo boolean;
BEGIN
  IF p_coach_id IS NULL
     OR btrim(p_coach_id) = ''
     OR p_inicio IS NULL
     OR p_inicio < now()
  THEN
    RAISE EXCEPTION 'datos_invalidos';
  END IF;

  IF p_email IS NULL
     OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;

  -- Coach: existencia, estado y organizacion en una sola lectura.
  SELECT u.activo, u.org_id
    INTO v_activo, v_org
  FROM public.usuarios u
  WHERE u.id::text = p_coach_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coach_inexistente';
  END IF;

  IF v_activo IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'coach_inactivo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.citas c
    WHERE c.coach_id = p_coach_id
      AND c.inicio = p_inicio
      AND c.estado IS DISTINCT FROM 'cancelada'
  )
  THEN
    RAISE EXCEPTION 'hueco_ocupado';
  END IF;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  INSERT INTO public.citas (
    coach_id, org_id, nombre, email, tipo, inicio,
    estado, grupal, cliente_tz, token,
    telefono, origen, modalidad, video_proveedor, lugar, lang, respuestas, kind
  )
  VALUES (
    p_coach_id,
    v_org,                                   -- derivado, nunca del cliente
    btrim(p_nombre),
    lower(btrim(p_email)),
    p_tipo,
    p_inicio,
    'pendiente',                             -- fijo
    false,                                   -- fijo
    p_cliente_tz,
    v_token,                                 -- generado aqui
    p_telefono,
    p_origen,
    coalesce(nullif(btrim(coalesce(p_modalidad, '')), ''), 'online'),
    p_video_proveedor,
    p_lugar,
    CASE WHEN p_lang IN ('es', 'en') THEN p_lang ELSE NULL END,
    p_respuestas,
    -- Lista blanca: son los dos unicos valores que produce reservar.html.
    CASE WHEN p_kind IN ('primera_llamada', 'demo_pathway') THEN p_kind ELSE NULL END
  )
  RETURNING citas.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token, p_inicio;
END;
$function$;

-- Privilegios explicitos: Supabase concede por defecto a anon/authenticated como
-- entradas ACL propias, asi que el REVOKE a PUBLIC no basta (lo aprendimos con
-- org_marca_propia). Se fija el conjunto exacto.
REVOKE ALL ON FUNCTION public.crear_cita(text,text,text,text,timestamptz,text,text,text,text,text,text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_cita(text,text,text,text,timestamptz,text,text,text,text,text,text,text,jsonb,text) TO anon, authenticated;
