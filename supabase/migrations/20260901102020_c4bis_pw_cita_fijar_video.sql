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