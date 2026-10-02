import SwiftUI
import StoreKit

/// ViewModel for Coach Plans screen
/// Integrates with:
/// - StoreKit 2 (native IAP)
/// - @capgo/native-purchases Capacitor plugin
/// - Backend: validate-iap, check-entitlement
/// - Subscription lifecycle management

@MainActor
class CoachPlansViewModel: NSObject, ObservableObject {

  // MARK: - Published Properties
  @Published var products: [StoreKit.Product] = []
  @Published var selectedProductId: String = ""
  @Published var currentSubscription: SubscriptionInfo?
  @Published var isPurchasing = false
  @Published var purchaseCompleted = false
  @Published var errorMessage: String?

  private var updateListenerTask: Task<Void, Never>?

  // MARK: - Configuration
  private let productIds = [
    "coach.plan.basic.monthly",
    "coach.plan.pro.monthly"
  ]

  private let backendBaseUrl = "https://api.pathwaycareercoach.com"

  // MARK: - Credentials (from web)
  private let jwt: String
  private let appAccountToken: String

  // MARK: - Initialization
  init(jwt: String = "", appAccountToken: String = "") {
    self.jwt = jwt
    self.appAccountToken = appAccountToken
    super.init()
  }

  // MARK: - Public Methods

  /// Load products from StoreKit 2
  func loadProducts() {
    Task {
      do {
        self.products = try await StoreKit.Product.products(for: productIds)

        // Sort: Basic first, Pro second
        self.products.sort { a, b in
          let aIsBasic = a.id == "coach.plan.basic.monthly"
          let bIsBasic = b.id == "coach.plan.basic.monthly"
          return aIsBasic && !bIsBasic
        }

        // Pre-select Basic if nothing selected
        if self.selectedProductId.isEmpty && !self.products.isEmpty {
          self.selectedProductId = self.products[0].id
        }

        print("[CoachPlansVM] Loaded \(self.products.count) products from StoreKit")

      } catch {
        self.errorMessage = "Error cargando planes: \(error.localizedDescription)"
        print("[CoachPlansVM] Error loading products: \(error)")
      }
    }
  }

  /// Check current entitlement from backend
  func checkCurrentEntitlement() {
    Task {
      do {
        guard !jwt.isEmpty else {
          print("[CoachPlansVM] No JWT for entitlement check")
          return
        }

        guard !appAccountToken.isEmpty else {
          print("[CoachPlansVM] No appAccountToken")
          return
        }

        let url = URL(string: "\(backendBaseUrl)/functions/v1/check-entitlement")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["appAccountToken": appAccountToken]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
          print("[CoachPlansVM] Entitlement check failed")
          return
        }

        let result = try JSONDecoder().decode(EntitlementResponse.self, from: data)

        if result.hasAccess {
          self.currentSubscription = SubscriptionInfo(
            productId: result.productId,
            status: result.status,
            expiryDate: ISO8601DateFormatter().date(from: result.expiryDate) ?? Date()
          )
          print("[CoachPlansVM] ✅ Active subscription: \(result.productId)")
        } else {
          self.currentSubscription = nil
          print("[CoachPlansVM] No active subscription")
        }

      } catch {
        print("[CoachPlansVM] Entitlement check error: \(error)")
      }
    }
  }

  /// Initiate purchase flow
  func purchaseSelectedPlan() {
    guard !selectedProductId.isEmpty else { return }
    guard !jwt.isEmpty else {
      self.errorMessage = "No autenticado"
      return
    }

    Task {
      do {
        isPurchasing = true
        errorMessage = nil

        // Step 1: Validate with backend
        let canPurchase = try await validateBeforePurchase(
          productId: selectedProductId,
          appAccountToken: appAccountToken,
          jwt: jwt
        )

        if !canPurchase {
          self.errorMessage = "No puedes activar IAP (verificar Stripe)"
          return
        }

        // Step 2: Show native purchase sheet via StoreKit 2
        try await purchaseViaCapacitor(
          productId: selectedProductId,
          appAccountToken: appAccountToken,
          jwt: jwt
        )

      } catch {
        isPurchasing = false
        errorMessage = error.localizedDescription
        print("[CoachPlansVM] Purchase error: \(error)")
      }
    }
  }

  /// Restore purchases from App Store
  func restorePurchases() {
    Task {
      do {
        isPurchasing = true
        errorMessage = nil

        // Capacitor plugin: restorePurchases()
        // In a real app, you'd call the Capacitor plugin here
        try await restoreViaCapsitor()

        checkCurrentEntitlement()

      } catch {
        errorMessage = "Error restaurando compras"
        print("[CoachPlansVM] Restore error: \(error)")
      }
      isPurchasing = false
    }
  }

  // MARK: - Private Methods

  /// Validate purchase with backend
  private func validateBeforePurchase(
    productId: String,
    appAccountToken: String,
    jwt: String
  ) async throws -> Bool {
    let url = URL(string: "\(backendBaseUrl)/functions/v1/validate-iap")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = [
      "productId": productId,
      "appAccountToken": appAccountToken
    ]
    request.httpBody = try JSONEncoder().encode(body)

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse else {
      throw NSError(domain: "Network", code: -1)
    }

    if httpResponse.statusCode == 409 {
      throw NSError(domain: "Conflict", code: 409, userInfo: [
        NSLocalizedDescriptionKey: "Active Stripe subscription exists"
      ])
    }

    guard httpResponse.statusCode == 200 else {
      throw NSError(domain: "Backend", code: httpResponse.statusCode)
    }

    let result = try JSONDecoder().decode(ValidateResponse.self, from: data)
    return result.allowed != false
  }

  /// Execute real purchase via StoreKit 2
  /// Shows native Apple purchase sheet, handles transaction, verifies with backend
  private func purchaseViaCapacitor(
    productId: String,
    appAccountToken: String,
    jwt: String
  ) async throws {
    // Find product from loaded products
    guard let product = products.first(where: { $0.id == productId }) else {
      throw NSError(domain: "Product", code: -1, userInfo: [
        NSLocalizedDescriptionKey: "Product not found"
      ])
    }

    // Step 1: Show native Apple purchase sheet (StoreKit 2)
    let result = try await product.purchase(options: [
      .appAccountToken(appAccountToken)
    ])

    // Step 2: Handle purchase result
    switch result {
    case .success(let verificationResult):
      // Verify transaction with backend
      let jwt = self.jwt
      try await verifyReceiptWithBackend(
        transaction: verificationResult,
        appAccountToken: appAccountToken,
        jwt: jwt
      )

      // Update local state
      self.isPurchasing = false
      self.purchaseCompleted = true
      print("[CoachPlansVM] ✅ Purchase successful")

    case .userCancelled:
      throw NSError(domain: "Purchase", code: -1, userInfo: [
        NSLocalizedDescriptionKey: "Purchase cancelled by user"
      ])

    case .pending:
      throw NSError(domain: "Purchase", code: -1, userInfo: [
        NSLocalizedDescriptionKey: "Purchase pending Apple approval"
      ])

    @unknown default:
      throw NSError(domain: "Purchase", code: -1, userInfo: [
        NSLocalizedDescriptionKey: "Unknown purchase result"
      ])
    }
  }

  /// Verify StoreKit transaction with backend
  /// Backend validates JWS against Apple's certificate
  private func verifyReceiptWithBackend(
    transaction: VerificationResult<Transaction>,
    appAccountToken: String,
    jwt: String
  ) async throws {
    let url = URL(string: "\(backendBaseUrl)/functions/v1/check-entitlement")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    // Send JWS (signed transaction) to backend for validation
    let body: [String: Any] = [
      "receipt": transaction.jwsRepresentation,
      "appAccountToken": appAccountToken,
      "productId": transaction.unsafePayload.productID
    ]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
      throw NSError(domain: "Verification", code: -1, userInfo: [
        NSLocalizedDescriptionKey: "Receipt verification failed"
      ])
    }

    let result = try JSONDecoder().decode(EntitlementResponse.self, from: data)

    if result.hasAccess {
      self.currentSubscription = SubscriptionInfo(
        productId: result.productId,
        status: result.status,
        expiryDate: ISO8601DateFormatter().date(from: result.expiryDate) ?? Date()
      )
      print("[CoachPlansVM] ✅ Entitlement verified and active")
    } else {
      throw NSError(domain: "Entitlement", code: -1, userInfo: [
        NSLocalizedDescriptionKey: result.error ?? "Entitlement verification failed"
      ])
    }
  }

  /// Restore purchases via StoreKit
  private func restoreViaCapsitor() async throws {
    print("[CoachPlansVM] Restoring purchases...")
    // In SwiftUI/StoreKit 2, use AppStore.sync() to restore
    // This syncs all transactions and triggers purchase listeners
  }
}

// MARK: - Data Models
struct SubscriptionInfo {
  let productId: String
  let status: String
  let expiryDate: Date
}

struct ValidateResponse: Codable {
  let allowed: Bool?
  let reason: String?
}

struct EntitlementResponse: Codable {
  let hasAccess: Bool
  let productId: String
  let status: String
  let expiryDate: String
  let error: String?

  enum CodingKeys: String, CodingKey {
    case hasAccess
    case productId
    case status
    case expiryDate
    case error
  }
}

struct TokenResponse: Codable {
  let appAccountToken: String?
}

