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