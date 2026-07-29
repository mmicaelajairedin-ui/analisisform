/**
 * DESIGN PHASE C — White-Label Branding System
 *
 * Injects brand color overrides based on coach/org settings.
 * Default: neutral (--pw-bosque green). Coach can override via --accent.
 *
 * Integration:
 * 1. Include this script in pages that support white-labeling:
 *    <script src="pw-white-label.js"></script>
 * 2. Set window._pwBrand before calling applyWhiteLabel():
 *    window._pwBrand = { color: '#8C7B80', label: 'Coach Name' }
 * 3. Call applyWhiteLabel() when brand data is ready
 */

(function() {
  'use strict';

  /**
   * Apply white-label brand colors to the page.
   *
   * @param {string} brandColor - Hex color for --accent (e.g., '#8C7B80')
   * @param {string} brandLabel - Coach/org name (for logging)
   *
   * Modifies: --accent, --brand, --rose (for client portals)
   * Scope: Only white-label elements (see CSS rules in pw-design-tokens.css)
   *
   * Chrome (sidebar, buttons, panels) remains neutral.
   * Chat bubbles stay neutral/crema.
   */
  window.applyWhiteLabel = function(brandColor, brandLabel) {
    if (!brandColor || typeof brandColor !== 'string') return;

    // Validate hex color format
    if (!/^#[0-9A-F]{6}$/i.test(brandColor)) {
      console.warn('[White-Label] Invalid color format:', brandColor);
      return;
    }

    // Calculate derived colors from base (simulating CSS color-mix)
    const base = brandColor;
    const dark = adjustBrightness(base, -30);
    const light = adjustBrightness(base, 85);
    const soft = adjustBrightness(base, 92);

    // Inject CSS variables (overrides :root defaults)
    const style = document.createElement('style');
    style.textContent = `:root {
      --accent: ${base};
      --accent-dark: ${dark};
      --accent-light: ${light};
      --accent-soft: ${soft};
      --brand: ${base};
      --brand-hover: ${dark};
      --brand-soft: ${soft};
      --brand-light: ${light};
      --brand-50: ${soft};
      --brand-100: ${adjustBrightness(base, 86)};
      --brand-border: ${adjustBrightness(base, 76)};

      /* For client portal (uses --rose token) */
      --rose: ${base};
      --rose-dark: ${dark};
      --rose-light: ${light};
      --rose-mid: ${adjustBrightness(base, 50)};
    }`;
    document.head.appendChild(style);

    // Log (dev only)
    if (window.location.hostname !== 'pathwaycareercoach.com') {
      console.log('[White-Label] Applied brand color:', brandLabel || brandColor);
    }
  };

  /**
   * Adjust brightness of a hex color.
   * Positive = lighter, negative = darker
   */
  function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;

    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  }

  /**
   * Get brand color from Supabase `organizaciones.marca` or fallback to default.
   *
   * Usage: _pwGetBrand(coachId || orgId).then(color => applyWhiteLabel(color))
   *
   * Depends on: sbGet() (Supabase fetch helper)
   */
  window._pwGetBrand = async function(organizacionId) {
    if (!organizacionId || !window.sbGet) return null;

    try {
      const resp = await sbGet(`organizaciones?id=eq.${organizacionId}&select=marca`);
      if (resp && resp.length > 0 && resp[0].marca) {
        const marca = resp[0].marca;
        if (marca.color) {
          return marca.color;
        }
      }
    } catch (e) {
      console.error('[White-Label] Error fetching brand:', e);
    }
    return null;
  };

  /**
   * Apply brand color from localStorage cache (if available).
   * Useful for instant branding on page load (before API calls complete).
   *
   * Usage: _pwApplyBrandFromCache()
   */
  window._pwApplyBrandFromCache = function() {
    try {
      const cached = localStorage.getItem('pw_brand_color');
      if (cached && /^#[0-9A-F]{6}$/i.test(cached)) {
        applyWhiteLabel(cached, '(cached)');
        return true;
      }
    } catch (e) {
      // localStorage might be disabled
    }
    return false;
  };

  /**
   * Cache brand color to localStorage for faster load next time.
   *
   * Usage: _pwCacheBrandColor('#8C7B80')
   */
  window._pwCacheBrandColor = function(color) {
    if (!/^#[0-9A-F]{6}$/i.test(color)) return;
    try {
      localStorage.setItem('pw_brand_color', color);
    } catch (e) {
      // localStorage might be full or disabled
    }
  };

})();
