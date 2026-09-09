# IAP Deployment Checklist — Phases 0, 1, 2

**Project:** In-App Purchase (IAP) Coach Plans (Basic $29/mo, Pro $59/mo)  
**Status:** Ready for Fase 0 → Fase 1 → Fase 2 → Fase 3  
**Last Updated:** 2026-09-09

---

## FASE 0: App Store Connect Setup (MANUAL — Micaela)

**Estimated Time:** 30 minutes  
**Dependencies:** None (standalone)  
**Document:** `FASE_0_APP_STORE_SETUP.md`

### Step 1: Create Products in App Store Connect
- [ ] Log into App Store Connect
- [ ] Create product "Coach Basic Monthly" (`coach.plan.basic.monthly`)
  - Price: $29.99 / €29.99 / etc.
  - Renewable subscription
  - Duration: 1 month
- [ ] Create product "Coach Pro Monthly" (`coach.plan.pro.monthly`)
  - Price: $59.99 / €59.99 / etc.
  - Renewable subscription
  - Duration: 1 month

### Step 2: Create Subscription Group
- [ ] App Store Connect → Subscription groups
- [ ] Name: "PathwayCoachPlans"
- [ ] Add both products to group

### Step 3: Configure Server Notifications V2
- [ ] Settings → URLs and IDs → Server Notifications
- [ ] Webhook URL: `https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook`
- [ ] Note: Must be live (will be tested by Apple)

### Step 4: Create App Store Server API Key
- [ ] Keys → Certificates, Identifiers & Profiles → Create new key
- [ ] Select "Server API" role
- [ ] Download .p8 file (keep private, NEVER commit to git)
- [ ] Note: Key ID and Issuer ID (shown in dashboard)

### Step 5: Fill Secrets Template
- [ ] Copy `docs/app-store-connect-secrets-template.txt`
- [ ] Fill in 5 secrets from App Store Connect:
  - `APPLE_TEAM_ID` (from Certificates, Identifiers & Profiles)
  - `APPLE_KEY_ID` (from API Key)
  - `APPLE_ISSUER_ID` (from API Key)
  - `APPLE_PRIVATE_KEY` (full content of .p8 file)
  - `APPLE_BUNDLE_ID` (hardcoded: `com.pathwaycareercoach.ios`)
- [ ] Store this file securely (NOT in git)

### ✅ Fase 0 COMPLETE when:
- [ ] Products created and live in App Store Connect
- [ ] Subscription group configured
- [ ] Webhook URL configured (will be validated by Apple)
- [ ] API Key generated and saved
- [ ] Secrets template filled with real values

**Next:** Micaela confirms "Fase 0 complete" → proceed to Fase 1

---

## FASE 1: Backend Infrastructure Deployment (CLAUDE)

**Estimated Time:** 2 hours  
**Dependencies:** Fase 0 MUST be complete  
**Document:** `FASE_1_CHECKPOINT.md`  
**Branch:** `claude/iap-coach-plans-implementation`

### Step 1: Configure Supabase Secrets

**In Supabase Dashboard:**
1. [ ] Project → Settings → Edge Functions → Secrets
2. [ ] Click "New secret" and add 5 secrets:
   - Name: `APPLE_TEAM_ID`, Value: `<from app-store-connect-secrets-template.txt>`
   - Name: `APPLE_KEY_ID`, Value: `<from template>`
   - Name: `APPLE_ISSUER_ID`, Value: `<from template>`
   - Name: `APPLE_PRIVATE_KEY`, Value: `<full .p8 file content, including BEGIN/END lines>`
   - Name: `APPLE_BUNDLE_ID`, Value: `com.pathwaycareercoach.ios` (hardcoded)
3. [ ] Verify: Refresh page, confirm all 5 appear in list

**⚠️ CRITICAL:** Never paste secrets in chat or unencrypted. Use Supabase dashboard directly.

### Step 2: Apply SQL Migrations

**In Supabase SQL Editor:**
1. [ ] New query
2. [ ] Copy entire content of `supabase/migrations/usuarios_suscripciones_iap.sql`
3. [ ] Paste into editor
4. [ ] Click "Run" (should see green checkmark)
5. [ ] Repeat for `app_store_server_notifications.sql`
6. [ ] Repeat for `suspicious_double_charges.sql`
7. [ ] Verify: Go to Table Editor → confirm 3 new tables exist

**Expected tables:**
- `usuarios_suscripciones_iap` (main subscription table)
- `app_store_server_notifications` (webhook audit log)
- `suspicious_double_charges` (fraud tracking)

### Step 3: Deploy Edge Functions

**In terminal** (assuming `supabase` CLI installed and project linked):

```bash
# Deploy webhook handler
supabase functions deploy apple-iap-webhook --no-verify-jwt

# Deploy purchase validator
supabase functions deploy validate-iap

# Deploy entitlement checker
supabase functions deploy check-entitlement
```

Expected output: "Function deployed successfully" for each.

**Verify deployment:**
- [ ] Supabase Dashboard → Edge Functions → see 3 new functions
- [ ] Each should show "Deployed" status

### Step 4: Verify Webhooks Can Reach Endpoint

**Test webhook endpoint (curl):**
```bash
# This should return 401 Unauthorized (invalid JWT)
curl -X POST https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook \
  -H "Content-Type: application/json" \
  -d '{"signedPayload":"invalid"}'

# Expected: 401 response (good, means endpoint is reachable)
```

### ✅ Fase 1 COMPLETE when:
- [ ] 5 secrets configured in Supabase
- [ ] 3 migrations applied successfully
- [ ] 3 Edge Functions deployed
- [ ] Webhook endpoint responds to requests

**Next:** Ready for Fase 2 (optional) or iOS integration (Fase 3)

---

## FASE 2: Backend Utilities Deployment (OPTIONAL BUT RECOMMENDED)

**Estimated Time:** 1 hour  
**Dependencies:** Fase 1 MUST be complete  
**Document:** `FASE_2_BACKEND_UTILITIES.md`  
**Status:** Non-blocking, can deploy anytime after Fase 0

### Step 1: Deploy Detection Job

**In terminal:**
```bash
supabase functions deploy detect-double-charges --no-verify-jwt
```

**Verify:**
- [ ] Supabase Dashboard → Edge Functions → "detect-double-charges" shows "Deployed"

### Step 2: Configure GitHub Actions Secrets

**In GitHub:**
1. [ ] Repository → Settings → Secrets and variables → Actions
2. [ ] Click "New repository secret"
3. [ ] Name: `DETECT_SECRET`, Value: `<random UUID or password>` (same value you'll use in Supabase)
4. [ ] Click "Add secret"
5. [ ] Repeat for `SUPABASE_PROJECT_URL`: Value: `https://api.pathwaycareercoach.com`

**Verify:**
- [ ] Both secrets appear in list (values hidden)

### Step 3: Configure Supabase Secret for Detection

**In Supabase Dashboard:**
1. [ ] Project → Settings → Edge Functions → Secrets
2. [ ] Click "New secret"
3. [ ] Name: `DETECT_SECRET`, Value: `<same value as GitHub secret>`
4. [ ] Name: `ADMIN_EMAIL`, Value: `micaela@pathwaycareercoach.com` (or admin email)

### Step 4: Verify Cron is Scheduled

**In GitHub:**
1. [ ] Repository → Actions
2. [ ] Look for workflow: "Daily Double Charge Detection"
3. [ ] Should show: "Scheduled • Runs daily at 01:00 UTC"
4. [ ] Can manually trigger: "Run workflow" button (optional for test)

### ✅ Fase 2 COMPLETE when:
- [ ] detect-double-charges function deployed
- [ ] GitHub Actions secrets configured
- [ ] Supabase secrets configured
- [ ] Cron workflow scheduled (first run will be next day at 01:00 UTC)

**Next:** Monitor first detection run. Then proceed to Fase 3 iOS.

---

## FASE 3: iOS Integration (MICAELA'S TEAM)

**Estimated Time:** 8-16 hours  
**Dependencies:** Fase 0, 1, 2 MUST be deployed and live  
**Status:** TODO (after backend ready)

### Setup (Developer)
- [ ] Xcode: StoreKit 2 configuration
- [ ] Create RevenueCat project or implement native StoreKit 2
- [ ] Configure product IDs: `coach.plan.basic.monthly`, `coach.plan.pro.monthly`

### Implementation (Developer)
- [ ] Generate `appAccountToken` on first user login
  - Must be unique per user
  - Store in `usuarios.app_account_token` (server)
  - Store in Keychain (client)
  - Send with every transaction

- [ ] Implement purchase flow:
  ```
   User taps "Buy Apple IAP"
      → AppStore.sync() transaction listener
      → Get transaction info (product, original_transaction_id, etc.)
      → Call validate-iap endpoint
      → Handle 200 (success), 409 (Stripe active, blocked)
      → Show success or error message
   ```

- [ ] Implement entitlement check:
   ```
   On app launch:
      → Call check-entitlement endpoint
      → If hasAccess=true, show premium features
      → If hasAccess=false, show "Upgrade" CTA
   ```

- [ ] Handle subscription events:
   - SUBSCRIBED → show success, hide CTA
   - DID_RENEW → update expiry (automatic via webhook)
   - DID_FAIL_TO_RENEW → show "payment issue" warning
   - GRACE_PERIOD → show "fix payment" prompt (but still has access)
   - EXPIRED → show "subscription expired" (no access)

### Testing (QA)
- [ ] TestFlight with Sandbox credentials
- [ ] Test all 13+ scenarios (see FASE_1_CHECKPOINT.md)
- [ ] Verify no regression: iOS blocking intact, Stripe web working, MultiCoach working

**Next:** QA approval → Build 6 submission

---

## FASE 4: Testing (COMPREHENSIVE)

**Estimated Time:** 4-8 hours  
**Dependencies:** Fase 3 iOS ready for QA  
**Status:** TODO (after iOS integration)

### Unit Tests
- [ ] Notification type mapping (12 events → status)
- [ ] Subscription state logic (active = has access, expired = no access)
- [ ] Date validation (past dates rejected)
- [ ] Product ID validation (only basic, pro allowed)

### Integration Tests
- [ ] Webhook deduplication (duplicate notification_id returns 409)
- [ ] Purchase validation (validate-iap with mock data)
- [ ] Entitlement check (merge Stripe + IAP results)
- [ ] Double charge detection (severity classification)

### E2E Tests (iOS)
- [ ] Purchase flow: tap CTA → AppStore → validate-iap → success
- [ ] Renewal: auto-renews, webhook updates DB, check-entitlement shows access
- [ ] Cancellation: user cancels renewal, webhook updates status, access expires
- [ ] Grace period: billing fails → grace period (3 days access) → recovery
- [ ] Expiry: grace period ends → expired → no access
- [ ] Refund: user refunded → status=refunded → no access
- [ ] Revoke: coach/Apple revokes → status=revoked → no access

### Regression Tests
- [ ] iOS blocking not broken (CTA hidden)
- [ ] Stripe payment flow still works
- [ ] MultiCoach admin panel still works
- [ ] Clientes tab still hidden
- [ ] Guardrails still enforced

**Success Criteria:**
- ✅ All 13+ scenarios pass
- ✅ Zero regressions
- ✅ No data loss
- ✅ No false positives in double charge detection

---

## FASE 5: QA & Refinement (OPTIONAL)

**Estimated Time:** 4-8 hours  
**Status:** TODO (after Fase 4)

### Manual QA (on device)
- [ ] Purchase flow on iOS Sandbox
- [ ] Verify access immediately after purchase
- [ ] Wait 24h, verify webhook from Apple updates status
- [ ] Check panel shows new customer
- [ ] Test cancellation, renewal, grace period

### Analytics & Monitoring
- [ ] Monitor `app_store_server_notifications` for webhook hits
- [ ] Monitor `suspicious_double_charges` for false positives
- [ ] Check `client_errors` for any JS errors on iOS
- [ ] Verify no 503/500 errors in Edge Functions logs

### Polish (Optional)
- [ ] UI: Show "Processing..." during purchase validation
- [ ] UI: Show "Subscription expires on..." in portal
- [ ] Email: Send welcome email after purchase
- [ ] Email: Send renewal reminder 7 days before expiry

---

## FASE 6: Build 6 Preparation

**Estimated Time:** 2-4 hours  
**Status:** TODO (after all QA passes)

### Pre-submission Checklist
- [ ] App version bumped (e.g., 4.2.0 → 4.3.0)
- [ ] IAP products configured and live in App Store Connect
- [ ] Privacy policy updated (mention subscription charges)
- [ ] Help page updated (show "how to manage subscription")
- [ ] Screenshot updated (show new Apple CTA if visible)

### App Store Submission
- [ ] Build ready for submission
- [ ] All tests passing
- [ ] No warnings/errors in Xcode
- [ ] Signing certificates valid
- [ ] Provisioning profiles updated
- [ ] Submit to App Store for review
- [ ] Wait for approval (typically 24-48h)

---

## Rollback Plan (If Issues Arise)

### Immediate (Day 1)
- [ ] Disable webhook: App Store Connect → Server Notifications → remove URL
- [ ] Disable iOS CTA: Hide "Buy Apple IAP" button in iOS app (next build)
- [ ] Investigation: Review `app_store_server_notifications` audit log

### Short-term (Days 2-3)
- [ ] If critical: Disable Edge Functions (Supabase dashboard)
- [ ] Refund: Manual refunds via Stripe for any double charges
- [ ] Communication: Notify affected coaches

### Full Rollback
- [ ] Keep SQL migrations (non-destructive, no data loss)
- [ ] Remove Edge Functions (code stays, just don't call)
- [ ] Next build: Remove iOS CTA entirely
- [ ] Proceed without IAP until issues resolved

---

## Command Reference

### Deploy All Fase 1 Edge Functions (One Command)
```bash
for func in apple-iap-webhook validate-iap check-entitlement; do
  supabase functions deploy $func --no-verify-jwt
done
```

### Deploy Fase 2 Detection Job
```bash
supabase functions deploy detect-double-charges --no-verify-jwt
```

### View Edge Function Logs
```bash
supabase functions list
# Then open Supabase dashboard → Edge Functions → click function name → Logs tab
```

### Test Webhook Endpoint
```bash
# Will return 401 (expected, invalid JWT)
curl -X POST https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook \
  -H "Content-Type: application/json" \
  -d '{"signedPayload":"test"}'
```

### View DB Tables Created by Migrations
```sql
-- In Supabase SQL Editor
SELECT tablename FROM pg_tables 
WHERE tablename LIKE 'usuarios_suscripciones_iap%' 
   OR tablename = 'app_store_server_notifications'
   OR tablename = 'suspicious_double_charges';
```

---

## Timeline Summary

| Phase | Task | Duration | Owner | Status |
|-------|------|----------|-------|--------|
| 0 | App Store Connect setup | 30 min | Micaela | ⏳ WAITING |
| 1 | Backend deployment | 2h | Claude | ⏳ BLOCKED ON 0 |
| 2 | Utilities deployment | 1h | Claude | ⏳ BLOCKED ON 0 |
| 3 | iOS integration | 8-16h | Team | ⏳ BLOCKED ON 0+1 |
| 4 | Testing & QA | 4-8h | QA | ⏳ BLOCKED ON 3 |
| 5 | Polish & monitoring | 4-8h | Team | ⏳ BLOCKED ON 4 |
| 6 | Build 6 submission | 2-4h | Team | ⏳ BLOCKED ON 5 |
| **TOTAL** | **From Fase 0 start to App Store** | **2-3 days** | **Team** | **⏳ ON SCHEDULE** |

---

## Success Criteria

### Fase 0 Complete
- ✅ Products live in App Store Connect
- ✅ Subscription group created
- ✅ API Key generated and .p8 file saved
- ✅ Webhook URL configured
- ✅ Secrets template filled

### Fase 1 Complete
- ✅ 5 secrets in Supabase
- ✅ 3 migrations applied
- ✅ 3 Edge Functions deployed
- ✅ Webhook endpoint responding

### Fase 2 Complete
- ✅ Detection job deployed
- ✅ GitHub Actions cron scheduled
- ✅ First detection run successful (next day)
- ✅ Admin email received

### Fase 3 Complete
- ✅ iOS can purchase Apple IAP
- ✅ Webhook updates DB on renewal
- ✅ Check-entitlement shows correct access
- ✅ No data loss, no double charges

### Fase 4 Complete
- ✅ All 13+ test scenarios pass
- ✅ Zero regressions detected
- ✅ Double charge detection working
- ✅ No critical issues

### Build 6 Ready
- ✅ iOS app with Apple IAP live on TestFlight
- ✅ QA sign-off
- ✅ Ready for App Store submission

---

## Contacts & Escalation

- **Backend/Architecture:** Claude (Anthropic)
- **iOS Development:** Micaela's team
- **App Store Connect:** Micaela
- **QA & Testing:** QA team
- **Supabase Configuration:** Admin/DevOps

---

**Checklist Version:** 2026-09-09  
**Status:** Ready for Fase 0 to begin  
**Last Updated By:** Claude Haiku 4.5
