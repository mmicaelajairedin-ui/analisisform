DROP POLICY IF EXISTS citas_anon_select ON public.citas;
DROP POLICY IF EXISTS citas_anon_insert ON public.citas;

REVOKE SELECT, INSERT ON public.citas FROM anon;

REVOKE SELECT ON public.citas_sin_organizacion FROM anon;