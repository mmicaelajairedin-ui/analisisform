-- Phase 0 Week 1: Create organizations table (multi-tenant root)
-- Timeline: Day 1-2
-- Rollback: DROP TABLE organizations CASCADE;

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name VARCHAR(255) NOT NULL,
  logo_emoji CHAR(2),
  sector VARCHAR(100),
  country VARCHAR(50),
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- Billing & Status
  plan VARCHAR(50) DEFAULT 'starter', -- starter | pro | enterprise
  status VARCHAR(50) DEFAULT 'active', -- active | trial | suspended | cancelled
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Configuration
  brand_color VARCHAR(7) DEFAULT '#8C7B80',
  contact_email VARCHAR(255),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT org_unique_owner UNIQUE (owner_id) -- One org per owner (for MVP)
);

CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_status ON organizations(status);

-- Enable RLS (policies added in 007_rls_policies.sql)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Grant direct access to test (will be restricted by policy)
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated;
