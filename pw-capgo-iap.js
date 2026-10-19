/**
 * Pathway IAP Integration with @capgo/native-purchases
 * 
 * Handles:
 * - Initialize StoreKit 2 product listing
 * - Purchase flow (with appAccountToken)
 * - Subscription status checking
 * - Refund/cancellation handling
 * - Backend validation (validate-iap, check-entitlement)
 * 
 * Architecture:
 * iOS App (@capgo/native-purchases)
 *   ├─ purchaseProduct(appAccountToken, productId)
 *   │  └─> Receipt generation (Apple)
 *   └─> POST /functions/v1/check-entitlement
 *       └─> Backend confirms subscription + returns access
 * 
 * Webhook (separate):
 *   └─> POST /functions/v1/apple-iap-webhook
 *       └─> Apple notifies of renewal/refund
 */

// ============================================================================
// Configuration
// ============================================================================

const CAPGO_CONFIG = {
  // Product IDs (must match App Store Connect)
  products: {
    basicMonthly: 'coach.plan.basic.monthly',
    proMonthly: 'coach.plan.pro.monthly'
  },
  
  // Pricing (for reference, set in App Store Connect)
  pricing: {
    'coach.plan.basic.monthly': { price: 29, currency: 'USD', period: 'month' },
    'coach.plan.pro.monthly': { price: 59, currency: 'USD', period: 'month' }
  },
  
  // Backend URLs
  backend: {
    validateIAP: '/functions/v1/validate-iap',
    checkEntitlement: '/functions/v1/check-entitlement'
  }
};

// ============================================================================
// IAP State Management
// ============================================================================

const IAP_STATE = {
  isInitialized: false,
  isLoading: false,
  currentSubscription: null,
  lastError: null,
  retryCount: 0,
  maxRetries: 3
};

// ============================================================================
// Module: Capgo IAP
// ============================================================================

const PW_CAPGO_IAP = {
  
  /**
   * Initialize IAP: load products from App Store Connect
   * Called once on app startup
   * Uses window.Capacitor.Plugins.NativePurchases (injected by Capacitor)
   */
  async init() {
    if (IAP_STATE.isInitialized) return;

    try {
      IAP_STATE.isLoading = true;
      console.log('[PW_CAPGO_IAP] Initializing...');

      // Capacitor injects NativePurchases plugin globally
      if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.NativePurchases) {
        throw new Error('NativePurchases plugin not available (not in Capacitor app)');
      }

      console.log('[PW_CAPGO_IAP] ✅ Initialized');
      IAP_STATE.isInitialized = true;

      // Auto-check entitlement on startup
      await this.checkCurrentEntitlement();

    } catch (err) {
      IAP_STATE.lastError = err;
      console.error('[PW_CAPGO_IAP] Init error:', err);
      return false;
    } finally {
      IAP_STATE.isLoading = false;
    }
  },
  
  /**
   * Get available products for purchase
   */
  async getProducts() {
    if (!IAP_STATE.isInitialized) await this.init();

    try {
      const NativePurchases = window.Capacitor.Plugins.NativePurchases;
      const productIds = Object.values(CAPGO_CONFIG.products);
      const products = await NativePurchases.getProducts({ productIds });

      return products.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        currency: p.currency,
        localizedPrice: p.localizedPrice,
        subscriptionPeriod: p.subscriptionPeriodNumberOfUnits + p.subscriptionPeriodUnit
      }));
    } catch (err) {
      console.error('[PW_CAPGO_IAP] getProducts error:', err);
      IAP_STATE.lastError = err;
      throw err;
    }
  },
  
  /**
   * Initiate purchase with appAccountToken
   * 
   * @param {string} productId - e.g., 'coach.plan.basic.monthly'
   * @param {string} appAccountToken - UUID (server-generated, unique per coach)
   * @returns {object} { success, subscription, error }
   */
  async purchaseProduct(productId, appAccountToken) {
    if (!IAP_STATE.isInitialized) await this.init();
    
    if (!productId || !appAccountToken) {
      throw new Error('[PW_CAPGO_IAP] productId and appAccountToken required');
    }
    
    try {
      IAP_STATE.isLoading = true;
      console.log(`[PW_CAPGO_IAP] Starting purchase: ${productId}`);
      
      // Step 1: Validate with backend BEFORE showing purchase sheet
      // This checks if coach already has active Stripe (mutual exclusivity)
      const validation = await this._validateBeforePurchase(productId, appAccountToken);
      if (!validation.allowed) {
        throw new Error(validation.reason || 'Purchase not allowed (check Stripe status)');
      }
      
      // Step 2: Show native purchase sheet (Capacitor handles this)
      const NativePurchases = window.Capacitor.Plugins.NativePurchases;
      const receipt = await NativePurchases.purchaseProduct({
        productId: productId,
        appAccountToken: appAccountToken  // UUID, required for App Store
      });
      
      if (!receipt) {
        throw new Error('No receipt returned (purchase may have been cancelled)');
      }
      
      console.log('[PW_CAPGO_IAP] Receipt received, verifying with backend...');
      
      // Step 3: Verify receipt with backend (check-entitlement function)
      const entitlement = await this._verifyReceiptWithBackend(receipt, appAccountToken);
      
      if (!entitlement.hasAccess) {
        throw new Error('Entitlement verification failed: ' + (entitlement.error || 'unknown'));
      }
      
      // Step 4: Update local state
      IAP_STATE.currentSubscription = {
        productId,
        appAccountToken,
        expiryDate: new Date(entitlement.expiryDate),
        status: entitlement.status,
        verifiedAt: new Date()
      };
      
      console.log('[PW_CAPGO_IAP] ✅ Purchase successful');
      return {
        success: true,
        subscription: IAP_STATE.currentSubscription
      };
      
    } catch (err) {
      console.error('[PW_CAPGO_IAP] Purchase error:', err);
      IAP_STATE.lastError = err;
      return {
        success: false,
        error: err.message || 'Purchase failed'
      };
    } finally {
      IAP_STATE.isLoading = false;
    }
  },
  
  /**
   * Check current entitlement (called on app launch, daily heartbeat)
   */
  async checkCurrentEntitlement() {
    if (!IAP_STATE.isInitialized) await this.init();

    try {
      // Get JWT from Supabase Auth session (works with email, Google, Apple)
      const session = await this._getAuthSession();
      if (!session || !session.access_token) {
        console.log('[PW_CAPGO_IAP] No session/JWT, skipping entitlement check');
        return null;
      }

      const appAccountToken = session.user.id;  // Auth ID, not usuarios.id
      if (!appAccountToken) {
        console.log('[PW_CAPGO_IAP] No appAccountToken, skipping entitlement check');
        return null;
      }
      
      console.log('[PW_CAPGO_IAP] Checking entitlement...');

      const response = await fetch('/functions/v1/check-entitlement', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appAccountToken: appAccountToken
        })
      });
      
      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Update state
      if (result.hasAccess) {
        IAP_STATE.currentSubscription = {
          productId: result.productId,
          appAccountToken: appAccountToken,
          expiryDate: new Date(result.expiryDate),
          status: result.status,
          verifiedAt: new Date()
        };
      } else {
        IAP_STATE.currentSubscription = null;
      }
      
      console.log('[PW_CAPGO_IAP] Entitlement check:', result.hasAccess ? '✅ Active' : '❌ Inactive');
      return result;
      
    } catch (err) {
      console.error('[PW_CAPGO_IAP] Entitlement check error:', err);
      IAP_STATE.lastError = err;
      return null;
    }
  },
  
  /**
   * Get current subscription status
   */
  getCurrentSubscription() {
    return IAP_STATE.currentSubscription;
  },
  
  /**
   * Get last error
   */
  getLastError() {
    return IAP_STATE.lastError;
  },
  
  /**
   * Check if currently loading
   */
  isLoading() {
    return IAP_STATE.isLoading;
  },

  /**
   * Restore previously purchased subscriptions
   * Shows Spanish feedback messages on success/failure
   */
  async restorePurchases() {
    if (!IAP_STATE.isInitialized) await this.init();

    try {
      IAP_STATE.isLoading = true;
      console.log('[PW_CAPGO_IAP] Restoring purchases...');

      const NativePurchases = window.Capacitor.Plugins.NativePurchases;
      const result = await NativePurchases.restorePurchases();

      if (!result || !result.length) {
        console.log('[PW_CAPGO_IAP] No purchases to restore');
        return {
          success: false,
          message: '❌ No encontramos compras anteriores asociadas a tu cuenta.'
        };
      }

      // Check entitlement with backend for the first restored purchase
      await this.checkCurrentEntitlement();

      console.log('[PW_CAPGO_IAP] ✅ Purchase restored');
      return {
        success: true,
        message: '✅ Compra restaurada correctamente.'
      };

    } catch (err) {
      console.error('[PW_CAPGO_IAP] Restore purchases error:', err);
      return {
        success: false,
        message: '⚠️ No pudimos verificar tus compras. Intentá de nuevo más tarde.'
      };
    } finally {
      IAP_STATE.isLoading = false;
    }
  },

  // ========================================================================
  // Private Methods
  // ========================================================================
  
  /**
   * Validate purchase with backend before showing purchase sheet
   * Checks: Stripe mutual exclusivity, coach eligibility, etc.
   */
  async _validateBeforePurchase(productId, appAccountToken) {
    try {
      const session = await this._getAuthSession();
      if (!session || !session.access_token) throw new Error('Sin sesión disponible');

      const response = await fetch('/functions/v1/validate-iap', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId,
          appAccountToken
        })
      });

      if (response.status === 409) {
        return {
          allowed: false,
          reason: 'Ya tenés una suscripción activa. Cancelala primero para usar la compra en la app.'
        };
      }

      if (response.status === 404) {
        console.warn('[PW_CAPGO_IAP] validate-iap not available (404 - backend not deployed yet)');
        return {
          allowed: false,
          reason: 'Servicio no disponible. Intentá más tarde.'
        };
      }

      if (!response.ok) {
        console.error('[PW_CAPGO_IAP] validate-iap error:', response.status);
        return {
          allowed: false,
          reason: 'Servicio no disponible. Intentá más tarde.'
        };
      }

      const result = await response.json();
      return {
        allowed: result.allowed !== false,
        reason: result.reason
      };

    } catch (err) {
      console.error('[PW_CAPGO_IAP] _validateBeforePurchase error:', err);
      return {
        allowed: false,
        reason: 'Servicio no disponible. Intentá más tarde.'
      };
    }
  },
  
  /**
   * Verify receipt with backend after purchase
   */
  async _verifyReceiptWithBackend(receipt, appAccountToken) {
    try {
      const session = await this._getAuthSession();
      if (!session || !session.access_token) throw new Error('Sin sesión disponible');

      const response = await fetch('/functions/v1/check-entitlement', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receipt,
          appAccountToken
        })
      });

      if (response.status === 404) {
        console.warn('[PW_CAPGO_IAP] check-entitlement not available (404 - backend not deployed yet)');
        throw new Error('Servicio no disponible. Intentá más tarde.');
      }

      if (!response.ok) {
        console.error('[PW_CAPGO_IAP] check-entitlement error:', response.status);
        throw new Error('Servicio no disponible. Intentá más tarde.');
      }

      const result = await response.json();
      return result;

    } catch (err) {
      console.error('[PW_CAPGO_IAP] _verifyReceiptWithBackend error:', err);
      throw err;
    }
  },
  
  /**
   * Get current user from localStorage
   */
  _getCurrentUser() {
    try {
      const userStr = localStorage.getItem('mj_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (err) {
      return null;
    }
  },

  /**
   * Get current auth session from Supabase
   * Works with email, Google, Apple logins
   */
  async _getAuthSession() {
    try {
      if (!window.sb || !window.sb.auth) {
        throw new Error('Supabase client not available');
      }
      const { data, error } = await window.sb.auth.getSession();
      if (error) throw error;
      return data?.session || null;
    } catch (err) {
      console.error('[PW_CAPGO_IAP] _getAuthSession error:', err);
      return null;
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PW_CAPGO_IAP;
}
