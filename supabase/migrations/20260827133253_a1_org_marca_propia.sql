-- A-1 / D-9 — Marca de la organizacion DEL LLAMANTE.
--
-- Principio: la marca se resuelve por la IDENTIDAD de quien llama, nunca por un
-- id que venga del navegador. Por eso la funcion NO ACEPTA ARGUMENTOS: no hay
-- forma de pedir la organizacion de otro, ni de recorrer el catalogo.
--
-- Dos vias de pertenencia, en orden determinista:
--   1) Equipo  — pw_coach_id() -> usuarios.org_id   (coach, owner, admin, colaborador)
--   2) Cliente — pw_email()    -> candidatos.org_id (el portal del cliente)
-- La (2) es imprescindible: medido, los 31 usuarios con rol='cliente' tienen
-- org_id NULL; los 32 clientes con organizacion viven solo en `candidatos`.
--
-- Devuelve SOLO `marca`. Quedan fuera owner_email, plan, estado_sub,
-- fecha_fin_prueba, max_coaches, max_clientes, activo, owner_id, dominio,
-- created_at y hasta el propio id: un cliente no tiene por que conocer nada de
-- eso de su red.
--
-- Sin organizacion, o ambiguo, o anonimo -> 0 filas. Falla cerrado.
-- (anon: pw_coach_id() da NULL y pw_email() da '' -> ninguna via resuelve.
--  Ademas no se le concede EXECUTE.)
--
-- SECURITY DEFINER para que siga funcionando cuando F2.3 habilite RLS sobre la
-- tabla base. search_path fijo, igual que pw_coach_id / pw_is_admin / pw_email.
CREATE OR REPLACE FUNCTION public.org_marca_propia()
RETURNS TABLE (marca jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.marca
  FROM organizaciones o
  WHERE o.id = coalesce(
    (SELECT u.org_id FROM usuarios u
      WHERE u.id = pw_coach_id() AND u.org_id IS NOT NULL LIMIT 1),
    (SELECT c.org_id FROM candidatos c
      WHERE pw_email() <> '' AND lower(c.email) = pw_email() AND c.org_id IS NOT NULL LIMIT 1)
  )
  LIMIT 1
$$;

-- Solo el rol autenticado. A anon NO se le concede: no tiene identidad que resolver.
REVOKE ALL ON FUNCTION public.org_marca_propia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_marca_propia() TO authenticated;