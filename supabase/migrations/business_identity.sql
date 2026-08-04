-- Business Identity Engine — Core Tables
-- Una fuente única de verdad para la identidad del coach

-- Tabla: business_identity
-- Almacena la información del negocio del coach (único formulario)
CREATE TABLE IF NOT EXISTS business_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Identidad base
  nombre TEXT NOT NULL,
  especialidad TEXT,  -- fitness, executive, carrera, finanzas, nutrición, productividad, etc.
  pais TEXT,
  idiomas TEXT[] DEFAULT '{es}',

  -- Posicionamiento (THE SOURCE OF TRUTH)
  qué_haces TEXT NOT NULL,
  a_quién_ayudas TEXT NOT NULL,
  problema_resuelve TEXT NOT NULL,
  cómo_trabajas TEXT,
  servicios TEXT[],  -- array de strings
  resultados_clientes TEXT[],  -- array de strings
  tono TEXT,  -- directo, inspirador, profesional, amigable, técnico, etc.

  -- Operacional
  cta_texto TEXT,
  cta_url TEXT,

  -- Metadata
  generated_at TIMESTAMPTZ,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Coach solo ve su propia identidad (admin ve todas)
ALTER TABLE business_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own identity" ON business_identity
  FOR SELECT USING (
    auth.uid()::TEXT = coach_id::TEXT
    OR (SELECT rol FROM usuarios WHERE id = coach_id LIMIT 1) = 'admin'
  );

CREATE POLICY "Coaches can insert own identity" ON business_identity
  FOR INSERT WITH CHECK (auth.uid()::TEXT = coach_id::TEXT);

CREATE POLICY "Coaches can update own identity" ON business_identity
  FOR UPDATE USING (auth.uid()::TEXT = coach_id::TEXT)
  AFTER UPDATE EXECUTE FUNCTION trigger_regenerate_business_outputs();

CREATE POLICY "Coaches can delete own identity" ON business_identity
  FOR DELETE USING (auth.uid()::TEXT = coach_id::TEXT);

-- Tabla: business_outputs
-- Los outputs generados por IA (landing, emails, seo, etc.)
-- Esta tabla es REGENERADA cada vez que business_identity cambia
CREATE TABLE IF NOT EXISTS business_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES business_identity(id) ON DELETE CASCADE UNIQUE,

  -- Landing
  landing_hero TEXT,
  landing_subhero TEXT,
  landing_benefits JSONB,
  landing_services JSONB,
  landing_faq JSONB,
  landing_cta_primary TEXT,
  landing_cta_secondary TEXT,

  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  seo_og_title TEXT,
  seo_og_description TEXT,
  seo_og_image_prompt TEXT,  -- para generar imagen con IA

  -- Email templates (JSON por tipo)
  emails JSONB,  -- {welcome, proposal, followup, onboarding}

  -- Portal del cliente
  portal_hero TEXT,
  portal_welcome TEXT,
  portal_success_messages JSONB,

  -- Marketplace
  marketplace_bio TEXT,
  marketplace_teaser TEXT,

  -- IA Assistant
  ai_system_prompt TEXT,
  ai_opening_message TEXT,

  -- Onboarding
  onboarding_welcome TEXT,
  onboarding_steps JSONB,

  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT now(),
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE business_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own outputs" ON business_outputs
  FOR SELECT USING (
    identity_id IN (
      SELECT id FROM business_identity WHERE auth.uid()::TEXT = coach_id::TEXT
    )
    OR (SELECT rol FROM usuarios WHERE id::TEXT = auth.uid() LIMIT 1) = 'admin'
  );

-- Índices para performance
CREATE INDEX idx_business_identity_coach_id ON business_identity(coach_id);
CREATE INDEX idx_business_outputs_identity_id ON business_outputs(identity_id);

-- Trigger function: Queue regeneration cuando business_identity cambia
CREATE OR REPLACE FUNCTION trigger_regenerate_business_outputs()
RETURNS TRIGGER AS $$
BEGIN
  -- En B.6.7 esto llamará a la edge function
  -- Por ahora, solo marca que necesita regeneración
  UPDATE business_outputs
  SET generated_at = NULL, version = version + 1
  WHERE identity_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Cuando business_identity cambia, invalidar outputs
CREATE TRIGGER business_identity_regenerate_outputs
AFTER UPDATE ON business_identity
FOR EACH ROW
WHEN (
  OLD.qué_haces IS DISTINCT FROM NEW.qué_haces
  OR OLD.a_quién_ayudas IS DISTINCT FROM NEW.a_quién_ayudas
  OR OLD.problema_resuelve IS DISTINCT FROM NEW.problema_resuelve
  OR OLD.cómo_trabajas IS DISTINCT FROM NEW.cómo_trabajas
  OR OLD.servicios IS DISTINCT FROM NEW.servicios
  OR OLD.resultados_clientes IS DISTINCT FROM NEW.resultados_clientes
  OR OLD.tono IS DISTINCT FROM NEW.tono
  OR OLD.nombre IS DISTINCT FROM NEW.nombre
  OR OLD.especialidad IS DISTINCT FROM NEW.especialidad
  OR OLD.cta_texto IS DISTINCT FROM NEW.cta_texto
)
EXECUTE FUNCTION trigger_regenerate_business_outputs();

-- Auto-crear business_outputs cuando se crea business_identity
CREATE OR REPLACE FUNCTION auto_create_business_outputs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO business_outputs (identity_id, generated_at)
  VALUES (NEW.id, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER business_identity_create_outputs
AFTER INSERT ON business_identity
FOR EACH ROW
EXECUTE FUNCTION auto_create_business_outputs();

-- Helper: obtener business_identity completo con outputs
CREATE OR REPLACE VIEW business_identity_with_outputs AS
SELECT
  bi.id,
  bi.coach_id,
  bi.nombre,
  bi.especialidad,
  bi.qué_haces,
  bi.a_quién_ayudas,
  bi.problema_resuelve,
  bi.cómo_trabajas,
  bi.servicios,
  bi.resultados_clientes,
  bi.tono,
  bi.cta_texto,
  bi.cta_url,
  bi.pais,
  bi.idiomas,
  bi.version,
  bi.updated_at,
  bo.landing_hero,
  bo.landing_subhero,
  bo.landing_benefits,
  bo.landing_services,
  bo.landing_faq,
  bo.landing_cta_primary,
  bo.seo_title,
  bo.seo_description,
  bo.seo_keywords,
  bo.emails,
  bo.ai_system_prompt,
  bo.marketplace_bio,
  bo.generated_at as outputs_generated_at
FROM business_identity bi
LEFT JOIN business_outputs bo ON bi.id = bo.identity_id;

ALTER VIEW business_identity_with_outputs OWNER TO postgres;
