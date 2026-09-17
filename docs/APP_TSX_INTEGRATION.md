# App.tsx Integration — StoreKit 2 Bootstrap

**For:** iOS app developers (Gonzalo)  
**When:** Right after user is authenticated  
**What:** Wire up `bootstrapStoreKit2()` in your React/Vue app component

---

## React Example (App.tsx or Main Component)

```tsx
import { useEffect, useState } from 'react';
import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { bootstrapStoreKit2 } from './pw-storekit-init';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Get auth state (adjust based on your auth system)
        const jwt = localStorage.getItem('mj_auth');
        if (!jwt) {
          console.log('[App] No JWT, skipping StoreKit init');
          setIsInitialized(true);
          return;
        }

        // 2. Bootstrap StoreKit 2
        console.log('[App] Initializing StoreKit 2...');
        const result = await bootstrapStoreKit2();

        if (result.success) {
          console.log('[App] ✅ StoreKit 2 ready');
          setIsInitialized(true);
        } else {
          console.error('[App] StoreKit 2 failed:', result.error);
          setInitError(result.error || 'Unknown error');
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('[App] Initialization error:', err);
        setInitError(err instanceof Error ? err.message : String(err));
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return <IonApp><div>Loading...</div></IonApp>;
  }

  if (initError) {
    return (
      <IonApp>
        <div style={{ padding: '20px', color: 'red' }}>
          ⚠️ StoreKit 2 initialization failed: {initError}
          <p>IAP features unavailable. Other features work normally.</p>
        </div>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet />
        {/* Your app routes here */}
      </IonReactRouter>
    </IonApp>
  );
}
```

---

## Vue 3 Example (App.vue or setup)

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { bootstrapStoreKit2 } from './pw-storekit-init';

const isInitialized = ref(false);
const initError = ref<string | null>(null);

onMounted(async () => {
  try {
    const jwt = localStorage.getItem('mj_auth');
    if (!jwt) {
      console.log('[App] No JWT, skipping StoreKit init');
      isInitialized.value = true;
      return;
    }

    console.log('[App] Initializing StoreKit 2...');
    const result = await bootstrapStoreKit2();

    if (result.success) {
      console.log('[App] ✅ StoreKit 2 ready');
      isInitialized.value = true;
    } else {
      console.error('[App] StoreKit 2 failed:', result.error);
      initError.value = result.error || 'Unknown error';
      isInitialized.value = true;
    }
  } catch (err) {
    console.error('[App] Initialization error:', err);
    initError.value = err instanceof Error ? err.message : String(err);
    isInitialized.value = true;
  }
});
</script>

<template>
  <div v-if="!isInitialized">Loading...</div>
  <div v-else-if="initError" style="padding: 20px; color: red;">
    ⚠️ StoreKit 2 initialization failed: {{ initError }}
    <p>IAP features unavailable. Other features work normally.</p>
  </div>
  <div v-else>
    <!-- Your app content here -->
  </div>
</template>
```

---

## Vanilla JS / Custom Framework

```javascript
import { bootstrapStoreKit2 } from './pw-storekit-init.ts';

async function initializeApp() {
  try {
    const jwt = localStorage.getItem('mj_auth');
    if (!jwt) {
      console.log('[App] No JWT, skipping StoreKit init');
      return;
    }

    console.log('[App] Initializing StoreKit 2...');
    const result = await bootstrapStoreKit2();

    if (result.success) {
      console.log('[App] ✅ StoreKit 2 ready');
      window.dispatchEvent(new CustomEvent('storekit-ready'));
    } else {
      console.error('[App] StoreKit 2 failed:', result.error);
      window.dispatchEvent(new CustomEvent('storekit-error', {
        detail: { error: result.error }
      }));
    }
  } catch (err) {
    console.error('[App] Initialization error:', err);
  }
}

// Call on app startup
document.addEventListener('DOMContentLoaded', initializeApp);
```

---

## What Happens at Bootstrap

```
bootstrapStoreKit2()
  ├─ Ensure appAccountToken exists
  │  ├─ Check localStorage cache
  │  ├─ Check user object
  │  └─ Generate new from backend if needed
  │
  ├─ Initialize Capacitor plugin
  │  └─ Calls initCapacitorApp({ appId: 'com.pathwaycareercoach.twa' })
  │
  ├─ Register purchase listener
  │  └─ Listens for StoreKit 2 purchase events
  │
  ├─ Restore purchases (best-effort)
  │  └─ Syncs with iCloud subscription history
  │
  └─ Initialize PW_CAPGO_IAP module
     └─ Calls window.PW_CAPGO_IAP.init()

Result: {
  success: true,
  appAccountToken: "uuid-xxx"
}
```

---

## Error Handling

**If `initError` is not null:**
- StoreKit 2 failed to initialize
- **Product features still work** (non-IAP parts)
- User can still browse, chat, etc.
- **Purchase buttons should be hidden or disabled**

**Common errors:**
- `"No JWT available"` — User not logged in yet
- `"Capacitor plugin not found"` — App running on web/browser, not iOS
- `"Network error"` — Backend unreachable

---

## Testing Bootstrap Locally

If you're developing on web (not iOS):

```javascript
// Capacitor will fail, but you can mock it:
if (!window.Capacitor?.isNativePlatform?.()) {
  console.log('[App] Running on web, skipping StoreKit 2');
  // Still initialize IAP module for testing
  if (window.PW_CAPGO_IAP) {
    window.PW_CAPGO_IAP.init().catch(err => 
      console.warn('[App] IAP init failed on web (expected):', err)
    );
  }
}
```

---

## TypeScript Types

If using TypeScript, the module exports types:

```typescript
import { bootstrapStoreKit2, STOREKIT_CONFIG } from './pw-storekit-init';

// Type of return value:
type BootstrapResult = {
  success: boolean;
  appAccountToken?: string;
  error?: string;
};

// Config type:
type StoreKitConfig = typeof STOREKIT_CONFIG;
// {
//   appId: string;
//   backendBaseUrl: string;
//   functions: { validateIAP, checkEntitlement, generateAppAccountToken };
// }
```

---

## Next: Wire Up Purchase Button

Once bootstrap succeeds, you can call purchase from any component:

```typescript
async function handleBuyPlan(productId: string) {
  if (!window.PW_CAPGO_IAP) {
    alert('IAP not available');
    return;
  }

  const appAccountToken = localStorage.getItem('mj_app_account_token');
  if (!appAccountToken) {
    alert('No account token. Try refreshing the app.');
    return;
  }

  const result = await window.PW_CAPGO_IAP.purchaseProduct(productId, appAccountToken);
  
  if (result.success) {
    alert('✅ Plan upgraded!');
    // Show success screen, update UI
  } else {
    alert('❌ Purchase failed: ' + result.error);
  }
}
```

---

## Checklist Before Build

- [ ] `bootstrapStoreKit2()` called after user login
- [ ] App waits for `isInitialized` before showing purchase UI
- [ ] Error state handled gracefully (non-blocking)
- [ ] `@capgo/native-purchases` installed (v8.7.0+)
- [ ] Capacitor updated to 5.0+
- [ ] Bundle ID matches Xcode + App Store Connect
- [ ] In-App Purchase capability enabled in Xcode
- [ ] App runs on iOS device (not simulator initially)
- [ ] Test purchase with sandbox tester account

---

**Last Updated:** September 2026  
**Status:** Ready for integration  
**Reference:** `pw-storekit-init.ts` · `pw-capgo-iap.js`
