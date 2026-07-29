-- ============================================================================
-- Fase 4 — RLS Strict por org_id (Multi-Tenant Isolation)
-- ============================================================================
-- PROBLEMA (detectado 2026-07-29):
--   Los RLS de candidatos/informes/cv_publicados solo protegen coach_id, NO org_id.
--   Efecto: un coach en Org A puede leer candidatos de Org B si busca por email.
--   Escenario:
--     GET /rest/v1/candidatos?email=eq.target@example.com
--     RLS evalúa: (coach_id = COACH_A) OR (email = target@example.com)
--     Si target@example.com está en Org B: fila retorna igual → BREACH
--
-- SOLUCIÓN:
--   Agregar org_id check a RLS policies:
--   - Coaches solo ven candidatos/informes/CVs de su PROPIA org
--   - Admins ven todo (no hay org_id check para ellos)
--   - Clientes acceden por email (sin org_id check, conforme al diseño)
--   - Citas YA tienen org_id check (0100_citas_rls_network.sql) → es el patrón correcto
--
-- IDEMPOTENTE: se puede ejecutar varias veces sin errores.
-- ============================================================================

-- ─── Helpers de identidad (si no existen aún) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.pw_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.pw_org_id() TO anon, authenticated;

-- ─── Verificar que helpers del coach existan ───────────────────────────────
-- (Ya creados en rls_strict.sql, pero re-creamos por idempotencia)
CREATE OR REPLACE FUNCTION public.pw_coach_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.pw_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.pw_email()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

GRANT EXECUTE ON FUNCTION public.pw_coach_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pw_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pw_email()   TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) candidatos — Agregar org_id check
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;

-- SELECT: coach ve su org, admin ve todo, cliente ve por email
DROP POLICY IF EXISTS candidatos_select ON candidatos;
CREATE POLICY candidatos_select ON candidatos FOR SELECT
  USING (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW: coach solo ve su org
    )
    OR lower(email) = public.pw_email()  -- cliente por email (sin org check)
  );

-- INSERT: ANÓNIMA permitida (intake form), o coach/admin de su org
DROP POLICY IF EXISTS candidatos_insert ON candidatos;
CREATE POLICY candidatos_insert ON candidatos FOR INSERT
  WITH CHECK (true);  -- intake form (anon), coach setea coach_id/org_id

-- UPDATE: coach de su org, admin, o cliente (edita su fila)
DROP POLICY IF EXISTS candidatos_update ON candidatos;
CREATE POLICY candidatos_update ON candidatos FOR UPDATE
  USING (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
    OR lower(email) = public.pw_email()
  )
  WITH CHECK (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
    OR lower(email) = public.pw_email()
  );

-- DELETE: coach de su org, admin
DROP POLICY IF EXISTS candidatos_delete ON candidatos;
CREATE POLICY candidatos_delete ON candidatos FOR DELETE
  USING (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 2) informes — Agregar org_id columna (si no existe) y RLS
-- ════════════════════════════════════════════════════════════════════════════

-- Agregar columna org_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'informes' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE informes ADD COLUMN org_id uuid;
    -- Backfill: copiar org_id del candidato relacionado (si existe)
    UPDATE informes SET org_id = c.org_id
      FROM candidatos c
      WHERE informes.email = c.email;
    -- Resto (huérfanos): NULL. Serán invisibles en queries (esperado).
  END IF;
END $$;

-- Agregar índice en org_id para performance
CREATE INDEX IF NOT EXISTS idx_informes_org_id
  ON informes(org_id) WHERE org_id IS NOT NULL;

ALTER TABLE informes ENABLE ROW LEVEL SECURITY;

-- SELECT: coach ve su org, admin ve todo, cliente ve por email
DROP POLICY IF EXISTS informes_select ON informes;
CREATE POLICY informes_select ON informes FOR SELECT
  USING (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
    OR lower(email) = public.pw_email()
  );

-- INSERT: coach/admin de su org (edge function generar-informe usa service_role)
DROP POLICY IF EXISTS informes_insert ON informes;
CREATE POLICY informes_insert ON informes FOR INSERT
  WITH CHECK (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
  );

-- UPDATE: coach de su org, admin
DROP POLICY IF EXISTS informes_update ON informes;
CREATE POLICY informes_update ON informes FOR UPDATE
  USING (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
  )
  WITH CHECK (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
  );

-- DELETE: coach de su org, admin
DROP POLICY IF EXISTS informes_delete ON informes;
CREATE POLICY informes_delete ON informes FOR DELETE
  USING (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 3) cv_publicados — Agregar org_id columna (si no existe) y RLS
-- ════════════════════════════════════════════════════════════════════════════

-- Agregar columna org_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cv_publicados' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE cv_publicados ADD COLUMN org_id uuid;
    -- Backfill: copiar org_id del candidato relacionado (si existe)
    UPDATE cv_publicados SET org_id = c.org_id
      FROM candidatos c
      WHERE cv_publicados.email = c.email;
    -- Resto: NULL
  END IF;
END $$;

-- Agregar índice
CREATE INDEX IF NOT EXISTS idx_cv_publicados_org_id
  ON cv_publicados(org_id) WHERE org_id IS NOT NULL;

ALTER TABLE cv_publicados ENABLE ROW LEVEL SECURITY;

-- SELECT: coach ve su org, admin ve todo, cliente ve por email
DROP POLICY IF EXISTS cv_publicados_select ON cv_publicados;
CREATE POLICY cv_publicados_select ON cv_publicados FOR SELECT
  USING (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
    OR lower(email) = public.pw_email()
  );

-- INSERT: cliente (por email), coach de su org, admin
DROP POLICY IF EXISTS cv_publicados_insert ON cv_publicados;
CREATE POLICY cv_publicados_insert ON cv_publicados FOR INSERT
  WITH CHECK (
    lower(email) = public.pw_email()
    OR public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
  );

-- UPDATE: cliente (por email), coach de su org, admin
DROP POLICY IF EXISTS cv_publicados_update ON cv_publicados;
CREATE POLICY cv_publicados_update ON cv_publicados FOR UPDATE
  USING (
    lower(email) = public.pw_email()
    OR public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
  )
  WITH CHECK (
    lower(email) = public.pw_email()
    OR public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
  );

-- DELETE: coach de su org, admin
DROP POLICY IF EXISTS cv_publicados_delete ON cv_publicados;
CREATE POLICY cv_publicados_delete ON cv_publicados FOR DELETE
  USING (
    public.pw_is_admin()
    OR (
      coach_id = public.pw_coach_id()
      AND org_id = public.pw_org_id()  -- ← NEW
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (ejecutar DESPUÉS de aplicar la migración)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 1) Con la anon key (no logueado):
--    SELECT COUNT(*) FROM candidatos;      -- esperado: 0 (RLS bloquea anon)
--    SELECT COUNT(*) FROM informes;        -- esperado: 0
--    SELECT COUNT(*) FROM cv_publicados;   -- esperado: 0
--
-- 2) Con JWT de coach de Org A:
--    SELECT COUNT(*) FROM candidatos;      -- esperado: solo clientes de su org
--
-- 3) Con JWT de coach de Org B:
--    SELECT * FROM candidatos WHERE email='coach-a-client@example.com';
--    -- esperado: 0 filas (RLS filtra por org_id)
--
-- 4) Verificar que no quedan políticas abiertas:
--    SELECT tablename, policyname, qual, with_check
--    FROM pg_policies
--    WHERE tablename IN ('candidatos','informes','cv_publicados')
--    AND (qual='true' OR with_check='true');
--    -- esperado: 0 filas (no debería haber USING(true) o WITH CHECK(true))
--
-- ════════════════════════════════════════════════════════════════════════════
