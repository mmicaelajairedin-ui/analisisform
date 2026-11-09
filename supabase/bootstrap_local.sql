-- LOCAL-ONLY BOOTSTRAP FILE — NEVER DEPLOYED TO PRODUCTION
-- This file creates the base usuarios table for local development.
-- The auth schema, auth.users, auth.uid(), and roles are provided by supabase start.
-- Run manually BEFORE supabase migrations: docker exec <container_id> psql postgresql://postgres:postgres@localhost:5432/postgres < bootstrap_local.sql

-- Base usuarios table
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  nombre VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'basic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_id ON usuarios(auth_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

COMMENT ON TABLE usuarios IS 'Base users table — created by bootstrap_local.sql (local dev only)';

-- Done
SELECT 'Bootstrap complete: auth schema + usuarios table created for local testing' as status;
