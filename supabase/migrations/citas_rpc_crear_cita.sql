-- ===================================================================
-- crear_cita — alta de cita desde reservar.html (visitante anonimo)
--
-- CAPTURA de la funcion que YA ESTA VIVA en produccion. Se versiona aqui
-- porque el repo no la tenia y era el UNICO sitio donde se emite el token
-- de la cita: sin token no hay link de cancelar/reprogramar para el cliente.
-- El trigger `citas_token_generation.sql` NO esta aplicado en produccion
-- (en `pg_trigger` solo esta `trg_citas_set_org_id`), asi que esta funcion
-- es la unica garantia del token. Sin este archivo, `check-guardrails.js`
-- no tenia nada que verificar.
--
-- Es CREATE OR REPLACE e identica a lo que corre hoy: re-aplicarla es un
-- no-op. NO hace falta correrla para que el sitio siga funcionando.
--
-- Por que una RPC y no un INSERT desde el navegador:
--   - SECURITY DEFINER → inserta y devuelve (id, token, inicio) sin que el
--     visitante pueda LEER la tabla citas (permite cerrar citas_anon_select).
--   - Valida del lado servidor lo que el navegador no puede garantizar:
--     coach existente y activo, hueco libre ('hueco_ocupado'), email valido,
--     fecha futura, y deriva org_id.
--   - El enlace de Zoom sale de `usuarios.configuracion.zoom_url` del COACH,
--     no de lo que mande el visitante (espejo de pw-modalidad.js::zoomEsSala).
-- ===================================================================

CREATE OR REPLACE FUNCTION public.crear_cita(
  p_coach_id text,
  p_nombre text,
  p_email text,
  p_tipo text,
  p_inicio timestamp with time zone,
  p_cliente_tz text DEFAULT NULL::text,
  p_telefono text DEFAULT NULL::text,
  p_origen text DEFAULT NULL::text,
  p_modalidad text DEFAULT NULL::text,
  p_video_proveedor text DEFAULT NULL::text,
  p_lugar text DEFAULT NULL::text,
  p_lang text DEFAULT NULL::text,
  p_respuestas jsonb DEFAULT NULL::jsonb,
  p_kind text DEFAULT NULL::text
)
 RETURNS TABLE(id bigint, token text, inicio timestamp with time zone)
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

-- El visitante de reservar.html es anon; el panel llama con JWT.
GRANT EXECUTE ON FUNCTION public.crear_cita(
  text, text, text, text, timestamptz, text, text, text, text, text, text, text, jsonb, text
) TO anon, authenticated, service_role;

-- VERIFY (debe devolver una fila con security_definer = true):
--   SELECT p.proname, p.prosecdef FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'crear_cita';
