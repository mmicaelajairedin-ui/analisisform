-- G2-RPC-01 — Via publica minima para el selector de horarios de reservar.html.
--
-- Hoy `reservar.html` lee la tabla `citas` con la anon key (policy
-- citas_anon_select USING(true)): 66 filas x 33 columnas, con token, sala_token,
-- telefono y email de cada cliente. Lo unico que necesita de ahi son los
-- INSTANTES que ya estan ocupados, para pintarlos en gris.
--
-- Esta funcion devuelve exactamente eso y nada mas: una columna, `inicio`.
-- No devuelve nombre, email, telefono, token, sala_token, notas, ni el id.
--
-- Acotaciones deliberadas:
--   * el coach se pasa completo (uuid): sin el id exacto no hay nada que listar,
--     y la forma se valida antes de tocar la tabla para no admitir sondeos;
--   * suelo en now(): el pasado no se ofrece nunca en el selector, asi que
--     tampoco se devuelve — si no, esto seria un historico de la actividad
--     del coach;
--   * techo de 62 dias sobre el inicio efectivo: el selector pide 29;
--   * STABLE: no escribe. La funcion no puede modificar ninguna fila.
--
-- Aplicada en produccion el 2026-08-31 (schema_migrations 20260831103005).
CREATE OR REPLACE FUNCTION public.pw_franjas_ocupadas(
  p_coach_id text,
  p_desde    timestamptz,
  p_hasta    timestamptz
)
RETURNS TABLE(inicio timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_desde timestamptz;
  v_hasta timestamptz;
BEGIN
  IF p_coach_id IS NULL
     OR p_coach_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  THEN
    RETURN;
  END IF;

  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
    RETURN;
  END IF;

  v_desde := greatest(p_desde, now());
  v_hasta := least(p_hasta, v_desde + interval '62 days');
  IF v_hasta < v_desde THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT c.inicio
    FROM public.citas c
    WHERE c.coach_id = p_coach_id
      AND c.estado IS DISTINCT FROM 'cancelada'
      AND c.inicio >= v_desde
      AND c.inicio <= v_hasta
    ORDER BY c.inicio;
END;
$function$;

-- Leccion de G1-R3: una funcion nueva nace con EXECUTE para PUBLIC. Se retira
-- explicitamente y se concede solo a quien la necesita.
REVOKE ALL ON FUNCTION public.pw_franjas_ocupadas(text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pw_franjas_ocupadas(text, timestamptz, timestamptz) TO anon, authenticated;
