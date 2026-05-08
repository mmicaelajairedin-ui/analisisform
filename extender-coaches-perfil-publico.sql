-- ============================================================
-- Extender tabla `coaches` con campos de perfil publico
-- ============================================================
-- Reusa columnas que YA existen en coaches:
--   - nombre, bio, especialidades (TEXT[]), foto_url
-- Agrega lo nuevo necesario para la pagina /coach/{slug}.
--
-- Idempotente: se puede correr varias veces sin romper.
-- Hacer backup antes de ejecutar.
-- ============================================================

ALTER TABLE coaches
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS titulo_profesional TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS mi_enfoque TEXT,
  ADD COLUMN IF NOT EXISTS atiende TEXT,
  ADD COLUMN IF NOT EXISTS anios_experiencia INTEGER,
  ADD COLUMN IF NOT EXISTS calendly_url TEXT,
  ADD COLUMN IF NOT EXISTS perfil_publico_activo BOOLEAN DEFAULT FALSE;

-- Slug es la clave de busqueda en la pagina publica
CREATE INDEX IF NOT EXISTS idx_coaches_slug
  ON coaches(slug) WHERE slug IS NOT NULL;

-- Filtro frecuente: solo coaches activos publicamente
CREATE INDEX IF NOT EXISTS idx_coaches_perfil_activo
  ON coaches(perfil_publico_activo) WHERE perfil_publico_activo = TRUE;

-- ============================================================
-- VERIFICACION
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'coaches'
--   ORDER BY ordinal_position;
