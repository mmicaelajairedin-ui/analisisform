-- LOCAL-ONLY BOOTSTRAP FILE — NEVER DEPLOYED TO PRODUCTION
-- This file creates stub auth schema + base usuarios table for local development
-- Run manually BEFORE supabase migrations: psql postgresql://postgres:postgres@localhost:54322/postgres < bootstrap_local.sql

-- Create auth schema if needed (for auth.users, auth.uid(), etc)
CREATE SCHEMA IF NOT EXISTS auth;

-- Stub auth.users table for local testing
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stub auth.uid() function for RLS policies
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub'::text;
$$ LANGUAGE SQL STABLE;

-- Create base roles for RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END $$;

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
