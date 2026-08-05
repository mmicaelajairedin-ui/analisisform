-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0109: Create colaborador_permisos table (Fase 2: Colaboradores)
-- ═══════════════════════════════════════════════════════════════════════
-- Propósito: Tabla para trackear permisos específicos de colaboradores
--           dentro de una organización. Multicoach.html la consulta cuando
--           un usuario con rol 'colaborador' intenta acceder.
--
-- Estructura:
--   - usuario_id: UUID del usuario colaborador (usuarios.id)
--   - org_id: UUID de la organización (organizaciones.id)
--   - permisos: JSONB array de permisos (ej: ["crear_coach", "ver_analitycs"])
--
-- Impacto: Colaboradores pueden acceder a MultiCoach sin 404 en BD.
--         Permite control granular de permisos sin necesidad de roles rígidos.

CREATE TABLE IF NOT EXISTS colaborador_permisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  permisos JSONB DEFAULT '[]'::jsonb,  -- array de strings: ["crear_coach", "ver_citas", "ver_reportes", etc.]
  creada_at TIMESTAMPTZ DEFAULT now(),
  actualizada_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(usuario_id, org_id)  -- un colaborador = un row por org
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_colaborador_permisos_usuario_id ON colaborador_permisos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_colaborador_permisos_org_id ON colaborador_permisos(org_id);
CREATE INDEX IF NOT EXISTS idx_colaborador_permisos_usuario_org ON colaborador_permisos(usuario_id, org_id);

-- RLS: colaborador ve solo sus permisos; owner ve todos los de su org
ALTER TABLE colaborador_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "colaborador_permisos_view_own" ON colaborador_permisos;
CREATE POLICY "colaborador_permisos_view_own" ON colaborador_permisos
  FOR SELECT
  USING (
    usuario_id = auth.uid()
    OR org_id IN (
      SELECT id FROM organizaciones WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "colaborador_permisos_owner_all" ON colaborador_permisos;
CREATE POLICY "colaborador_permisos_owner_all" ON colaborador_permisos
  FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizaciones WHERE owner_id = auth.uid()
    )
  );

-- GRANT para que autenticados puedan leer su fila
GRANT SELECT ON colaborador_permisos TO authenticated;
GRANT SELECT ON colaborador_permisos TO anon;

COMMENT ON TABLE colaborador_permisos IS
  'Tabla de permisos granulares para colaboradores dentro de una organización. Pendiente para Fase 2: integración con modelo de capacidades.';

COMMENT ON COLUMN colaborador_permisos.permisos IS
  'Array JSON de permisos (strings). Ejemplos: ["crear_coach", "ver_citas", "ver_reportes", "gestionar_clientes"]. Vacío = sin permisos específicos.';
