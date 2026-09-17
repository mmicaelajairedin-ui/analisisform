# Gonzalo's Implementation Checklist

**Print this page. Tacha items as you go.**

---

## PHASE 1: SETUP (30 min)

- [ ] 1.1 Clone: `git clone ...`
- [ ] 1.2 Checkout: `git checkout feature/capgo-iap-integration`
- [ ] 1.3 Install: `npm install`
- [ ] 1.4 Verify: `npm list @capgo/native-purchases` = v8.7.0
- [ ] 1.5 Open Xcode: `npx cap open ios` or open `.xcworkspace`

**Verify after Phase 1:**
```
Git HEAD = 3cb87b7
npm shows @capgo/native-purchases@8.7.0
Xcode window opens without errors
```

---

## PHASE 2: XCODE CONFIG (20 min)

**Targets → General:**
- [ ] 2.1 Bundle ID = `com.pathwaycareercoach.twa`
- [ ] 2.2 Team = Your Apple Developer Team

**Targets → Signing & Capabilities:**
- [ ] 2.3 Team set
- [ ] 2.4 In-App Purchase capability added
- [ ] 2.5 `.entitlements` file exists with `com.apple.developer.in-app-payments`

**Capacitor (if applicable):**
- [ ] 2.6 Podfile includes `@capgo/native-purchases` OR re-run `npx cap sync ios`

**Verify after Phase 2:**
- [ ] Bundle ID exactly `com.pathwaycareercoach.twa`
- [ ] In-App Purchase checkbox checked in Signing & Capabilities
- [ ] No warnings in build log

---

## PHASE 3: APP STORE CONNECT (45 min)

**Verification:**
- [ ] 3.1 App exists in App Store Connect
- [ ] 3.2 Bundle ID in App Store Connect matches Xcode

**In-App Purchase Products:**
- [ ] 3.3 Product 1: `coach.plan.basic.monthly` ($29/mo) created
- [ ] 3.4 Product 2: `coach.plan.pro.monthly` ($59/mo) created
- [ ] 3.5 Both products in status "Ready to Submit" or "Approved"

**Shared Secret:**
- [ ] 3.6 Get Shared Secret from **In-App Purchases → Shared Secret → Manage**
- [ ] 3.7 Copy full secret (don't truncate)
- [ ] 3.8 Save in secure location (will give to Micaela)

**Sandbox Tester:**
- [ ] 3.9 Create sandbox tester in **Users and Access → Sandbox Testers**
- [ ] 3.10 Email: `test-coach-1@example.com`
- [ ] 3.11 Generate strong password
- [ ] 3.12 Set expiration to 1 month from now

**Verify after Phase 3:**
- [ ] Both product IDs visible in App Store Connect with exact spelling
- [ ] Shared Secret available (long string)
- [ ] Sandbox tester can log in to device (test email/password work)

---

## PHASE 4: DEVICE TESTING (1 hour)

**Device Setup:**
- [ ] 4.1 iPhone/iPad connected via USB
- [ ] 4.2 Device appears in Xcode → Window → Devices and Simulators
- [ ] 4.3 Device trusted on both Mac and device

**Debug Build:**
- [ ] 4.4 Select device in Xcode toolbar (not Simulator)
- [ ] 4.5 `Cmd+B` = Build succeeds
- [ ] 4.6 `Cmd+R` = App installs on device
- [ ] 4.7 App opens without crash

**Xcode Console Verification:**
- [ ] 4.8 See `[PW_STOREKIT] Initializing StoreKit 2...`
- [ ] 4.9 See `[PW_STOREKIT] ✅ Bootstrap complete`
- [ ] 4.10 No errors with `[PW_STOREKIT]` prefix

**App Testing:**
- [ ] 4.11 Login screen works
- [ ] 4.12 Can log in with test account
- [ ] 4.13 Navigate to Plans/Purchase screen
- [ ] 4.14 See "Basic Plan $29" and "Pro Plan $59"

**Verify after Phase 4:**
- [ ] No crashes in console
- [ ] All `[PW_STOREKIT]` and `[PW_CAPGO_IAP]` logs are ✅ (green)
- [ ] Plans screen shows correct pricing

---

## PHASE 5: SANDBOX PURCHASE TEST (45 min)

**Device Setup:**
- [ ] 5.1 On device: Settings → App Store → Sign Out
- [ ] 5.2 Close app completely (swipe up on multitasking screen)

**Purchase Attempt:**
- [ ] 5.3 Open app again
- [ ] 5.4 Navigate to Plans page
- [ ] 5.5 Tap "Buy Basic Plan"
- [ ] 5.6 Prompted to sign in
- [ ] 5.7 Sign in with sandbox tester email: `test-coach-1@example.com`
- [ ] 5.8 Apple's native purchase sheet appears
- [ ] 5.9 See yellow banner: "This is a test transaction"
- [ ] 5.10 Tap "Approve" or use Face ID
- [ ] 5.11 See success screen (Purchase Complete / Subscription Active)

**Console Verification:**
- [ ] 5.12 In Xcode Console see: `[PW_STOREKIT] Receipt verified: { hasAccess: true }`
- [ ] 5.13 No error messages starting with `[PW_STOREKIT] ... error`

**Backend Verification (Supabase SQL):**
- [ ] 5.14 Open Supabase Dashboard → SQL Editor
- [ ] 5.15 Run:
  ```sql
  SELECT email, configuracion 
  FROM usuarios 
  WHERE email LIKE 'test-coach%' 
  LIMIT 1;
  ```
- [ ] 5.16 See result with `configuracion` containing `iap_subscriptions`
- [ ] 5.17 In `iap_subscriptions` see:
  ```json
  {
    "productId": "coach.plan.basic.monthly",
    "status": "ACTIVE",
    "expiryDate": "2026-10-17T..."
  }
  ```

**Verify after Phase 5:**
- [ ] Sandbox purchase completed without crash
- [ ] "This is a test transaction" banner visible
- [ ] Supabase has subscription data
- [ ] Console shows `hasAccess: true`

---

## PHASE 6: BUILD RELEASE (30 min)

**Version Bump:**
- [ ] 6.1 Xcode → General → Version field
- [ ] 6.2 Change version to `1.0.1` (or next increment)
- [ ] 6.3 Change Build Number to `6` (or next increment)

**Build Setup:**
- [ ] 6.4 `Cmd+Shift+K` = Clean build folder
- [ ] 6.5 Toolbar dropdown: Select **Any iOS Device (arm64)** (NOT Simulator)

**Archive:**
- [ ] 6.6 `Cmd+B` = Build (no errors)
- [ ] 6.7 `Cmd+Shift+B` = Archive
- [ ] 6.8 Wait for Organizer window to open
- [ ] 6.9 See archive in list with your version number

**Upload to TestFlight:**
- [ ] 6.10 In Organizer, select latest archive
- [ ] 6.11 Click **Distribute App**
- [ ] 6.12 Select **App Store Connect**
- [ ] 6.13 Select **Upload**
- [ ] 6.14 Follow on-screen prompts (signing, etc.)
- [ ] 6.15 Wait for upload to complete (5-10 min)

**Verify after Phase 6:**
- [ ] No build errors
- [ ] Archive created successfully
- [ ] TestFlight upload succeeds (no error messages)

---

## PHASE 7: TESTFLIGHT VERIFICATION (10 min)

**In App Store Connect:**
- [ ] 7.1 Go to your app → **TestFlight** tab
- [ ] 7.2 Go to **iOS Builds**
- [ ] 7.3 See Build 6 (or your build number)
- [ ] 7.4 Status shows "Waiting for Review" or "Ready to Test"
- [ ] 7.5 Metadata looks correct (version, build number)

**Verify after Phase 7:**
- [ ] TestFlight build visible
- [ ] Build number matches what you just uploaded
- [ ] No errors or warnings

---

## PHASE 8: REPORT TO MICAELA (5 min)

**Send Micaela this message:**

```
✅ Build 6 Ready for TestFlight

TECHNICAL DETAILS:
- Build Number: 6
- App Version: 1.0.1
- Bundle ID: com.pathwaycareercoach.twa
- Shared Secret: [PASTE SECRET HERE]

TESTING RESULTS:
✅ Xcode config complete (bundle ID, team, IAP capability)
✅ App Store Connect products created (both with correct IDs)
✅ Debug app installed on device
✅ Sandbox tester created
✅ Sandbox purchase tested:
   - Apple sheet appeared
   - Test transaction banner visible
   - Purchase approved successfully
   - Supabase received subscription data
✅ TestFlight build 6 uploaded
✅ No crashes in console

NEXT STEPS (Your turn):
1. Change if: false → if: true in .github/workflows/deploy-functions.yml
2. Push to main
3. GitHub Actions deploys 4 Edge Functions
4. Verify deployment with: supabase functions list

When functions are deployed, I'll do final end-to-end testing.
```

**Verify after Phase 8:**
- [ ] 8.1 Message sent to Micaela
- [ ] 8.2 Included Build #, version, Bundle ID
- [ ] 8.3 Included Shared Secret (don't forget!)
- [ ] 8.4 Included checklist of what's tested

---

## PHASE 9: WAIT FOR BACKEND (1-2 hours)

**Micaela will:**
- [ ] 9.1 Activate Edge Functions (if: false → if: true)
- [ ] 9.2 Push to main
- [ ] 9.3 Verify functions deployed
- [ ] 9.4 Tell you when ready

**You do:**
- [ ] 9.5 Wait for message from Micaela
- [ ] 9.6 Check that functions are live: `supabase functions list`

**Verify after Phase 9:**
- [ ] Message from Micaela: "Functions deployed ✅"
- [ ] In Supabase: Functions list shows 4 IAP functions

---

## FINAL: MORE TESTING (30 min)

**When functions are live:**
- [ ] Final.1 Do another sandbox purchase test
- [ ] Final.2 Verify end-to-end works with live functions
- [ ] Final.3 Check Supabase for subscription data again
- [ ] Final.4 Test refund if possible (Micaela can do this)
- [ ] Final.5 Confirm everything ready for App Store Review

**Verify after FINAL:**
- [ ] Sandbox purchase still works
- [ ] All console logs ✅
- [ ] Supabase subscription persists
- [ ] Ready to tell Micaela: "Ready for App Store Review"

---

## 🎯 SUCCESS CRITERIA

Before Phase 8 (Report to Micaela), you MUST have:

- ✅ App installs on device without crash
- ✅ Login works
- ✅ Plans screen shows both products with correct pricing
- ✅ Sandbox purchase completes (see "This is a test" banner)
- ✅ Console shows `[PW_STOREKIT] ✅ Bootstrap complete`
- ✅ Supabase has subscription data in `usuarios.configuracion`
- ✅ TestFlight build uploaded
- ✅ Shared Secret obtained and saved

**If ANY of these are ❌, don't proceed. Fix first.**

---

## 📊 Progress Tracker

```
Phase 1: SETUP                     ░░░░░░░░░░ 0%  [ ]
Phase 2: XCODE CONFIG             ░░░░░░░░░░ 0%  [ ]
Phase 3: APP STORE CONNECT        ░░░░░░░░░░ 0%  [ ]
Phase 4: DEVICE TESTING           ░░░░░░░░░░ 0%  [ ]
Phase 5: SANDBOX PURCHASE         ░░░░░░░░░░ 0%  [ ]
Phase 6: BUILD RELEASE            ░░░░░░░░░░ 0%  [ ]
Phase 7: TESTFLIGHT VERIFY        ░░░░░░░░░░ 0%  [ ]
Phase 8: REPORT TO MICAELA        ░░░░░░░░░░ 0%  [ ]
Phase 9: WAIT FOR BACKEND         ░░░░░░░░░░ 0%  [ ]
FINAL:   MORE TESTING             ░░░░░░░░░░ 0%  [ ]
```

---

**Good luck! 🚀 You've got this, Gonzalo.**

---

**Print Date:** ________________  
**Start Time:** ________________  
**Finish Time:** ________________  
**Total Time:** ________________  

**Notes/Issues Encountered:**
```
_________________________________________________
_________________________________________________
_________________________________________________
_________________________________________________
```

---

**When complete, take a screenshot and send to Micaela! 📸**
