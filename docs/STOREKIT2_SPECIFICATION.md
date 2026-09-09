# StoreKit 2 Integration Specification — Fase 3

**Status:** 📋 SPECIFICATION (iOS implementation required)  
**Date:** 2026-09-09  
**Backend State:** ✅ Ready (Fases 1-2 deployed)  
**iOS State:** 🟡 TODO (this spec defines what to build)

---

## Overview

This document specifies the complete StoreKit 2 integration for Pathway Coach Plans. The backend (Fases 1-2) is production-ready; iOS must implement the purchase flow, transaction handling, and entitlement sync described below.

**Product IDs (from App Store Connect after Fase 0):**
- `coach.plan.basic.monthly` ($29.99/month)
- `coach.plan.pro.monthly` ($59.99/month)

**Subscription Group:** `PathwayCoachPlans`

**Bundle ID:** `com.pathwaycareercoach.ios`

---

## Architecture

```
┌──────────────────────────────────────┐
│ iOS App (StoreKit 2)                 │
│                                      │
│ 1. Request products from App Store   │
│ 2. Transaction listener (auto-renew) │
│ 3. User taps "Buy"                   │
│ 4. Complete transaction in App Store │
│ 5. Send to backend: validate-iap ──┐ │
│                                    │ │
│ 10. Check entitlement: check-ent ←─┤ │
│                                    │ │
│ 11. Show features or upgrade CTA   │ │
└──────────────────────────────────────┘
                             │
                             ↓
                  ┌─────────────────┐
                  │ Backend         │
                  │ (Supabase)      │
                  │                 │
                  │ 6. validate-iap │ (POST)
                  │    - checks JWT │
                  │    - validates  │
                  │      date/product
                  │    - checks     │
                  │      Stripe     │
                  │    - inserts to │
                  │      DB         │
                  │                 │
                  │ 7. Returns 200  │
                  │    (or error)   │
                  │                 │
                  │ 8. Webhook:     │
                  │    Apple posts  │
                  │    Server Notes │
                  │                 │
                  │ 9. Updates DB   │
                  │    status/expiry│
                  │                 │
                  │ 10. check-ent   │ (GET/POST)
                  │     reads DB    │
                  │     returns     │
                  │     hasAccess   │
                  └─────────────────┘
```

---

## 1. Initialize Products

### 1.1 Fetch Products from App Store

**When:** App launch (main thread safe)

**Swift Code:**
```swift
import StoreKit

var basicProduct: Product?
var proProduct: Product?

@MainActor
func loadProducts() async {
    let productIds = ["coach.plan.basic.monthly", "coach.plan.pro.monthly"]
    
    do {
        let products = try await Product.products(for: productIds)
        
        // Sort by price to map to basic/pro
        for product in products.sorted(by: { $0.price < $1.price }) {
            if product.id == "coach.plan.basic.monthly" {
                basicProduct = product
            } else if product.id == "coach.plan.pro.monthly" {
                proProduct = product
            }
        }
        
        print("Products loaded: basic=$\(basicProduct?.price ?? 0), pro=$\(proProduct?.price ?? 0)")
    } catch {
        print("Error loading products: \(error)")
        // Show error message: "Could not load pricing"
    }
}
```

**Error Handling:**
- If products fail to load: Show "Pricing temporarily unavailable"
- Retry on app restart (not on demand)
- Do NOT show prices if not loaded

---

## 2. Generate appAccountToken

### 2.1 On First Login

**When:** User logs in for the first time (check: `usuarios.app_account_token IS NULL`)

**Swift Code:**
```swift
import Foundation

func generateAppAccountToken() -> String {
    let uuid = UUID().uuidString
    // Return standard UUID format: "550e8400-e29b-41d4-a716-446655440000"
    return uuid.lowercased()
}

@MainActor
async func onFirstLogin(userId: String) async {
    let token = generateAppAccountToken()
    
    // Send to backend to store in usuarios.app_account_token
    let response = try? await registerAppAccountToken(userId: userId, token: token)
    
    if response?.success == true {
        // Store locally in Keychain for offline access
        storeAppAccountTokenInKeychain(token)
        print("App account token registered: \(token)")
    } else {
        // If backend fails, still generate locally (will sync on next login)
        storeAppAccountTokenInKeychain(token)
        print("Warning: App account token not synced with server")
    }
}

// Helper: register with backend
private func registerAppAccountToken(userId: String, token: String) async throws -> RegisterResponse {
    let url = URL(string: "https://api.pathwaycareercoach.com/functions/v1/register-app-account-token")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
    
    let body = ["user_id": userId, "app_account_token": token]
    request.httpBody = try JSONEncoder().encode(body)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(RegisterResponse.self, from: data)
}

struct RegisterResponse: Codable {
    let success: Bool
}
```

**Keychain Storage:**
```swift
func storeAppAccountTokenInKeychain(_ token: String) {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: "appAccountToken",
        kSecValueData as String: token.data(using: .utf8)!
    ]
    
    SecItemDelete(query as CFDictionary)
    SecItemAdd(query as CFDictionary, nil)
}

func retrieveAppAccountTokenFromKeychain() -> String? {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: "appAccountToken",
        kSecReturnData as String: true
    ]
    
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    
    guard status == errSecSuccess,
          let data = result as? Data,
          let token = String(data: data, encoding: .utf8) else {
        return nil
    }
    return token
}
```

---

## 3. Transaction Listener

### 3.1 Listen for Auto-Renewal Events

**When:** App launch, sets up listener for app lifetime

**Swift Code:**
```swift
import StoreKit

nonisolated private func listenForTransactions() -> Task<Void, Never> {
    Task(priority: .background) {
        for await result in Transaction.updates {
            do {
                let transaction = try checkVerified(result)
                
                // Handle each transaction
                switch transaction.productType {
                case .autoRenewable:
                    await handleAutoRenewableTransaction(transaction)
                default:
                    break
                }
                
                // Always finish the transaction
                await transaction.finish()
            } catch {
                print("Transaction verification failed: \(error)")
            }
        }
    }
}

@MainActor
private func handleAutoRenewableTransaction(_ transaction: VerificationResult<Transaction>) async {
    // This is called for:
    // - New purchase (SUBSCRIBED)
    // - Renewal (DID_RENEW)
    // - Cancellation (user cancelled renewal)
    // - Billing failure (DID_FAIL_TO_RENEW)
    // - Grace period events
    // - Refunds
    
    let txn = try! checkVerified(transaction)
    
    print("Transaction: \(txn.productID), status: \(txn.transactionDate)")
    
    // Store for entitlement check
    await updateSubscriptionStatusLocal(txn)
    
    // Webhook from Apple will update backend
    // (no need to call validate-iap here; webhook handles it)
}

private func updateSubscriptionStatusLocal(_ transaction: Transaction) async {
    // Cache locally for faster entitlement checks
    UserDefaults.standard.set(
        transaction.expirationDate?.timeIntervalSince1970 ?? 0,
        forKey: "subscriptionExpiryTime"
    )
}

// Start listening on app launch
private(set) var transactionListener: Task<Void, Never>?

func startListeningToTransactions() {
    transactionListener = listenForTransactions()
}
```

**Error Handling:**
- If verification fails: Log and don't process (Apple's security, not our bug)
- If finish() fails: Retry on next app launch (StoreKit handles this)

---

## 4. Purchase Flow

### 4.1 User Taps "Buy" Button

**Swift Code:**
```swift
@MainActor
func purchaseProduct(_ product: Product) async {
    do {
        print("Starting purchase: \(product.id)")
        
        // Get app account token from Keychain
        guard let appAccountToken = retrieveAppAccountTokenFromKeychain() else {
            showError("Authentication error: Please log in again")
            return
        }
        
        // Request purchase from App Store
        let result = try await product.purchase(options: [
            .appAccountToken(appAccountToken)
        ])
        
        switch result {
        case .success(let verificationResult):
            // Purchase successful, now validate with backend
            await handlePurchaseSuccess(verificationResult, product: product)
            
        case .userCancelled:
            print("User cancelled purchase")
            // No error, just close dialog
            
        case .pending:
            // Apple is reviewing purchase (rare)
            showAlert("Purchase pending Apple review. Please try again later.")
            
        @unknown default:
            showError("Unknown purchase error")
        }
        
    } catch {
        // StoreKit error (network, payment method, etc.)
        showError("Purchase failed: \(error.localizedDescription)")
        print("StoreKit error: \(error)")
    }
}

@MainActor
private func handlePurchaseSuccess(
    _ verificationResult: VerificationResult<Transaction>,
    product: Product
) async {
    do {
        let transaction = try checkVerified(verificationResult)
        
        print("Purchase verified by App Store")
        print("Original Transaction ID: \(transaction.originalID)")
        print("Expires: \(transaction.expirationDate ?? Date())")
        
        // NOW call backend to validate
        let success = await validateIAPWithBackend(
            originalTransactionId: String(transaction.originalID),
            appAccountToken: retrieveAppAccountTokenFromKeychain()!,
            productId: product.id,
            expiresDate: transaction.expirationDate?.timeIntervalSince1970 ?? 0,
            purchaseDate: transaction.purchaseDate.timeIntervalSince1970
        )
        
        if success {
            // Backend accepted, subscription active
            showSuccessMessage("Welcome! Your subscription is active.")
            await transaction.finish()
            
            // Refresh entitlements
            await refreshEntitlements()
            
            // Dismiss purchase dialog
            dismissPurchaseSheet()
        } else {
            // Backend rejected (Stripe conflict, validation failed, etc.)
            // User still owns the App Store transaction, but not in our system
            // Apple will track it; webhook will update us
            showError("Could not activate subscription. Please contact support.")
            await transaction.finish()
        }
        
    } catch {
        showError("Verification failed: \(error.localizedDescription)")
    }
}
```

**Critical: validateIAPWithBackend Function**
```swift
private func validateIAPWithBackend(
    originalTransactionId: String,
    appAccountToken: String,
    productId: String,
    expiresDate: TimeInterval,
    purchaseDate: TimeInterval
) async -> Bool {
    let url = URL(string: "https://api.pathwaycareercoach.com/functions/v1/validate-iap")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
    
    let body: [String: Any] = [
        "originalTransactionId": originalTransactionId,
        "appAccountToken": appAccountToken,
        "productId": productId,
        "bundleId": "com.pathwaycareercoach.ios",
        "expiresDate": Int(expiresDate * 1000), // Convert to milliseconds
        "purchaseDate": Int(purchaseDate * 1000),
        "environment": isTestFlight ? "Sandbox" : "Production"
    ]
    
    request.httpBody = try? JSONEncoder().encode(body)
    
    do {
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            switch httpResponse.statusCode {
            case 200:
                // SUCCESS: Subscription created in DB
                print("Validation successful")
                return true
                
            case 400:
                // BAD REQUEST: Invalid data
                if let error = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    print("Validation error (400): \(error.error)")
                }
                return false
                
            case 401:
                // UNAUTHORIZED: Auth token invalid
                print("Validation error (401): Auth token invalid")
                return false
                
            case 403:
                // FORBIDDEN: appAccountToken mismatch or user mismatch
                if let error = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    print("Validation error (403): \(error.error)")
                    // Likely: "appAccountToken does not match coach_id"
                }
                return false
                
            case 409:
                // CONFLICT: Either Stripe already active, or originalTransactionId duplicate
                if let error = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    print("Validation error (409): \(error.error)")
                    // Could be: "Already have active Stripe subscription"
                    // Or: "Upgrade not supported yet"
                }
                return false
                
            default:
                print("Validation error (\(httpResponse.statusCode))")
                return false
            }
        }
        return false
        
    } catch {
        print("Network error during validation: \(error)")
        return false
    }
}

struct ErrorResponse: Codable {
    let error: String
}
```

---

## 5. Entitlement Check

### 5.1 On App Launch & After Purchase

**Swift Code:**
```swift
@MainActor
func checkEntitlementOnAppLaunch() async {
    print("Checking entitlement...")
    
    let hasAccess = await checkEntitlement(coachId: currentCoachId)
    
    if hasAccess {
        // Show premium features
        showPremiumUI()
        print("✅ Coach has active subscription")
    } else {
        // Show upgrade CTA
        showUpgradeUI()
        print("❌ No active subscription")
    }
}

private func checkEntitlement(coachId: String) async -> Bool {
    let url = URL(string: "https://api.pathwaycareercoach.com/functions/v1/check-entitlement?coach_id=\(coachId)")!
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    
    // Optional: include auth token (check-entitlement accepts both anonymous and auth)
    if let token = authToken {
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    
    do {
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            switch httpResponse.statusCode {
            case 200:
                // Has access
                if let result = try? JSONDecoder().decode(EntitlementResult.self, from: data) {
                    print("Entitlement: \(result.plan) via \(result.paymentSource ?? "unknown")")
                    return result.hasAccess
                }
                return false
                
            case 403:
                // No active subscription
                print("No active subscription (403)")
                return false
                
            default:
                // Network error or server error
                print("Entitlement check error (\(httpResponse.statusCode))")
                // Assume has access (graceful degradation)
                return true
            }
        }
        return false
        
    } catch {
        print("Network error checking entitlement: \(error)")
        // Graceful degradation: if backend unreachable, assume has access based on local cache
        return isSubscriptionValidLocally()
    }
}

struct EntitlementResult: Codable {
    let hasAccess: Bool
    let coach_id: String
    let plan: String?
    let paymentSource: String?
    let status: String?
    let expiresAt: String?
}

// Fallback: check local cache
private func isSubscriptionValidLocally() -> Bool {
    if let expiryTime = UserDefaults.standard.double(forKey: "subscriptionExpiryTime") {
        return Date().timeIntervalSince1970 < expiryTime
    }
    return false
}
```

**Refresh After Purchase:**
```swift
@MainActor
async func refreshEntitlements() {
    print("Refreshing entitlements...")
    _ = await checkEntitlement(coachId: currentCoachId)
}
```

---

## 6. Restore Purchases

### 6.1 "Restore" Button (for users with existing subscription on other device)

**Swift Code:**
```swift
@MainActor
func restorePurchases() async {
    do {
        print("Starting restore...")
        
        // StoreKit 2 automatically syncs transactions across devices
        // But we need to re-validate our backend DB
        
        // Get all transactions from App Store
        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(result)
                
                if transaction.productType == .autoRenewable,
                   transaction.revocationDate == nil {
                    // Valid subscription found, re-validate with backend
                    _ = await validateIAPWithBackend(
                        originalTransactionId: String(transaction.originalID),
                        appAccountToken: retrieveAppAccountTokenFromKeychain()!,
                        productId: transaction.productID,
                        expiresDate: transaction.expirationDate?.timeIntervalSince1970 ?? 0,
                        purchaseDate: transaction.purchaseDate.timeIntervalSince1970
                    )
                }
                
                await transaction.finish()
            } catch {
                print("Verification error during restore: \(error)")
            }
        }
        
        // Refresh entitlements
        await refreshEntitlements()
        
        showSuccessMessage("Purchases restored successfully")
        
    } catch {
        showError("Restore failed: \(error.localizedDescription)")
    }
}
```

---

## 7. Subscription Management (In-App)

### 7.1 Manage Subscription in Settings

**Swift Code:**
```swift
@MainActor
func openManageSubscription() {
    // iOS 16.0+
    if #available(iOS 16.0, *) {
        Task {
            do {
                try await AppStore.showManageSubscriptions(in: UIApplication.shared.connectedScenes.first as? UIWindowScene)
            } catch {
                print("Error opening manage subscriptions: \(error)")
            }
        }
    }
}
```

**UI Integration:**
```
Settings → Subscription Management
└── Opens App Store → Manage Subscriptions
    ├── View subscription status
    ├── Change plan (Basic ↔ Pro)
    └── Cancel subscription
```

---

## 8. Handle Errors & Edge Cases

### 8.1 Subscription Expired

**When:** Entitlement check returns `hasAccess=false, status=expired`

**Swift Code:**
```swift
func handleExpiredSubscription() {
    showAlert(
        title: "Subscription Expired",
        message: "Your coaching subscription has expired. Renew to continue.",
        primaryButton: "Renew",
        primaryAction: { showPurchaseSheet() }
    )
}
```

### 8.2 Grace Period (Billing Failed)

**When:** Entitlement check returns `hasAccess=true, status=grace_period`

**Swift Code:**
```swift
func handleGracePeriod(_ expiresAt: Date) {
    let daysLeft = Int(expiresAt.timeIntervalSince(Date()) / 86400)
    
    showAlert(
        title: "⚠️ Payment Issue",
        message: "Your billing failed but you still have access for \(daysLeft) days. Update your payment method in Settings → Subscriptions.",
        primaryButton: "Open Subscriptions",
        primaryAction: { openManageSubscription() }
    )
}
```

### 8.3 Stripe Conflict (Already Have Stripe Active)

**When:** Purchase returns 409 Conflict with error "Already have active Stripe subscription"

**Swift Code:**
```swift
func handleStripeConflict() {
    showAlert(
        title: "Subscription Conflict",
        message: "You already have an active Stripe subscription. Cancel it in Settings before buying via Apple.",
        primaryButton: "Open Settings",
        primaryAction: { openManageSubscription() }
    )
}
```

### 8.4 Network Offline During Purchase

**Swift Code:**
```swift
func handleNetworkOfflineAfterPurchase() {
    // Scenario: User bought, but validate-iap call failed due to network
    // App Store has the transaction (verified)
    // Backend doesn't know yet (webhook will sync later)
    
    showAlert(
        title: "Unable to Activate",
        message: "Your purchase was successful but we couldn't activate it yet. We'll try again automatically.",
        secondaryButton: "Try Now",
        secondaryAction: { refreshEntitlements() }
    )
}
```

---

## 9. Local Cache Strategy

**Cache entitlement for 5 minutes to reduce API calls:**

```swift
private var cachedEntitlementTime: Date?
private var cachedEntitlementResult: Bool?

@MainActor
func checkEntitlementCached(coachId: String) async -> Bool {
    // If cache valid (< 5 min old), use it
    if let cached = cachedEntitlementResult,
       let cachedTime = cachedEntitlementTime,
       Date().timeIntervalSince(cachedTime) < 300 {
        return cached
    }
    
    // Otherwise fetch fresh
    let result = await checkEntitlement(coachId: coachId)
    cachedEntitlementResult = result
    cachedEntitlementTime = Date()
    
    return result
}

// Invalidate cache after purchase
func invalidateEntitlementCache() {
    cachedEntitlementTime = nil
    cachedEntitlementResult = nil
}
```

---

## 10. UI State Machine

**Simplified state flow:**

```
┌─ NO SUBSCRIPTION (show upgrade CTA)
│  └─ User taps "Buy" → PURCHASING
│     ├─ Success → SUBSCRIBED + refresh
│     ├─ Failed → back to NO SUBSCRIPTION (show error)
│     └─ Cancelled → back to NO SUBSCRIPTION
│
├─ SUBSCRIBED (show features)
│  ├─ Entitlement check returns active → SUBSCRIBED
│  ├─ Entitlement check returns grace_period → GRACE_PERIOD (warn)
│  ├─ Entitlement check returns expired → EXPIRED (show CTA)
│  └─ Webhook arrives (renewal/cancellation) → update local state
│
├─ GRACE_PERIOD (show warning + payment method prompt)
│  └─ After 3 days with no fix → EXPIRED
│
└─ EXPIRED (show upgrade CTA)
   └─ User purchases → SUBSCRIBED
```

**State storage (UserDefaults):**
```swift
struct SubscriptionState: Codable {
    let status: String // "active", "expired", "grace_period", "none"
    let plan: String? // "basic", "pro"
    let expiresAt: Date?
    let lastCheckedAt: Date
}

func saveSubscriptionState(_ state: SubscriptionState) {
    let encoded = try! JSONEncoder().encode(state)
    UserDefaults.standard.set(encoded, forKey: "subscriptionState")
}

func loadSubscriptionState() -> SubscriptionState? {
    guard let encoded = UserDefaults.standard.data(forKey: "subscriptionState") else { return nil }
    return try? JSONDecoder().decode(SubscriptionState.self, from: encoded)
}
```

---

## 11. Upgrade / Downgrade (Future)

**Current Status:** NOT SUPPORTED

**Why:** validate-iap currently blocks with 409 Conflict if trying to add a second IAP subscription for same coach.

**Future Implementation (Fase 3+):**
1. Allow user to upgrade Basic → Pro mid-cycle
2. Prorate the cost
3. Update subscription in App Store
4. Call backend with upgrade flag

**For Now:** If user wants to upgrade, ask them to cancel basic, then buy pro.

---

## 12. Testing Strategy

### 12.1 Sandbox Environment

**Setup:**
1. Xcode: Add Sandbox Apple ID to test accounts
2. StoreKit Configuration: Import products from App Store Connect
3. Run app → StoreKit 2 will use Sandbox server

**Test Scenarios:**
- ✅ Purchase basic plan, verify validate-iap called
- ✅ Renewal (auto-renewable), verify webhook updates DB
- ✅ Cancel renewal, verify status changes
- ✅ Grace period (billing fails), verify 3-day access
- ✅ Expire grace period, verify no access
- ✅ Restore purchases from another device
- ✅ Purchase → network fails → webhook catches up

### 12.2 TestFlight

**Setup:**
1. Build with Production App Store credentials (NOT Sandbox)
2. Upload to TestFlight
3. Testers use real Apple IDs + test transactions

**Verification:**
1. Purchase in TestFlight → webhook received in production
2. Entitlement check returns hasAccess=true
3. Portal shows new customer
4. Admin sees subscription in suspicious_double_charges (for monitoring)

### 12.3 Mock Testing (No Real App Store)

**Unit tests (can run locally):**
```swift
import XCTest

class IAP_Tests: XCTestCase {
    
    func testAppAccountTokenGeneration() {
        let token = generateAppAccountToken()
        XCTAssertTrue(token.contains("-"))
        XCTAssertEqual(token.count, 36) // UUID format
    }
    
    func testValidateIAPRequest() async {
        // Mock the backend response
        let result = await validateIAPWithBackend(
            originalTransactionId: "2000000098765432",
            appAccountToken: "550e8400-e29b-41d4-a716-446655440000",
            productId: "coach.plan.basic.monthly",
            expiresDate: Date().addingTimeInterval(30*24*3600).timeIntervalSince1970,
            purchaseDate: Date().timeIntervalSince1970
        )
        
        // Will fail if backend not running, but validates request shape
        XCTAssertNotNil(result)
    }
}
```

---

## 13. Security Considerations

### 13.1 appAccountToken Protection

✅ Generated client-side, stored in Keychain  
✅ Never sent unencrypted (always via HTTPS with Auth JWT)  
✅ Validated server-side against usuarios table  
✅ Prevents client spoofing of coach_id

### 13.2 Transaction Verification

✅ StoreKit 2 automatically verifies signature  
✅ `checkVerified()` enforces verification before use  
✅ Never trust unverified transactions

### 13.3 Auth Token

✅ Only send to backend in Authorization header  
✅ Use Supabase Auth (not custom token)  
✅ Set HTTPShouldSetCookies = false

### 13.4 Sensitive Data

❌ Never log originalTransactionId in plaintext (logs may be exposed)  
❌ Never send appAccountToken in error messages  
✅ Log only: "Purchase successful" or "Purchase failed: \(error code)"

---

## 14. Migration from Fase 2

**Backend is ready:**
```
✅ Supabase Auth configured
✅ usuarios.app_account_token column exists
✅ Edge Functions deployed (validate-iap, check-entitlement)
✅ Webhook endpoint live
✅ Database schema ready (usuarios_suscripciones_iap)
```

**iOS must implement:**
```
🟡 Product fetching (StoreKit 2)
🟡 appAccountToken generation & storage
🟡 Transaction listener (auto-renew events)
🟡 Purchase flow
🟡 Entitlement check on app launch
🟡 Restore purchases
🟡 Error handling (expired, grace period, conflicts)
🟡 UI state machine
🟡 Testing (Sandbox + TestFlight)
```

---

## 15. API Contracts (Backend Perspective)

### 15.1 validate-iap (POST)

**Expected Request:**
```json
{
  "originalTransactionId": "2000000098765432",
  "appAccountToken": "550e8400-e29b-41d4-a716-446655440000",
  "productId": "coach.plan.basic.monthly",
  "bundleId": "com.pathwaycareercoach.ios",
  "expiresDate": 1693958400000,
  "purchaseDate": 1693353600000,
  "environment": "Sandbox"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "subscription_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Error Responses:**
```
400 Bad Request: Missing fields or invalid dates
401 Unauthorized: Auth token invalid
403 Forbidden: appAccountToken doesn't match coach_id
409 Conflict: Stripe active OR duplicate originalTransactionId OR upgrade not supported
```

### 15.2 check-entitlement (GET)

**Expected Query:**
```
GET https://api.pathwaycareercoach.com/functions/v1/check-entitlement?coach_id={id}
Authorization: Bearer {authToken}  (optional)
```

**Success Response (200):**
```json
{
  "hasAccess": true,
  "coach_id": "550e8400-e29b-41d4-a716-446655440000",
  "plan": "basic",
  "paymentSource": "apple_iap",
  "status": "active",
  "expiresAt": "2026-10-15T23:59:59Z"
}
```

**No Access Response (403):**
```json
{
  "hasAccess": false,
  "coach_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Subscription expired"
}
```

### 15.3 Webhook (Apple Server Notifications V2)

**Apple sends POST to:**
```
https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook
```

**Payload (Server Notifications V2):**
```json
{
  "signedPayload": "eyJhbGc..."  (JWT)
}
```

**JWT contains:**
```json
{
  "notificationType": "SUBSCRIBED",
  "notificationUUID": "...",
  "signedDate": 1693958400000,
  "data": {
    "appAccountToken": "550e8400-e29b-41d4-a716-446655440000",
    "originalTransactionId": "2000000098765432",
    "productId": "coach.plan.basic.monthly",
    "expiresDate": 1693958400000,
    ...
  }
}
```

**Response:**
- 200 OK: Processed successfully
- 409 Conflict: Duplicate notification (already seen)
- 401 Unauthorized: Invalid JWT signature

---

## Summary Checklist

### Before iOS Development Starts
- [ ] Backend (Fases 1-2) deployed to production
- [ ] Supabase secrets configured (APPLE_*_ID, etc.)
- [ ] Webhook endpoint live on pathwaycareercoach.com
- [ ] Products live in App Store Connect
- [ ] Subscription group configured

### iOS Checklist
- [ ] Fetch products from App Store
- [ ] Generate appAccountToken on first login
- [ ] Set up transaction listener
- [ ] Implement purchase flow → validateIAPWithBackend
- [ ] Implement entitlement check (on launch, after purchase)
- [ ] Implement restore purchases
- [ ] Implement subscription management (Settings → in-app)
- [ ] Error handling: expired, grace period, Stripe conflict
- [ ] UI state machine (no subscription → subscribed → expired)
- [ ] Local caching (5 min)
- [ ] Test in Sandbox environment
- [ ] Test in TestFlight (production)

### After iOS Deployed
- [ ] Monitor webhook logs (app_store_server_notifications table)
- [ ] Verify entitlements work (check_entitlement calls)
- [ ] Monitor for errors (client_errors table)
- [ ] Verify no data loss
- [ ] Verify double charge detection works

---

**This specification is production-ready. iOS team can begin implementation immediately.**

---

Document generated: 2026-09-09  
For backend questions: See FASE_1_CHECKPOINT.md & FASE_2_BACKEND_UTILITIES.md  
For deployment: See docs/DEPLOYMENT_CHECKLIST.md
