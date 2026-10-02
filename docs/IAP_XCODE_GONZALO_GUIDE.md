# IAP Integration for iOS App — Gonzalo's Xcode Checklist

**Backend Status:** ✅ 100% READY  
**Frontend Integration:** ✅ Complete (pw-capgo-iap.js)  
**Your Task:** Wire up StoreKit 2 in Xcode to match backend expectations

---

## Quick Overview

The backend is **prepared for production**. You receive:

1. **IAP validation function** (`/functions/v1/validate-iap`) — checks for Stripe conflicts before purchase
2. **IAP entitlement function** (`/functions/v1/check-entitlement`) — verifies Apple receipts post-purchase
3. **Webhook handler** (`/functions/v1/apple-iap-webhook`) — receives Apple's server-to-server notifications
4. **JavaScript integration module** (`pw-capgo-iap.js`) — ready to call your Capgo methods

Your job: **Make the iOS app call these backend functions at the right time.**

---

## What You're Building (High-Level)

```
User taps "Buy Plan" (iOS app)
  ↓
pw-capgo-iap.js calls PW_CAPGO_IAP.purchaseProduct()
  ↓
[Step 1] Validate: POST /functions/v1/validate-iap (check Stripe conflict)
  ↓
[Step 2] Show native purchase sheet (@capgo/native-purchases handles this)
  ↓
[Step 3] User completes purchase in Apple's UI
  ↓
[Step 4] Verify receipt: POST /functions/v1/check-entitlement
  ↓
Backend confirms subscription ✅
  ↓
User sees "Plan upgraded" in app
```

---

## Step 1: Install @capgo/native-purchases

In your Xcode project directory:

```bash
npm install @capgo/native-purchases
# or if using Capacitor
npx cap add ios
npx cap sync
```

**Important:** This is a Capacitor plugin, not a native library. If your app uses Capacitor, it's a three-liner. If it's a bare React Native project, there's a separate setup. **Confirm your stack with Micaela first.**

---

## Step 2: Initialize StoreKit 2

In your app's startup (e.g., `AppDelegate.swift` or `app.tsx`):

```swift
// AppDelegate.swift (if using Capacitor)
import Capacitor
import NativePurchases

class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // Initialize Capgo IAP
    let config: [AnyHashable: Any] = [
      "appId": "com.pathwaycareercoach.twa"
    ]
    CapacitorPlugins.register(["NativePurchases": NativePurchasesPlugin.self])
    
    return true
  }
}
```

Or if using **web-based Capacitor**:

```javascript
// main.tsx or app.tsx
import { initCapacitorApp } from '@capgo/native-purchases';

await initCapacitorApp({ appId: 'com.pathwaycareercoach.twa' });
```

**Verify:** After startup, `window.PW_CAPGO_IAP.isInitialized` should be `true`.

---

## Step 3: Fetch and Display Products

In your plan selection screen:

```javascript
// In your React/Vue component or vanilla JS
const products = await PW_CAPGO_IAP.getProducts();
// Returns array of product objects with price, title, description, localizedPrice

// Render products in your UI
products.forEach(p => {
  console.log(`${p.title} — ${p.localizedPrice}/${p.subscriptionPeriod}`);
});
```

**What you get back:**

```javascript
{
  id: "coach.plan.basic.monthly",
  title: "Basic Plan",
  description: "Coaching platform access",
  price: 29,
  currency: "USD",
  localizedPrice: "$29.00",
  subscriptionPeriod: "1month"
}
```

---

## Step 4: Generate appAccountToken

Before the user taps "Buy", your backend must generate a unique UUID for this coach:

```javascript
// In your panel or settings, after login
const response = await fetch('/functions/v1/generate-app-account-token', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + jwt },
  body: JSON.stringify({ coachId: currentCoachId })
});
const { appAccountToken } = await response.json();
// Save this UUID in localStorage or your state
localStorage.setItem('appAccountToken', appAccountToken);
```

**⚠️ CRITICAL:** This token **must be unique per coach**. It links the purchase back to the correct Supabase `usuarios` row. Apple sends this back in the webhook, and we use it to find the right coach.

---

## Step 5: Initiate Purchase

When user taps "Buy Basic Plan":

```javascript
const appAccountToken = localStorage.getItem('appAccountToken');
const productId = 'coach.plan.basic.monthly';

const result = await PW_CAPGO_IAP.purchaseProduct(productId, appAccountToken);

if (result.success) {
  // Subscription active! Show success screen
  console.log('✅ Purchase successful', result.subscription);
  // Navigate to "Plan upgraded" screen or show modal
} else {
  // Show error
  console.error('❌ Purchase failed:', result.error);
  // Could be:
  // - "Cannot purchase IAP while active Stripe subscription exists" (409)
  // - "No receipt returned" (user cancelled)
  // - "Entitlement verification failed" (backend rejected)
}
```

**What happens inside:**

1. `pw-capgo-iap.js` calls `_validateBeforePurchase()` → hits `/functions/v1/validate-iap`
   - Backend checks: is there an active Stripe subscription?
   - If YES → returns `{ allowed: false, reason: 'Stripe active' }`
   - If NO → returns `{ allowed: true }`

2. If allowed, `@capgo/native-purchases` shows Apple's native purchase sheet
   - User enters Face ID / passcode
   - Apple validates the charge

3. Receipt comes back to the app
   - `pw-capgo-iap.js` calls `_verifyReceiptWithBackend()` → hits `/functions/v1/check-entitlement`
   - Backend verifies the receipt with Apple
   - If valid → writes subscription to `usuarios.configuracion` JSONB

4. Local state updates: `currentSubscription` is now populated

---

## Step 6: Check Entitlement on App Launch

Every time the app starts, verify the user's subscription is still active:

```javascript
// In your app's initialization (e.g., after login)
const entitlement = await PW_CAPGO_IAP.checkCurrentEntitlement();

if (entitlement && entitlement.hasAccess) {
  // User has active subscription
  console.log('Subscription active until:', entitlement.expiryDate);
  ME.hasPremium = true;
} else {
  // No subscription or it expired
  ME.hasPremium = false;
}
```

---

## Step 7: Configure App Store Connect

Log into App Store Connect and set up these product IDs:

| Product ID | Name | Type | Price | Billing |
|---|---|---|---|---|
| `coach.plan.basic.monthly` | Basic Plan | Subscription | $29/mo | Monthly auto-renewal |
| `coach.plan.pro.monthly` | Pro Plan | Subscription | $59/mo | Monthly auto-renewal |

**⚠️ Make sure these product IDs match exactly. No typos.**

---

## Step 8: Test in Sandbox

1. Create a **Sandbox Tester** account in App Store Connect → Testers & Roles
2. In your iOS device:
   - Settings → App Store → Sign Out (from your real Apple ID)
   - Open the TestFlight app or your debug build
   - When prompted, sign in with the **Sandbox Tester** email
3. Try a purchase
   - Should prompt: "This is a test transaction"
   - Select "Approve" (sandbox charges fake money, no real charge)
4. Verify in backend:
   - Check `usuarios.configuracion` for the coach → should have `iap_subscriptions` JSONB
   - Example:
     ```json
     {
       "iap_subscriptions": [
         {
           "productId": "coach.plan.basic.monthly",
           "originalTransactionId": "2000000...",
           "expiryDate": "2026-10-16T12:34:56Z",
           "status": "ACTIVE"
         }
       ]
     }
     ```

---

## Step 9: Webhook Secret Configuration

Apple will send webhook notifications to `/functions/v1/apple-iap-webhook`. These are signed with your **Shared Secret**.

1. In App Store Connect → Your App → In-App Purchases → Get your **Shared Secret**
2. Add to Supabase Edge Functions secrets:
   ```bash
   supabase secrets set APPLE_IAP_SHARED_SECRET="your-secret-here"
   ```
3. The backend will validate every webhook using this secret

---

## Step 10: Deployment Checklist

Before going to production:

- [ ] Product IDs created in App Store Connect (basic & pro)
- [ ] Sandbox testing successful (fake purchase approved)
- [ ] Backend secrets configured (`APPLE_IAP_SHARED_SECRET`)
- [ ] Edge Functions deployed (currently blocked, will unblock when you're ready)
- [ ] `appAccountToken` is unique per coach (verified in logs)
- [ ] Receipt verification returns correct expiry date
- [ ] App shows correct "Plan upgraded" messaging
- [ ] Refund/cancellation handling tested (if applicable)

---

## Files You Need to Know About

| File | What It Does | Your Responsibility |
|---|---|---|
| `pw-capgo-iap.js` | JavaScript IAP integration module | Call these methods from your UI |
| `panel-v2.html` | Coach dashboard (web version) | Already has IAP CTAs hidden with `data-app-hide` |
| `supabase/functions/validate-iap` | Pre-purchase validation | Backend (already done) |
| `supabase/functions/check-entitlement` | Post-purchase verification | Backend (already done) |
| `supabase/functions/apple-iap-webhook` | Webhook receiver | Backend (already done) |

---

## Common Issues & Fixes

### "appAccountToken required"
→ Make sure you're passing the UUID from `generate-app-account-token` endpoint

### "Cannot purchase IAP while active Stripe subscription exists"
→ Backend detected this coach has an active Stripe subscription. Stripe & IAP can't coexist. Show user a message: "Please cancel your current plan first"

### "Receipt verification failed"
→ The receipt didn't validate with Apple. Usually a sandbox testing issue. Check:
  - Are you testing with Sandbox Tester account?
  - Is `APPLE_IAP_SHARED_SECRET` configured in backend?
  - Try again in sandbox environment

### User sees purchase sheet but nothing happens
→ Check browser console for errors. Most likely:
  - No JWT token in localStorage (`mj_auth`)
  - Network error (offline?)
  - App crashed after purchase (check iOS console)

### User purchased but subscription not showing
→ Check:
  1. Did the receipt verification succeed? (look for `/check-entitlement` 200 response)
  2. Is the subscription in `usuarios.configuracion`? (query Supabase)
  3. Did the webhook from Apple arrive? (check `app_store_server_notifications` table)

---

## What Micaela Will Do

- ✅ Prepare backend functions (done)
- ✅ Set up RLS policies (done)
- ✅ Configure Supabase migrations (done)
- ✅ Test with mock receipts (done)
- ❌ Do Xcode setup (that's you!)
- ❌ Configure App Store Connect (you or Micaela)
- ❌ Create TestFlight build (you or Micaela)

---

## What Happens After Purchase

1. **Immediate (app-side):**
   - `currentSubscription` state updates
   - User sees "✅ Plan upgraded"
   - UI unlocks premium features

2. **Later (webhook):**
   - Apple sends renewal notices to `/apple-iap-webhook`
   - Backend updates subscription status in `usuarios.configuracion`
   - If subscription is cancelled, `status` changes to `CANCELLED`

3. **On App Launch:**
   - `checkCurrentEntitlement()` verifies subscription is still active
   - If expired or refunded, UI downgrades to free tier

---

## Questions to Ask

1. **Is the app Capacitor-based or bare React Native?**
   - → Affects @capgo/native-purchases installation
   
2. **Do you have App Store Connect access?**
   - → You'll need to create the product IDs
   
3. **What's the iOS team ID / bundle ID?**
   - → Should be `com.pathwaycareercoach.twa` but confirm
   
4. **TestFlight build — will you do this or Micaela?**
   - → Needed to test sandbox purchases

---

## Next Steps (In Order)

1. Read this guide → understand the flow
2. Install @capgo/native-purchases → verify it loads
3. Create product IDs in App Store Connect
4. Add `PW_CAPGO_IAP.init()` to app startup
5. Wire up "Buy Plan" button → calls `purchaseProduct()`
6. Test in sandbox → verify receipt verification
7. Tell Micaela when you're ready → she'll unblock the Edge Functions deployment
8. Go live!

---

## Support

- Stuck on @capgo integration? → Check @capgo docs: https://capgo.app/docs
- Questions about backend functions? → Ask Micaela
- Test receipt rejected? → Check Apple's sandbox environment requirements
- iOS build issues? → Check Xcode logs, ensure Signing & Capabilities are set

**Last updated:** September 2026  
**Backend commit:** `b0263c1` (Blocker #1 fix — JSONB architecture)  
**Status:** Ready for iOS integration
