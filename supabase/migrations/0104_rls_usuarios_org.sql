-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0104: RLS for usuarios (organization context)
-- ═══════════════════════════════════════════════════════════════════════
-- Políticas para que usuarios puedan leer coaches/owners de sus organizaciones.
--
-- Lógica:
--   1. User lee su propio perfil (siempre)
--   2. Owner lee coaches de su org (org_id match)
--   3. Coach lee solo su propio perfil (no ve otros coaches)
--   4. Admin lee todos
--
-- Nota: esta es la capa de org. Luego viene la de rol_en_org (Fase 2).
--

-- Enable RLS (ya está probablemente habilitado de migrations anteriores, pero asegurarse)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone reads themselves
CREATE POLICY "rls_usuarios_read_self"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- Policy 2: Owner reads coaches in their org
CREATE POLICY "rls_usuarios_owner_reads_org_coaches"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'owner'
      LIMIT 1
    )
    AND org_id IS NOT NULL
  );

-- Policy 3: Admin reads all
CREATE POLICY "rls_usuarios_admin_reads_all"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_id = auth.uid()
        AND rol = 'admin'
    )
  );

-- Anon can't read
ALTER TABLE usuarios FORCE ROW LEVEL SECURITY;

COMMENT ON POLICY "rls_usuarios_read_self" ON usuarios IS
  'Todo usuario autenticado puede leer su propio perfil.';

COMMENT ON POLICY "rls_usuarios_owner_reads_org_coaches" ON usuarios IS
  'Un owner puede leer todos los usuarios (coaches) de su organización.';

COMMENT ON POLICY "rls_usuarios_admin_reads_all" ON usuarios IS
  'Admin puede leer todos los usuarios de todas las organizaciones.';
