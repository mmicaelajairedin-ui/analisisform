CREATE OR REPLACE FUNCTION public.get_proxima_cita(p_email text)
RETURNS TABLE(inicio timestamp with time zone, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pedido text;
  v_yo     text;
BEGIN
  IF p_email IS NULL
     OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  THEN
    RETURN;
  END IF;

  v_pedido := lower(btrim(p_email));
  v_yo     := pw_email();

  IF coalesce(v_yo, '') = '' AND NOT pw_is_admin() THEN
    RAISE EXCEPTION 'sesion_requerida'
      USING ERRCODE = '42501',
            HINT = 'get_proxima_cita solo responde al propio cliente, a su coach o a un admin.';
  END IF;

  IF v_pedido IS DISTINCT FROM v_yo
     AND NOT pw_is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.citas c
        WHERE lower(c.email) = v_pedido
          AND c.coach_id = (pw_coach_id())::text
     )
  THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT c.inicio, c.estado
      FROM public.citas c
     WHERE lower(c.email) = v_pedido
       AND c.estado <> 'cancelada'
       AND c.inicio > now()
     ORDER BY c.inicio
     LIMIT 1;
END;
$function$;