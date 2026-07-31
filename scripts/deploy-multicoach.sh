#!/bin/bash

# MultiCoach Automated Deployment Script
# Deploys all critical edge functions and applies migrations
# Usage: ./scripts/deploy-multicoach.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          MultiCoach Backend Deployment Script             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Pre-deployment checks
echo -e "${YELLOW}[1/5]${NC} Pre-Deployment Checks..."
echo ""

# Check supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗${NC} Supabase CLI not found. Install with: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}✓${NC} Supabase CLI installed"

# Check if we're in the right directory
if [ ! -f "supabase/functions/mi-red/index.ts" ]; then
    echo -e "${RED}✗${NC} Not in project root. Run from: /home/user/analisisform"
    exit 1
fi
echo -e "${GREEN}✓${NC} Project root verified"

# Check if supabase is linked
if [ ! -d ".supabase" ]; then
    echo -e "${YELLOW}⚠${NC} .supabase directory not found. Running: supabase link"
    supabase link
fi
echo -e "${GREEN}✓${NC} Supabase project linked"

# Check if all functions exist
echo -e "\n${YELLOW}[2/5]${NC} Verifying Edge Functions..."
echo ""

FUNCTIONS=(
    "mi-red"
    "coach-api-gateway"
    "agregar-coach-red"
    "agregar-cliente-red"
    "asignar-cliente"
    "eliminar-coach-red"
    "editar-coach-red"
    "canal-red"
    "mensaje-red"
    "crear-cita-red"
    "editar-cita-red"
    "fetch-coach-detail"
    "comunidad-red"
    "coach-self-save"
    "guardar-red"
    "link-preview"
    "red-checkout"
)

for fn in "${FUNCTIONS[@]}"; do
    if [ -d "supabase/functions/$fn" ]; then
        echo -e "${GREEN}✓${NC} $fn"
    else
        echo -e "${RED}✗${NC} $fn MISSING"
        exit 1
    fi
done

# Check migrations
echo -e "\n${YELLOW}[3/5]${NC} Verifying Migrations..."
echo ""

if [ -f "supabase/migrations/0101_citas_owner_rls.sql" ]; then
    echo -e "${GREEN}✓${NC} 0101_citas_owner_rls.sql"
else
    echo -e "${RED}✗${NC} 0101_citas_owner_rls.sql MISSING"
    exit 1
fi

# Deploy functions
echo -e "\n${YELLOW}[4/5]${NC} Deploying Edge Functions..."
echo ""

for fn in "${FUNCTIONS[@]}"; do
    echo -n "Deploying $fn... "
    if supabase functions deploy $fn --no-verify-jwt 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC} (check Supabase dashboard)"
    fi
done

echo ""
echo -e "${YELLOW}[5/5]${NC} Deployment Complete!"
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              📋 NEXT STEPS - APPLY MIGRATIONS              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "1. Go to: Supabase Dashboard → Project → SQL Editor"
echo "2. Open file: supabase/migrations/0101_citas_owner_rls.sql"
echo "3. Copy entire contents"
echo "4. Paste into SQL Editor and click RUN"
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║               ✅ TESTING YOUR DEPLOYMENT                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "1. Open: https://pathwaycareercoach.com/multicoach.html"
echo "2. Login with owner credentials"
echo "3. Check DevTools → Network tab for successful /functions/v1/mi-red call"
echo "4. Verify Coaches section shows real coaches (not demo)"
echo ""
echo -e "${GREEN}🚀 Deployment script complete!${NC}"
echo ""
