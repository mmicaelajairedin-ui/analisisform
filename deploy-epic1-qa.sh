#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# EPIC 1: Deploy Migrations + QA Validation Script
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on any error

echo "🚀 EPIC 1: Starting Deployment to Dev Supabase"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# PASO 1: Deploy Migrations
echo "📦 PASO 1: Deploying Migrations 0101-0106..."
echo "─────────────────────────────────────────────────────────────────────────"

cd /home/user/analisisform

# Verify migrations exist
echo "✓ Checking if migrations exist..."
ls -lh supabase/migrations/010{1..6}_*.sql || {
  echo "❌ ERROR: Migrations not found!"
  exit 1
}

echo "✓ Migrations found"
echo ""

# Push to dev
echo "📡 Executing: supabase db push (dev environment)"
echo "   Note: Select 'dev' when prompted"
echo ""

supabase db push

echo ""
echo "✅ Migrations deployed successfully!"
echo ""

# PASO 2: Validate Schema
echo "✅ PASO 2: Validating Schema..."
echo "─────────────────────────────────────────────────────────────────────────"
echo ""
echo "Running validation queries..."
echo ""

# We can't run psql directly against remote Supabase
# User must run validation queries in SQL Editor
echo "⚠️  Validation requires manual SQL execution in Supabase SQL Editor:"
echo ""
echo "Copy and paste these queries in SQL Editor to verify:"
echo ""
cat << 'EOF'

-- VALIDATION 1: Check tables exist
SELECT tablename FROM information_schema.tables
WHERE tablename IN ('organizaciones', 'usuarios', 'candidatos', 'coach_client_assignments')
ORDER BY tablename;
-- EXPECTED: 4 rows

-- VALIDATION 2: Check policies
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('organizaciones', 'usuarios', 'candidatos', 'coach_client_assignments')
GROUP BY tablename
ORDER BY tablename;
-- EXPECTED: 17 total policies

EOF

echo ""
echo "✓ After running validation queries, confirm:"
echo "  • 4 tables exist (organizaciones, usuarios, candidatos, coach_client_assignments)"
echo "  • 17 policies active (3+3+4+7)"
echo ""

# PASO 3: Create Test Data
echo "✅ PASO 3: Creating Test Data..."
echo "─────────────────────────────────────────────────────────────────────────"
echo ""
echo "Test data setup requires manual SQL execution in Supabase SQL Editor:"
echo ""
echo "Copy and paste the COMPLETE test data setup script from:"
echo "  /tmp/claude-0/-home-user-analisisform/15eb8784-ca7e-5e23-9528-e2fae3d75a7b/scratchpad/EPIC_1_DEPLOYMENT_PLAN.md"
echo ""
echo "Section: PASO 3: Crear Datos de Test"
echo ""
echo "After executing, verify with:"
cat << 'EOF'

SELECT 'Organizaciones' as entity, COUNT(*) FROM organizaciones
  WHERE id IN ('550e8400-e29b-41d4-a716-446655440000'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid)
UNION ALL
SELECT 'Usuarios', COUNT(*) FROM usuarios WHERE org_id IS NOT NULL
UNION ALL
SELECT 'Clientes', COUNT(*) FROM candidatos WHERE org_id IS NOT NULL
UNION ALL
SELECT 'Assignments', COUNT(*) FROM coach_client_assignments WHERE org_id IS NOT NULL;

-- EXPECTED:
-- Organizaciones | 2
-- Usuarios | 3
-- Clientes | 3
-- Assignments | 2

EOF

echo ""

# PASO 4: RLS Scenarios
echo "✅ PASO 4: RLS Validation Scenarios..."
echo "─────────────────────────────────────────────────────────────────────────"
echo ""
echo "Execute the 4 RLS scenarios from EPIC_1_DEPLOYMENT_PLAN.md:"
echo ""
echo "📋 ESCENARIO 1: Owner Acceso Total (tests 1A-1E)"
echo "   Expected: Owner sees all org data, blocked from other orgs"
echo ""
echo "📋 ESCENARIO 2: Coach Solo Asignados (tests 2A-2F) ⚠️ CRITICAL"
echo "   Expected: Coach sees ONLY assigned clients (test 2E is critical)"
echo ""
echo "📋 ESCENARIO 3: Cliente Self (tests 3A-3D)"
echo "   Expected: Client sees only own data"
echo ""
echo "📋 ESCENARIO 4: Aislamiento Total (tests 4A-4E)"
echo "   Expected: Org 1 and Org 2 completely isolated"
echo ""

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "🎯 NEXT STEPS:"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "1. ✅ Migrations deployed (you just did this)"
echo ""
echo "2. Open Supabase SQL Editor at:"
echo "   https://app.supabase.com/project/[your-project-id]/sql"
echo ""
echo "3. Run VALIDATION queries (PASO 2)"
echo ""
echo "4. Run TEST DATA setup (PASO 3)"
echo ""
echo "5. Run 4 RLS SCENARIOS (PASO 4)"
echo ""
echo "6. Document results in:"
echo "   /tmp/claude-0/-home-user-analisisform/15eb8784-ca7e-5e23-9528-e2fae3d75a7b/scratchpad/EPIC_1_QA_CHECKLIST.md"
echo ""
echo "7. Report back with results:"
echo "   • Which tests PASSED ✅"
echo "   • Which tests FAILED ❌ (with error message)"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "✨ Deployment script completed. Proceed to SQL Editor for QA scenarios."
echo ""
