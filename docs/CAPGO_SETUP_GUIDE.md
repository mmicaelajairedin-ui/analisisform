# @capgo/native-purchases Installation & Setup Guide

**Target:** Gonzalo (Xcode/iOS development)  
**Objective:** Set up StoreKit 2 bridge for IAP integration  
**Time estimate:** 15-30 minutes

---

## Prerequisites

- Xcode 14.3+
- iOS 15.0+ deployment target
- Capacitor 5.0+ (or React Native IAP if not using Capacitor)
- Node.js 16+
- npm or yarn

---

## Installation

### Option A: Capacitor Project (Recommended)

If your project uses Capacitor (most common for cross-platform apps):

```bash
# 1. Install the plugin via npm
npm install @capgo/native-purchases

# 2. Sync native dependencies
npx cap sync ios

# 3. Open Xcode
npx cap open ios
```

### Option B: React Native Bare Project

If using React Native without Capacitor:

```bash
npm install @capgo/native-purchases react-native-native-purchases

# Then follow RNiAP setup: https://react-native-iap.dooboolab.com/docs/installation
```

### Option C: Flutter Project

```bash
flutter pub add in_app_purchase
# OR for Capgo Flutter:
flutter pub add native_purchases
```

---

## Configuration (Xcode)

### Step 1: Enable In-App Purchases Capability

1. Open Xcode
2. Select your project → Target → Signing & Capabilities
3. Click **+ Capability**
4. Search and add: **In-App Purchase**
5. Verify it appears in your `.entitlements` file

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.in-app-payments</key>
    <true/>
</dict>
</plist>
```

### Step 2: Configure StoreKit 2 (Capacitor)

In your `AppDelegate.swift` or `MainActivity.kt`:

#### Swift (iOS)
```swift
import Capacitor
import NativePurchases

class AppDelegate: UIResponder, UIApplicationDelegate {
  
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // Initialize Capgo
    let config: [String: Any] = [
      "appId": "com.pathwaycareercoach.twa"
    ]
    
    // Pass config to plugin
    NativePurchasesPlugin.shared.initialize(with: config)
    
    return true
  }
}
```

#### TypeScript (Web/Capacitor)
```typescript
// main.ts or app.tsx
import { initCapacitorApp } from '@capgo/native-purchases';

// Initialize on app startup
async function initializeApp() {
  await initCapacitorApp({
    appId: 'com.pathwaycareercoach.twa'
  });
  console.log('✅ Capgo IAP initialized');
}

initializeApp();
```

### Step 3: Pod Dependencies (CocoaPods)

Ensure your `Podfile` includes StoreKit 2:

```ruby
# ios/Podfile
platform :ios, '15.0'

target 'YourAppName' do
  # ... other pods ...
  
  # StoreKit 2 (usually automatic with Capgo)
  pod 'StoreKit', :git => 'https://github.com/apple/swift-dependencies.git'
end
```

Run:
```bash
cd ios
pod install
cd ..
```

---

## Verification

### 1. Check JavaScript Module Loads

```javascript
// In your app startup
if (window.PW_CAPGO_IAP) {
  console.log('✅ PW_CAPGO_IAP module loaded');
} else {
  console.log('❌ PW_CAPGO_IAP not found');
}
```

### 2. Verify @capgo Plugin Available

```javascript
try {
  const { initCapacitorApp } = await import('@capgo/native-purchases');
  console.log('✅ @capgo/native-purchases available');
} catch (err) {
  console.error('❌ @capgo/native-purchases not loaded:', err);
}
```

### 3. Test Product Fetching

```javascript
// After init
const products = await PW_CAPGO_IAP.getProducts();
console.log('Products:', products);
// Should return array with at least 2 products:
// - coach.plan.basic.monthly ($29)
// - coach.plan.pro.monthly ($59)
```

---

## App Store Connect Setup

### Step 1: Create In-App Purchases

1. Log into [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app → In-App Purchases
3. Click **+** to create new IAP

**Product 1: Basic Plan**
- **Product ID:** `coach.plan.basic.monthly`
- **Type:** Subscription → Monthly
- **Name:** Basic Plan
- **Description:** Coaching platform access with essential features
- **Price tier:** Tier 3 ($2.99 base, ~$29/month globally)
- **Billing cycles:** Standard
- **Auto-renewal:** Enabled
- **Family Sharing:** Enabled (optional, user preference)

**Product 2: Pro Plan**
- **Product ID:** `coach.plan.pro.monthly`
- **Type:** Subscription → Monthly
- **Name:** Pro Plan
- **Description:** Coaching platform access with advanced features
- **Price tier:** Tier 6 ($4.99 base, ~$59/month globally)
- **Billing cycles:** Standard
- **Auto-renewal:** Enabled
- **Family Sharing:** Enabled (optional)

### Step 2: Get Your Shared Secret

1. App Store Connect → Your App → In-App Purchases
2. Scroll down → **Shared Secret**
3. Click **Manage** → View existing or generate new
4. Copy the secret (looks like: `abc123def456ghi789...`)
5. Give to Micaela → she'll add to Supabase Edge Functions

---

## Testing Sandbox Purchases

### Create Sandbox Tester

1. App Store Connect → Users and Access → Testers & Roles
2. Select **Sandbox Testers**
3. Click **+**
4. Enter test email (e.g., `test-coach-1@example.com`)
5. Set expiration to 1 month ahead
6. Save

### Test on Device/Simulator

1. **On iOS Device:**
   - Settings → App Store → Sign Out
   - Open app
   - Try purchase → Will prompt to sign in
   - Sign in with **Sandbox Tester** email (Apple ID password)
   - Should show: "This is a test transaction"
   - Tap Approve → Transaction succeeds (no real charge)

2. **On Simulator:**
   - Most simulators can test IAP with biometric prompts
   - If simulator doesn't show purchase sheet, try device

### Verify Sandbox Purchase

```bash
# Check Supabase
SELECT id, email, configuracion 
FROM usuarios 
WHERE email = 'test-coach-1@example.com';

# Look for iap_subscriptions in configuracion JSONB:
# {
#   "iap_subscriptions": [
#     {
#       "productId": "coach.plan.basic.monthly",
#       "originalTransactionId": "...",
#       "status": "ACTIVE",
#       "expiryDate": "2026-10-16T..."
#     }
#   ]
# }
```

---

## Troubleshooting

### "Product not found" error

**Problem:** `getProducts()` returns empty array

**Solutions:**
1. Verify product IDs in App Store Connect match exactly:
   - Should be: `coach.plan.basic.monthly`, `coach.plan.pro.monthly`
   - Not: `coach_plan_basic_monthly` or `coachPlanBasicMonthly`

2. Check Bundle ID matches:
   - Xcode Target → General → Bundle Identifier should be `com.pathwaycareercoach.twa`
   - In App Store Connect, verify app uses same Bundle ID

3. Ensure app is signed with correct Team ID
   - App Store Connect → App Information → Bundle ID
   - Should match Xcode Signing settings

### "In-App Purchases capability not enabled"

**Problem:** `@capgo/native-purchases` fails to initialize

**Solution:**
1. Xcode → Target → Signing & Capabilities
2. Verify **In-App Purchase** capability is enabled
3. Check `.entitlements` file includes:
   ```xml
   <key>com.apple.developer.in-app-payments</key>
   <true/>
   ```

### Sandbox purchases work, but not showing in backend

**Problem:** Receipt verifies but subscription not in `usuarios.configuracion`

**Solutions:**
1. Check Edge Function logs:
   ```bash
   supabase functions logs check-entitlement
   ```

2. Verify JWT token is being sent:
   ```javascript
   const jwt = localStorage.getItem('mj_auth');
   console.log('JWT:', jwt ? '✅ Found' : '❌ Missing');
   ```

3. Ensure `appAccountToken` is unique per coach:
   ```javascript
   const user = JSON.parse(localStorage.getItem('mj_user'));
   console.log('appAccountToken:', user.app_account_token);
   ```

### "Cannot use real Apple ID in sandbox"

**Problem:** Trying to use personal Apple ID for testing

**Solution:** 
- Sandbox testing REQUIRES Sandbox Tester account
- Create dedicated sandbox test emails (e.g., `test-coach-1@example.com`)
- Never use your real Apple ID in sandbox

---

## Integration with pw-capgo-iap.js

Once setup is complete, the module is ready to use:

```javascript
// 1. Initialize
await PW_CAPGO_IAP.init();

// 2. Fetch products
const products = await PW_CAPGO_IAP.getProducts();

// 3. Purchase
const result = await PW_CAPGO_IAP.purchaseProduct(
  'coach.plan.basic.monthly',
  appAccountToken  // UUID from backend
);

if (result.success) {
  console.log('✅ Subscription active');
} else {
  console.error('❌ Purchase failed:', result.error);
}
```

---

## iOS-Specific Gotchas

### 1. App Tracking Transparency (ATT)

If your app requests user tracking (for analytics), Apple requires ATT prompt. **Not related to IAP**, but good to know:

```swift
// In AppDelegate
import AppTrackingTransparency

ATTrackingManager.requestTrackingAuthorization { _ in
  // User granted or denied
}
```

### 2. Reader Rule 3.1.3(f) Compliance

If reviewing your IAP implementation, Apple checks:
- ✅ No direct payment links (Stripe) visible in iOS app
- ✅ Show only neutral purchase UI
- ✅ Use native purchase sheet (Apple's, not custom)

**In the web version (`panel-v2.html`), IAP CTAs are hidden in iOS:**
```html
<div data-app-hide><!-- Hidden in iOS --></div>
```

**Why?** Reader Rule prevents showing alternative payment options in-app.

### 3. Auto-Renewal Receipts

Apple sends renewal receipts automatically. Backend handles these via webhook (`apple-iap-webhook`). You don't need to do anything — subscriptions auto-update.

### 4. Refund/Cancellation

If user requests refund via App Store:
1. Apple processes refund
2. Sends `REFUNDED` notification to webhook
3. Backend updates `usuarios.configuracion` status
4. Next time app calls `checkCurrentEntitlement()`, it sees refund

---

## Security Checklist

- [ ] In-App Purchase capability enabled in Xcode
- [ ] Shared Secret configured in Supabase
- [ ] Product IDs match App Store Connect exactly
- [ ] JWT token sent with backend requests
- [ ] appAccountToken is unique per coach
- [ ] Sandbox testing uses Sandbox Tester account (not real Apple ID)
- [ ] Receipt verification required before granting access
- [ ] No hardcoded secrets in app code

---

## Next Steps

1. ✅ Install @capgo/native-purchases
2. ✅ Enable In-App Purchase capability
3. ✅ Create sandbox tester account
4. ✅ Create IAP products in App Store Connect
5. ✅ Test sandbox purchase flow
6. ⏳ Tell Micaela when ready → she'll deploy Edge Functions
7. ⏳ Build TestFlight app → real testing
8. ⏳ Submit to App Store

---

## Resources

- **Capgo Docs:** https://capgo.app/docs/native-purchases
- **StoreKit 2 Guide:** https://developer.apple.com/storekit/
- **App Store Connect Help:** https://appstoreconnect.apple.com/help
- **Reader Rule Details:** https://developer.apple.com/app-store/review/guidelines/
- **Sandbox Testing:** https://developer.apple.com/documentation/appstoreserverapi/app_store_server_notifications

---

## Support

| Issue | Who to Ask |
|---|---|
| @capgo plugin won't load | Capgo support or Gonzalo (you!) |
| Product IDs not showing | App Store Connect team / Micaela |
| Backend returns 409 (Stripe conflict) | Expected behavior — user has active Stripe |
| Receipt won't verify | Check Shared Secret in backend / JWT |
| Sandbox tester account issues | Apple Support |

**Last Updated:** September 2026  
**Status:** Ready for iOS integration  
**Maintainer:** Backend is Micaela, iOS integration is Gonzalo
