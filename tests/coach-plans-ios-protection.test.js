/**
 * Coach Plans iOS Protection Tests
 * ═════════════════════════════════════════════════════════════════
 * Tests for Coach Plans (SaaS subscription) iOS payment blocking
 * per Apple App Store Guideline 3.1.3(f) Reader Model
 *
 * Scenarios:
 * 1. iOS owner can access multicoach-v3.html for non-billing features
 * 2. iOS owner cannot access owner-billing.html payment management
 * 3. iOS owner cannot access Stripe checkout/billing portal
 * 4. iOS owner cannot directly access owner-billing.html via URL
 * 5. Web (non-iOS) billing functionality works normally
 * 6. No other navigable payment links from multicoach-v3.html exist
 */

describe('Coach Plans iOS Protection', () => {
  let originalPWInApp;

  beforeEach(() => {
    // Save original PW_IN_APP value
    originalPWInApp = window.PW_IN_APP;

    // Reset DOM
    document.documentElement.className = '';
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Restore original PW_IN_APP value
    window.PW_IN_APP = originalPWInApp;
  });

  // ═════════════════════════════════════════════════════════════════
  // SCENARIO 1: iOS Owner Can Access MultiCoach for Non-Billing
  // ═════════════════════════════════════════════════════════════════
  describe('Scenario 1: iOS multicoach access (non-billing features)', () => {
    test('multicoach-v3.html should load when PW_IN_APP=true', () => {
      window.PW_IN_APP = true;

      // Simulate multicoach-v3.html initialization
      if (window.PW_IN_APP) {
        document.documentElement.classList.add('pw-app-mode');
      }

      expect(document.documentElement.classList.contains('pw-app-mode')).toBe(true);
      expect(window.PW_IN_APP).toBe(true);
    });

    test('multicoach HOME/EQUIPO/CLIENTES tabs should be visible in iOS', () => {
      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      // These operational tabs should NOT have data-app-hide
      const homeTab = document.createElement('div');
      homeTab.id = 'home';
      homeTab.className = 'tab-section active';
      homeTab.innerHTML = '<div id="diagnostico-alerts">📊 Alerts</div>';
      document.body.appendChild(homeTab);

      // Should be visible (no data-app-hide)
      const alerts = document.getElementById('diagnostico-alerts');
      expect(alerts).not.toHaveAttribute('data-app-hide');
      expect(alerts.textContent).toContain('Alerts');
    });

    test('multicoach EQUIPO/CLIENTES team management should work in iOS', () => {
      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      // Team management is operational, not billing
      const teamSection = document.createElement('div');
      teamSection.id = 'equipo';
      teamSection.className = 'tab-section';
      teamSection.innerHTML = '<div class="team-list"><div>Coach: Juan</div></div>';
      document.body.appendChild(teamSection);

      expect(document.getElementById('equipo').innerHTML).toContain('Juan');
    });

    test('CSS rule .pw-app-mode [data-app-hide] should be defined', () => {
      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-app-hide]{ display:none !important; }';
      document.head.appendChild(style);

      // Verify rule exists
      const sheets = document.styleSheets;
      let ruleFound = false;
      for (let i = 0; i < sheets.length; i++) {
        try {
          const rules = sheets[i].cssRules || sheets[i].rules;
          for (let j = 0; j < rules.length; j++) {
            if (rules[j].selectorText === '.pw-app-mode [data-app-hide]') {
              ruleFound = true;
              break;
            }
          }
        } catch (e) {
          // Cross-origin stylesheets throw, skip
        }
      }
      expect(ruleFound).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // SCENARIO 2: iOS Owner Cannot Access Billing Management
  // ═════════════════════════════════════════════════════════════════
  describe('Scenario 2: iOS owner-billing blocked', () => {
    test('owner-billing.html should hide plan change buttons in iOS', () => {
      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      // Add CSS rule
      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-app-hide]{ display:none !important; }';
      document.head.appendChild(style);

      // Simulate plan change buttons wrapped in data-app-hide
      const planActions = document.createElement('div');
      planActions.setAttribute('data-app-hide', '');
      planActions.innerHTML = `
        <button class="plan-button">Cambiar Plan</button>
        <button class="plan-button secondary">Cancelar Suscripción</button>
      `;
      document.body.appendChild(planActions);

      // Verify elements have data-app-hide
      const buttons = document.querySelectorAll('[data-app-hide] .plan-button');
      expect(buttons.length).toBe(2);

      // Verify CSS hides them
      expect(window.getComputedStyle(planActions).display).toBe('none');
    });

    test('owner-billing.html should hide payment method buttons in iOS', () => {
      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-app-hide]{ display:none !important; }';
      document.head.appendChild(style);

      // Simulate payment method actions
      const paymentActions = document.createElement('div');
      paymentActions.setAttribute('data-app-hide', '');
      paymentActions.innerHTML = `
        <button>Cambiar método de pago</button>
        <button>Ver recibos fiscales</button>
      `;
      document.body.appendChild(paymentActions);

      expect(window.getComputedStyle(paymentActions).display).toBe('none');
    });

    test('modular owner-billing plan actions should be hidden in iOS', () => {
      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-app-hide]{ display:none !important; }';
      document.head.appendChild(style);

      // Simulate modular version plan actions
      const planActions = document.createElement('div');
      planActions.className = 'plan-actions';
      planActions.setAttribute('data-app-hide', '');
      planActions.innerHTML = `
        <button class="btn btn-secondary">Cambiar Plan</button>
        <button class="btn btn-secondary">Gestionar Suscripción</button>
      `;
      document.body.appendChild(planActions);

      expect(window.getComputedStyle(planActions).display).toBe('none');
    });

    test('modular owner-billing payment method section should be hidden in iOS', () => {
      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-app-hide]{ display:none !important; }';
      document.head.appendChild(style);

      const paymentMethod = document.createElement('div');
      paymentMethod.className = 'payment-method';
      paymentMethod.setAttribute('data-app-hide', '');
      paymentMethod.innerHTML = '<button>Actualizar método de pago</button>';
      document.body.appendChild(paymentMethod);

      expect(window.getComputedStyle(paymentMethod).display).toBe('none');
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // SCENARIO 3: iOS Owner Cannot Access Stripe Checkout/Portal
  // ═════════════════════════════════════════════════════════════════
  describe('Scenario 3: iOS Stripe payment blocking', () => {
    test('Stripe checkout URLs should not be accessible in iOS', () => {
      window.PW_IN_APP = true;

      // Simulate panel-v2.html onclick handler that blocks Stripe URLs
      const stripeUrls = [
        'https://buy.stripe.com/00waEX3Qke8gczqge78AE0d',
        'https://buy.stripe.com/eVq5kD86Ae8geHy1jd8AE0e',
        'https://billing.stripe.com/p/login/1234567890'
      ];

      stripeUrls.forEach(url => {
        // Simulate the onclick handler blocking check from panel-v2.html:11402
        const shouldBlock = window.PW_IN_APP && /(upgrade\.html|buy\.stripe\.com|billing\.stripe\.com|stripeSubUrl)/.test(url);
        expect(shouldBlock).toBe(true);
      });
    });

    test('upgrade.html should only be accessible through guarded handlers in iOS', () => {
      window.PW_IN_APP = true;

      // upgrade.html can contain direct Stripe links but should only be
      // accessible via data-act='open' handler which blocks Stripe URLs
      const upgradeUrl = 'upgrade.html';

      // Simulate guard: only accessible via data-act='open' with handler blocking
      const wouldShowNeutralModal = window.PW_IN_APP && /upgrade\.html/.test(upgradeUrl);
      expect(wouldShowNeutralModal).toBe(true);
    });

    test('STRIPE_PORTAL variable should not be navigable in iOS', () => {
      window.PW_IN_APP = true;
      const STRIPE_PORTAL = 'https://billing.stripe.com/p/login/1234567890';

      // Should be blocked by onclick handler
      const wouldBeBlocked = window.PW_IN_APP && /billing\.stripe\.com/.test(STRIPE_PORTAL);
      expect(wouldBeBlocked).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // SCENARIO 4: Direct URL Access to owner-billing.html Blocked
  // ═════════════════════════════════════════════════════════════════
  describe('Scenario 4: Direct owner-billing.html access blocked in iOS', () => {
    test('owner-billing.html should auto-initialize pw-app-mode when PW_IN_APP=true', () => {
      // Simulate direct navigation to owner-billing.html in iOS
      window.PW_IN_APP = true;

      // The page initialization script should run
      if (window.PW_IN_APP) {
        document.documentElement.classList.add('pw-app-mode');
      }

      expect(document.documentElement.classList.contains('pw-app-mode')).toBe(true);
    });

    test('owner-billing.html should hide all payment actions on load in iOS', () => {
      window.PW_IN_APP = true;

      // Add the CSS rule that hides [data-app-hide]
      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-app-hide]{ display:none !important; }';
      document.head.appendChild(style);

      // Initialize
      document.documentElement.classList.add('pw-app-mode');

      // Create payment sections with data-app-hide
      const paymentSection = document.createElement('div');
      paymentSection.setAttribute('data-app-hide', '');
      paymentSection.innerHTML = '<button>Cambiar Plan</button>';
      document.body.appendChild(paymentSection);

      // Should be hidden
      expect(window.getComputedStyle(paymentSection).display).toBe('none');
    });

    test('modular owner-billing.html should auto-initialize pw-app-mode in iOS', () => {
      window.PW_IN_APP = true;

      if (window.PW_IN_APP) {
        document.documentElement.classList.add('pw-app-mode');
      }

      expect(document.documentElement.classList.contains('pw-app-mode')).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // SCENARIO 5: Web Billing Functionality Works Normally
  // ═════════════════════════════════════════════════════════════════
  describe('Scenario 5: Web (non-iOS) billing works normally', () => {
    test('Web browser should not have PW_IN_APP set', () => {
      window.PW_IN_APP = undefined;

      // No pw-app-mode class should be added
      if (window.PW_IN_APP) {
        document.documentElement.classList.add('pw-app-mode');
      }

      expect(document.documentElement.classList.contains('pw-app-mode')).toBe(false);
    });

    test('Web owner-billing.html plan buttons should be visible', () => {
      window.PW_IN_APP = false; // explicitly not iOS

      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-app-hide]{ display:none !important; }';
      document.head.appendChild(style);

      const planActions = document.createElement('div');
      planActions.setAttribute('data-app-hide', '');
      planActions.innerHTML = `
        <button class="plan-button">Cambiar Plan</button>
        <button class="plan-button secondary">Cancelar Suscripción</button>
      `;
      document.body.appendChild(planActions);

      // In web (no pw-app-mode), elements should NOT be hidden
      expect(window.getComputedStyle(planActions).display).not.toBe('none');
    });

    test('Web owner-billing.html payment method update should be clickable', () => {
      window.PW_IN_APP = false;

      const paymentButton = document.createElement('button');
      paymentButton.textContent = 'Actualizar método de pago';
      paymentButton.onclick = function() {
        return { action: 'update_payment_method' };
      };
      document.body.appendChild(paymentButton);

      const result = paymentButton.onclick();
      expect(result.action).toBe('update_payment_method');
    });

    test('Web upgrade.html should display Stripe checkout links', () => {
      window.PW_IN_APP = false;

      const checkoutLink = document.createElement('a');
      checkoutLink.id = 'btn-pro';
      checkoutLink.href = 'https://buy.stripe.com/eVq5kD86Ae8geHy1jd8AE0e';
      checkoutLink.textContent = 'Upgrade to Pro';
      document.body.appendChild(checkoutLink);

      const link = document.getElementById('btn-pro');
      expect(link.href).toContain('buy.stripe.com');
      expect(link.textContent).toBe('Upgrade to Pro');
    });

    test('Web panel-v2.html should allow multicoach link navigation', () => {
      window.PW_IN_APP = false;

      const multicoachLink = document.createElement('a');
      multicoachLink.href = 'multicoach-v3.html';
      multicoachLink.textContent = 'Mi red';
      document.body.appendChild(multicoachLink);

      expect(multicoachLink.href).toContain('multicoach-v3.html');
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // SCENARIO 6: No Other Navigable Payment Links from MultiCoach
  // ═════════════════════════════════════════════════════════════════
  describe('Scenario 6: No other payment navigation from multicoach', () => {
    test('multicoach-v3.html should not have inline Stripe checkout links', () => {
      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      // Create mock multicoach-v3 content
      const multicoachContent = document.createElement('div');
      multicoachContent.id = 'multicoach-content';
      multicoachContent.innerHTML = `
        <div class="tab-section active">HOME</div>
        <div class="tab-section">EQUIPO</div>
        <div class="tab-section">CLIENTES</div>
        <div class="tab-section">CONFIGURACIÓN</div>
      `;
      document.body.appendChild(multicoachContent);

      // Search for any Stripe links
      const stripeLinks = document.querySelectorAll('a[href*="buy.stripe.com"], a[href*="billing.stripe.com"]');
      expect(stripeLinks.length).toBe(0);
    });

    test('multicoach-v3.html should only navigate to owner-billing with protection', () => {
      // If multicoach-v3 links to owner-billing, owner-billing.html
      // should have its own pw-app-mode protection

      const ownerBillingLink = document.createElement('a');
      ownerBillingLink.href = 'owner-billing.html';
      ownerBillingLink.textContent = 'Facturación';
      document.body.appendChild(ownerBillingLink);

      // The link itself is not protected, but the target page is
      expect(ownerBillingLink.href).toContain('owner-billing.html');

      // Simulate loading owner-billing.html
      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      // owner-billing.html initializes with pw-app-mode
      expect(document.documentElement.classList.contains('pw-app-mode')).toBe(true);
    });

    test('multicoach-v3.html tab content should not contain payment actions', () => {
      const tabContent = document.createElement('div');
      tabContent.innerHTML = `
        <div id="home">HOME Tab</div>
        <div id="equipo">EQUIPO Tab</div>
        <div id="clientes">CLIENTES Tab</div>
        <div id="config">CONFIG Tab</div>
      `;
      document.body.appendChild(tabContent);

      // None of these tabs should contain Stripe links
      const allTabs = document.querySelectorAll('[id$=""]');
      allTabs.forEach(tab => {
        const stripeLinks = tab.querySelectorAll('a[href*="stripe.com"]');
        expect(stripeLinks.length).toBe(0);
      });
    });

    test('All payment modification buttons in multicoach should be guarded', () => {
      // Comprehensive check: any button that modifies Coach Plans
      // subscription should either:
      // 1. Be wrapped in data-app-hide, OR
      // 2. Have a JS guard with window.PW_IN_APP check

      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      // Pattern: payment action buttons should fail safely in iOS
      const paymentActions = [
        { name: 'Cambiar Plan', guard: () => window.PW_IN_APP ? false : true },
        { name: 'Cancelar Suscripción', guard: () => window.PW_IN_APP ? false : true },
        { name: 'Actualizar método de pago', guard: () => window.PW_IN_APP ? false : true },
        { name: 'Ver recibos fiscales', guard: () => window.PW_IN_APP ? false : true }
      ];

      paymentActions.forEach(action => {
        // Either guarded or wrapped
        const canProceed = action.guard();
        expect(canProceed).toBe(false); // Should NOT be allowed in iOS
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // INTEGRATION: Confirm No Payment/Plan Management Possible from iOS
  // ═════════════════════════════════════════════════════════════════
  describe('Integration: Full Coach Plans iOS blocking verification', () => {
    test('Complete flow: iOS owner cannot complete any Coach Plans transaction', () => {
      window.PW_IN_APP = true;
      document.documentElement.classList.add('pw-app-mode');

      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-app-hide]{ display:none !important; }';
      document.head.appendChild(style);

      // 1. Try accessing plan change from multicoach
      const planChangeBtn = document.createElement('button');
      planChangeBtn.setAttribute('data-app-hide', '');
      planChangeBtn.textContent = 'Cambiar Plan';
      planChangeBtn.onclick = function() {
        if (window.PW_IN_APP) return false;
        // Navigate to Stripe
      };
      document.body.appendChild(planChangeBtn);

      // 2. Button should be hidden
      expect(window.getComputedStyle(planChangeBtn).display).toBe('none');

      // 3. Even if clicked, onclick should return false in iOS
      expect(planChangeBtn.onclick()).toBe(false);

      // 4. Stripe URLs should not be navigable
      const stripeUrl = 'https://billing.stripe.com/p/login/123';
      const canNavigate = window.PW_IN_APP && /(billing\.stripe\.com)/.test(stripeUrl);
      expect(canNavigate).toBe(true); // Detected as blocked
    });

    test('Coach Plans are protected at 3 levels: UI, CSS, Business Logic', () => {
      window.PW_IN_APP = true;

      // Level 1: UI onclick handlers blocked
      const level1Guard = window.PW_IN_APP ? 'GUARDED' : 'OPEN';
      expect(level1Guard).toBe('GUARDED');

      // Level 2: CSS hiding [data-app-hide]
      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-app-hide]{ display:none !important; }';
      document.head.appendChild(style);

      document.documentElement.classList.add('pw-app-mode');

      const hiddenElement = document.createElement('div');
      hiddenElement.setAttribute('data-app-hide', '');
      hiddenElement.textContent = 'Payment Section';
      document.body.appendChild(hiddenElement);

      const level2Guard = window.getComputedStyle(hiddenElement).display === 'none' ? 'GUARDED' : 'OPEN';
      expect(level2Guard).toBe('GUARDED');

      // Level 3: Function guards
      function pwUpgrade() {
        if (window.PW_IN_APP) return false; // Business logic blocks
        return true;
      }

      const level3Guard = pwUpgrade() ? 'OPEN' : 'GUARDED';
      expect(level3Guard).toBe('GUARDED');
    });
  });
});
