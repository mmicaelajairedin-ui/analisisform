-- Phase 0 Week 1: Create audit_logs table (activity trail & compliance)
-- Timeline: Day 1-2
-- Rollback: DROP TABLE audit_logs CASCADE;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Action
  action VARCHAR(50), -- read | create | update | delete | export | login | logout
  resource_type VARCHAR(100), -- coaches | clients | programs | billing | settings
  resource_id UUID,

  -- Details
  changes JSONB, -- { old_values: {...}, new_values: {...} }
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Enable RLS (policies added in 007_rls_policies.sql)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Grant access (will be restricted by policy)
GRANT SELECT, INSERT ON audit_logs TO authenticated;
