-- FIX (v2): el coach no puede guardar el diagnóstico/plan en `informes`.
-- La v1 solo creó POLÍTICAS RLS, pero faltaba el GRANT de tabla: sin el GRANT,
-- el rol `anon` (que usa el navegador) NO puede escribir aunque RLS esté apagado
-- o aunque exista la política → "permission denied for table informes".
-- Esta versión cubre AMBOS mecanismos (GRANT + política permisiva). Idempotente.

-- 1) GRANTs de tabla — esto era lo que faltaba.
GRANT SELECT, INSERT, UPDATE ON public.informes     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cv_publicados TO anon, authenticated;
-- Por si algún id es serial/identity (el INSERT necesita la secuencia).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 2) Políticas RLS permisivas (inertes si RLS está desactivado; necesarias si está activo).
--    Mantiene la postura permisiva actual (RLS estricto por coach_id = Sprint B).
DO $$
BEGIN
  IF to_regclass('public.informes') IS NOT NULL THEN
    DROP POLICY IF EXISTS informes_anon_all ON public.informes;
    CREATE POLICY informes_anon_all ON public.informes
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF to_regclass('public.cv_publicados') IS NOT NULL THEN
    DROP POLICY IF EXISTS cvpub_anon_all ON public.cv_publicados;
    CREATE POLICY cvpub_anon_all ON public.cv_publicados
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
