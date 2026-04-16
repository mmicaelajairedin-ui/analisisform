-- ============================================================
-- Pathway Career Coach — Marketplace Schema Migration
-- ============================================================
-- EJECUTAR EN ORDEN. Hacer backup completo ANTES de ejecutar.
-- Reemplazar 'UUID-MICAELA' con el UUID real de Micaela en auth.users
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- PASO 1: Crear tabla coaches (debe existir antes de las FK)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- SHA-256 hash (mismo patron que usuarios)
  nombre_practica TEXT,
  bio TEXT,
  especialidades TEXT[] DEFAULT '{}',
  mercados TEXT[] DEFAULT '{}',
  idiomas TEXT[] DEFAULT '{}',
  foto_url TEXT,
  logo_url TEXT,
  color_primario TEXT DEFAULT '#2D6A4F',
  nombre_plataforma TEXT,
  precio_sesion NUMERIC,
  precio_programa NUMERIC,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  estado TEXT DEFAULT 'prueba' CHECK (estado IN ('activo', 'inactivo', 'prueba', 'suspendido')),
  visible_directorio BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  fecha_inicio_prueba TIMESTAMPTZ DEFAULT NOW(),
  fecha_vencimiento TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  max_candidatos INTEGER DEFAULT 15,
  rating NUMERIC DEFAULT 0,
  total_resenas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar a Micaela como primer coach (super-admin)
-- REEMPLAZAR email y nombre si es necesario
INSERT INTO coaches (nombre, email, plan, estado, visible_directorio, max_candidatos)
VALUES ('Micaela Jairedin', 'EMAIL-DE-MICAELA', 'enterprise', 'activo', false, 999)
ON CONFLICT (email) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- PASO 2: Agregar coach_id a tablas existentes
-- ──────────────────────────────────────────────────────────────
-- El DEFAULT apunta al ID de Micaela para que todos los registros
-- existentes queden asignados a ella automáticamente.

-- Primero obtener el ID de Micaela:
-- SELECT id FROM coaches WHERE email = 'EMAIL-DE-MICAELA';
-- Luego reemplazar 'UUID-MICAELA' abajo con ese valor.

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS
  coach_id UUID REFERENCES coaches(id) DEFAULT 'UUID-MICAELA';

ALTER TABLE informes ADD COLUMN IF NOT EXISTS
  coach_id UUID REFERENCES coaches(id) DEFAULT 'UUID-MICAELA';

ALTER TABLE cv_publicados ADD COLUMN IF NOT EXISTS
  coach_id UUID REFERENCES coaches(id) DEFAULT 'UUID-MICAELA';

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS
  coach_id UUID REFERENCES coaches(id) DEFAULT 'UUID-MICAELA';

-- ──────────────────────────────────────────────────────────────
-- PASO 3: Tabla suscripciones
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  plan TEXT CHECK (plan IN ('mensual', 'anual')),
  precio NUMERIC,
  moneda TEXT DEFAULT 'eur',
  estado TEXT DEFAULT 'prueba' CHECK (estado IN ('activa', 'cancelada', 'vencida', 'prueba')),
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
  fecha_fin TIMESTAMPTZ,
  fecha_proximo_cobro TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- PASO 4: Tabla candidaturas (tracking de aplicaciones)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS candidaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id UUID REFERENCES candidatos(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES coaches(id),
  empresa TEXT,
  puesto TEXT,
  url_oferta TEXT,
  estado TEXT DEFAULT 'guardada' CHECK (estado IN ('guardada', 'aplicada', 'entrevista', 'oferta', 'descartada')),
  fecha_aplicacion TIMESTAMPTZ,
  fecha_entrevista TIMESTAMPTZ,
  notas TEXT,
  notas_coach TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- PASO 5: Tabla reseñas de coaches
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS resenas_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  candidato_id UUID REFERENCES candidatos(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comentario TEXT,
  visible BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- PASO 6: Tabla conexiones coach-candidato
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conexiones_coach_candidato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id UUID REFERENCES candidatos(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  origen TEXT DEFAULT 'manual' CHECK (origen IN ('directorio', 'invitacion_coach', 'manual')),
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('pendiente', 'activa', 'finalizada')),
  comision_aplicada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- PASO 7: Tabla invitaciones (para tokens de invitación)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT,
  token TEXT UNIQUE NOT NULL,
  usado BOOLEAN DEFAULT false,
  expira_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '72 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- PASO 8: Tabla cv_variantes (CV adaptado por oferta)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cv_variantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id UUID REFERENCES candidatos(id) ON DELETE CASCADE,
  candidatura_id UUID REFERENCES candidaturas(id),
  nombre TEXT,
  contenido JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- INDICES para rendimiento
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_candidatos_coach ON candidatos(coach_id);
CREATE INDEX IF NOT EXISTS idx_informes_coach ON informes(coach_id);
CREATE INDEX IF NOT EXISTS idx_cv_publicados_coach ON cv_publicados(coach_id);
CREATE INDEX IF NOT EXISTS idx_candidaturas_candidato ON candidaturas(candidato_id);
CREATE INDEX IF NOT EXISTS idx_candidaturas_coach ON candidaturas(coach_id);
CREATE INDEX IF NOT EXISTS idx_conexiones_coach ON conexiones_coach_candidato(coach_id);
CREATE INDEX IF NOT EXISTS idx_conexiones_candidato ON conexiones_coach_candidato(candidato_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_coach ON suscripciones(coach_id);
CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON invitaciones(token);
CREATE INDEX IF NOT EXISTS idx_coaches_estado ON coaches(estado);
CREATE INDEX IF NOT EXISTS idx_coaches_visible ON coaches(visible_directorio, estado);

-- ──────────────────────────────────────────────────────────────
-- VERIFICACION: Correr despues de ejecutar todo
-- ──────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM candidatos WHERE coach_id IS NOT NULL;
-- SELECT COUNT(*) FROM coaches;
-- SELECT * FROM coaches LIMIT 5;
