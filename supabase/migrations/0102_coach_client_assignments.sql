-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0102: Create coach_client_assignments table
-- ═══════════════════════════════════════════════════════════════════════
-- Nueva tabla para relación explícita entre coaches y clientes dentro de
-- una organización. Esto es el "mapeo" de quién es coach de quién.
--
-- Antes: inferíamos la relación de candidatos.coach_id
-- Ahora: tabla explícita que permite:
--   - Auditar cuándo se asignó
--   - Cambiar estado (activa/pausada/cerrada)
--   - Validar RLS (Coach X puede VER cliente Y porque hay assignment)
--   - Preparar permisos complejos (Fase 2)
--

CREATE TABLE IF NOT EXISTS coach_client_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  coach_id        UUID NOT NULL,
  client_id       UUID NOT NULL,

  -- Estado de la relación
  estado          TEXT DEFAULT 'activa',

  -- Auditoría básica
  assigned_at     TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ,

  -- Constraints
  UNIQUE(org_id, coach_id, client_id),
  CONSTRAINT fk_assignment_org
    FOREIGN KEY (org_id)
    REFERENCES organizaciones(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_coach
    FOREIGN KEY (coach_id)
    REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_client
    FOREIGN KEY (client_id)
    REFERENCES candidatos(id) ON DELETE CASCADE
);

-- Índices para queries comunes
CREATE INDEX IF NOT EXISTS idx_assignments_org
  ON coach_client_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_assignments_org_coach
  ON coach_client_assignments(org_id, coach_id);
CREATE INDEX IF NOT EXISTS idx_assignments_org_client
  ON coach_client_assignments(org_id, client_id);
CREATE INDEX IF NOT EXISTS idx_assignments_estado
  ON coach_client_assignments(estado)
  WHERE estado = 'activa';

-- Comments
COMMENT ON TABLE coach_client_assignments IS
  'Relación explícita: Coach X está asignado a Cliente Y dentro de Org Z. '
  'Permite auditar asignaciones, cambiar estado, y validar permisos.';

COMMENT ON COLUMN coach_client_assignments.estado IS
  'activa | pausada | cerrada. Estado de la relación coach-cliente.';

COMMENT ON COLUMN coach_client_assignments.assigned_at IS
  'Cuándo se creó la asignación (auditoría).';
