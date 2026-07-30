-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0101: Add rol_en_org column to usuarios
-- ═══════════════════════════════════════════════════════════════════════
-- Agregar columna rol_en_org para que el usuario tenga un rol explícito dentro
-- de su organización. Esto es separado del rol global (coach, admin, cliente).
--
-- Valores posibles:
--   - 'owner': Dueño de la organización
--   - 'coach': Coach dentro de la organización
--   - 'colaborador': Colaborador con permisos específicos (Fase 2)
--   - NULL: Usuario sin rol específico en org (coach individual legacy)
--

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol_en_org TEXT;

COMMENT ON COLUMN usuarios.rol_en_org IS
  'Rol del usuario dentro de su organización. owner | coach | colaborador | null. '
  'Separado del rol global (que determina si es coach, admin, cliente). '
  'Permite que un usuario tenga org_id y un rol específico en esa org.';

-- Índice para queries eficientes por org_id + rol_en_org
CREATE INDEX IF NOT EXISTS idx_usuarios_org_rol_en_org
  ON usuarios(org_id, rol_en_org)
  WHERE org_id IS NOT NULL AND rol_en_org IS NOT NULL;
