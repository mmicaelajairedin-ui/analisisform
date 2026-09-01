-- INC-A · `sala.html` deja de leer `usuarios` y `organizaciones` con la anon key.
--
-- QUE ARREGLA
-- `sala.html` (bloque `_salaBrand`) hacia DOS lecturas con la anon key:
--   1. usuarios?id=eq.<coach>&select=org_id,configuracion,slug,nombre
--   2. organizaciones?id=eq.<org>&select=marca
-- Las dos estan cerradas a `anon` desde el endurecimiento de RLS:
--   has_table_privilege('anon','usuarios','SELECT')       = false  (Fase 4/5)
--   has_table_privilege('anon','organizaciones','SELECT') = false  (f2_3_cierre_organizaciones)
-- La primera devuelve 403, un `.catch(function(){})` vacio se lo traga, y el
-- bloque hace `return` sin llegar a la segunda. Fallo silencioso: la Sala se
-- queda sin marca Y sin SALA_SERVICIOS / SALA_SLUG / SALA_MONEDA /
-- SALA_COACHNAME, que es lo que alimenta el pop-up de venta en vivo del boton
-- "Cobrar" de una `primera_llamada`.
--
-- POR QUE UNA RPC Y NO REABRIR EL SELECT
-- Reabrir `SELECT` a `anon` sobre `usuarios` u `organizaciones` deshace justo lo
-- que cerraron las Fases 4/5 y F2.3. Esta funcion devuelve SOLO los cinco datos
-- que la Sala necesita y NADA mas: en particular NO devuelve `configuracion`
-- entera (que lleva `verification_token`, `access_code`, `gcal`...), ni `org_id`,
-- ni email, ni nada del resto de la fila.
--
-- EXPOSICION: no anade ninguna
-- Los cinco campos ya son publicos por otras vias que siguen abiertas:
-- `usuarios_publicos` (nombre, slug y `configuracion` menos 4 claves, o sea
-- servicios y moneda) y el perfil publico del coach, donde la marca se pinta.
-- Es estrictamente menos de lo que ya se puede leer hoy.
--
-- LA RESOLUCION DE LA MARCA SE MUEVE AL SERVIDOR
-- Antes la decidia el navegador: si hay org -> marca de la org; si no y el coach
-- es Pro -> su propia marca. Esa misma regla vive ahora aqui, con el mismo orden
-- y el mismo resultado, para no tener que exponer `org_id` ni el bloque `plan`.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.pw_sala_contexto(text);

CREATE OR REPLACE FUNCTION public.pw_sala_contexto(p_coach_id text)
RETURNS TABLE(nombre text, slug text, moneda text, servicios jsonb, marca jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cfg  jsonb;
  v_org  uuid;
  v_nom  text;
  v_slug text;
  v_cfg_org text;
BEGIN
  -- Mismo guard de forma que `pw_franjas_ocupadas`: sin UUID valido no se mira
  -- la tabla siquiera.
  IF p_coach_id IS NULL
     OR p_coach_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  THEN
    RETURN;
  END IF;

  SELECT coalesce(u.configuracion, '{}'::jsonb), u.org_id, u.nombre, u.slug
    INTO v_cfg, v_org, v_nom, v_slug
  FROM public.usuarios u
  WHERE u.id::text = lower(p_coach_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Espejo de `u.org_id || cfg.org_id` del navegador. El cast solo se intenta si
  -- el valor TIENE forma de UUID: un `configuracion.org_id` corrupto no puede
  -- tumbar la Sala.
  IF v_org IS NULL THEN
    v_cfg_org := nullif(btrim(coalesce(v_cfg->>'org_id', '')), '');
    IF v_cfg_org IS NOT NULL
       AND v_cfg_org ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN
      v_org := v_cfg_org::uuid;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    btrim(coalesce(v_nom, '')),
    btrim(coalesce(nullif(v_slug, ''), v_cfg->>'slug', '')),
    lower(coalesce(nullif(btrim(coalesce(v_cfg->>'moneda', '')), ''), 'eur')),
    CASE WHEN jsonb_typeof(v_cfg->'servicios') = 'array'
         THEN v_cfg->'servicios' ELSE '[]'::jsonb END,
    CASE
      WHEN v_org IS NOT NULL THEN
        coalesce((SELECT o.marca FROM public.organizaciones o WHERE o.id = v_org), '{}'::jsonb)
      WHEN coalesce(v_cfg->>'es_pro_vitalicio', '') = 'true'
        OR coalesce(v_cfg->>'plan', '') = 'pro' THEN
        jsonb_strip_nulls(jsonb_build_object('color', v_cfg->>'color_marca',
                                             'logo',  v_cfg->>'logo_url'))
      ELSE '{}'::jsonb
    END;
END;
$function$;

REVOKE ALL ON FUNCTION public.pw_sala_contexto(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pw_sala_contexto(text) TO anon, authenticated, service_role;
