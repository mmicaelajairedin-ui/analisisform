-- Phase 0 Week 1: Create organization_branding table (white-label)
-- Timeline: Day 1-2
-- Rollback: DROP TABLE organization_branding CASCADE;

CREATE TABLE organization_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Branding
  brand_name VARCHAR(255),
  logo_emoji CHAR(2),
  tagline VARCHAR(255),

  -- Colors
  primary_color VARCHAR(7) DEFAULT '#8C7B80',
  secondary_color VARCHAR(7) DEFAULT '#D4CCCA',
  accent_color VARCHAR(7) DEFAULT '#8C7B80',

  -- Optional
  custom_domain VARCHAR(255),
  favicon_emoji CHAR(2),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organization_branding_org_id ON organization_branding(org_id);

-- Enable RLS (policies added in 007_rls_policies.sql)
ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY;

-- Grant access (will be restricted by policy)
GRANT SELECT, UPDATE ON organization_branding TO authenticated;
