-- FASE 3 — `reprogramar_cita` conserva TODOS los campos relevantes.
--
-- Antes copiaba solo coach_id, nombre, email, tipo y cliente_tz. Perdia
-- telefono, origen, modalidad, video_proveedor, lugar, lang, respuestas, kind y
-- meet_link. Sin modalidad ni proveedor, `recordatorios-citas` cae en su rama de
-- compatibilidad y el correo de la cita reprogramada sale mal.
--
-- Criterio de cada campo: COALESCE(nuevo, viejo).
--   - Se CONSERVA lo que no se envia (de ahi "conservar los campos relevantes").
--   - GANA lo que se envia, porque en la reprogramacion reservar.html NO precarga
--     el formulario: el cliente reescribe nombre, telefono y respuestas, y hoy
--     esos valores nuevos son los que quedan. Copiar los viejos a ciegas seria
--     una regresion silenciosa (quien corrige su telefono al reprogramar lo
--     perderia).
--
-- `coach_id` NUNCA sale de un parametro: solo de la cita vieja. Con el token de
-- una cita no se puede fabricar una cita para otro coach.
--
-- `meet_link` se deriva igual que en crear_cita: de la configuracion del coach y
-- solo si es una sala de Zoom (espejo de pw-modalidad.js `zoomEsSala`).
--
-- Se anade `id_anterior` al retorno: el frontend lo necesita para retirar de
-- Google Calendar el evento de la cita vieja. Sin el, la fila queda cancelada
-- pero el evento sigue ocupando el hueco del coach con el enlace antiguo.
--
-- Atomicidad: es una sola funcion plpgsql, es decir una transaccion. O se
-- cancela la vieja Y nace la nueva, o no cambia nada. Es lo que sustituye al
-- `_cancelOld` del navegador, que hacia dos peticiones separadas y cuya segunda
-- fallaba en silencio (anon no tiene UPDATE) dejando la cita DUPLICADA.
--
-- DROP + CREATE: cambian la firma y el retorno. Verificado que no hay llamadores.

DROP FUNCTION IF EXISTS public.reprogramar_cita(text, timestamptz, text);

CREATE FUNCTION public.reprogramar_cita(
  p_token           text,
  p_nuevo_inicio    timestamptz,
  p_cliente_tz      text  DEFAULT NULL,
  p_nombre          text  DEFAULT NULL,
  p_email           text  DEFAULT NULL,
  p_tipo            text  DEFAULT NULL,
  p_telefono        text  DEFAULT NULL,
  p_origen          text  DEFAULT NULL,
  p_modalidad       text  DEFAULT NULL,
  p_video_proveedor text  DEFAULT NULL,
  p_lugar           text  DEFAULT NULL,
  p_lang            text  DEFAULT NULL,
  p_respuestas      jsonb DEFAULT NULL,
  p_kind            text  DEFAULT NULL
)
RETURNS TABLE (id bigint, token text, inicio timestamptz, id_anterior bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ant   public.citas%ROWTYPE;
  v_id    bigint;
  v_token text;
  v_zoom  text;
  v_prov  text;
  v_meet  text;
  v_email text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'token_invalido';
  END IF;

  IF p_nuevo_inicio IS NULL OR p_nuevo_inicio < now() THEN
    RAISE EXCEPTION 'fecha_invalida';
  END IF;

  SELECT c.* INTO v_ant
  FROM public.citas c
  WHERE c.token = p_token
    AND c.estado NOT IN ('cancelada', 'completada')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cita_no_reprogramable';
  END IF;

  -- Si llega email nuevo tiene que ser valido; si no, se conserva el de la cita.
  v_email := lower(btrim(coalesce(p_email, v_ant.email)));
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;

  -- Hueco libre. IS DISTINCT FROM para que una fila con estado NULL tambien
  -- cuente como ocupada (NULL <> 'cancelada' es NULL, o sea "libre").
  IF EXISTS (
    SELECT 1
    FROM public.citas c
    WHERE c.coach_id = v_ant.coach_id
      AND c.inicio = p_nuevo_inicio
      AND c.id <> v_ant.id
      AND c.estado IS DISTINCT FROM 'cancelada'
  ) THEN
    RAISE EXCEPTION 'hueco_ocupado';
  END IF;

  v_prov := coalesce(p_video_proveedor, v_ant.video_proveedor);

  SELECT nullif(btrim(coalesce(u.configuracion->>'zoom_url', '')), '')
    INTO v_zoom
  FROM public.usuarios u
  WHERE u.id::text = v_ant.coach_id
  LIMIT 1;

  -- Espejo de pw-modalidad.js `zoomEsSala`, igual que en crear_cita.
  v_meet := CASE
              WHEN v_prov = 'zoom'
               AND v_zoom ~* '^https://([a-z0-9-]+\.)*(zoom\.us|zoomgov\.com)(/(j|w)/[0-9]{6,}|/my/[A-Za-z0-9._-]+)'
              THEN v_zoom
              ELSE NULL
            END;

  UPDATE public.citas AS x
     SET estado = 'cancelada'
   WHERE x.id = v_ant.id;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  INSERT INTO public.citas (
    coach_id, org_id, nombre, email, tipo, inicio,
    estado, grupal, cliente_tz, token,
    telefono, origen, modalidad, video_proveedor, lugar, lang, respuestas, kind,
    meet_link
  )
  VALUES (
    v_ant.coach_id,                                   -- nunca de un parametro
    v_ant.org_id,
    btrim(coalesce(p_nombre, v_ant.nombre)),
    v_email,
    coalesce(p_tipo, v_ant.tipo),
    p_nuevo_inicio,
    'pendiente',
    coalesce(v_ant.grupal, false),
    coalesce(p_cliente_tz, v_ant.cliente_tz),
    v_token,
    coalesce(p_telefono, v_ant.telefono),
    coalesce(p_origen, v_ant.origen),
    coalesce(nullif(btrim(coalesce(p_modalidad, '')), ''), v_ant.modalidad, 'online'),
    v_prov,
    coalesce(p_lugar, v_ant.lugar),
    CASE WHEN p_lang IN ('es', 'en') THEN p_lang ELSE v_ant.lang END,
    coalesce(p_respuestas, v_ant.respuestas),
    CASE WHEN p_kind IN ('primera_llamada', 'demo_pathway') THEN p_kind ELSE v_ant.kind END,
    v_meet
  )
  RETURNING public.citas.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token, p_nuevo_inicio, v_ant.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reprogramar_cita(text,timestamptz,text,text,text,text,text,text,text,text,text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reprogramar_cita(text,timestamptz,text,text,text,text,text,text,text,text,text,text,jsonb,text) TO anon, authenticated;
