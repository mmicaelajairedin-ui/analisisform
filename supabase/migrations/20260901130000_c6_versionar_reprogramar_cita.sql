-- C-6 · versionar `reprogramar_cita`: la version BUENA vivia solo en la base.
--
-- POR QUE ESTA MIGRACION EXISTE
-- La funcion se reescribio el 31-ago-2026 (migracion aplicada
-- `fase3_reprogramar_cita_contrato_completo`) y quedo mejor que la del
-- repositorio: conserva las 19 columnas, es atomica, devuelve `id_anterior` y no
-- toma `coach_id` de un parametro. Pero esa migracion NUNCA llego a un fichero.
-- Consecuencia: restaurar la base desde el repositorio DEGRADARIA la funcion a la
-- version que pierde 11 columnas. Este fichero cierra ese hueco.
--
-- NO CAMBIA NADA, Y ESTA MIGRACION NO SE HA APLICADO
-- Produccion YA tiene la version buena; aplicarla seria reescribir una funcion
-- que funciona. Este fichero existe para que el REPOSITORIO pueda reproducirla.
--
-- Como se verifico la fidelidad (no por md5 crudo: el cuerpo en la base usa
-- CRLF y este fichero LF, asi que el md5 directo nunca coincidiria):
--   normalizando ambos —quitando comentarios y todo el espacio en blanco—
--   el cuerpo da 797a0d2cb740d8c4581ddb172d0e5f32, 2057 caracteres, EN LOS DOS.
--
--   SELECT md5(regexp_replace(regexp_replace(prosrc,'--[^\n\r]*','','g'),'\s+','','g'))
--     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--    WHERE n.nspname='public' AND p.proname='reprogramar_cita';
--
-- Si algun dia ese md5 deja de coincidir, la base y el repositorio han vuelto a
-- divergir y hay que re-transcribir ANTES de tocar nada.
--
-- QUE HACE LA FUNCION, PARA QUIEN LA LEA AQUI
-- Una reprogramacion es UNA operacion logica: cancela la cita vieja e inserta la
-- nueva dentro de la misma transaccion. No hay ventana en la que el cliente tenga
-- dos turnos vivos ni ninguno. Los 11 parametros opcionales permiten al que llama
-- sobreescribir datos del formulario; lo que no manda, se hereda de la cita
-- anterior con `coalesce`. `coach_id` y `org_id` NUNCA salen de un parametro:
-- salen de la fila vieja, asi que un visitante no puede reasignar una cita a otro
-- coach ni a otra organizacion.
--
-- ROLLBACK: no procede. Revertir esto seria volver a la version que pierde datos.

CREATE OR REPLACE FUNCTION public.reprogramar_cita(
  p_token           text,
  p_nuevo_inicio    timestamp with time zone,
  p_cliente_tz      text    DEFAULT NULL::text,
  p_nombre          text    DEFAULT NULL::text,
  p_email           text    DEFAULT NULL::text,
  p_tipo            text    DEFAULT NULL::text,
  p_telefono        text    DEFAULT NULL::text,
  p_origen          text    DEFAULT NULL::text,
  p_modalidad       text    DEFAULT NULL::text,
  p_video_proveedor text    DEFAULT NULL::text,
  p_lugar           text    DEFAULT NULL::text,
  p_lang            text    DEFAULT NULL::text,
  p_respuestas      jsonb   DEFAULT NULL::jsonb,
  p_kind            text    DEFAULT NULL::text
)
RETURNS TABLE(id bigint, token text, inicio timestamp with time zone, id_anterior bigint)
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

REVOKE ALL ON FUNCTION public.reprogramar_cita(text, timestamptz, text, text, text, text, text, text, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reprogramar_cita(text, timestamptz, text, text, text, text, text, text, text, text, text, text, jsonb, text) TO anon, authenticated, service_role;
