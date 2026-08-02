-- Sprint 5.1: Capability-based permission model
-- Table: user_capacidades (user_id, capacidad, enabled)

CREATE TABLE IF NOT EXISTS user_capacidades (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  capacidad TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, capacidad)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_capacidades_org_id ON user_capacidades(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_capacidades_user_id ON user_capacidades(user_id);
CREATE INDEX IF NOT EXISTS idx_user_capacidades_capacidad ON user_capacidades(capacidad);
CREATE INDEX IF NOT EXISTS idx_user_capacidades_org_user ON user_capacidades(organization_id, user_id);

-- Enable RLS
ALTER TABLE user_capacidades ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Owner y Admin de la org ven/editan todas las capacidades
CREATE POLICY "org_owner_all_capacidades" ON user_capacidades
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM organizaciones
      WHERE owner_id = auth.uid()
    )
  );

-- RLS Policy 2: Usuarios ven sus propias capacidades
CREATE POLICY "user_own_capacidades" ON user_capacidades
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- RLS Policy 3: Coaches con capacidad 'config.usuarios' pueden ver/editar capacidades del equipo
CREATE POLICY "config_usuarios_can_edit" ON user_capacidades
  FOR ALL USING (
    organization_id IN (
      SELECT u.organization_id FROM usuarios u
      WHERE u.id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM user_capacidades uc
          WHERE uc.user_id = auth.uid()
            AND uc.capacidad = 'config.usuarios'
            AND uc.enabled = true
        )
    )
  );

-- Tabla de presets (opcional, para reutilizar)
CREATE TABLE IF NOT EXISTS capacidades_presets (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo_persona TEXT NOT NULL, -- 'Coach', 'Colaborador', 'Owner'
  capacidades TEXT[] NOT NULL, -- Array de capacidades
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed presets (data)
INSERT INTO capacidades_presets (nombre, descripcion, tipo_persona, capacidades)
VALUES
  (
    'Coach Estándar',
    'Coach con acceso a clientes propios, agenda, programas y IA',
    'Coach',
    ARRAY[
      'clientes.read',
      'clientes.edit',
      'clientes.notes',
      'agenda.view_own',
      'agenda.create',
      'agenda.edit',
      'programas.create',
      'programas.edit',
      'recursos.create',
      'recursos.share',
      'mensajes.send',
      'ia.use',
      'analytics.view_own'
    ]
  ),
  (
    'Coach Senior',
    'Coach Senior con permisos de asignación, visibilidad de equipo y colaboración',
    'Coach',
    ARRAY[
      'clientes.read',
      'clientes.create',
      'clientes.edit',
      'clientes.assign',
      'clientes.notes',
      'agenda.view_own',
      'agenda.view_team',
      'agenda.create',
      'agenda.edit',
      'programas.create',
      'programas.edit',
      'recursos.create',
      'recursos.share',
      'mensajes.send',
      'ia.use',
      'analytics.view_own',
      'collab.compartir_cliente'
    ]
  ),
  (
    'Recruiter',
    'Colaborador especializado en captación y asignación de candidatos',
    'Colaborador',
    ARRAY[
      'clientes.read',
      'clientes.create',
      'clientes.assign',
      'agenda.view_own',
      'mensajes.send',
      'analytics.view_own'
    ]
  ),
  (
    'Asistente',
    'Colaborador de apoyo con acceso a agenda y mensajes',
    'Colaborador',
    ARRAY[
      'agenda.create',
      'agenda.edit',
      'agenda.view_own',
      'mensajes.send',
      'clientes.read'
    ]
  ),
  (
    'Admin Recursos',
    'Gestión de recursos y biblioteca',
    'Colaborador',
    ARRAY[
      'recursos.create',
      'recursos.share',
      'recursos.edit',
      'recursos.delete',
      'biblioteca.manage',
      'biblioteca.publish',
      'analytics.view_org'
    ]
  ),
  (
    'RRHH',
    'Reportes y analytics de organización',
    'Colaborador',
    ARRAY[
      'clientes.read',
      'analytics.view_org',
      'analytics.export'
    ]
  ),
  (
    'Owner',
    'Acceso total a la organización',
    'Owner',
    ARRAY[
      'clientes.read',
      'clientes.create',
      'clientes.edit',
      'clientes.assign',
      'clientes.archive',
      'clientes.notes',
      'agenda.view_own',
      'agenda.view_team',
      'agenda.create',
      'agenda.edit',
      'agenda.cancel',
      'programas.create',
      'programas.edit',
      'programas.publish',
      'programas.delete',
      'recursos.create',
      'recursos.share',
      'recursos.edit',
      'recursos.delete',
      'biblioteca.manage',
      'biblioteca.publish',
      'mensajes.send',
      'mensajes.view',
      'mensajes.archive',
      'ia.use',
      'ia.crear_prompts',
      'comunidad.publicar',
      'comunidad.moderar',
      'comunidad.ver',
      'marketplace.perfil',
      'marketplace.recibir',
      'marketplace.reviews',
      'analytics.view_own',
      'analytics.view_org',
      'analytics.export',
      'billing.view_own',
      'billing.view_org',
      'billing.manage_invoice',
      'billing.receive_payment',
      'billing.export',
      'config.usuarios',
      'config.branding',
      'config.especialidades',
      'collab.compartir_cliente',
      'collab.delegar'
    ]
  )
ON CONFLICT DO NOTHING;
