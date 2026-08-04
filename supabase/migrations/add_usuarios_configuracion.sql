-- Add configuracion column to usuarios table
-- Stores coach identity, branding, and settings as JSONB
-- Structure: { negocio: {...}, marca: {...}, ... }

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS configuracion JSONB DEFAULT '{"negocio":{},"marca":{}}'::jsonb;

-- Index for fast access
CREATE INDEX IF NOT EXISTS idx_usuarios_configuracion ON usuarios USING GIN (configuracion);

-- Comment for documentation
COMMENT ON COLUMN usuarios.configuracion IS 'Coach configuration: negocio (identity), marca (branding), and other settings. Single source of truth per coach.';
