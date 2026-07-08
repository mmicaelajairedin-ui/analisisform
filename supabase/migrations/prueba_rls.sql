-- ============================================================================
-- PRUEBA DEL CANDADO (RLS) — NO PERSISTE NADA
-- ============================================================================
-- Este bloque prende RLS estricto, mide qué ve un usuario ANÓNIMO (el atacante
-- con la anon key), y al final hace ROLLBACK: DESHACE TODO. Tu base queda
-- exactamente igual que antes de correrlo. Es 100% seguro de probar.
--
-- Cómo usar:
--   1) Pegá TODO esto en Supabase → SQL Editor y corré.
--   2) Miralo devolver una fila con la columna  anonimo_ve.
--   3) Pasame ese número.  Esperado:  anonimo_ve = 0  (candado OK).
--      Si diera > 0, NO prendemos nada y revisamos.
-- ============================================================================

BEGIN;

-- Helpers de identidad (mismos que la migration real) -----------------------
CREATE OR REPLACE FUNCTION public.pw_coach_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.pw_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin') $$;
CREATE OR REPLACE FUNCTION public.pw_email()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- Prender RLS en candidatos + policy de lectura -----------------------------
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS candidatos_select ON candidatos;
CREATE POLICY candidatos_select ON candidatos FOR SELECT
  USING (
    coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
    OR lower(email) = public.pw_email()
  );

-- ── Medición: ¿qué ve un ANÓNIMO (sin sesión, solo anon key)? ──────────────
SET LOCAL ROLE anon;
SELECT count(*) AS anonimo_ve FROM candidatos;   -- ESPERADO: 0
RESET ROLE;

-- Deshacer TODO — la base queda intacta.
ROLLBACK;
