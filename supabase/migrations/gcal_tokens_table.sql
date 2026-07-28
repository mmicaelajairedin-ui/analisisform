-- ===================================================================
-- gcal_tokens_table.sql — "Caja fuerte" del token de Google Calendar.
--
-- Problema: el token de Google del coach (con refresh_token = acceso PERMANENTE
-- a su calendario) vivía en usuarios.configuracion.gcal. Como el directorio y
-- otros flujos leen `configuracion` con la anon key, ese token quedaba legible.
--
-- Solución (sin tocar los permisos de `usuarios`, para no romper registro /
-- alta / directorio): mover el token a una TABLA APARTE con RLS. El anónimo NO
-- tiene ninguna política sobre esta tabla → no puede leerla de ninguna forma.
-- El coach lee/escribe SOLO su token (por su JWT); las edge functions usan
-- service role (bypass RLS). Se deja `configuracion.gcal_ical_url` (URL pública,
-- no secreto) donde estaba.
--
-- Reversible: ver el bloque ROLLBACK al final (comentado).
--
-- Deploy: se aplica sola al mergear a main (workflow supabase-migrations).
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.gcal_tokens (
  coach_id   uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.gcal_tokens ENABLE ROW LEVEL SECURITY;

-- El coach (o admin) gestiona SU token. anon: sin política → sin acceso.
DROP POLICY IF EXISTS gcal_tokens_self ON public.gcal_tokens;
CREATE POLICY gcal_tokens_self ON public.gcal_tokens FOR ALL
  USING (coach_id = public.pw_coach_id() OR public.pw_is_admin())
  WITH CHECK (coach_id = public.pw_coach_id() OR public.pw_is_admin());

-- Permisos base (la RLS filtra las filas). anon NO recibe nada.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gcal_tokens TO authenticated;

-- Migrar los tokens que hoy están en configuracion.gcal.
INSERT INTO public.gcal_tokens (coach_id, token)
  SELECT id, configuracion->'gcal'
  FROM public.usuarios
  WHERE configuracion ? 'gcal' AND (configuracion->'gcal') IS NOT NULL
  ON CONFLICT (coach_id) DO NOTHING;

-- Sacar el token de configuracion (deja gcal_ical_url y todo lo demás intacto).
UPDATE public.usuarios
  SET configuracion = configuracion - 'gcal'
  WHERE configuracion ? 'gcal';

-- ── ROLLBACK (si algo fallara, correr esto a mano en el SQL Editor) ──────────
-- UPDATE public.usuarios u
--   SET configuracion = COALESCE(u.configuracion,'{}'::jsonb)
--       || jsonb_build_object('gcal', t.token)
--   FROM public.gcal_tokens t
--   WHERE t.coach_id = u.id;
-- (opcional) DROP TABLE public.gcal_tokens;
