-- G2-A · sala.html — puerta de acceso a la videollamada por token.
--
-- `sala.html` pedia hasta ahora, con la anon key:
--     citas?or=(token.eq.X,sala_token.eq.X)&select=id,coach_id,email,estado
-- De esas cuatro columnas el codigo usa UNA: `coach_id`, para comprobar que el
-- token corresponde al coach cuyo room dice la URL. `id`, `email` y `estado` se
-- pedian y se tiraban.
--
-- token vs sala_token (medido antes de implementar):
--   * `token`      -> 65 filas. Es el token de gestion de la cita (el del email:
--                     gestionar-cita.html?t=...). Longitud >= 16 salvo UNA fila
--                     de prueba de 13 con `inicio` NULL.
--   * `sala_token` -> 1 fila, distinta de `token` en esa fila (0 coincidencias).
--                     Es el token V2, exclusivo de la sala.
--   Los dos siguen vivos: la compatibilidad bidireccional que hace `sala.html`
--   es real y hay que conservarla, asi que la funcion acepta cualquiera de los
--   dos y no se puede simplificar a uno solo.
--
-- Devuelve el coach y nada mas. Sin id, sin email, sin estado, sin telefono,
-- sin el token de vuelta. Sin token exacto no devuelve nada: no hay listado ni
-- forma de enumerar. El minimo de 16 caracteres corta los sondeos cortos.
--
-- Aplicada en produccion el 2026-08-31 (schema_migrations 20260831110641).
CREATE OR REPLACE FUNCTION public.pw_sala_coach(p_token text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_coach text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT c.coach_id INTO v_coach
  FROM public.citas c
  WHERE c.token = p_token OR c.sala_token = p_token
  LIMIT 1;

  RETURN v_coach;
END;
$function$;

REVOKE ALL ON FUNCTION public.pw_sala_coach(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pw_sala_coach(text) TO anon, authenticated;
