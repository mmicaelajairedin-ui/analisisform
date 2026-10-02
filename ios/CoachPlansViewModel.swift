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

  // MARK: - Initialization
  override init() {
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
        guard let jwt = SessionStorage.getJWT() else {
          print("[CoachPlansVM] No JWT for entitlement check")
          return
        }

        guard let appAccountToken = SessionStorage.getAppAccountToken() else {
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
    guard let jwt = SessionStorage.getJWT() else {
      self.errorMessage = "No autenticado"
      return
    }

    // Generate or get appAccountToken
    Task {
      do {
        let appAccountToken = try await ensureAppAccountToken(jwt: jwt)

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

        // Step 2: Show native purchase sheet via Capacitor
        isPurchasing = true
        errorMessage = nil

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

  /// Execute purchase via Capacitor NativePurchases plugin
  private func purchaseViaCapacitor(
    productId: String,
    appAccountToken: String,
    jwt: String
  ) async throws {
    // In production, this calls:
    // window.Capacitor.Plugins.NativePurchases.purchaseProduct({
    //   productId: productId,
    //   appAccountToken: appAccountToken
    // })

    // For demo: simulate receipt
    let receipt = "mock-receipt-\(productId)"

    // Verify receipt with backend
    let url = URL(string: "\(backendBaseUrl)/functions/v1/check-entitlement")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = [
      "receipt": receipt,
      "appAccountToken": appAccountToken
    ] as [String: Any]
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

      isPurchasing = false
      purchaseCompleted = true
      print("[CoachPlansVM] ✅ Purchase successful")

    } else {
      throw NSError(domain: "Entitlement", code: -1, userInfo: [
        NSLocalizedDescriptionKey: result.error ?? "Unknown error"
      ])
    }
  }

  /// Restore purchases via Capacitor
  private func restoreViaCapsitor() async throws {
    // Call Capacitor: window.Capacitor.Plugins.NativePurchases.restorePurchases()
    // For now, just log
    print("[CoachPlansVM] Restoring purchases...")
    // Real implementation requires JavaScript bridge
  }

  /// Ensure appAccountToken exists or generate new
  private func ensureAppAccountToken(jwt: String) async throws -> String {
    if let cached = SessionStorage.getAppAccountToken() {
      return cached
    }

    // Generate new token via backend
    let url = URL(string: "\(backendBaseUrl)/functions/v1/generate-app-account-token")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode([:])

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
      throw NSError(domain: "Token", code: -1)
    }

    let result = try JSONDecoder().decode(TokenResponse.self, from: data)

    if let token = result.appAccountToken {
      SessionStorage.setAppAccountToken(token)
      return token
    }

    throw NSError(domain: "Token", code: -1, userInfo: [
      NSLocalizedDescriptionKey: "No token returned"
    ])
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

// MARK: - Session Storage (iOS UserDefaults wrapper)
class SessionStorage {
  static func getJWT() -> String? {
    UserDefaults.standard.string(forKey: "mj_auth")
  }

  static func getAppAccountToken() -> String? {
    UserDefaults.standard.string(forKey: "mj_app_account_token")
  }

  static func setAppAccountToken(_ token: String) {
    UserDefaults.standard.set(token, forKey: "mj_app_account_token")
  }
}
