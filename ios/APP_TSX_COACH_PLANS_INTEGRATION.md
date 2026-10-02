# App.tsx — Coach Plans Integration (iOS)

## Overview
In `App.tsx` (Capacitor bootstrap), add a navigation state to present the `CoachPlansView` natively when purchase is needed.

## Flow
1. **Web Panel** (panel-v2.html) → Coach clicks "Ver planes" → `_purchasePlan("pro")`
2. **JS Bridge** → Check `window.PW_IN_APP` (Capacitor)
3. **Capacitor** → Emit event `showCoachPlans`
4. **Swift (App.tsx)** → Present `CoachPlansView` as native sheet
5. **StoreKit** → Purchase → Backend validation
6. **Dismiss** → Sync subscription state back to web

---

## Code: App.tsx Integration

Add this to your existing App component:

```tsx
import SwiftUI
import Capacitor

@main
struct App: UIApplicationDelegate {
  var window: UIWindow?
  
  // ... existing code ...
  
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Initialize Capacitor
    CapacitorBridge.registerPlugins()
    
    // Listen for Coach Plans request from web
    NotificationCenter.default.addObserver(
      forName: NSNotification.Name("showCoachPlans"),
      object: nil,
      queue: .main
    ) { _ in
      self.presentCoachPlans()
    }
    
    return true
  }
  
  private func presentCoachPlans() {
    guard let rootViewController = window?.rootViewController else { return }
    
    let hostingController = UIHostingController(rootViewController: CoachPlansView())
    hostingController.modalPresentationStyle = .formSheet
    
    if let sheetController = hostingController.sheetPresentationController {
      sheetController.detents = [.large(), .medium()]
      sheetController.prefersGrabberVisible = true
      sheetController.preferredCornerRadius = 20
    }
    
    rootViewController.present(hostingController, animated: true)
  }
}
```

---

## Code: panel-v2.html JavaScript Dispatcher

Modify `_purchasePlan()` in panel-v2.html:

```javascript
function _purchasePlan(plan) {
  // iOS In-App: trigger native Coach Plans view
  if (window.PW_IN_APP) {
    if (window.Capacitor && window.Capacitor.Plugins) {
      // Emit event to Swift
      window.Capacitor.Plugins.App?.addListener?.('pause', () => {
        // Forward to native
      });
    }
    // Trigger via notification
    if (window.Capacitor && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.notifyListeners?.('showCoachPlans', { plan: plan });
    }
    return;
  }
  
  // Web: Stripe checkout
  const stripeUrl = plan === 'pro' 
    ? 'https://buy.stripe.com/...' 
    : 'https://pathwaycareercoach.com/upgrade.html';
  window.open(stripeUrl, '_blank');
}
```

---

## Code: Sync Subscription State Back to Web

When purchase completes in `CoachPlansView`, notify web:

```swift
// In CoachPlansView.swift, after purchase succeeds:
if let bridge = CapacitorBridge.bridge {
  bridge.eval(
    javascript: """
    if (window.PW_CAPGO_IAP) {
      window.PW_CAPGO_IAP.checkCurrentEntitlement();
    }
    """
  )
}
```

---

## App.swift (New File)

Create `ios/App.swift` with Capacitor setup:

```swift
import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

  var window: UIWindow?
  var webViewController: CAPBridgeViewController?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {

    // Create web view controller
    let controller = CAPBridgeViewController(with: "Config")
    
    // Setup window
    let window = UIWindow(frame: UIScreen.main.bounds)
    window.rootViewController = controller
    self.window = window
    window.makeKeyAndVisible()

    // Listen for Coach Plans event from web
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(presentCoachPlans),
      name: NSNotification.Name("showCoachPlans"),
      object: nil
    )

    return true
  }

  @objc private func presentCoachPlans() {
    guard let rootViewController = window?.rootViewController else { return }
    
    let coachPlansView = CoachPlansView()
    let hostingController = UIHostingController(rootViewController: coachPlansView)
    hostingController.modalPresentationStyle = .formSheet
    
    if let sheetController = hostingController.sheetPresentationController {
      sheetController.detents = [.large(), .medium()]
      sheetController.prefersGrabberVisible = true
      sheetController.preferredCornerRadius = 20
    }
    
    rootViewController.present(hostingController, animated: true)
  }
}
```

---

## Files Modified/Created

| File | Type | Change |
|------|------|--------|
| `ios/CoachPlansView.swift` | New | UI screen |
| `ios/CoachPlansViewModel.swift` | New | Purchase logic + backend integration |
| `ios/App.swift` | New | Capacitor bootstrap + coach plans listener |
| `panel-v2.html` | Modified | Update `_purchasePlan()` to dispatch to native |

---

## Architecture Diagram

```
panel-v2.html (_purchasePlan)
  │
  ├─ Web: window.open(Stripe)
  │
  └─ iOS: window.Capacitor.notifyListeners('showCoachPlans')
      │
      ├─ App.swift (AppDelegate)
      │  └─ presentCoachPlans()
      │
      └─ CoachPlansView.swift (SwiftUI)
         │
         ├─ CoachPlansViewModel
         │  ├─ loadProducts() → StoreKit
         │  ├─ validateBeforePurchase() → /validate-iap
         │  ├─ purchaseViaCapacitor() → window.Capacitor.Plugins.NativePurchases
         │  └─ checkCurrentEntitlement() → /check-entitlement
         │
         └─ Dismiss → Sync back to web (PW_CAPGO_IAP.checkCurrentEntitlement)
```

---

## Important Notes

1. **Capacitor Version**: Requires Capacitor 6.2.2
2. **@capgo/native-purchases**: Version 6.0.42 (exact)
3. **StoreKit 2**: iOS 15.0+ (set in Xcode build settings)
4. **App.tsx vs App.swift**: 
   - If using Ionic/React: integrate via Capacitor event bridge
   - If using Swift: use App.swift approach above

---

## Next Steps (Xcode/Mac Only)

1. Copy `CoachPlansView.swift` → `ios/App/CoachPlansView.swift`
2. Copy `CoachPlansViewModel.swift` → `ios/App/CoachPlansViewModel.swift`
3. Copy `App.swift` code → `ios/App/App.swift`
4. In Xcode:
   - Link Capacitor framework
   - Add StoreKit 2 framework
   - Set iOS deployment target to 15.0+
   - Configure `Info.plist`: SKAds permissions
5. Update `panel-v2.html` _purchasePlan()
6. Build and test on simulator
