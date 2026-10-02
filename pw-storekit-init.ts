/**
 * StoreKit 2 Initialization Layer
 *
 * Bridges Capacitor + @capgo/native-purchases with Pathway's IAP module
 * Runs on app startup, before UI rendering
 *
 * Responsibilities:
 * - Initialize @capgo/native-purchases with app credentials
 * - Setup observer for purchase updates from StoreKit 2
 * - Load appAccountToken from localStorage/Supabase
 * - Register global PW_CAPGO_IAP module for UI access
 * - Handle StoreKit 2 lifecycle events
 */

import { initCapacitorApp, addPurchaseListener, restorePurchases } from '@capgo/native-purchases';

// ============================================================================
// Configuration
// ============================================================================

const STOREKIT_CONFIG = {
  // Must match bundle ID in Xcode + App Store Connect
  appId: 'com.pathwaycareercoach.twa',

  // API endpoint for server validation
  backendBaseUrl: 'https://api.pathwaycareercoach.com',

  // Function endpoints
  functions: {
    validateIAP: '/functions/v1/validate-iap',
    checkEntitlement: '/functions/v1/check-entitlement',
    generateAppAccountToken: '/functions/v1/generate-app-account-token'
  }
};

// ============================================================================
// StoreKit 2 Initialization
// ============================================================================

/**
 * Initialize StoreKit 2 on app startup
 * Called ONCE, before any purchase UI
 *
 * @returns {Promise<boolean>} true if successful
 */
async function initStoreKit2(): Promise<boolean> {
  try {
    console.log('[PW_STOREKIT] Initializing StoreKit 2...');

    // Step 1: Initialize Capacitor plugin
    await initCapacitorApp({
      appId: STOREKIT_CONFIG.appId
    });

    console.log('[PW_STOREKIT] ✅ Capacitor initialized');

    // Step 2: Setup purchase listener for update notifications
    addPurchaseListener(async (purchase) => {
      console.log('[PW_STOREKIT] Purchase event received:', purchase);
      await _handlePurchaseUpdate(purchase);
    });

    console.log('[PW_STOREKIT] ✅ Purchase listener registered');

    // Step 3: Restore purchases on app launch (syncs with iCloud)
    try {
      const restored = await restorePurchases();
      console.log('[PW_STOREKIT] Restored purchases:', restored.length);
    } catch (err) {
      // Restore is best-effort; network issues don't block init
      console.warn('[PW_STOREKIT] Restore purchases failed (non-blocking):', err);
    }

    console.log('[PW_STOREKIT] ✅ StoreKit 2 fully initialized');
    return true;

  } catch (err) {
    console.error('[PW_STOREKIT] Initialization error:', err);
    return false;
  }
}

// ============================================================================
// Purchase Event Handler
// ============================================================================

/**
 * Handle purchase updates from StoreKit 2
 * Called when user completes purchase or renewal
 */
async function _handlePurchaseUpdate(purchase: any): Promise<void> {
  try {
    console.log('[PW_STOREKIT] Handling purchase update:', {
      productId: purchase.productId,
      transactionId: purchase.originalTransactionId,
      status: purchase.status
    });

    // Extract data
    const productId = purchase.productId || 'unknown';
    const originalTransactionId = purchase.originalTransactionId;
    const receiptData = purchase.receiptData; // Base64 receipt from Apple

    if (!receiptData) {
      console.warn('[PW_STOREKIT] No receipt data in purchase event');
      return;
    }

    // Get current auth
    const jwt = localStorage.getItem('mj_auth');
    const user = (() => {
      try {
        const userStr = localStorage.getItem('mj_user');
        return userStr ? JSON.parse(userStr) : null;
      } catch {
        return null;
      }
    })();

    if (!jwt || !user?.app_account_token) {
      console.warn('[PW_STOREKIT] No JWT or appAccountToken, cannot verify receipt');
      return;
    }

    // Verify receipt with backend (check-entitlement function)
    const response = await fetch(STOREKIT_CONFIG.backendBaseUrl + STOREKIT_CONFIG.functions.checkEntitlement, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + jwt,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receipt: {
          receiptData,
          productId,
          originalTransactionId,
          status: purchase.status
        },
        appAccountToken: user.app_account_token
      })
    });

    if (!response.ok) {
      console.error('[PW_STOREKIT] Receipt verification failed:', response.status);
      return;
    }

    const result = await response.json();
    console.log('[PW_STOREKIT] ✅ Receipt verified:', {
      hasAccess: result.hasAccess,
      status: result.status
    });

    // Update local state if module is loaded
    if (window.PW_CAPGO_IAP) {
      window.PW_CAPGO_IAP.setCurrentSubscription({
        productId,
        appAccountToken: user.app_account_token,
        expiryDate: new Date(result.expiryDate),
        status: result.status,
        verifiedAt: new Date()
      });
    }

  } catch (err) {
    console.error('[PW_STOREKIT] Purchase update error:', err);
  }
}

// ============================================================================
// AppAccountToken Management
// ============================================================================

/**
 * Get or generate appAccountToken for current user
 * This token links purchases to the correct Supabase usuario
 *
 * @returns {Promise<string|null>} UUID token or null if unavailable
 */
async function ensureAppAccountToken(): Promise<string | null> {
  try {
    // Check if already in localStorage
    const cached = localStorage.getItem('mj_app_account_token');
    if (cached) {
      console.log('[PW_STOREKIT] Using cached appAccountToken');
      return cached;
    }

    // Check if in user object
    const userStr = localStorage.getItem('mj_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.app_account_token) {
        console.log('[PW_STOREKIT] Using appAccountToken from user object');
        localStorage.setItem('mj_app_account_token', user.app_account_token);
        return user.app_account_token;
      }
    }

    // Generate new token via backend
    const jwt = localStorage.getItem('mj_auth');
    if (!jwt) {
      console.warn('[PW_STOREKIT] No JWT available for token generation');
      return null;
    }

    console.log('[PW_STOREKIT] Generating new appAccountToken...');

    const response = await fetch(
      STOREKIT_CONFIG.backendBaseUrl + STOREKIT_CONFIG.functions.generateAppAccountToken,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );

    if (!response.ok) {
      console.error('[PW_STOREKIT] Token generation failed:', response.status);
      return null;
    }

    const result = await response.json();
    const token = result.appAccountToken;

    if (token) {
      localStorage.setItem('mj_app_account_token', token);
      console.log('[PW_STOREKIT] ✅ New appAccountToken generated');
      return token;
    }

    return null;

  } catch (err) {
    console.error('[PW_STOREKIT] Token management error:', err);
    return null;
  }
}

// ============================================================================
// Entry Point: Call from App.tsx or main.ts
// ============================================================================

/**
 * Bootstrap StoreKit 2 for Pathway iOS app
 * Call this ONCE on app startup (after auth is loaded)
 *
 * Example usage:
 *   import { bootstrapStoreKit2 } from './pw-storekit-init';
 *
 *   // In your App component or main setup:
 *   useEffect(() => {
 *     bootstrapStoreKit2();
 *   }, []);
 */
export async function bootstrapStoreKit2(): Promise<{
  success: boolean;
  appAccountToken?: string;
  error?: string;
}> {
  try {
    console.log('[PW_STOREKIT] Bootstrap starting...');

    // Step 1: Ensure appAccountToken exists
    const appAccountToken = await ensureAppAccountToken();
    if (!appAccountToken) {
      console.warn('[PW_STOREKIT] No appAccountToken available');
    }

    // Step 2: Initialize StoreKit 2
    const initialized = await initStoreKit2();

    if (!initialized) {
      return {
        success: false,
        error: 'StoreKit 2 initialization failed'
      };
    }

    // Step 3: Trigger PW_CAPGO_IAP initialization
    if (window.PW_CAPGO_IAP) {
      await window.PW_CAPGO_IAP.init();
    }

    console.log('[PW_STOREKIT] ✅ Bootstrap complete');

    return {
      success: true,
      appAccountToken: appAccountToken || undefined
    };

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[PW_STOREKIT] Bootstrap error:', error);
    return {
      success: false,
      error
    };
  }
}

// ============================================================================
// Type Augmentation (for TypeScript)
// ============================================================================

declare global {
  interface Window {
    PW_CAPGO_IAP?: any;
    PW_STOREKIT_CONFIG?: typeof STOREKIT_CONFIG;
  }
}

// Export for testing
export {
  STOREKIT_CONFIG,
  initStoreKit2,
  ensureAppAccountToken,
  _handlePurchaseUpdate
};
