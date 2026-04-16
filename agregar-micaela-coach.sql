-- ============================================================
-- Agregar a Micaela como Coach (sin crear nuevo usuario)
-- ============================================================
-- Usa el email y password_hash que YA TIENE en la tabla `usuarios`
-- y lo enlaza a un nuevo registro en la tabla `coaches`.
--
-- INSTRUCCIONES:
-- 1. Reemplazar 'TU_EMAIL_AQUI' con tu email real de login
-- 2. Ejecutar este script en el SQL Editor de Supabase
-- ============================================================

-- PASO 1: Verificar que existe en `usuarios`
SELECT id, email, nombre, rol, activo
FROM usuarios
WHERE email = 'TU_EMAIL_AQUI';
-- Deberia devolver 1 fila. Si no, primero hay que crear el usuario.

-- PASO 2: Crear (o actualizar) tu registro en `coaches`
-- copiando el password_hash desde `usuarios` para que el login siga funcionando
INSERT INTO coaches (
  nombre,
  email,
  password_hash,
  nombre_practica,
  bio,
  especialidades,
  mercados,
  idiomas,
  plan,
  estado,
  visible_directorio,
  max_candidatos
)
SELECT
  COALESCE(u.nombre, 'Micaela Jairedin'),
  u.email,
  u.password_hash,
  'Micaela Jairedin Coaching',
  'Career coach especializada en transicion de carrera. +5 anos ayudando a profesionales a encontrar su proximo paso.',
  ARRAY['transicion', 'ejecutivo'],
  ARRAY['espana', 'argentina', 'latam'],
  ARRAY['es', 'en'],
  'enterprise',
  'activo',
  true,
  999
FROM usuarios u
WHERE u.email = 'TU_EMAIL_AQUI'
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  nombre = EXCLUDED.nombre,
  estado = 'activo',
  plan = 'enterprise',
  max_candidatos = 999;

-- PASO 3: Asegurar que el usuario tiene rol 'coach' o 'admin'
UPDATE usuarios SET rol = 'coach' WHERE email = 'TU_EMAIL_AQUI' AND rol NOT IN ('coach', 'admin');

-- PASO 4: Enlazar usuarios.coach_id con coaches.id
UPDATE usuarios u
SET coach_id = c.id
FROM coaches c
WHERE u.email = 'TU_EMAIL_AQUI' AND c.email = u.email;

-- PASO 5: Asignar todos los candidatos existentes a tu coach_id
-- (solo si la columna coach_id existe en candidatos)
UPDATE candidatos
SET coach_id = (SELECT id FROM coaches WHERE email = 'TU_EMAIL_AQUI')
WHERE coach_id IS NULL;

-- PASO 6: Crear suscripcion ilimitada para Micaela (super-admin, sin pago)
INSERT INTO suscripciones (
  coach_id,
  plan,
  precio,
  moneda,
  estado,
  fecha_inicio,
  fecha_fin
)
SELECT
  id,
  'anual',
  0,
  'eur',
  'activa',
  NOW(),
  NOW() + INTERVAL '10 years'
FROM coaches
WHERE email = 'TU_EMAIL_AQUI'
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICACION
-- ============================================================
SELECT
  c.id as coach_id,
  c.email,
  c.nombre,
  c.plan,
  c.estado,
  u.rol,
  u.coach_id as usuario_coach_id,
  (SELECT COUNT(*) FROM candidatos WHERE coach_id = c.id) as total_candidatos
FROM coaches c
LEFT JOIN usuarios u ON u.email = c.email
WHERE c.email = 'TU_EMAIL_AQUI';
