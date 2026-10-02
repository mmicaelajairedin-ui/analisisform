import SwiftUI
import StoreKit

/// Coach Plans Purchase Screen — Native iOS UI for StoreKit 2
/// Displays Basic ($29.99/month) and Pro ($59.99/month) with full UX
///
/// Integrates with:
/// - @capgo/native-purchases for purchase flow
/// - check-entitlement backend for verification
/// - validate-iap for pre-purchase checks
/// - apple-iap-webhook for subscription lifecycle

struct CoachPlansView: View {
  let jwt: String
  let appAccountToken: String
  @StateObject private var viewModel: CoachPlansViewModel
  @Environment(\.dismiss) var dismiss

  init(jwt: String = "", appAccountToken: String = "") {
    self.jwt = jwt
    self.appAccountToken = appAccountToken
    _viewModel = StateObject(wrappedValue: CoachPlansViewModel(jwt: jwt, appAccountToken: appAccountToken))
  }

  var body: some View {
    ZStack {
      // MARK: - Background
      LinearGradient(
        gradient: Gradient(colors: [
          Color(red: 0.988, green: 0.988, blue: 0.988),  // #FCFDFC
          Color(red: 0.99, green: 0.99, blue: 0.99)      // Near white
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      VStack(spacing: 0) {
        // MARK: - Header
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            VStack(alignment: .leading, spacing: 4) {
              Text("Elige tu plan")
                .font(.system(size: 24, weight: .bold, design: .default))
                .tracking(-0.5)
                .foregroundColor(Color(red: 0.11, green: 0.18, blue: 0.15))  // #1B2E26

              Text("Acceso a funcionalidades premium")
                .font(.system(size: 13, weight: .regular, design: .default))
                .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.38))  // #5A6A60
            }
            Spacer()
            Button(action: { dismiss() }) {
              Image(systemName: "xmark.circle.fill")
                .font(.system(size: 24))
                .foregroundColor(Color(red: 0.75, green: 0.75, blue: 0.75))
            }
          }
          .padding(.horizontal, 20)
          .padding(.vertical, 16)
        }
        .background(Color(red: 0.99, green: 0.99, blue: 0.99))
        .border(Color(red: 0.93, green: 0.93, blue: 0.93), width: 1)

        ScrollView(.vertical, showsIndicators: false) {
          VStack(spacing: 16) {
            // MARK: - Current Subscription Status
            if let sub = viewModel.currentSubscription {
              VStack(spacing: 12) {
                HStack(spacing: 10) {
                  Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundColor(Color(red: 0.3, green: 0.64, blue: 0.58))  // #4CAF7D

                  VStack(alignment: .leading, spacing: 2) {
                    Text("Plan activo")
                      .font(.system(size: 13, weight: .semibold))
                      .foregroundColor(Color(red: 0.11, green: 0.18, blue: 0.15))

                    Text(sub.productId.contains("pro") ? "Pro" : "Basic")
                      .font(.system(size: 12, weight: .regular))
                      .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.38))
                  }

                  Spacer()

                  VStack(alignment: .trailing, spacing: 2) {
                    Text("Vence")
                      .font(.system(size: 11, weight: .regular))
                      .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.38))

                    Text(dateFormatter.string(from: sub.expiryDate))
                      .font(.system(size: 12, weight: .semibold, design: .default))
                      .foregroundColor(Color(red: 0.11, green: 0.18, blue: 0.15))
                  }
                }
                .padding(12)
                .background(Color(red: 0.97, green: 0.98, blue: 0.97))
                .cornerRadius(10)
              }
              .padding(.horizontal, 16)
              .padding(.top, 16)
            }

            // MARK: - Plans Grid
            VStack(spacing: 12) {
              ForEach(viewModel.products, id: \.id) { product in
                PlanCard(
                  product: product,
                  isSelected: viewModel.selectedProductId == product.id,
                  onTap: { viewModel.selectedProductId = product.id },
                  isPurchasing: viewModel.isPurchasing && viewModel.selectedProductId == product.id
                )
              }
            }
            .padding(.horizontal, 16)
            .padding(.top, viewModel.currentSubscription == nil ? 20 : 0)

            // MARK: - Features Comparison
            FeaturesComparisonView()
              .padding(.horizontal, 16)
              .padding(.top, 24)

            // MARK: - Auto-Renewal Info
            VStack(spacing: 8) {
              HStack(spacing: 8) {
                Image(systemName: "info.circle")
                  .font(.system(size: 13))
                  .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.38))

                Text("Se renueva automáticamente. Cancela en cualquier momento en Configuración → Suscripciones.")
                  .font(.system(size: 11, weight: .regular))
                  .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.38))
                  .lineLimit(3)
              }
              .padding(12)
              .background(Color(red: 0.97, green: 0.98, blue: 0.97))
              .cornerRadius(8)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)

            // MARK: - Restore Purchases
            if !viewModel.isPurchasing && viewModel.currentSubscription == nil {
              Button(action: { viewModel.restorePurchases() }) {
                Text("Restaurar compras anteriores")
                  .font(.system(size: 13, weight: .medium))
                  .foregroundColor(Color(red: 0.3, green: 0.64, blue: 0.58))
              }
              .padding(.top, 8)
            }

            // MARK: - Links
            VStack(spacing: 6) {
              Link(destination: URL(string: "https://pathwaycareercoach.com/terms-of-use")!) {
                Text("Terms of Use")
                  .font(.system(size: 11, weight: .regular))
                  .foregroundColor(Color(red: 0.3, green: 0.64, blue: 0.58))
              }

              Link(destination: URL(string: "https://pathwaycareercoach.com/privacy-policy")!) {
                Text("Privacy Policy")
                  .font(.system(size: 11, weight: .regular))
                  .foregroundColor(Color(red: 0.3, green: 0.64, blue: 0.58))
              }
            }
            .padding(.top, 20)
            .padding(.bottom, 16)
          }
        }

        // MARK: - Purchase Button
        VStack(spacing: 8) {
          if let error = viewModel.errorMessage {
            VStack(spacing: 8) {
              HStack(spacing: 8) {
                Image(systemName: "exclamationmark.circle.fill")
                  .foregroundColor(Color(red: 0.76, green: 0.46, blue: 0.43))

                Text(error)
                  .font(.system(size: 12, weight: .regular))
                  .foregroundColor(Color(red: 0.76, green: 0.46, blue: 0.43))
                  .lineLimit(2)
              }
              .padding(10)
              .background(Color(red: 0.97, green: 0.92, blue: 0.91))
              .cornerRadius(8)
            }
            .padding(.horizontal, 16)
          }

          Button(action: { viewModel.purchaseSelectedPlan() }) {
            if viewModel.isPurchasing {
              HStack(spacing: 10) {
                ProgressView()
                  .tint(Color.white)
                Text("Procesando…")
                  .font(.system(size: 16, weight: .semibold))
                  .foregroundColor(.white)
              }
            } else {
              Text(viewModel.selectedProductId.isEmpty ? "Selecciona un plan" : "Continuar con la compra")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)
            }
          }
          .frame(maxWidth: .infinity)
          .frame(height: 48)
          .background(
            viewModel.selectedProductId.isEmpty
              ? Color(red: 0.9, green: 0.9, blue: 0.9)
              : Color(red: 0.3, green: 0.64, blue: 0.58)  // #4CAF7D
          )
          .cornerRadius(10)
          .disabled(viewModel.selectedProductId.isEmpty || viewModel.isPurchasing)
          .padding(.horizontal, 16)
          .padding(.bottom, 16)
        }
      }
    }
    .onAppear {
      viewModel.loadProducts()
      viewModel.checkCurrentEntitlement()
    }
    .onChange(of: viewModel.purchaseCompleted) { completed in
      if completed {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
          dismiss()
        }
      }
    }
  }

  private var dateFormatter: DateFormatter {
    let fmt = DateFormatter()
    fmt.dateStyle = .medium
    fmt.timeStyle = .none
    fmt.locale = Locale(identifier: "es_ES")
    return fmt
  }
}

// MARK: - Plan Card Component
struct PlanCard: View {
  let product: StoreKit.Product
  let isSelected: Bool
  let onTap: () -> Void
  let isPurchasing: Bool

  var body: some View {
    VStack(spacing: 12) {
      // Plan name
      HStack {
        Text(product.id.contains("pro") ? "Pro" : "Basic")
          .font(.system(size: 18, weight: .semibold))
          .foregroundColor(Color(red: 0.11, green: 0.18, blue: 0.15))

        Spacer()

        if isSelected {
          Image(systemName: "checkmark.circle.fill")
            .font(.system(size: 20))
            .foregroundColor(Color(red: 0.3, green: 0.64, blue: 0.58))
        }
      }

      // Price (localized from StoreKit)
      HStack(spacing: 4) {
        Text(product.displayPrice)
          .font(.system(size: 28, weight: .bold, design: .default))
          .tracking(-0.6)
          .foregroundColor(Color(red: 0.11, green: 0.18, blue: 0.15))

        VStack(alignment: .leading, spacing: 0) {
          Text("por mes")
            .font(.system(size: 12, weight: .regular))
            .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.38))

          Text("Auto-renovable")
            .font(.system(size: 10, weight: .regular))
            .foregroundColor(Color(red: 0.75, green: 0.75, blue: 0.75))
        }

        Spacer()
      }

      // Divider
      Divider()
        .padding(.vertical, 8)

      // Features
      VStack(alignment: .leading, spacing: 8) {
        if product.id.contains("pro") {
          FeatureRow(text: "Mensajería y email")
          FeatureRow(text: "White-label personalizado")
          FeatureRow(text: "Analytics y reportes")
          FeatureRow(text: "Integraciones avanzadas")
          FeatureRow(text: "Soporte prioritario")
        } else {
          FeatureRow(text: "Gestión de clientes")
          FeatureRow(text: "Portal del cliente")
          FeatureRow(text: "Generación de informes")
          FeatureRow(text: "Hasta 10 clientes")
        }
      }
    }
    .padding(16)
    .background(Color.white)
    .border(
      isSelected
        ? Color(red: 0.3, green: 0.64, blue: 0.58)
        : Color(red: 0.93, green: 0.93, blue: 0.93),
      width: isSelected ? 2 : 1
    )
    .cornerRadius(12)
    .onTapGesture { onTap() }
    .opacity(isPurchasing && !isSelected ? 0.6 : 1.0)
  }
}

// MARK: - Feature Row
struct FeatureRow: View {
  let text: String

  var body: some View {
    HStack(spacing: 8) {
      Image(systemName: "checkmark")
        .font(.system(size: 12, weight: .semibold))
        .foregroundColor(Color(red: 0.3, green: 0.64, blue: 0.58))
        .frame(width: 16)

      Text(text)
        .font(.system(size: 13, weight: .regular))
        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.38))
    }
  }
}

// MARK: - Features Comparison
struct FeaturesComparisonView: View {
  var body: some View {
    VStack(spacing: 8) {
      HStack {
        Text("Comparar")
          .font(.system(size: 13, weight: .semibold))
          .foregroundColor(Color(red: 0.11, green: 0.18, blue: 0.15))
        Spacer()
      }

      VStack(spacing: 6) {
        ComparisonRow(feature: "Clientes", basic: "Hasta 10", pro: "Ilimitados")
        ComparisonRow(feature: "Mensajería", basic: "No", pro: "Sí")
        ComparisonRow(feature: "White-label", basic: "No", pro: "Sí")
        ComparisonRow(feature: "Analytics", basic: "No", pro: "Sí")
      }
    }
  }
}

// MARK: - Comparison Row
struct ComparisonRow: View {
  let feature: String
  let basic: String
  let pro: String

  var body: some View {
    HStack {
      Text(feature)
        .font(.system(size: 12, weight: .regular))
        .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.38))

      Spacer()

      HStack(spacing: 16) {
        Text(basic)
          .font(.system(size: 12, weight: .regular))
          .foregroundColor(Color(red: 0.35, green: 0.42, blue: 0.38))
          .frame(width: 60, alignment: .trailing)

        Text(pro)
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(Color(red: 0.11, green: 0.18, blue: 0.15))
          .frame(width: 60, alignment: .trailing)
      }
    }
    .padding(.vertical, 6)
  }
}

#Preview {
  CoachPlansView()
}
