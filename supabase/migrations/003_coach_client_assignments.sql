-- Phase 0 Week 1: Create coach_client_assignments table (explicit mapping)
-- Timeline: Day 1-2
-- Rollback: DROP TABLE coach_client_assignments CASCADE;

CREATE TABLE coach_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,

  status VARCHAR(50) DEFAULT 'active', -- active | paused | completed
  assigned_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT coach_client_assignment_unique UNIQUE (org_id, coach_id, client_id)
);

CREATE INDEX idx_coach_client_assignments_org_id ON coach_client_assignments(org_id);
CREATE INDEX idx_coach_client_assignments_coach_id ON coach_client_assignments(coach_id);
CREATE INDEX idx_coach_client_assignments_client_id ON coach_client_assignments(client_id);

-- Enable RLS (policies added in 007_rls_policies.sql)
ALTER TABLE coach_client_assignments ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users (will be restricted by policy)
GRANT SELECT, INSERT, UPDATE ON coach_client_assignments TO authenticated;
