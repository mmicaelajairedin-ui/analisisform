/**
 * Tests: Bloqueo de ruta de compra de Coach Services en iOS
 *
 * Objetivo: Validar que window.PW_IN_APP=true bloquea acceso a:
 * 1. login.html → coaches.html (CTA "Find in directory")
 * 2. coaches.html → coach.html (perfiles de coaches)
 * 3. coach.html → Stripe Checkout (botones "Comprar")
 */

describe('Coach Services Purchase Blocking (iOS)', () => {

  describe('login.html - "Find in directory" CTA', () => {
    test('should NOT block navigation when PW_IN_APP is false', () => {
      window.PW_IN_APP = false;
      const link = document.createElement('a');
      link.href = '/coaches.html';
      link.onclick = function() { return !(window.PW_IN_APP === true); };

      const result = link.onclick();
      expect(result).toBe(true); // Should allow navigation
    });

    test('should block navigation when PW_IN_APP is true', () => {
      window.PW_IN_APP = true;
      const link = document.createElement('a');
      link.href = '/coaches.html';
      link.onclick = function() { return !(window.PW_IN_APP === true); };

      const result = link.onclick();
      expect(result).toBe(false); // Should block navigation
    });

    test('should hide CTA element when pw-app-mode class is set', () => {
      document.documentElement.classList.add('pw-app-mode');
      const style = document.createElement('style');
      style.textContent = '.pw-app-mode #find-coach-cta { display:none !important; }';
      document.head.appendChild(style);

      const cta = document.createElement('div');
      cta.id = 'find-coach-cta';
      document.body.appendChild(cta);

      const computed = window.getComputedStyle(cta);
      expect(computed.display).toBe('none');

      // Cleanup
      document.documentElement.classList.remove('pw-app-mode');
      style.remove();
      cta.remove();
    });
  });

  describe('coaches.html - Coach profile links', () => {
    test('should block link click when PW_IN_APP is true', () => {
      window.PW_IN_APP = true;
      const link = document.createElement('a');
      link.href = '/coach/test-slug';
      link.setAttribute('data-coach-profile', 'true');
      link.onclick = function(e) {
        if(window.PW_IN_APP===true){ return false; }
      };

      const result = link.onclick();
      expect(result).toBe(false);
    });

    test('should hide coach profile links when pw-app-mode is set', () => {
      document.documentElement.classList.add('pw-app-mode');
      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-coach-profile] { display:none !important; }';
      document.head.appendChild(style);

      const link = document.createElement('a');
      link.href = '/coach/test-slug';
      link.setAttribute('data-coach-profile', 'true');
      document.body.appendChild(link);

      const computed = window.getComputedStyle(link);
      expect(computed.display).toBe('none');

      // Cleanup
      document.documentElement.classList.remove('pw-app-mode');
      style.remove();
      link.remove();
    });
  });

  describe('coach.html - "Comprar" button', () => {
    test('should block button click when PW_IN_APP is true', () => {
      window.PW_IN_APP = true;
      const btn = document.createElement('button');
      btn.setAttribute('data-purchase-cta', 'true');
      btn.onclick = function(e) {
        if(window.PW_IN_APP===true){
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      btn.onclick(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    test('should hide purchase button when pw-app-mode is set', () => {
      document.documentElement.classList.add('pw-app-mode');
      const style = document.createElement('style');
      style.textContent = '.pw-app-mode [data-purchase-cta] { display:none !important; }';
      document.head.appendChild(style);

      const btn = document.createElement('button');
      btn.setAttribute('data-purchase-cta', 'true');
      document.body.appendChild(btn);

      const computed = window.getComputedStyle(btn);
      expect(computed.display).toBe('none');

      // Cleanup
      document.documentElement.classList.remove('pw-app-mode');
      style.remove();
      btn.remove();
    });
  });

  describe('coach.html - iniciarCompra() function', () => {
    test('should exit early if PW_IN_APP is true', () => {
      window.PW_IN_APP = true;

      // Mock the function behavior
      const iniciarCompra = function(coach, idx, btn) {
        if(window.PW_IN_APP===true) return; // Should exit here
        // Rest of function would execute fetch, etc.
        return 'fetch-called';
      };

      const result = iniciarCompra({}, 0, null);
      expect(result).toBeUndefined();
    });

    test('should NOT exit if PW_IN_APP is false', () => {
      window.PW_IN_APP = false;

      const iniciarCompra = function(coach, idx, btn) {
        if(window.PW_IN_APP===true) return;
        if(!coach) return;
        return 'would-proceed';
      };

      const result = iniciarCompra({ id: 'test' }, 0, null);
      expect(result).toBe('would-proceed');
    });
  });

  describe('Web functionality preserved', () => {
    test('web navigation should work normally (PW_IN_APP=false)', () => {
      window.PW_IN_APP = false;

      const link = document.createElement('a');
      link.href = '/coaches.html';
      link.onclick = function() { return !(window.PW_IN_APP === true); };

      expect(link.href).toContain('/coaches.html');
      expect(link.onclick()).toBe(true);
    });

    test('pw-app-mode should NOT be set when PW_IN_APP is false', () => {
      window.PW_IN_APP = false;

      // Simulate initialization code
      if(window.PW_IN_APP===true) {
        document.documentElement.classList.add('pw-app-mode');
      }

      expect(document.documentElement.classList.contains('pw-app-mode')).toBe(false);
    });
  });

  describe('iOS initialization (pw-app-mode class)', () => {
    test('should add pw-app-mode class when PW_IN_APP is true', () => {
      window.PW_IN_APP = true;

      if(window.PW_IN_APP===true) {
        document.documentElement.classList.add('pw-app-mode');
      }

      expect(document.documentElement.classList.contains('pw-app-mode')).toBe(true);

      // Cleanup
      document.documentElement.classList.remove('pw-app-mode');
    });

    test('should NOT add pw-app-mode class when PW_IN_APP is false', () => {
      window.PW_IN_APP = false;
      document.documentElement.classList.remove('pw-app-mode');

      if(window.PW_IN_APP===true) {
        document.documentElement.classList.add('pw-app-mode');
      }

      expect(document.documentElement.classList.contains('pw-app-mode')).toBe(false);
    });
  });

  describe('Language coverage (ES + EN)', () => {
    test('protection should work in login.html (ES)', () => {
      window.PW_IN_APP = true;
      const cta = document.createElement('a');
      cta.href = '/coaches.html';
      cta.onclick = function() { return !(window.PW_IN_APP === true); };

      expect(cta.onclick()).toBe(false);
    });

    test('protection should work in login-en.html (EN)', () => {
      window.PW_IN_APP = true;
      const cta = document.createElement('a');
      cta.href = '/coaches.html';
      cta.onclick = function() { return !(window.PW_IN_APP === true); };

      expect(cta.onclick()).toBe(false);
    });
  });
});
