#!/bin/bash
# Apply migration 0103: Open citas table read access for anon users
# Usage: ./scripts/apply-migration-0103.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔧 Applying migration 0103: citas anon read policy${NC}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found${NC}"
    echo ""
    echo "Options:"
    echo "1. Install Supabase CLI: https://supabase.com/docs/guides/cli"
    echo "2. Or apply manually via Supabase Dashboard:"
    echo "   - Go to: https://supabase.com/dashboard/project/ddxnrsnjdvtqhxunxbwj"
    echo "   - Open SQL Editor"
    echo "   - Copy-paste from: supabase/migrations/0103_citas_anon_read.sql"
    exit 1
fi

# Verify Supabase project is linked
if [ ! -f ".supabase/config.json" ]; then
    echo -e "${RED}✗ Supabase project not linked${NC}"
    echo ""
    echo "Link your project first:"
    echo "  supabase link --project-ref ddxnrsnjdvtqhxunxbwj"
    exit 1
fi

# Apply migration
echo -e "${YELLOW}Executing SQL...${NC}"
supabase db execute -f supabase/migrations/0103_citas_anon_read.sql

echo ""
echo -e "${GREEN}✓ Migration 0103 applied successfully${NC}"
echo ""
echo "Next steps:"
echo "1. Verify in Supabase SQL Editor (should show no errors)"
echo "2. Test in browser: https://pathwaycareercoach.com/reservar.html"
echo "3. Check DevTools Network tab for 'citas' query (should be 200, not 401)"
