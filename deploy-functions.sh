#!/bin/bash
set -e

echo "🚀 Phase 0 Week 1 — Edge Functions Deployment"
echo "=============================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ supabase CLI not found. Installing..."
  npm install -g supabase
fi

# Step 1: Login (interactive)
echo "📝 Step 1: Authenticating with Supabase..."
echo "   (This will open a browser window for OAuth)"
supabase login

# Step 2: Link project
echo ""
echo "🔗 Step 2: Linking project..."
supabase link --project-ref ddxnrsnjdvtqhxunxnwj

# Step 3: Deploy functions
echo ""
echo "📦 Step 3: Deploying Edge Functions..."
echo ""

echo "  • verify-user-org"
supabase functions deploy verify-user-org --no-verify-jwt

echo "  • get-user-org"
supabase functions deploy get-user-org --no-verify-jwt

echo "  • fetch-coach-detail"
supabase functions deploy fetch-coach-detail --no-verify-jwt

# Step 4: Verify deployment
echo ""
echo "✅ Step 4: Verifying deployment..."
echo ""
supabase functions list

# Step 5: Test
echo ""
echo "🧪 Step 5: Testing fetch-coach-detail endpoint..."
echo ""

SUPABASE_URL="https://ddxnrsnjdvtqhxunxnwj.supabase.co"
# ANON_KEY removed — use SUPABASE_ANON_KEY environment variable instead
# This key should be obtained from Supabase dashboard (Settings → API Keys)
# Project: ddxnrsnjdvtqhxunxnwj (ref: wj)

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "⚠️  SUPABASE_ANON_KEY not set. Skipping test."
  echo "   To test, set: export SUPABASE_ANON_KEY='your-key-here'"
  exit 0
fi

curl -s -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/functions/v1/fetch-coach-detail/organization/550e8400-e29b-41d4-a716-446655440000/coaches/53eb424e-3b04-45e9-a07f-257eb62280c4" | jq -r '.coach.name // "❌ No coach data"' > /tmp/test_result.txt

RESULT=$(cat /tmp/test_result.txt)
if [[ "$RESULT" == *"Jennifer"* ]]; then
  echo "   ✅ Endpoint working! Coach name: $RESULT"
else
  echo "   ⚠️  Test returned: $RESULT"
  echo "   (Endpoint may still be initializing, wait 30s and try curl command manually)"
fi

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Next: Open browser and navigate to:"
echo "   http://localhost:5173/multicoach/pages/owner-coach-detail.html"
echo ""
