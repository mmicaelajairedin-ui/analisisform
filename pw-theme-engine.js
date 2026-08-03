/**
 * Theme Engine — Transforma Brand Engine en CSS variables en vivo
 *
 * ARQUITECTURA:
 * Brand Engine (datos JSON) → Theme Engine (reglas) → CSS Variables → Preview/UI
 *
 * Usado por: MultiCoach, Panel, Portal Cliente, Login, Landing, Emails, PDFs
 * NO es específico de MultiCoach — es reutilizable en toda la plataforma
 */

class ThemeEngine {
  constructor() {
    this.currentTheme = null;
    this.currentBrand = null;
    this.preview = null;
  }

  /**
   * Recibe Brand Engine y lo transforma en Theme
   * @param {Object} brand - {primary_color, secondary_color, brand_font, ...}
   * @returns {Object} theme - {cssVars, colors, typography, spacing, ...}
   */
  buildTheme(brand = {}) {
    const b = {
      primary_color: brand.primary_color || '#2D5016',
      secondary_color: brand.secondary_color || '#8C7B80',
      neutral_dark: brand.neutral_dark || '#1F4030',
      neutral_light: brand.neutral_light || '#F5F3F0',
      brand_font: brand.brand_font || 'poppins',
      white_label_level: brand.white_label_level || 0,
    };

    this.currentBrand = brand;

    // Generar Theme
    const theme = {
      _metadata: {
        version: brand.current_version || 'v1.0',
        timestamp: Date.now(),
      },
      colors: {
        primary: b.primary_color,
        secondary: b.secondary_color,
        neutralDark: b.neutral_dark,
        neutralLight: b.neutral_light,
        cssVars: {
          '--org-primary': b.primary_color,
          '--org-secondary': b.secondary_color,
          '--org-neutral-dark': b.neutral_dark,
          '--org-neutral-light': b.neutral_light,
          '--org-accent': b.primary_color, // alias
        },
      },
      typography: {
        fontFamily: b.brand_font,
        cssVars: {
          '--org-font-family': b.brand_font === 'poppins' ? 'Poppins' :
                               b.brand_font === 'inter' ? 'Inter' :
                               b.brand_font === 'manrope' ? 'Manrope' : 'Poppins',
        },
      },
      spacing: {
        base: '8px',
        cssVars: {
          '--org-space-xs': '4px',
          '--org-space-sm': '8px',
          '--org-space-md': '16px',
          '--org-space-lg': '24px',
          '--org-space-xl': '32px',
        },
      },
      radius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        cssVars: {
          '--org-radius-sm': '8px',
          '--org-radius-md': '12px',
          '--org-radius-lg': '16px',
        },
      },
      whiteLabel: {
        level: b.white_label_level,
      },
    };

    this.currentTheme = theme;
    return theme;
  }

  /**
   * Aplica Theme a un elemento (generalmente document.documentElement o preview panel)
   * @param {Object} theme - Theme generado por buildTheme()
   * @param {Element} target - Elemento donde aplicar (default: html root)
   */
  applyTheme(theme = this.currentTheme, target = document.documentElement) {
    if (!theme) {
      console.warn('[ThemeEngine] No theme to apply');
      return false;
    }

    // 1. CSS Variables de colores
    Object.entries(theme.colors.cssVars || {}).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });

    // 2. CSS Variables de tipografía
    Object.entries(theme.typography.cssVars || {}).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });

    // 3. CSS Variables de spacing
    Object.entries(theme.spacing.cssVars || {}).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });

    // 4. CSS Variables de radius
    Object.entries(theme.radius.cssVars || {}).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });

    // 5. Guardar en window para acceso global
    window.CURRENT_THEME = theme;
    window.CURRENT_BRAND = this.currentBrand;

    return true;
  }

  /**
   * Update instantáneo de un color específico
   * @param {string} colorKey - 'primary' | 'secondary' | 'neutral_dark' | 'neutral_light'
   * @param {string} colorValue - hex color #XXXXXX
   * @param {Element} target - Elemento donde aplicar
   */
  updateColor(colorKey, colorValue, target = document.documentElement) {
    if (!this.currentBrand) return;

    // Actualizar Brand
    this.currentBrand[colorKey] = colorValue;

    // Reconstruir Theme
    const theme = this.buildTheme(this.currentBrand);

    // Aplicar cambios
    const cssVarMap = {
      primary_color: '--org-primary',
      secondary_color: '--org-secondary',
      neutral_dark: '--org-neutral-dark',
      neutral_light: '--org-neutral-light',
    };

    const cssVar = cssVarMap[colorKey];
    if (cssVar) {
      target.style.setProperty(cssVar, colorValue);
    }

    window.CURRENT_THEME = theme;
    window.CURRENT_BRAND = this.currentBrand;
  }

  /**
   * Update instantáneo de tipografía
   * @param {string} fontFamily - 'poppins' | 'inter' | 'manrope'
   * @param {Element} target - Elemento donde aplicar
   */
  updateTypography(fontFamily, target = document.documentElement) {
    if (!this.currentBrand) return;

    this.currentBrand.brand_font = fontFamily;
    const theme = this.buildTheme(this.currentBrand);

    const fontMap = {
      poppins: 'Poppins',
      inter: 'Inter',
      manrope: 'Manrope',
    };

    const fontName = fontMap[fontFamily] || 'Poppins';
    target.style.setProperty('--org-font-family', fontName);

    window.CURRENT_THEME = theme;
    window.CURRENT_BRAND = this.currentBrand;
  }

  /**
   * Obtener Theme actual
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Obtener Brand actual
   */
  getBrand() {
    return this.currentBrand;
  }
}

// Instancia global
window.ThemeEngine = new ThemeEngine();
