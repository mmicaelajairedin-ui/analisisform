-- LOCAL-ONLY BOOTSTRAP FILE — NEVER DEPLOYED TO PRODUCTION
-- This file creates ONLY the base usuarios table for local development
-- auth schema, auth.users, auth.uid(), and roles are already in Supabase (real and local)
-- Run manually BEFORE supabase migrations: psql postgresql://postgres:postgres@localhost:54322/postgres < bootstrap_local.sql

-- Base usuarios table (needed by IAP migration FK)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE,
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
SELECT 'Bootstrap complete: usuarios table created for local testing' as status;
