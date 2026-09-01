-- F2.1 / D-5 — Acceso publico a organizaciones por FUNCION, no por vista.
-- Motivo (D-5): una vista con GRANT SELECT a anon permite ?select=* sin filtro y
-- por tanto ENUMERAR todas las redes. Una funcion de un argumento obliga a
-- conocer el slug, que es el identificador que el propio owner publica.
--
-- Columnas: SOLO las 4 que consume el flujo publico. Verificado en
-- landing.html -> org.id, org.nombre, org.slug, org.marca.
-- FUERA, sin excepcion: owner_email, plan, estado_sub, fecha_fin_prueba,
-- max_coaches, max_clientes, activo, owner_id, dominio, created_at.
--
-- SECURITY DEFINER es necesario para que siga funcionando cuando F2.3 habilite
-- RLS sobre la tabla base. search_path fijo, igual que pw_coach_id/pw_is_admin.
CREATE OR REPLACE FUNCTION public.org_publica(p_slug text)
RETURNS TABLE (id uuid, nombre text, slug text, marca jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id, o.nombre, o.slug, o.marca
  FROM organizaciones o
  WHERE coalesce(btrim(p_slug), '') <> ''
    AND o.activo = true
    AND o.slug IS NOT NULL
    AND lower(o.slug) = lower(btrim(p_slug))
  LIMIT 1
$$;

-- Nadie por defecto; solo los dos roles del navegador.
REVOKE ALL ON FUNCTION public.org_publica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_publica(text) TO anon, authenticated;