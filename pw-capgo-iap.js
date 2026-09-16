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
   */
  async init() {
    if (IAP_STATE.isInitialized) return;
    
    try {
      IAP_STATE.isLoading = true;
      console.log('[PW_CAPGO_IAP] Initializing...');
      
      // Import @capgo/native-purchases dynamically
      const { initCapacitorApp } = await import('@capgo/native-purchases');
      await initCapacitorApp({ appId: 'com.pathwaycareercoach.twa' });
      
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
      const { getProducts } = await import('@capgo/native-purchases');
      const productIds = Object.values(CAPGO_CONFIG.products);
      const products = await getProducts(productIds);
      
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
      
      // Step 2: Show native purchase sheet (@capgo handles this)
      const { purchaseProduct } = await import('@capgo/native-purchases');
      const receipt = await purchaseProduct(productId, {
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
      const user = this._getCurrentUser();
      if (!user || !user.app_account_token) {
        console.log('[PW_CAPGO_IAP] No appAccountToken, skipping entitlement check');
        return null;
      }
      
      const jwt = localStorage.getItem('mj_auth');
      if (!jwt) {
        console.log('[PW_CAPGO_IAP] No JWT, skipping entitlement check');
        return null;
      }
      
      console.log('[PW_CAPGO_IAP] Checking entitlement...');
      
      const response = await fetch('/functions/v1/check-entitlement', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appAccountToken: user.app_account_token
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
          appAccountToken: user.app_account_token,
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
  
  // ========================================================================
  // Private Methods
  // ========================================================================
  
  /**
   * Validate purchase with backend before showing purchase sheet
   * Checks: Stripe mutual exclusivity, coach eligibility, etc.
   */
  async _validateBeforePurchase(productId, appAccountToken) {
    try {
      const jwt = localStorage.getItem('mj_auth');
      if (!jwt) throw new Error('No JWT available');
      
      const response = await fetch('/functions/v1/validate-iap', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId,
          appAccountToken
        })
      });
      
      if (response.status === 409) {
        // Conflict: Stripe already active
        return {
          allowed: false,
          reason: 'Cannot purchase IAP while active Stripe subscription exists'
        };
      }
      
      if (!response.ok) {
        return {
          allowed: false,
          reason: `Backend error: ${response.status}`
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
        reason: err.message
      };
    }
  },
  
  /**
   * Verify receipt with backend after purchase
   */
  async _verifyReceiptWithBackend(receipt, appAccountToken) {
    try {
      const jwt = localStorage.getItem('mj_auth');
      if (!jwt) throw new Error('No JWT available');
      
      const response = await fetch('/functions/v1/check-entitlement', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receipt,
          appAccountToken
        })
      });
      
      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status}`);
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
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PW_CAPGO_IAP;
}
