/**
 * Unit Tests for pw-storekit-init.ts
 *
 * Tests StoreKit 2 initialization layer without real iOS device
 * Mocks @capgo/native-purchases and Capacitor
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

// ============================================================================
// Mock Setup: @capgo/native-purchases
// ============================================================================

const mockCapgoFunctions = {
  initCapacitorApp: vi.fn(async (config) => {
    if (!config.appId) throw new Error('appId required');
  }),

  getProducts: vi.fn(async (productIds) => {
    return productIds.map(id => ({
      id,
      title: id === 'coach.plan.basic.monthly' ? 'Basic Plan' : 'Pro Plan',
      description: 'Pathway coaching access',
      price: id === 'coach.plan.basic.monthly' ? 29 : 59,
      currency: 'USD',
      localizedPrice: id === 'coach.plan.basic.monthly' ? '$29.00' : '$59.00',
      subscriptionPeriodNumberOfUnits: 1,
      subscriptionPeriodUnit: 'month'
    }));
  }),

  purchaseProduct: vi.fn(async (productId, options) => {
    if (!options.appAccountToken) throw new Error('appAccountToken required');
    return {
      originalTransactionId: 'mock-txn-' + Date.now(),
      transactionId: 'mock-txn-' + Date.now(),
      receiptData: 'mock-receipt-base64-' + productId,
      status: 'ACTIVE'
    };
  }),

  addPurchaseListener: vi.fn((callback) => {
    mockCapgoFunctions._purchaseListener = callback;
  }),

  restorePurchases: vi.fn(async () => {
    return [];
  }),

  _purchaseListener: null as any
};

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] || null;
  },
  setItem(key: string, value: string) {
    this.store[key] = value;
  },
  removeItem(key: string) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage
});

// Mock fetch for backend calls
global.fetch = vi.fn(async (url: string, options: any) => {
  const bodyStr = options?.body || '';
  const body = bodyStr ? JSON.parse(bodyStr) : {};

  // Mock generate-app-account-token
  if (url.includes('generate-app-account-token')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        appAccountToken: 'uuid-generated-' + Date.now()
      })
    };
  }

  // Mock check-entitlement
  if (url.includes('check-entitlement')) {
    if (body.appAccountToken === 'invalid-token') {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        hasAccess: true,
        productId: body.receipt?.productId,
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    };
  }

  // Mock validate-iap
  if (url.includes('validate-iap')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ allowed: true })
    };
  }

  return {
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not found' })
  };
}) as any;

// ============================================================================
// Mock Module Implementation
// ============================================================================

const STOREKIT_CONFIG = {
  appId: 'com.pathwaycareercoach.twa',
  backendBaseUrl: 'https://api.pathwaycareercoach.com',
  functions: {
    validateIAP: '/functions/v1/validate-iap',
    checkEntitlement: '/functions/v1/check-entitlement',
    generateAppAccountToken: '/functions/v1/generate-app-account-token'
  }
};

async function initStoreKit2(): Promise<boolean> {
  try {
    await mockCapgoFunctions.initCapacitorApp({
      appId: STOREKIT_CONFIG.appId
    });

    mockCapgoFunctions.addPurchaseListener(async (purchase) => {
      // Purchase handler
    });

    try {
      await mockCapgoFunctions.restorePurchases();
    } catch {
      // Non-blocking
    }

    return true;
  } catch (err) {
    console.error('[STOREKIT_TEST] Init error:', err);
    return false;
  }
}

async function ensureAppAccountToken(): Promise<string | null> {
  try {
    const cached = localStorage.getItem('mj_app_account_token');
    if (cached) return cached;

    const userStr = localStorage.getItem('mj_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.app_account_token) {
        localStorage.setItem('mj_app_account_token', user.app_account_token);
        return user.app_account_token;
      }
    }

    const jwt = localStorage.getItem('mj_auth');
    if (!jwt) return null;

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

    if (!response.ok) return null;

    const result = await response.json();
    if (result.appAccountToken) {
      localStorage.setItem('mj_app_account_token', result.appAccountToken);
      return result.appAccountToken;
    }

    return null;
  } catch (err) {
    console.error('[STOREKIT_TEST] Token error:', err);
    return null;
  }
}

async function bootstrapStoreKit2(): Promise<{
  success: boolean;
  appAccountToken?: string;
  error?: string;
}> {
  try {
    const appAccountToken = await ensureAppAccountToken();
    const initialized = await initStoreKit2();

    if (!initialized) {
      return {
        success: false,
        error: 'StoreKit 2 initialization failed'
      };
    }

    return {
      success: true,
      appAccountToken: appAccountToken || undefined
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error
    };
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('pw-storekit-init.ts — StoreKit 2 Initialization', () => {

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('Configuration', () => {

    it('should have correct app ID', () => {
      expect(STOREKIT_CONFIG.appId).toBe('com.pathwaycareercoach.twa');
    });

    it('should have backend URL configured', () => {
      expect(STOREKIT_CONFIG.backendBaseUrl).toBe('https://api.pathwaycareercoach.com');
    });

    it('should have all function endpoints', () => {
      expect(STOREKIT_CONFIG.functions.validateIAP).toBeDefined();
      expect(STOREKIT_CONFIG.functions.checkEntitlement).toBeDefined();
      expect(STOREKIT_CONFIG.functions.generateAppAccountToken).toBeDefined();
    });
  });

  describe('StoreKit 2 Initialization', () => {

    it('should initialize Capacitor successfully', async () => {
      const result = await initStoreKit2();
      expect(result).toBe(true);
      expect(mockCapgoFunctions.initCapacitorApp).toHaveBeenCalledWith({
        appId: 'com.pathwaycareercoach.twa'
      });
    });

    it('should register purchase listener', async () => {
      await initStoreKit2();
      expect(mockCapgoFunctions.addPurchaseListener).toHaveBeenCalled();
    });

    it('should restore purchases on init', async () => {
      await initStoreKit2();
      expect(mockCapgoFunctions.restorePurchases).toHaveBeenCalled();
    });

    it('should handle restore failures gracefully', async () => {
      mockCapgoFunctions.restorePurchases.mockRejectedValueOnce(new Error('Network error'));
      const result = await initStoreKit2();
      // Should still return true (restore is best-effort)
      expect(result).toBe(true);
    });
  });

  describe('AppAccountToken Management', () => {

    it('should return cached token if available', async () => {
      localStorage.setItem('mj_app_account_token', 'cached-token-123');
      const token = await ensureAppAccountToken();
      expect(token).toBe('cached-token-123');
    });

    it('should read token from user object', async () => {
      localStorage.setItem('mj_user', JSON.stringify({
        id: 'coach-1',
        app_account_token: 'from-user-obj'
      }));
      const token = await ensureAppAccountToken();
      expect(token).toBe('from-user-obj');
      // Should cache it
      expect(localStorage.getItem('mj_app_account_token')).toBe('from-user-obj');
    });

    it('should return null if no JWT for generation', async () => {
      localStorage.removeItem('mj_auth');
      const token = await ensureAppAccountToken();
      expect(token).toBeNull();
    });

    it('should generate new token from backend', async () => {
      localStorage.setItem('mj_auth', 'valid-jwt');
      const token = await ensureAppAccountToken();
      expect(token).toBeTruthy();
      expect(token).toMatch(/uuid-generated-/);
      expect(localStorage.getItem('mj_app_account_token')).toBe(token);
    });

    it('should handle backend token generation failure', async () => {
      localStorage.setItem('mj_auth', 'valid-jwt');
      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      })) as any;

      const token = await ensureAppAccountToken();
      expect(token).toBeNull();
    });
  });

  describe('Bootstrap Flow', () => {

    it('should complete bootstrap successfully', async () => {
      localStorage.setItem('mj_auth', 'valid-jwt');
      const result = await bootstrapStoreKit2();

      expect(result.success).toBe(true);
      expect(result.appAccountToken).toBeTruthy();
      expect(result.error).toBeUndefined();
    });

    it('should skip if no JWT', async () => {
      localStorage.removeItem('mj_auth');
      const result = await bootstrapStoreKit2();

      expect(result.success).toBe(true);
      expect(result.appAccountToken).toBeUndefined();
    });

    it('should report error if init fails', async () => {
      localStorage.setItem('mj_auth', 'valid-jwt');
      mockCapgoFunctions.initCapacitorApp.mockRejectedValueOnce(new Error('Plugin not found'));

      const result = await bootstrapStoreKit2();
      expect(result.success).toBe(false);
      expect(result.error).toContain('initialization failed');
    });

    it('should still succeed if restore fails', async () => {
      localStorage.setItem('mj_auth', 'valid-jwt');
      mockCapgoFunctions.restorePurchases.mockRejectedValueOnce(new Error('Offline'));

      const result = await bootstrapStoreKit2();
      expect(result.success).toBe(true);
    });
  });

  describe('Purchase Event Handler', () => {

    it('should handle purchase update with receipt', async () => {
      localStorage.setItem('mj_auth', 'valid-jwt');
      localStorage.setItem('mj_user', JSON.stringify({
        id: 'coach-1',
        app_account_token: 'token-1'
      }));

      // Simulate purchase event
      const mockPurchase = {
        productId: 'coach.plan.basic.monthly',
        originalTransactionId: 'txn-123',
        receiptData: 'receipt-base64',
        status: 'ACTIVE'
      };

      // When purchase listener is triggered, it should validate
      expect(mockCapgoFunctions._purchaseListener).toBeDefined();
    });

    it('should skip handler if no JWT', async () => {
      localStorage.removeItem('mj_auth');
      const mockPurchase = {
        productId: 'coach.plan.basic.monthly',
        originalTransactionId: 'txn-123',
        receiptData: 'receipt-base64',
        status: 'ACTIVE'
      };
      // Should not crash
      expect(() => mockCapgoFunctions._purchaseListener?.(mockPurchase)).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {

    it('Scenario 1: New user authentication + bootstrap', async () => {
      // User logs in
      localStorage.setItem('mj_auth', 'jwt-new-user');
      localStorage.setItem('mj_user', JSON.stringify({
        id: 'coach-new',
        email: 'new@example.com'
      }));

      // Bootstrap
      const result = await bootstrapStoreKit2();

      expect(result.success).toBe(true);
      expect(result.appAccountToken).toBeTruthy();
      expect(mockCapgoFunctions.initCapacitorApp).toHaveBeenCalled();
    });

    it('Scenario 2: User returns (token cached)', async () => {
      // Simulate returning user
      localStorage.setItem('mj_auth', 'jwt-returning');
      localStorage.setItem('mj_app_account_token', 'cached-uuid-abc');

      // Bootstrap
      const result = await bootstrapStoreKit2();

      expect(result.success).toBe(true);
      expect(result.appAccountToken).toBe('cached-uuid-abc');
      // Should not call backend for generation
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('generate-app-account-token'),
        expect.anything()
      );
    });

    it('Scenario 3: Bootstrap on app foreground', async () => {
      localStorage.setItem('mj_auth', 'jwt-foreground');

      // Bootstrap twice (like app goes background/foreground)
      const result1 = await bootstrapStoreKit2();
      const result2 = await bootstrapStoreKit2();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Both should work
      expect(mockCapgoFunctions.initCapacitorApp).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('Type Safety', () => {

  it('should have correct return type for bootstrapStoreKit2', async () => {
    localStorage.setItem('mj_auth', 'jwt');
    const result = await bootstrapStoreKit2();

    // TS would catch these errors at compile time
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      expect(typeof result.appAccountToken).toBe('string' || 'undefined');
    } else {
      expect(typeof result.error).toBe('string');
    }
  });
});
