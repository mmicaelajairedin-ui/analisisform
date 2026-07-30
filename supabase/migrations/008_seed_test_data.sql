-- Phase 0 Week 1: Seed test data for Phase 0 validation
-- Timeline: Day 3-4
-- Rollback: DELETE FROM coach_client_assignments WHERE org_id = 'org-test-001'; DELETE FROM coach_client_assignments... (see below)

-- Note: This uses hardcoded UUIDs for predictable testing
-- In production, use gen_random_uuid() and fetch IDs from responses

-- ============================================================================
-- TEST ORGANIZATION (for Phase 0 validation)
-- ============================================================================

INSERT INTO organizations (
  id, owner_id, name, logo_emoji, sector, country, timezone, plan, status, brand_color, contact_email
) VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'u0000000-0000-0000-0000-000000000001'::uuid, -- Test owner user ID (you'll need to create this in Supabase Auth)
  'Acme Coaching Corp',
  '🏢',
  'Tecnología',
  'España',
  'Europe/Madrid',
  'pro',
  'active',
  '#8C7B80',
  'admin@acmecorp.com'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- TEST BILLING
-- ============================================================================

INSERT INTO organizations_billing (
  id, org_id, plan, price_usd, billing_interval, subscription_started_at, next_billing_date,
  coaches_used, coaches_limit, clients_used, clients_limit, storage_used_gb, storage_limit_gb, status
) VALUES (
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'pro',
  2999.00,
  'month',
  '2024-07-01'::timestamptz,
  '2024-08-01'::date,
  5, 10,
  12, 50,
  25.50, 100,
  'active'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- TEST BRANDING
-- ============================================================================

INSERT INTO organization_branding (
  id, org_id, brand_name, logo_emoji, tagline, primary_color, secondary_color, accent_color, favicon_emoji
) VALUES (
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Acme Coaching',
  '🏢',
  'Tu carrera, tu éxito',
  '#8C7B80',
  '#D4CCCA',
  '#8C7B80',
  '🎯'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- TEST COACHES (extend from existing usuarios in Pathway)
-- ============================================================================

-- Maria García (coach-001)
UPDATE usuarios SET
  org_id = 'a0000000-0000-0000-0000-000000000001'::uuid,
  avatar = '👩‍💼',
  especialidad = 'Tech Leadership',
  last_login = NOW() - INTERVAL '2 hours',
  capacity = 10
WHERE id = 'coach-001'::uuid OR email = 'maria@acmecorp.com'
  LIMIT 1;

-- Carlos López (coach-002)
UPDATE usuarios SET
  org_id = 'a0000000-0000-0000-0000-000000000001'::uuid,
  avatar = '👨‍💼',
  especialidad = 'Sales & Negotiation',
  last_login = NOW() - INTERVAL '8 hours',
  capacity = 10
WHERE id = 'coach-002'::uuid OR email = 'carlos@acmecorp.com'
  LIMIT 1;

-- Ana Martínez (coach-003)
UPDATE usuarios SET
  org_id = 'a0000000-0000-0000-0000-000000000001'::uuid,
  avatar = '👩‍🏫',
  especialidad = 'Career Development',
  last_login = NOW() - INTERVAL '1 hour',
  capacity = 10
WHERE id = 'coach-003'::uuid OR email = 'ana@acmecorp.com'
  LIMIT 1;

-- Roberto Díaz (coach-004)
UPDATE usuarios SET
  org_id = 'a0000000-0000-0000-0000-000000000001'::uuid,
  avatar = '👨‍💻',
  especialidad = 'Executive Coaching',
  last_login = NOW() - INTERVAL '24 hours',
  capacity = 8
WHERE id = 'coach-004'::uuid OR email = 'roberto@acmecorp.com'
  LIMIT 1;

-- Sofia Ruiz (coach-005)
UPDATE usuarios SET
  org_id = 'a0000000-0000-0000-0000-000000000001'::uuid,
  avatar = '👩‍🎓',
  especialidad = 'Personal Branding',
  last_login = NOW() - INTERVAL '12 hours',
  capacity = 10
WHERE id = 'coach-005'::uuid OR email = 'sofia@acmecorp.com'
  LIMIT 1;

-- ============================================================================
-- TEST CLIENTS (extend from existing candidatos in Pathway)
-- ============================================================================

-- Assign org_id to existing candidatos
UPDATE candidatos SET
  org_id = 'a0000000-0000-0000-0000-000000000001'::uuid
WHERE org_id IS NULL
  LIMIT 10;

-- ============================================================================
-- TEST COACH-CLIENT ASSIGNMENTS (create mappings)
-- ============================================================================

-- Get actual coach and client IDs from the database
-- (These INSERT statements use the IDs from mock-data structure)

-- Maria García's clients: Juan Pérez, María López, Carlos Ruiz
INSERT INTO coach_client_assignments (
  id, org_id, coach_id, client_id, status, assigned_at
)
SELECT
  'd0000001-0000-0000-0000-000000000001'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  u.id, c.id, 'active', NOW()
FROM usuarios u, candidatos c
WHERE (u.email = 'maria@acmecorp.com' OR u.id = 'coach-001'::uuid)
  AND (c.email = 'juan.perez@external.com' OR c.id = 'client-001'::uuid)
  LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO coach_client_assignments (
  id, org_id, coach_id, client_id, status, assigned_at
)
SELECT
  'd0000002-0000-0000-0000-000000000001'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  u.id, c.id, 'active', NOW()
FROM usuarios u, candidatos c
WHERE (u.email = 'maria@acmecorp.com' OR u.id = 'coach-001'::uuid)
  AND (c.email LIKE 'maria.lopez%' OR c.id = 'client-002'::uuid)
  LIMIT 1
ON CONFLICT DO NOTHING;

-- (More assignments can be added similarly)

-- ============================================================================
-- VERIFY: Check that data is in place
-- ============================================================================

-- Verify organizations table
SELECT COUNT(*) as org_count FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid;

-- Verify coaches have org_id
SELECT COUNT(*) as coaches_with_org FROM usuarios WHERE org_id = 'a0000000-0000-0000-0000-000000000001'::uuid AND rol = 'coach';

-- Verify clients have org_id
SELECT COUNT(*) as clients_with_org FROM candidatos WHERE org_id = 'a0000000-0000-0000-0000-000000000001'::uuid LIMIT 1;

-- Verify coach-client assignments
SELECT COUNT(*) as assignments FROM coach_client_assignments WHERE org_id = 'a0000000-0000-0000-0000-000000000001'::uuid;
