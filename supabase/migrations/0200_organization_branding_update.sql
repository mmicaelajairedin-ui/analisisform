-- Update organization_branding schema to match Brand Engine (B.6)
-- This migration adds missing columns and maintains backward compatibility

-- Add missing columns for Brand Engine
ALTER TABLE organization_branding
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS brand_font VARCHAR(50) DEFAULT 'poppins',
ADD COLUMN IF NOT EXISTS neutral_dark VARCHAR(7) DEFAULT '#1F4030',
ADD COLUMN IF NOT EXISTS neutral_light VARCHAR(7) DEFAULT '#F5F3F0',
ADD COLUMN IF NOT EXISTS white_label_level INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_version VARCHAR(10) DEFAULT 'v1.0';

-- Migrate data from org_id to organization_id (both exist for now)
UPDATE organization_branding
SET organization_id = org_id
WHERE organization_id IS NULL AND org_id IS NOT NULL;

-- Create unique index on organization_id (for Brand Engine queries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_branding_org_id_v2
ON organization_branding(organization_id)
WHERE organization_id IS NOT NULL;

-- Update timestamp trigger for automatic updated_at
CREATE OR REPLACE FUNCTION update_organization_branding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_branding_timestamp ON organization_branding;
CREATE TRIGGER organization_branding_timestamp
BEFORE UPDATE ON organization_branding
FOR EACH ROW
EXECUTE FUNCTION update_organization_branding_timestamp();

-- RLS policies for organization_branding
ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY;

-- Policy: Owner can read/update their own branding
CREATE POLICY organization_branding_owner_access
ON organization_branding
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.org_id = organization_branding.organization_id
    AND usuarios.auth_id = auth.uid()
    AND usuarios.rol = 'owner'
  )
);

-- Policy: Anon can read (for white-label public pages)
CREATE POLICY organization_branding_anon_read
ON organization_branding
FOR SELECT
USING (true);

GRANT SELECT, UPDATE ON organization_branding TO authenticated, anon;
