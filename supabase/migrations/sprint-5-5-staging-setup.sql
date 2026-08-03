-- Sprint 5.5 Staging Setup
-- Crear usuarios de test, datos de test, y RLS para validación real
-- Ejecutar en: Supabase SQL Editor (staging environment)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. USUARIOS DE TEST
-- ─────────────────────────────────────────────────────────────────────────

-- Owner test (puede crear, editar, cancelar cualquier sesión)
INSERT INTO usuarios (email, nombre, rol, org_id, permisos, activo)
VALUES (
  'qa-owner@staging.test',
  'QA Owner Test',
  'owner',
  1,
  '["agenda.create","agenda.edit","agenda.edit.others","agenda.cancel","agenda.cancel.others","agenda.reschedule","agenda.manage.availability","agenda.read.team","agenda.read.global"]'::jsonb,
  true
)
ON CONFLICT (email) DO UPDATE SET activo = true
RETURNING id AS owner_id;

-- Coach test (puede crear/editar solo sus sesiones)
INSERT INTO usuarios (email, nombre, rol, org_id, permisos, activo)
VALUES (
  'qa-coach@staging.test',
  'QA Coach Test',
  'coach',
  1,
  '["agenda.create","agenda.edit","agenda.cancel","agenda.reschedule","agenda.manage.availability","agenda.read.team"]'::jsonb,
  true
)
ON CONFLICT (email) DO UPDATE SET activo = true
RETURNING id AS coach_id;

-- Client test (read-only, puede confirmar asistencia)
INSERT INTO usuarios (email, nombre, rol, org_id, permisos, activo)
VALUES (
  'qa-client@staging.test',
  'QA Client Test',
  'client',
  1,
  '["agenda.read.self"]'::jsonb,
  activo
)
ON CONFLICT (email) DO UPDATE SET activo = true
RETURNING id AS client_id;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. DATOS DE TEST (sesiones_registro)
-- ─────────────────────────────────────────────────────────────────────────

-- Session 1: Programada para HOY + 2 días (para realtime testing)
INSERT INTO sesiones_registro (
  titulo, descripcion, fecha, hora, duracion_minutos,
  tipo, coach_id, cliente_id, estado,
  participantes, metadata,
  creado_por, actualizado_por
)
VALUES (
  'Sesión de Prueba Owner-Coach',
  'Validación Sprint 5.5: Realtime sync',
  CURRENT_DATE + INTERVAL '2 days',
  '15:00',
  60,
  'sesion_individual',
  (SELECT id FROM usuarios WHERE email = 'qa-coach@staging.test'),
  (SELECT id FROM usuarios WHERE email = 'qa-client@staging.test'),
  'scheduled',
  '["coach","client"]'::jsonb,
  '{"event_type":"sesion_individual","week":1,"qa_session":true}'::jsonb,
  (SELECT id FROM usuarios WHERE email = 'qa-owner@staging.test'),
  (SELECT id FROM usuarios WHERE email = 'qa-owner@staging.test')
)
RETURNING id AS session_id;

-- Session 2: Sesión futuro próximo para Coach test
INSERT INTO sesiones_registro (
  titulo, descripcion, fecha, hora, duracion_minutos,
  tipo, coach_id, cliente_id, estado,
  participantes, metadata,
  creado_por, actualizado_por
)
VALUES (
  'Sesión del Coach',
  'Validación Sprint 5.5: Coach edit/confirm flow',
  CURRENT_DATE + INTERVAL '3 days',
  '16:00',
  60,
  'clase',
  (SELECT id FROM usuarios WHERE email = 'qa-coach@staging.test'),
  (SELECT id FROM usuarios WHERE email = 'qa-client@staging.test'),
  'scheduled',
  '["coach","client"]'::jsonb,
  '{"event_type":"clase","week":1,"qa_session":true}'::jsonb,
  (SELECT id FROM usuarios WHERE email = 'qa-owner@staging.test'),
  (SELECT id FROM usuarios WHERE email = 'qa-owner@staging.test')
)
RETURNING id AS session_id;

-- Session 3: Sesión de otro coach (para validar que coach1 NO puede editar)
INSERT INTO usuarios (email, nombre, rol, org_id, permisos, activo)
VALUES (
  'qa-coach2@staging.test',
  'QA Coach Test 2',
  'coach',
  1,
  '["agenda.create","agenda.edit","agenda.cancel","agenda.reschedule"]'::jsonb,
  true
)
ON CONFLICT (email) DO UPDATE SET activo = true
RETURNING id AS coach2_id;

INSERT INTO sesiones_registro (
  titulo, descripcion, fecha, hora, duracion_minutos,
  tipo, coach_id, cliente_id, estado,
  participantes, metadata,
  creado_por, actualizado_por
)
VALUES (
  'Sesión de Otro Coach',
  'Validación Sprint 5.5: Permission boundary - coach1 debe ver pero NO editar',
  CURRENT_DATE + INTERVAL '4 days',
  '14:00',
  60,
  'evaluacion',
  (SELECT id FROM usuarios WHERE email = 'qa-coach2@staging.test'),
  (SELECT id FROM usuarios WHERE email = 'qa-client@staging.test'),
  'scheduled',
  '["coach","client"]'::jsonb,
  '{"event_type":"evaluacion","week":1,"qa_session":true}'::jsonb,
  (SELECT id FROM usuarios WHERE email = 'qa-owner@staging.test'),
  (SELECT id FROM usuarios WHERE email = 'qa-owner@staging.test')
)
RETURNING id AS session_id;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS POLICIES (SECURITY - CRITICAL)
-- ─────────────────────────────────────────────────────────────────────────

-- Enable RLS on sesiones_registro (if not already enabled)
ALTER TABLE sesiones_registro ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS sesiones_owner_all ON sesiones_registro;
DROP POLICY IF EXISTS sesiones_coach_own ON sesiones_registro;
DROP POLICY IF EXISTS sesiones_client_own ON sesiones_registro;
DROP POLICY IF EXISTS sesiones_read_all ON sesiones_registro;

-- POLICY 1: Owner can see/edit ALL sesiones
CREATE POLICY sesiones_owner_all ON sesiones_registro
  FOR ALL
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'owner'
    OR auth.uid() = creado_por
  )
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'owner'
    OR auth.uid() = creado_por
  );

-- POLICY 2: Coach can see/edit ONLY their own sesiones
CREATE POLICY sesiones_coach_own ON sesiones_registro
  FOR ALL
  USING (
    coach_id = auth.uid()
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'owner'
    OR auth.uid() IN (
      SELECT DISTINCT coach_id FROM sesiones_registro
      WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'coach'
  );

-- POLICY 3: Client can see ONLY their own sesiones (participantes JSONB)
CREATE POLICY sesiones_client_own ON sesiones_registro
  FOR SELECT
  USING (
    cliente_id = auth.uid()
    OR participantes @> to_jsonb(COALESCE((SELECT email FROM usuarios WHERE id = auth.uid()), ''))
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. BLOCK DATES TABLE (for availability testing)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agenda_bloques (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  duracion_horas INTEGER DEFAULT 1,
  motivo TEXT DEFAULT '',
  estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'cancelled')),
  creado_por UUID REFERENCES usuarios(id),
  actualizado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_bloques_usuario_idx ON agenda_bloques(usuario_id);
CREATE INDEX IF NOT EXISTS agenda_bloques_fecha_idx ON agenda_bloques(fecha_inicio);

-- RLS for agenda_bloques
ALTER TABLE agenda_bloques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bloques_own ON agenda_bloques;
DROP POLICY IF EXISTS bloques_admin ON agenda_bloques;

CREATE POLICY bloques_own ON agenda_bloques
  FOR ALL
  USING (
    usuario_id = auth.uid()
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'owner'
  )
  WITH CHECK (
    usuario_id = auth.uid()
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'owner'
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 5. SUPABASE AUTH INTEGRATION (if using Supabase Auth)
-- ─────────────────────────────────────────────────────────────────────────
-- NOTE: These users should also be created in Supabase Auth with matching emails
-- Via: Supabase Dashboard → Authentication → Users → Add user
-- Passwords: any (for testing); Confirm email: checked

-- ─────────────────────────────────────────────────────────────────────────
-- 6. VERIFICATION QUERIES (run to confirm setup)
-- ─────────────────────────────────────────────────────────────────────────

-- Check users created
SELECT
  email, nombre, rol, permisos, activo
FROM usuarios
WHERE email LIKE 'qa-%'
ORDER BY email;

-- Check test sessions
SELECT
  id, titulo, fecha, hora, tipo, coach_id, cliente_id, estado, participantes
FROM sesiones_registro
WHERE metadata->>'qa_session' = 'true'
ORDER BY fecha;

-- Check RLS policies
SELECT
  tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('sesiones_registro', 'agenda_bloques')
ORDER BY tablename, policyname;

-- ─────────────────────────────────────────────────────────────────────────
-- NOTES FOR QA ENGINEERS
-- ─────────────────────────────────────────────────────────────────────────
-- 1. Users: qa-owner@staging.test | qa-coach@staging.test | qa-client@staging.test
-- 2. Sessions created for +2d, +3d, +4d (so they appear in "upcoming")
-- 3. RLS enforces: Owner sees all, Coach sees own, Client sees own
-- 4. To test realtime: open 3 windows with different users, watch sync without refresh
-- 5. To test permissions: Coach2 has a session, Coach1 should NOT be able to edit it
-- 6. Reset test data: DELETE FROM sesiones_registro WHERE metadata->>'qa_session'='true';

-- RUN THIS LAST TO COMMIT
-- SELECT 'Sprint 5.5 Staging Setup Complete' AS status;
