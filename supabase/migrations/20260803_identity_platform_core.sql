-- ============================================================
-- Identity Platform — Core Infrastructure
-- Sprint B.1 — Organizations, Brand, Landing, Domains
-- ============================================================
-- EXECUTAR EN ORDEN. Backup completo ANTES de ejecutar.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- PASO 1: Crear tabla organizations (renombrado de coaches)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identidad
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- ej: "coach-a" → coach-a.pathwaycareercoach.com

  -- Plan (sin precios, solo capacidades)
  plan_id UUID REFERENCES plans(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'trial', 'suspended', 'inactive')),

  -- Configuración Regional (nueva sección)
  default_language TEXT DEFAULT 'es',  -- 'es' | 'en' | 'pt' | 'fr'
  timezone TEXT DEFAULT 'UTC',
  date_format TEXT DEFAULT 'DD/MM/YYYY',  -- patrón para fecha
  currency TEXT DEFAULT 'EUR',  -- ISO 4217
  country TEXT DEFAULT 'ES',  -- ISO 3166-1 alpha-2

  -- Legacy (deprecar lentamente)
  email TEXT UNIQUE,
  password_hash TEXT,

  -- Capacidades heredadas (migrando a plan_capabilities)
  max_clients INTEGER DEFAULT 10,
  max_coaches INTEGER DEFAULT 1,
  max_programs INTEGER DEFAULT 1,

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (owner_id, slug)
);

CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_plan ON organizations(plan_id);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ──────────────────────────────────────────────────────────────
-- PASO 2: Crear tabla organization_members
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rol local a esta org
  role TEXT DEFAULT 'coach' CHECK (role IN ('owner', 'coach', 'collaborator', 'viewer')),

  -- Auditoría
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- ──────────────────────────────────────────────────────────────
-- PASO 3: Crear tabla plans (planes, sin precios)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,  -- 'free' | 'pro' | 'enterprise'
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed inicial (Micaela define nombres/precios después)
INSERT INTO plans (slug, name, description, status) VALUES
  ('free', 'Free', 'Plan gratuito', 'active'),
  ('pro', 'Pro', 'Plan profesional', 'active'),
  ('enterprise', 'Enterprise', 'Plan empresarial', 'active')
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- PASO 4: Crear tabla plan_capabilities
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  capacidad TEXT NOT NULL,  -- 'branding.colors' | 'custom_domain' | 'multicoach' | ...

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (plan_id, capacidad)
);

CREATE INDEX idx_plan_caps_plan ON plan_capabilities(plan_id);

-- ──────────────────────────────────────────────────────────────
-- PASO 5: Crear tabla organization_branding
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Colores
  primary_color TEXT DEFAULT '#2D5016',
  secondary_color TEXT DEFAULT '#8C7B80',
  neutral_dark TEXT DEFAULT '#1F4030',
  neutral_light TEXT DEFAULT '#F5F3F0',

  -- Tipografía (select de opciones aprobadas)
  brand_font TEXT DEFAULT 'poppins',  -- 'poppins' | 'inter' | 'manrope' | ...

  -- White Label Level
  white_label_level INTEGER DEFAULT 0 CHECK (white_label_level IN (0, 1, 2, 3)),

  -- Versión actual
  current_version TEXT DEFAULT 'v1.0',

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_branding_org ON organization_branding(organization_id);

-- ──────────────────────────────────────────────────────────────
-- PASO 6: Crear tabla organization_assets (versionada)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version TEXT DEFAULT 'v1.0',

  -- Clasificación
  asset_category TEXT NOT NULL,  -- 'logo' | 'favicon' | 'social' | 'email' | 'pdf' | 'app' | 'certificate' | 'landing'
  asset_type TEXT NOT NULL,      -- 'logo_dark' | 'logo_light' | 'favicon' | 'og_image' | 'email_logo' | 'pdf_logo' | ...

  -- Storage
  file_url TEXT NOT NULL,  -- URL permanente (Uploadcare CDN)
  file_size_bytes INTEGER,
  mime_type TEXT,

  -- Dimensiones & validación
  dimensions JSONB,  -- {width, height, aspect_ratio}
  validation_status TEXT DEFAULT 'valid' CHECK (validation_status IN ('valid', 'needs_review', 'invalid')),
  validation_error TEXT,

  -- Uploadcare metadata
  uploadcare_file_id TEXT UNIQUE,

  -- Auditoría
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id),

  UNIQUE (organization_id, version, asset_type)
);

CREATE INDEX idx_assets_org_version ON organization_assets(organization_id, version);
CREATE INDEX idx_assets_category ON organization_assets(asset_category);

-- ──────────────────────────────────────────────────────────────
-- PASO 7: Crear tabla organization_brand_versions (audit trail)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_brand_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version TEXT NOT NULL,

  -- Snapshots
  branding_snapshot JSONB,  -- {primary_color, secondary_color, ...}
  assets_snapshot JSONB,    -- {logo_dark: url, logo_light: url, ...}

  -- Estado
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deprecated')),

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deprecated_at TIMESTAMPTZ,

  UNIQUE (organization_id, version)
);

CREATE INDEX idx_versions_org ON organization_brand_versions(organization_id);

-- ──────────────────────────────────────────────────────────────
-- PASO 8: Crear tabla organization_domains
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Subdominio automático (siempre existe, FK a organizations.slug)
  subdomain TEXT NOT NULL UNIQUE,  -- ej: "coach-a"

  -- Dominio custom (opcional)
  custom_domain TEXT UNIQUE,  -- ej: "coach.example.com"
  custom_domain_verified BOOLEAN DEFAULT false,

  -- Verificación DNS
  verification_token TEXT UNIQUE,
  verification_verified_at TIMESTAMPTZ,

  -- SSL
  ssl_enabled BOOLEAN DEFAULT false,
  ssl_cert_expires_at TIMESTAMPTZ,

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_domains_subdomain ON organization_domains(subdomain);
CREATE INDEX idx_domains_custom ON organization_domains(custom_domain);

-- ──────────────────────────────────────────────────────────────
-- PASO 9: Crear tabla organization_landing_config
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_landing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Orden de bloques
  blocks_order JSONB NOT NULL DEFAULT '["hero", "cta", "footer"]',

  -- Configuración por bloque
  hero_config JSONB,
  features_config JSONB,
  testimonials_config JSONB,
  services_config JSONB,
  about_config JSONB,
  team_config JSONB,
  faq_config JSONB,
  pricing_config JSONB,
  cta_config JSONB,
  footer_config JSONB,

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints: Hero, CTA y Footer siempre requeridos
  CONSTRAINT check_hero_required CHECK (blocks_order @> '["hero"]'::jsonb),
  CONSTRAINT check_cta_required CHECK (blocks_order @> '["cta"]'::jsonb),
  CONSTRAINT check_footer_required CHECK (blocks_order @> '["footer"]'::jsonb)
);

CREATE INDEX idx_landing_org ON organization_landing_config(organization_id);

-- ──────────────────────────────────────────────────────────────
-- PASO 10: Extender user_capacidades con org_id
-- ──────────────────────────────────────────────────────────────

ALTER TABLE user_capacidades ADD COLUMN IF NOT EXISTS
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE user_capacidades ADD COLUMN IF NOT EXISTS
  asignado_por_plan BOOLEAN DEFAULT false;

ALTER TABLE user_capacidades DROP CONSTRAINT IF EXISTS user_capacidades_pkey;
ALTER TABLE user_capacidades ADD PRIMARY KEY (user_id, organization_id, capacidad);

CREATE INDEX idx_cap_org ON user_capacidades(organization_id);
CREATE INDEX idx_cap_user_org ON user_capacidades(user_id, organization_id);

-- ──────────────────────────────────────────────────────────────
-- PASO 11: RLS Policies
-- ──────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_brand_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_landing_config ENABLE ROW LEVEL SECURITY;

-- Organizations: user puede ver solo sus orgs
CREATE POLICY org_select ON organizations
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = organizations.id
    )
  );

-- Organization Members: user puede ver miembros de sus orgs
CREATE POLICY org_members_select ON organization_members
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = organization_members.organization_id
    )
  );

-- Branding: readonly access
CREATE POLICY branding_select ON organization_branding
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Branding: update solo owner + capacidad
CREATE POLICY branding_update ON organization_branding
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM user_capacidades
      WHERE capacidad IN ('config.branding', 'config.identity')
        AND enabled = true
        AND (organization_id = organization_branding.organization_id OR organization_id IS NULL)
    )
  );

-- Assets: select
CREATE POLICY assets_select ON organization_assets
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Assets: insert solo owner
CREATE POLICY assets_insert ON organization_assets
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Landing Config: select
CREATE POLICY landing_select ON organization_landing_config
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Landing Config: update solo owner
CREATE POLICY landing_update ON organization_landing_config
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Domains: select
CREATE POLICY domains_select ON organization_domains
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Domains: update solo owner + capacidad custom_domain
CREATE POLICY domains_update ON organization_domains
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM user_capacidades
      WHERE capacidad = 'custom_domain'
        AND enabled = true
        AND (organization_id = organization_domains.organization_id OR organization_id IS NULL)
    )
  );

-- ──────────────────────────────────────────────────────────────
-- PASO 12: Seed inicial (Para testing)
-- ──────────────────────────────────────────────────────────────

-- Estos inserts son OPCIONALES. Descomentar solo si necesitas datos de testing.
-- En producción, las orgs se crean cuando el usuario se registra.

-- INSERT INTO organizations (owner_id, name, slug, plan_id, status, default_language, timezone, currency, country)
-- VALUES (
--   'OWNER_UUID_HERE',
--   'Pathway Demo',
--   'pathway-demo',
--   (SELECT id FROM plans WHERE slug = 'free'),
--   'active',
--   'es',
--   'UTC',
--   'EUR',
--   'ES'
-- )
-- ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- FIN DE LA MIGRACIÓN
-- ──────────────────────────────────────────────────────────────
