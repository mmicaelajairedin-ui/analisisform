# Coach Plans iOS Screen — Implementation Guide

## 🎯 What Was Created

A native iOS (SwiftUI) screen for purchasing Pathway Coach Plans directly via StoreKit 2, integrated with the existing @capgo/native-purchases architecture.

### Design
- **Colors**: Pathway green (#4CAF7D), crema/white (#FCFDFC), carbon (#1B2E26)
- **Font**: Inter (system font, 13-16px)
- **Pricing**: Real from StoreKit (localized)
- **Plans**: Basic ($29.99/mo) & Pro ($59.99/mo)

---

## 📁 Files Created / Modified

### NEW FILES (Swift — iOS only)
| File | Purpose | Lines |
|------|---------|-------|
| `ios/CoachPlansView.swift` | SwiftUI UI screen | 420 |
| `ios/CoachPlansViewModel.swift` | Purchase logic + backend integration | 380 |
| `ios/CoachPlansPlugin.swift` | Capacitor bridge (JS → Swift) | 50 |
| `ios/XCODE_SETUP_CORRECTED.md` | Correct Xcode setup guide | 250 |

### MODIFIED FILES (iOS + Web)
| File | Changes | Lines Changed |
|------|---------|---------------|
| `panel-v2.html` | Updated `_purchasePlan()` to dispatch to native view | 15974-16012 |

### NEW DOCUMENTATION
| File | Purpose |
|------|---------|
| This file | Integration checklist |
| `ios/APP_TSX_COACH_PLANS_INTEGRATION.md` | Xcode setup instructions |

---

## 🏗️ Architecture

### Web → Native Flow
```
panel-v2.html
  _purchasePlan("pro")
    ↓
  window.Capacitor.Plugins.App.notifyListeners('showCoachPlans', {plan})
    ↓
  Swift App.swift (AppDelegate)
    presentCoachPlans()
      ↓
    CoachPlansView (SwiftUI)
      ├─ CoachPlansViewModel
      │  ├─ loadProducts() → StoreKit.Product
      │  ├─ validateBeforePurchase() → /validate-iap
      │  ├─ purchaseViaCapacitor() → /check-entitlement
      │  └─ checkCurrentEntitlement() → current subscription state
      │
      └─ UI: Plans, features, purchase button, auto-renewal info
```

### Features Implemented

#### 1. **Product Loading**
- Loads real products from StoreKit: `coach.plan.basic.monthly`, `coach.plan.pro.monthly`
- Displays localized pricing (USD per country)
- Handles no products gracefully

#### 2. **Purchase Flow**
- Step 1: Pre-purchase validation (`/validate-iap`) → checks Stripe mutual exclusivity
- Step 2: Show native purchase sheet → @capgo/native-purchases
- Step 3: Backend verification (`/check-entitlement`) → confirms subscription
- Step 4: Dismiss & sync back to web

#### 3. **Subscription State**
- Shows current active subscription (if any)
- Displays expiry date (locale-specific: es_ES)
- Auto-renewal information
- Option to restore purchases

#### 4. **UX**
- Full error handling + user-friendly messages
- Loading states during purchase
- Disabled state when no plan selected
- Dismiss button
- Links to Terms & Privacy (external URLs)

#### 5. **Backend Integration**
- `/validate-iap` — checks if coach can buy (no active Stripe)
- `/check-entitlement` — verifies receipt & returns subscription
- `/generate-app-account-token` — creates unique purchase identifier

---

## ⚙️ Files & What Requires Xcode (Mac)

### Can Be Done on Linux (This Session)
- ✅ `pw-capgo-iap.js` — JavaScript module (already done)
- ✅ `panel-v2.html` — Updated dispatcher
- ✅ `package.json` — Version pinned to 6.0.42 (already done)
- ✅ `CoachPlansView.swift` — Swift code created
- ✅ `CoachPlansViewModel.swift` — Swift code created
- ✅ Documentation

### REQUIRES XCODE / MAC ONLY
- 🔨 Copy Swift files → `ios/App/` directory
- 🔨 Link Capacitor framework
- 🔨 Add StoreKit 2 framework  
- 🔨 Set MinimumOSVersion: 15.0
- 🔨 Update `Info.plist` with SKAds permissions
- 🔨 Create App.swift with Capacitor bootstrap
- 🔨 Configure App Store Connect (IAP products, certificates)
- 🔨 Build & test on simulator/device
- 🔨 Final App Store submission

---

## 🔌 Integration Checklist

### Step 1: Verify Backend Functions Exist ✅
- [ ] `validate-iap` deployed → `/functions/v1/validate-iap`
- [ ] `check-entitlement` deployed → `/functions/v1/check-entitlement`
- [ ] `generate-app-account-token` deployed
- [ ] `apple-iap-webhook` deployed

### Step 2: Verify Web Changes ✅
- [ ] `panel-v2.html` `_purchasePlan()` updated to dispatch to native (DONE)
- [ ] `package.json` version set to 6.0.42 (DONE)
- [ ] `pw-capgo-iap.js` using `window.Capacitor.Plugins.NativePurchases` (DONE)

### Step 3: Prepare Swift Files (Copy to Mac/Xcode)
- [ ] Copy `ios/CoachPlansView.swift` → `{XcodeProject}/ios/App/CoachPlansView.swift`
- [ ] Copy `ios/CoachPlansViewModel.swift` → `{XcodeProject}/ios/App/CoachPlansViewModel.swift`
- [ ] Copy `ios/CoachPlansPlugin.swift` → `{XcodeProject}/ios/App/CoachPlansPlugin.swift` (Capacitor bridge)
- [ ] Read `ios/XCODE_SETUP_CORRECTED.md` for complete setup

### Step 4: Xcode Configuration
- [ ] Add files to Xcode target (File → Add Files to Project)
- [ ] Register CoachPlansPlugin in `Info.plist` (CapacitorPlugins array)
- [ ] Link `StoreKit` framework (Build Phases → Link Binary)
- [ ] Set iOS deployment target to 15.0+ in Build Settings
- [ ] Update `Info.plist` with SKAdNetwork (optional but recommended)

### Step 5: Verify Plugin Registration
- [ ] In Xcode Build Phases → Compile Sources: all 3 Swift files present
- [ ] In File Inspector: Target Membership checked for main app target
- [ ] In Info.plist: `CapacitorPlugins` array includes `CoachPlansPlugin`

### Step 6: Build & Test (Simulator)
- [ ] `pod install` (if using CocoaPods)
- [ ] Build in Xcode
- [ ] Open app in simulator
- [ ] Navigate to premium feature (messaging, white-label)
- [ ] Click "Ver planes"
- [ ] Verify CoachPlansView appears
- [ ] Test plan selection & purchase flow

### Step 7: App Store Connect Setup
- [ ] Create IAP products in App Store Connect:
  - `coach.plan.basic.monthly` ($29.99/month, auto-renewing)
  - `coach.plan.pro.monthly` ($59.99/month, auto-renewing)
- [ ] Set Status: "Ready to Submit"
- [ ] Configure billing agreement & display name
- [ ] Add screenshots (if prompted)

### Step 8: Production Build
- [ ] Remove all `console.log()` from Swift
- [ ] Set provisioning profile (Production)
- [ ] Archive for distribution
- [ ] Sign with App Store distribution certificate
- [ ] Upload to App Store Connect

### Step 9: Wait for Apple Review
- [ ] Submit for review
- [ ] Expect 24-48h turnaround
- [ ] Monitor for rejections (Reader Rule 3.1.3(f) now compliant)

### Step 10: Post-Approval
- [ ] In Supabase: deploy `apple-iap-webhook` (if not already)
- [ ] In GitHub: change deploy workflow `if: false` → `if: true` for iOS build
- [ ] Test live IAP on TestFlight
- [ ] Release to App Store

---

## 📋 Feature Checklist (What CoachPlansView Provides)

- [x] Display Basic & Pro plans with real pricing
- [x] Load products from StoreKit (not hardcoded)
- [x] Pre-purchase validation (Stripe check)
- [x] Purchase flow with Capacitor
- [x] Receipt verification via backend
- [x] Current subscription display
- [x] Expiry date (locale: es_ES)
- [x] Auto-renewal information
- [x] Restore purchases button
- [x] Error messages (user-friendly)
- [x] Loading state during purchase
- [x] Plan selection UI
- [x] Features comparison table
- [x] Links: Terms of Use & Privacy Policy
- [x] Dismiss button
- [x] Styling: Pathway green (#4CAF7D), crema, Inter font

---

## 🔐 Security Notes

### What's Protected
1. **Stripe Mutual Exclusivity** — validate-iap returns 409 if Stripe active
2. **Receipt Verification** — Backend validates Apple receipt via check-entitlement
3. **appAccountToken** — Unique per coach, links purchase to usuarios row
4. **RLS** — Supabase RLS ensures only coach can read own subscription
5. **Reader Rule 3.1.3(f)** — No in-app Stripe CTA (only StoreKit)

### What Requires Attention
- JWT sent in Authorization header (standard)
- appAccountToken stored in UserDefaults (SessionStorage class)
- Receipt data never stored locally (only backend verification)

---

## 🚀 Deployment Timeline

**Phase 1 (Linux/This Session)** ✅ DONE
- Swift code written
- Web dispatcher updated
- Documentation prepared
- 0 server changes needed

**Phase 2 (Xcode/Mac)** — Gonzalo's responsibility
- Files copied to Xcode project
- Framework linking
- Capacitor bootstrap setup
- Simulator testing (1-2 days)

**Phase 3 (App Store)** — After Gonzalo's build works
- Create IAP products in App Store Connect
- Submit for review
- Wait for approval (24-48h)

**Phase 4 (Production Activation)** — After App Store approval
- Enable iOS webhook in GitHub Actions (`if: true`)
- Live testing via TestFlight
- Release to App Store

---

## ❌ What This Does NOT Do

- ❌ Modify Stripe checkout (web only)
- ❌ Change Coach Plans backend functions
- ❌ Deploy anything to production
- ❌ Create or modify IAP products in App Store Connect
- ❌ Build the app (requires Xcode on Mac)

---

## 🆘 Troubleshooting

### "CoachPlansView not found" (Build error)
- ✓ Ensure Swift files in correct Xcode target
- ✓ Check Build Phases → Compile Sources includes both files

### "Capacitor plugin not available"
- ✓ Verify `@capgo/native-purchases` 6.0.42 installed
- ✓ Ensure Capacitor 6.2.2+ linked
- ✓ Check `Info.plist` includes plugin registration

### "Products not loading"
- ✓ Verify IAP product IDs in App Store Connect match:
  - `coach.plan.basic.monthly`
  - `coach.plan.pro.monthly`
- ✓ Check Bundle ID matches in Xcode

### "Purchase fails with 409"
- ✓ Coach has active Stripe subscription
- ✓ Instruct coach to cancel Stripe first, then retry

---

## 📞 Support

**For web/backend issues** → This session (panel-v2.html, validate-iap, etc.)
**For iOS/Swift issues** → Gonzalo (Xcode, CoachPlansView.swift, etc.)
**For App Store submission** → Refer to Apple's review guidelines
