-- FASE 1-ter — La URL de Zoom derivada tiene que ser una SALA, no un chat.
--
-- La 1-bis leia usuarios.configuracion->>'zoom_url' y la guardaba con solo pedir
-- que empezara por https. Insuficiente: el unico coach con zoom_url configurado
-- tiene guardado un enlace de CHAT
-- (https://us05web.zoom.us/launch/chat?src=direct_chat_link...), que no abre
-- ninguna reunion. El repositorio ya arreglo ese bug una vez en el navegador
-- (pw-modalidad.js:156 `zoomEsSala`, y el comentario de reservar.html:446: "asi
-- es como un enlace de CHAT de Zoom acabo enviandose como videollamada").
-- Derivarla en el servidor sin la misma validacion lo habria reintroducido.
--
-- Se replica `zoomEsSala`: host zoom.us o zoomgov.com, y ruta /j/<6+ digitos>,
-- /w/<6+ digitos> o /my/<nombre>. Cualquier otra cosa -> meet_link NULL, que es
-- exactamente lo que hace hoy el navegador (cae a otro proveedor).
--
-- Misma firma -> CREATE OR REPLACE, sin DROP ni sobrecargas.

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

  -- Espejo de pw-modalidad.js `zoomEsSala`. El enlace es del coach, no del
  -- visitante, y ademas tiene que ser una sala de verdad.
  v_meet := CASE
              WHEN p_video_proveedor = 'zoom'
               AND v_zoom ~* '^https://([a-z0-9-]+\.)*(zoom\.us|zoomgov\.com)(/(j|w)/[0-9]{6,}|/my/[A-Za-z0-9._-]+)'
              THEN v_zoom
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
    v_org,
    btrim(p_nombre),
    lower(btrim(p_email)),
    p_tipo,
    p_inicio,
    'pendiente',
    false,
    p_cliente_tz,
    v_token,
    p_telefono,
    p_origen,
    coalesce(nullif(btrim(coalesce(p_modalidad, '')), ''), 'online'),
    p_video_proveedor,
    p_lugar,
    CASE WHEN p_lang IN ('es', 'en') THEN p_lang ELSE NULL END,
    p_respuestas,
    CASE WHEN p_kind IN ('primera_llamada', 'demo_pathway') THEN p_kind ELSE NULL END,
    v_meet
  )
  RETURNING citas.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token, p_inicio;
END;
$function$;