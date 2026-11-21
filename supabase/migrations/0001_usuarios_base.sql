-- Phase 0: Create base usuarios table
-- Required before 002_usuarios_extend.sql extends it
--
-- This table is the foundation for:
-- - Coach and client identity (email, rol)
-- - Billing integration (plan_tipo, plan_changed_at, configuracion → Stripe)
-- - Access control (activo, auth_id added by 20261024)
-- - Multi-tenant isolation (org_id added by 002, references organizations)

CREATE TABLE IF NOT EXISTS public.usuarios (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nombre TEXT,

  -- Authentication (legacy login via email+password_hash; Supabase Auth via auth_id)
  password_hash VARCHAR(255),

  -- Role and status
  rol TEXT NOT NULL DEFAULT 'coach'
    CHECK (rol IN ('admin', 'coach', 'cliente', 'empleado', 'owner')),
  activo BOOLEAN DEFAULT true,

  -- Billing and product
  plan_tipo TEXT DEFAULT 'basic',
  plan_changed_at TIMESTAMPTZ,

  -- Coach configuration: branding (marca), business identity (negocio),
  -- Stripe subscription metadata (stripe_customer_id, stripe_subscription_id, billing),
  -- and other settings. Single source of truth per coach.
  configuracion JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);

-- Enable RLS (policies added by 007_rls_policies.sql)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Minimal RLS for testing (bootstrap can write via service_role)
-- Production policies are stricter (see 007_rls_policies.sql)
DROP POLICY IF EXISTS "usuarios_service_role_all" ON usuarios;
CREATE POLICY "usuarios_service_role_all"
  ON usuarios
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
