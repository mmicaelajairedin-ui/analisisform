-- Phase 0 Week 1: Extend usuarios table with org_id and coach fields
-- Timeline: Day 1-2
-- Rollback: ALTER TABLE usuarios DROP COLUMN org_id, avatar, especialidad, last_login, capacity;

-- Add org_id for multi-tenant partitioning
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add coach-specific fields
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar CHAR(2);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS especialidad VARCHAR(100);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 10;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usuarios_org_id ON usuarios(org_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_last_login ON usuarios(last_login);

-- Enable RLS (policies added in 007_rls_policies.sql)
-- Note: usuarios already has RLS from Pathway
-- Just ensure it stays enabled
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
