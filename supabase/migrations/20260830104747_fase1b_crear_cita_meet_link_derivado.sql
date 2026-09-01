-- FASE 1-bis — Correccion de una omision de la Fase 1: `meet_link`.
--
-- Al preparar la Fase 2 se vio que reservar.html escribe `meet_link` en el
-- propio INSERT, pero SOLO cuando el proveedor es zoom (reservar.html:1000).
-- `crear_cita` no lo cubria, asi que migrar el frontend habria dejado sin enlace
-- las reservas de Zoom, y `recordatorios-citas` habria mandado el correo sin
-- sitio al que entrar.
--
-- No se anade parametro. La URL de Zoom es del COACH, no del visitante: se lee
-- de usuarios.configuracion->>'zoom_url' en la misma consulta que ya valida al
-- coach. Aceptarla del navegador habria abierto un vector de phishing —
-- reservar a nombre de un tercero con un enlace arbitrario, que el recordatorio
-- automatico le enviaria. Con esto el navegador no puede inyectar enlaces.
--
-- Solo se guarda si el proveedor pedido es 'zoom' y la URL configurada es https.
-- Misma firma que la Fase 1 -> CREATE OR REPLACE, sin DROP y sin sobrecargas.

CREATE OR REPLACE FUNCTION public.crear_cita(
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
  v_zoom   text;
  v_meet   text;
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

  -- Coach: existencia, estado, organizacion y su URL de Zoom en una sola lectura.
  SELECT u.activo, u.org_id, nullif(btrim(coalesce(u.configuracion->>'zoom_url','')), '')
    INTO v_activo, v_org, v_zoom
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

  -- El enlace sale de la configuracion del coach, nunca del cuerpo de la peticion.
  v_meet := CASE
              WHEN p_video_proveedor = 'zoom' AND v_zoom ~ '^https://' THEN v_zoom
              ELSE NULL
            END;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  INSERT INTO public.citas (
    coach_id, org_id, nombre, email, tipo, inicio,
    estado, grupal, cliente_tz, token,
    telefono, origen, modalidad, video_proveedor, lugar, lang, respuestas, kind,
    meet_link
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
    CASE WHEN p_kind IN ('primera_llamada', 'demo_pathway') THEN p_kind ELSE NULL END,
    v_meet                                   -- derivado del coach
  )
  RETURNING citas.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token, p_inicio;
END;
$function$;