-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0112: arreglar las policies de `programs` (nunca matcheaban)
-- ═══════════════════════════════════════════════════════════════════════
--
-- CONTRADICCIÓN CON EL PLAN DE CIERRE, documentada antes de tocar nada.
--
-- El plan daba Programas como "backend 0: la tabla, la RLS y los GRANT ya
-- están, CRUD por REST directo". Los GRANT sí están (migración 0110). La RLS
-- NO: las dos policies de la 0102 no pueden matchear nunca.
--
--   CREATE POLICY "programs_owner_access" ON programs FOR ALL USING (
--     org_id IN (SELECT id FROM organizaciones WHERE owner_id = auth.uid()) );
--
-- `organizaciones.owner_id` es una FK a `usuarios.id` (migración 0107), y
-- `auth.uid()` devuelve el id de Supabase Auth, que en este esquema vive en
-- `usuarios.auth_id`. Se comparan dos identificadores distintos, así que la
-- condición es siempre falsa. Lo mismo en `programs_coach_access`, que compara
-- `programs.coach_id` (un `usuarios.id`) contra `auth.uid()`.
--
-- Efecto real: con RLS activa y ninguna policy que matchee, la tabla es
-- invisible e inescribible para TODO el mundo salvo service role. Por eso
-- multicoach.html leía siempre cero filas y caía a MOCK_PROGRAMS.
--
-- El resto de policies del repositorio ya resuelven al usuario de la forma
-- correcta —`usuarios WHERE auth_id = auth.uid()`, ver 007_rls_policies.sql—.
-- Esta migración alinea `programs` con esa convención. Es el cambio mínimo que
-- hace usable la tabla: sin él no hay CRUD de programas por REST y habría que
-- crear una edge function, que es más superficie nueva, no menos.
--
-- Idempotente. No toca datos, solo policies.

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- Fuera las dos policies rotas (por nombre, tal como las creó la 0102).
DROP POLICY IF EXISTS "programs_owner_access" ON programs;
DROP POLICY IF EXISTS "programs_coach_access" ON programs;
-- Y las de esta migración, para poder re-correrla.
DROP POLICY IF EXISTS "programs_owner_all" ON programs;
DROP POLICY IF EXISTS "programs_org_read" ON programs;

-- 1) El DUEÑO de la organización: acceso completo a los programas de SU red.
--    WITH CHECK es imprescindible: sin él el INSERT/UPDATE se rechaza aunque
--    el USING permita leer la fila.
CREATE POLICY "programs_owner_all" ON programs
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT o.id FROM organizaciones o
      JOIN usuarios u ON u.id = o.owner_id
      WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT o.id FROM organizaciones o
      JOIN usuarios u ON u.id = o.owner_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- 2) Cualquier miembro de la organización (coach, colaborador, el propio
--    dueño) puede LEER los programas de su red. Escribir, solo el dueño.
CREATE POLICY "programs_org_read" ON programs
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT u.org_id FROM usuarios u
      WHERE u.auth_id = auth.uid() AND u.org_id IS NOT NULL
    )
  );

ALTER TABLE programs FORCE ROW LEVEL SECURITY;

COMMENT ON POLICY "programs_owner_all" ON programs IS
  'El dueno de la org (organizaciones.owner_id -> usuarios.id -> usuarios.auth_id = auth.uid()) gestiona los programas de su red.';
COMMENT ON POLICY "programs_org_read" ON programs IS
  'Cualquier miembro de la org lee sus programas. Escritura solo del dueno.';

-- Verificación manual:
--   SELECT polname, polcmd FROM pg_policy
--   WHERE polrelid = 'programs'::regclass ORDER BY polname;
-- Debe devolver programs_org_read (r) y programs_owner_all (*).
