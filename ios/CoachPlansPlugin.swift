import Foundation
import Capacitor
import SwiftUI

/// CoachPlansPlugin — Capacitor bridge for native Coach Plans view
/// Allows JS (panel-v2.html) to trigger native purchase screen
/// Pattern: same as GoogleAuthPlugin (confirmed working)

@objc(CoachPlansPlugin)
public class CoachPlansPlugin: CAPPlugin, CAPBridgedPlugin {

  public let identifier = "CoachPlansPlugin"
  public let jsName = "CoachPlansPlugin"

  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise)
  ]

  /// Present native Coach Plans view (SwiftUI)
  /// Called from JS: window.Capacitor.Plugins.CoachPlansPlugin.present()
  @objc func present(_ call: CAPPluginCall) {
    DispatchQueue.main.async {
      guard let vc = self.bridge?.viewController else {
        call.reject("No view controller available")
        return
      }

      let coachPlansView = CoachPlansView()
      let hostingController = UIHostingController(rootViewController: coachPlansView)

      // Sheet presentation (modal, swipe to dismiss)
      hostingController.modalPresentationStyle = .formSheet
      if let sheetController = hostingController.sheetPresentationController {
        sheetController.detents = [.large(), .medium()]
        sheetController.prefersGrabberVisible = true
        sheetController.preferredCornerRadius = 20
      }

      vc.present(hostingController, animated: true) {
        call.resolve()
      }
    }
  }
}
