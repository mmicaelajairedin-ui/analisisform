-- FIX: el coach no podía guardar el diagnóstico/plan (tabla `informes`).
-- La generación por IA la hace la Edge Function con SERVICE ROLE (bypassa RLS),
-- pero la EDICIÓN del coach usa la anon key desde el navegador. Si RLS está
-- activo en `informes` sin política de UPDATE para anon, el PATCH se rechaza y
-- el diagnóstico "no se guarda". Estas políticas permisivas lo habilitan
-- (misma postura actual; el RLS estricto por coach_id es el Sprint B).
-- Idempotente. Solo aplica si RLS está activo; si está desactivado, son inertes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='informes') THEN
    DROP POLICY IF EXISTS informes_anon_select ON public.informes;
    CREATE POLICY informes_anon_select ON public.informes FOR SELECT TO anon USING (true);
    DROP POLICY IF EXISTS informes_anon_insert ON public.informes;
    CREATE POLICY informes_anon_insert ON public.informes FOR INSERT TO anon WITH CHECK (true);
    DROP POLICY IF EXISTS informes_anon_update ON public.informes;
    CREATE POLICY informes_anon_update ON public.informes FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  -- Mismo caso para los CV publicados (el coach/cliente edita el CV).
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cv_publicados') THEN
    DROP POLICY IF EXISTS cvpub_anon_select ON public.cv_publicados;
    CREATE POLICY cvpub_anon_select ON public.cv_publicados FOR SELECT TO anon USING (true);
    DROP POLICY IF EXISTS cvpub_anon_insert ON public.cv_publicados;
    CREATE POLICY cvpub_anon_insert ON public.cv_publicados FOR INSERT TO anon WITH CHECK (true);
    DROP POLICY IF EXISTS cvpub_anon_update ON public.cv_publicados;
    CREATE POLICY cvpub_anon_update ON public.cv_publicados FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
