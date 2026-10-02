# Xcode Setup — Coach Plans (CORRECTED)

## Architecture Correction

**Previous approach (WRONG):**
- Create new `App.swift` with @main entry point
- Use NotificationCenter listener
- ❌ Conflict: Can't have two @main entry points

**Correct approach (PROVEN):**
- Create small Capacitor plugin: `CoachPlansPlugin.swift`
- JS calls: `window.Capacitor.Plugins.CoachPlansPlugin.present()`
- Plugin opens CoachPlansView natively
- ✅ Same pattern as GoogleAuthPlugin (tested & working)

---

## Files to Copy to Xcode Project

```
{XcodeProject}/ios/App/
  ├─ CoachPlansView.swift          ← NEW
  ├─ CoachPlansViewModel.swift      ← NEW
  └─ CoachPlansPlugin.swift         ← NEW (Capacitor bridge)
```

---

## Step 1: Copy Swift Files

From repo:
- `ios/CoachPlansView.swift` → `{XcodeProject}/ios/App/CoachPlansView.swift`
- `ios/CoachPlansViewModel.swift` → `{XcodeProject}/ios/App/CoachPlansViewModel.swift`
- `ios/CoachPlansPlugin.swift` → `{XcodeProject}/ios/App/CoachPlansPlugin.swift`

In Xcode:
- File → Add Files to Project
- Select all 3 Swift files
- Target: check "App" (or your main target)

---

## Step 2: Register Plugin (Capacitor 6.2.2)

The plugin needs manual registration in Capacitor 6.

**Option A: Via Info.plist**

Edit `ios/App/App/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  ...
</array>
<key>CapacitorPlugins</key>
<array>
  <string>CoachPlansPlugin</string>
</array>
```

**Option B: Programmatic (in AppDelegate.swift)**

In your existing `AppDelegate.swift`, make sure Capacitor plugins are registered:

```swift
import Capacitor

// This is automatic in newer Capacitor, but if needed:
override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
  
  // Register custom plugins manually if not auto-discovered
  CapacitorBridge.registerPlugins()
  
  return true
}
```

**Option C: Xcode Build Phases (Failsafe)**

If plugins aren't auto-discovered:

1. In Xcode: Target → Build Phases
2. Add Run Script Phase:
   ```bash
   echo "Plugins registered via CapacitorBridge.registerPlugins()"
   ```

---

## Step 3: Link Frameworks

In Xcode:

**General Tab:**
- Frameworks, Libraries, and Embedded Content
- Add:
  - `StoreKit.framework` (iOS 15+)
  - `Capacitor.framework` (already present)

**Build Settings:**
- Search: `iOS Deployment Target`
- Set to: **15.0 or higher**

---

## Step 4: Verify Info.plist

Check these keys exist (Xcode usually auto-creates):

```xml
<key>NSLocalizedDescription</key>
<string>Coach Plans</string>

<key>SKAdNetwork</key>
<true/>
```

Optional but recommended for SKAdNetwork support.

---

## Step 5: Build & Test on Simulator

```bash
# In terminal
cd /path/to/XcodeProject
npx cap sync ios

# Then in Xcode
# Product → Build (Cmd+B)
# Product → Run (Cmd+R)
```

**Expected result:**
- App launches normally
- Navigate to a premium feature (e.g., Messaging)
- Click "Ver planes"
- CoachPlansView appears as a sheet
- Can select plan & attempt purchase

---

## Step 6: Test Purchase Flow (Simulator)

1. Open app in simulator
2. Click "Ver planes"
3. CoachPlansView appears
4. Select plan (Basic or Pro)
5. Click "Continuar con la compra"
6. Native purchase sheet appears (Simulator shows mock)
7. Complete purchase (or cancel)
8. View dismisses

---

## Step 7: App Store Connect Setup

1. Go to **App Store Connect** → Your App → **In-App Purchases**
2. Create two products:

   **Product 1: Basic Plan**
   - Product ID: `coach.plan.basic.monthly`
   - Type: Auto-Renewable Subscription
   - Subscription Period: 1 Month
   - Price Tier: $29.99
   - Status: Ready to Submit

   **Product 2: Pro Plan**
   - Product ID: `coach.plan.pro.monthly`
   - Type: Auto-Renewable Subscription
   - Subscription Period: 1 Month
   - Price Tier: $59.99
   - Status: Ready to Submit

3. **Billing Agreement** (required for subscriptions)
   - Accept Apple's agreement

4. Save & submit

---

## Step 8: Build for Production

```bash
# Archive
Product → Archive (Cmd+Shift+K)

# Validate & upload
Product → Export
```

Follow Apple's app submission flow.

---

## Troubleshooting

### "CoachPlansPlugin not found"
- ✅ Verify file is in Build Phases → Compile Sources
- ✅ Check target membership (File Inspector → Target Membership)

### "StoreKit not found"
- ✅ Project → Build Phases → Link Binary With Libraries
- ✅ Add `StoreKit.framework`

### "Product IDs not loading"
- ✅ Verify in App Store Connect products are "Ready to Submit"
- ✅ Bundle ID matches exactly
- ✅ On simulator: can be slow (5-10s) first time

### "Capacitor plugin not available"
- ✅ Check plugin is registered (Info.plist or CapacitorBridge)
- ✅ Verify CoachPlansPlugin.swift compiled without errors

### Build fails with @main conflicts
- ✅ Check you're NOT creating a new App.swift with @main
- ✅ Use existing AppDelegate.swift only
- ✅ CoachPlansPlugin.swift should NOT have @main

---

## Key Differences from Previous Docs

| What | Before | Now |
|-----|--------|-----|
| Entry point | New App.swift with @main | Use existing AppDelegate.swift |
| Bridge | NotificationCenter listener | CoachPlansPlugin (Capacitor) |
| JS call | App.notifyListeners() | CoachPlansPlugin.present() |
| Conflict | Two @main entry points ❌ | Single AppDelegate, plugin only |
| Pattern | Unique | Same as GoogleAuthPlugin ✅ |

---

## JS Integration (Already Done)

In `panel-v2.html` (already updated):

```javascript
function _purchasePlan(plan){
  if(window.Capacitor?.Plugins?.CoachPlansPlugin){
    window.Capacitor.Plugins.CoachPlansPlugin.present();
    return;
  }
  // Web: Stripe checkout
}
```

No changes needed in JavaScript.

---

## Ready to Build?

1. ✅ Copy 3 Swift files to Xcode
2. ✅ Register CoachPlansPlugin (Info.plist)
3. ✅ Link StoreKit framework
4. ✅ Set iOS 15.0+
5. ✅ Build & test
6. ✅ Create IAP products in App Store Connect
7. ✅ Submit to App Store
