-- ============================================================
-- Extender tabla `usuarios` con campos de perfil publico de coach
-- ============================================================
-- Cada coach tiene una pagina publica en /coach/{slug} que comparte
-- en redes para captar candidatos. Estos campos alimentan esa pagina.
--
-- Idempotente: se puede correr varias veces sin romper.
-- Solo aplica para usuarios con rol='coach' o 'admin' (no candidatos).
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS titulo_profesional TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS bio_publica TEXT,
  ADD COLUMN IF NOT EXISTS mi_enfoque TEXT,
  ADD COLUMN IF NOT EXISTS especialidades TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS atiende TEXT,
  ADD COLUMN IF NOT EXISTS anios_experiencia INTEGER,
  ADD COLUMN IF NOT EXISTS calendly_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_perfil_url TEXT,
  ADD COLUMN IF NOT EXISTS perfil_publico_activo BOOLEAN DEFAULT FALSE;

-- Slug es la clave de busqueda en la pagina publica
CREATE INDEX IF NOT EXISTS idx_usuarios_slug
  ON usuarios(slug) WHERE slug IS NOT NULL;

-- Filtro frecuente: solo perfiles activos publicamente
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil_activo
  ON usuarios(perfil_publico_activo) WHERE perfil_publico_activo = TRUE;

-- ============================================================
-- VERIFICACION
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'usuarios'
--   ORDER BY ordinal_position;
