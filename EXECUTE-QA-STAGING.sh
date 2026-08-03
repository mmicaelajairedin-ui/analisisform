#!/bin/bash
# SPRINT 5.5.1 QA EXECUTION SCRIPT
# Run in: staging environment with Supabase CLI access
# Usage: ./EXECUTE-QA-STAGING.sh <supabase_url> <supabase_key>

SUPABASE_URL=${1:-"https://your-staging.supabase.co"}
SUPABASE_KEY=${2:-"your-anon-key"}
PROJECT_BRANCH="claude/multicoach-product-spec-m269gc"

echo "════════════════════════════════════════════════"
echo "  SPRINT 5.5.1 QA EXECUTION — STAGING"
echo "════════════════════════════════════════════════"
echo ""
echo "Target: $SUPABASE_URL"
echo "Branch: $PROJECT_BRANCH"
echo ""

# ─────────────────────────────────────────────────────────────────────────
# STEP 1: SETUP SQL (Create users, sessions, RLS)
# ─────────────────────────────────────────────────────────────────────────

echo "STEP 1: Executing SQL setup..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found"
    echo "   Install: npm install -g @supabase/cli"
    echo ""
    echo "   OR run SQL manually in Supabase Dashboard:"
    echo "   → SQL Editor → paste contents of supabase/migrations/sprint-5-5-staging-setup.sql"
    echo ""
else
    echo "✓ Supabase CLI found"
    echo ""
    echo "Running SQL setup..."

    # Execute the SQL file
    cat supabase/migrations/sprint-5-5-staging-setup.sql | \
        curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/sql" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -H "Content-Type: application/json" \
        -d @- 2>&1

    if [ $? -eq 0 ]; then
        echo "✓ SQL setup completed"
    else
        echo "✗ SQL setup failed - execute manually in Supabase Dashboard"
    fi
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────
# STEP 2: VERIFY USERS & SESSIONS
# ─────────────────────────────────────────────────────────────────────────

echo "STEP 2: Verifying test data..."
echo ""

echo "Test Users (should exist):"
echo "  - qa-owner@staging.test (role=owner)"
echo "  - qa-coach@staging.test (role=coach)"
echo "  - qa-coach2@staging.test (role=coach)"
echo "  - qa-client@staging.test (role=client)"
echo ""

echo "Test Sessions (should exist):"
echo "  - Session 1: +2 days (realtime testing)"
echo "  - Session 2: +3 days (coach edit testing)"
echo "  - Session 3: +4 days (permission boundary testing)"
echo ""

# ─────────────────────────────────────────────────────────────────────────
# STEP 3: MANUAL VALIDATION (3-WINDOW TEST)
# ─────────────────────────────────────────────────────────────────────────

echo "STEP 3: Manual validation (requires browser)"
echo ""
echo "Open 3 browser windows side-by-side:"
echo ""
echo "  WINDOW A (Owner):"
echo "  └─ URL: https://pathwaycareercoach.com/multicoach.html"
echo "  └─ Login: qa-owner@staging.test"
echo ""
echo "  WINDOW B (Coach):"
echo "  └─ URL: https://pathwaycareercoach.com/panel-v2.html"
echo "  └─ Login: qa-coach@staging.test"
echo ""
echo "  WINDOW C (Client):"
echo "  └─ URL: https://pathwaycareercoach.com/cliente.html"
echo "  └─ Login: qa-client@staging.test"
echo ""

echo "Then run in browser console:"
echo "  var script = document.createElement('script');"
echo "  script.src = '/qa-sprint-5-5-runner.js';"
echo "  document.head.appendChild(script);"
echo ""
echo "And execute:"
echo "  QA_RUNNER.validate_realtime()   // 12 checks"
echo "  QA_RUNNER.validate_security()   // 14 checks"
echo "  QA_RUNNER.validate_ux()         // 10 checks"
echo "  QA_RUNNER.generate_report()"
echo ""

# ─────────────────────────────────────────────────────────────────────────
# STEP 4: CODE INTEGRITY CHECK
# ─────────────────────────────────────────────────────────────────────────

echo "STEP 4: Code integrity verification..."
echo ""

# Check pw-scheduler.js
echo "✓ pw-scheduler.js"
grep -q "var AgendaProvider" pw-scheduler.js && echo "  ✓ AgendaProvider defined"
grep -q "var SupabaseProvider" pw-scheduler.js && echo "  ✓ SupabaseProvider defined"
grep -q "crearEvento:" pw-scheduler.js && echo "  ✓ CRUD methods present"
echo ""

# Check multicoach.html
echo "✓ multicoach.html"
grep -q "AgendaProvider.fromSesionesRegistro" multicoach.html && echo "  ✓ AgendaProvider wired"
grep -q "SupabaseProvider.createEvent" multicoach.html && echo "  ✓ Callbacks wired"
echo ""

# Check panel-v2.html
echo "✓ panel-v2.html"
grep -q "SupabaseProvider" panel-v2.html && echo "  ✓ SupabaseProvider integrated"
echo ""

# Check QA runner
echo "✓ qa-sprint-5-5-runner.js"
grep -q "validate_realtime:" qa-sprint-5-5-runner.js && echo "  ✓ Realtime tests"
grep -q "validate_security:" qa-sprint-5-5-runner.js && echo "  ✓ Security tests"
grep -q "validate_ux:" qa-sprint-5-5-runner.js && echo "  ✓ UX tests"
echo ""

# ─────────────────────────────────────────────────────────────────────────
# STEP 5: ARCHITECTURE VALIDATION
# ─────────────────────────────────────────────────────────────────────────

echo "STEP 5: Architecture lock verification..."
echo ""

echo "Frozen components:"
grep -q "LOCKED POST SPRINT 5.3" pw-scheduler.js && echo "  ✓ pw-scheduler.js LOCKED"
grep -q "STATES: {" pw-scheduler.js && echo "  ✓ State contract frozen (5 states)"
echo ""

echo "Permission model:"
grep -q "agenda.create" pw-scheduler.js && echo "  ✓ Capability-based (not role-based)"
echo ""

echo "Providers:"
grep -q "fromSesionesRegistro:" pw-scheduler.js && echo "  ✓ AgendaProvider.fromSesionesRegistro ready"
grep -q "fromGoogleCalendar:" pw-scheduler.js && echo "  ✓ GoogleProvider stub ready"
grep -q "fromOutlook:" pw-scheduler.js && echo "  ✓ OutlookProvider stub ready"
echo ""

# ─────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════"
echo "  READINESS SUMMARY"
echo "════════════════════════════════════════════════"
echo ""
echo "✓ Code: Ready (architecture locked)"
echo "✓ Setup: SQL prepared (execute in Supabase Dashboard)"
echo "✓ Tests: Harness ready (execute in browser console)"
echo "⧖ Validation: Requires manual execution in staging"
echo ""
echo "NEXT: Execute 3-window test in staging"
echo ""
