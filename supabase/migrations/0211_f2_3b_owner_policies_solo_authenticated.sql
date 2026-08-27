-- F2.3b — Reparacion de un efecto colateral de F2.3, SIN reabrir anon.
--
-- Al quitarle a anon el SELECT sobre `organizaciones`, estas dos policies
-- (declaradas `TO public`, es decir tambien para anon) pasaron a lanzar
-- "42501: permission denied for table organizaciones" en vez de devolver 0
-- filas, porque su subconsulta lee `organizaciones` con los permisos del que
-- llama. Eso rompia el formulario publico de alta (formulario.html:911,929
-- escribe en `candidatos` con la clave anon).
--
-- Ambas son policies de DUEÑO: casan por `auth.jwt() ->> 'email'`, que para anon
-- es NULL, asi que NUNCA podian devolver nada para anon. Restringirlas a
-- `authenticated` solo QUITA alcance (saca a anon de su evaluacion); no concede
-- nada a nadie. Anon vuelve a ver 0 filas en vez de un error.
ALTER POLICY cand_owner_select_org ON public.candidatos TO authenticated;
ALTER POLICY asgn_owner_full ON public.coach_client_assignments TO authenticated;
