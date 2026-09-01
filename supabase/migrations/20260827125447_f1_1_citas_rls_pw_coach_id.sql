-- F1.1 — Reparar las 7 policies de `citas` que comparaban auth.uid() (= auth_id)
-- contra usuarios.id (llave de negocio). Medido: auth_id <> id en 58/58 filas,
-- por lo que estas policies nunca evaluaban true (coach y owner veian 0 citas).
-- Se sustituye por pw_coach_id(), el unico punto de traduccion sesion -> negocio.
-- D-2: no se toca org_id; las 6 citas sin org_id quedan fuera del alcance de owner
--      (modelo coach-individual aceptado).
-- D-3: se mantiene rol='owner' OR rol='admin' (INC-014, R-15: el dueno real de
--      "Mi Empresa" tiene rol='admin').
-- NO se toca citas_anon_select ni citas_anon_insert (D-6 no autorizada).

ALTER POLICY rls_citas_coach_network ON public.citas
  USING (
    (pw_coach_id() IS NOT NULL)
    AND (
      (coach_id = (pw_coach_id())::text)
      OR (
        (org_id IN (
          SELECT usuarios.org_id FROM usuarios
          WHERE usuarios.id = pw_coach_id() AND usuarios.org_id IS NOT NULL
        ))
        AND (grupal = true)
      )
    )
  );

ALTER POLICY rls_citas_coach_insert ON public.citas
  WITH CHECK (coach_id = (pw_coach_id())::text);

ALTER POLICY rls_citas_coach_update ON public.citas
  USING      ((coach_id = (pw_coach_id())::text) AND (grupal = false))
  WITH CHECK ((coach_id = (pw_coach_id())::text) AND (grupal = false));

ALTER POLICY rls_citas_coach_delete ON public.citas
  USING ((coach_id = (pw_coach_id())::text) AND (grupal = false));

ALTER POLICY rls_citas_owner_select ON public.citas
  USING (
    pw_coach_id() IN (
      SELECT usuarios.id FROM usuarios
      WHERE (usuarios.rol = 'owner' OR usuarios.rol = 'admin')
        AND usuarios.org_id IS NOT NULL
        AND usuarios.org_id = citas.org_id
    )
  );

ALTER POLICY rls_citas_owner_insert ON public.citas
  WITH CHECK (
    pw_coach_id() IN (
      SELECT usuarios.id FROM usuarios
      WHERE (usuarios.rol = 'owner' OR usuarios.rol = 'admin')
        AND usuarios.org_id IS NOT NULL
        AND usuarios.org_id = citas.org_id
    )
  );

ALTER POLICY rls_citas_owner_update ON public.citas
  USING (
    pw_coach_id() IN (
      SELECT usuarios.id FROM usuarios
      WHERE (usuarios.rol = 'owner' OR usuarios.rol = 'admin')
        AND usuarios.org_id IS NOT NULL
        AND usuarios.org_id = citas.org_id
    )
  )
  WITH CHECK (
    pw_coach_id() IN (
      SELECT usuarios.id FROM usuarios
      WHERE (usuarios.rol = 'owner' OR usuarios.rol = 'admin')
        AND usuarios.org_id IS NOT NULL
        AND usuarios.org_id = citas.org_id
    )
  );