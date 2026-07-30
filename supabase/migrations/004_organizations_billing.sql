-- Phase 0 Week 1: Create organizations_billing table
-- Timeline: Day 1-2
-- Rollback: DROP TABLE organizations_billing CASCADE;

CREATE TABLE organizations_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Plan & Pricing
  plan VARCHAR(50) NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  price_usd DECIMAL(10, 2),
  billing_interval VARCHAR(10) DEFAULT 'month', -- month | year

  -- Subscription Dates
  subscription_started_at TIMESTAMPTZ,
  subscription_ended_at TIMESTAMPTZ,
  next_billing_date DATE,

  -- Usage
  coaches_used INT DEFAULT 0,
  coaches_limit INT DEFAULT 5, -- per plan
  clients_used INT DEFAULT 0,
  clients_limit INT DEFAULT 50,
  storage_used_gb DECIMAL(10, 2) DEFAULT 0,
  storage_limit_gb INT DEFAULT 100,

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active | past_due | cancelled

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_billing_org_id ON organizations_billing(org_id);

-- Enable RLS (policies added in 007_rls_policies.sql)
ALTER TABLE organizations_billing ENABLE ROW LEVEL SECURITY;

-- Grant access (will be restricted by policy)
GRANT SELECT, UPDATE ON organizations_billing TO authenticated;
