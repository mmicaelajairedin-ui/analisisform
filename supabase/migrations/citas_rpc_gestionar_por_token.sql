-- ===================================================================
-- get_cita_by_token / cancelar_cita_by_token
--   El cliente gestiona SU reserva desde el link del email
--   (gestionar-cita.html?t=<token>), sin cuenta ni login.
--
-- CAPTURA de las funciones que YA ESTAN VIVAS en produccion. Se versionan
-- aqui porque el repo no las tenia: eran el unico sitio donde se resuelve
-- el token del cliente y `check-guardrails.js` no tenia nada que verificar.
--
-- Son CREATE OR REPLACE e identicas a lo que corre hoy: re-aplicarlas es un
-- no-op. NO hace falta correrlas para que el sitio siga funcionando.
--
-- Por que RPC y no REST (`citas?token=eq....`):
--   Leer/escribir por REST obliga a dejar `citas` abierta a anon, y con eso
--   cualquiera lista TODAS las citas de TODOS los coaches (nombres, emails,
--   telefonos). SECURITY DEFINER + busqueda por token deja pasar UNA fila:
--   la del que tiene el link. Es lo que permite cerrar `citas_anon_select`.
--   El token exige >= 16 caracteres, asi que no se puede sondear con basura.
-- ===================================================================

CREATE OR REPLACE FUNCTION public.get_cita_by_token(p_token text)
 RETURNS TABLE(id bigint, coach_id text, nombre text, email text, tipo text, inicio timestamp with time zone, estado text, cliente_tz text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      c.id,
      c.coach_id,
      c.nombre,
      c.email,
      c.tipo,
      c.inicio,
      c.estado,
      c.cliente_tz
    FROM public.citas c
    WHERE c.token = p_token
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancelar_cita_by_token(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_filas integer := 0;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN false;
  END IF;

  UPDATE public.citas
  SET estado = 'cancelada'
  WHERE token = p_token
    AND estado NOT IN ('cancelada', 'completada');

  GET DIAGNOSTICS v_filas = ROW_COUNT;

  RETURN v_filas > 0;
END;
$function$;

-- El cliente que abre el link del email es anon.
GRANT EXECUTE ON FUNCTION public.get_cita_by_token(text)      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_cita_by_token(text) TO anon, authenticated, service_role;

-- VERIFY (las dos deben salir con prosecdef = true):
--   SELECT p.proname, p.prosecdef FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('get_cita_by_token', 'cancelar_cita_by_token');
