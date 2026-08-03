/**
 * Theme Engine — Transforma Brand Engine en Theme completo
 *
 * ARQUITECTURA:
 * Brand Engine (identidad visual: colors, fonts, white-label)
 *        ↓
 * Theme Engine (transforma a theme aplicable: dark mode, spacing, radius, iconografía, componentes, densidad)
 *        ↓
 * applyTheme() (aplica theme a la página)
 *
 * IMPORTANTE:
 * El Theme Engine es agnóstico a cómo se cargó la marca.
 * Recibe un brand object y devuelve un theme object.
 *
 * En el futuro:
 * - dark mode automático
 * - spacing adaptable
 * - radius escalable
 * - iconografía por marca
 * - componentes personalizados
 * - densidad por organización
 */

class ThemeEngine {
  /**
   * Transforma Brand Engine en Theme
   * Input: {branding, assets, white_label_level}
   * Output: {
   *   colors: {...},
   *   typography: {...},
   *   spacing: {...},
   *   radius: {...},
   *   icons: {...},
   *   components: {...},
   *   density: {...},
   *   darkMode: {...}
   * }
   */
  static buildTheme(brand, isDarkMode = false) {
    if (!brand) {
      return this._getDefaultTheme();
    }

    const {branding, assets, white_label_level} = brand;

    return {
      // ─────────────────────────────────────────────────────
      // COLORS
      // ─────────────────────────────────────────────────────
      colors: this._buildColors(branding, isDarkMode),

      // ─────────────────────────────────────────────────────
      // TYPOGRAPHY
      // ─────────────────────────────────────────────────────
      typography: this._buildTypography(branding),

      // ─────────────────────────────────────────────────────
      // SPACING (escalable según organización)
      // ─────────────────────────────────────────────────────
      spacing: this._buildSpacing(),

      // ─────────────────────────────────────────────────────
      // RADIUS (border-radius según white-label level)
      // ─────────────────────────────────────────────────────
      radius: this._buildRadius(white_label_level),

      // ─────────────────────────────────────────────────────
      // ICONS (será extensible para iconografía custom)
      // ─────────────────────────────────────────────────────
      icons: this._buildIcons(branding),

      // ─────────────────────────────────────────────────────
      // COMPONENTS (estilos de componentes, será escalable)
      // ─────────────────────────────────────────────────────
      components: this._buildComponents(branding, white_label_level),

      // ─────────────────────────────────────────────────────
      // DENSITY (compacta vs cómoda, según org)
      // ─────────────────────────────────────────────────────
      density: this._buildDensity(white_label_level),

      // ─────────────────────────────────────────────────────
      // DARK MODE (futuro: automático según sistema)
      // ─────────────────────────────────────────────────────
      darkMode: isDarkMode ? this._buildDarkMode(branding) : null,

      // ─────────────────────────────────────────────────────
      // ASSETS (para inyectar en componentes)
      // ─────────────────────────────────────────────────────
      assets: assets || {},

      // ─────────────────────────────────────────────────────
      // WHITE LABEL LEVEL
      // ─────────────────────────────────────────────────────
      whiteLabel: {
        level: white_label_level,
        showPathwayBranding: white_label_level <= 1,
        hidePathwayFooter: white_label_level >= 2,
        allowCustomization: white_label_level >= 2,
      },

      // Metadata
      _metadata: {
        timestamp: Date.now(),
        isDarkMode,
        version: brand.version || 'default',
      },
    };
  }

  // ───────────────────────────────────────────────────────
  // BUILDERS PRIVADOS
  // ───────────────────────────────────────────────────────

  /**
   * Construye paleta de colores completa
   * Base: primary, secondary, neutral, feedback
   * Derivados: shades, tints, sistema completo
   */
  static _buildColors(branding, isDarkMode) {
    const primary = branding.primary_color || '#2D5016';
    const secondary = branding.secondary_color || '#8C7B80';
    const neutral = {
      dark: branding.neutral_dark || '#1F4030',
      light: branding.neutral_light || '#F5F3F0',
    };

    return {
      // Base
      primary: {
        base: primary,
        light: this._tint(primary, 0.2),
        lighter: this._tint(primary, 0.4),
        lightest: this._tint(primary, 0.6),
        dark: this._shade(primary, 0.2),
        darker: this._shade(primary, 0.4),
      },

      secondary: {
        base: secondary,
        light: this._tint(secondary, 0.2),
        lighter: this._tint(secondary, 0.4),
        dark: this._shade(secondary, 0.2),
        darker: this._shade(secondary, 0.4),
      },

      neutral: {
        dark: neutral.dark,
        medium: '#6B7280',
        light: neutral.light,
        lighter: '#F9F8F6',
        lightest: '#FEFDFB',
      },

      feedback: {
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      },

      // Para dark mode (futuro)
      ...(isDarkMode && {
        darkModeBg: '#0F172A',
        darkModeText: '#F1F5F9',
      }),

      // CSS Variables (para aplicar directamente)
      cssVars: {
        '--pw-primary': primary,
        '--pw-secondary': secondary,
        '--pw-dark': neutral.dark,
        '--pw-light': neutral.light,
      },
    };
  }

  /**
   * Construye tipografía completa
   * Family, sizes, weights, line-heights, letter-spacing
   */
  static _buildTypography(branding) {
    const fontFamily = this._getFontStack(branding.brand_font || 'poppins');

    return {
      fontFamily: fontFamily,

      // Scales: h1, h2, h3, h4, h5, h6, body, small, caption
      sizes: {
        h1: {fontSize: '32px', fontWeight: '700', lineHeight: '1.2'},
        h2: {fontSize: '28px', fontWeight: '700', lineHeight: '1.3'},
        h3: {fontSize: '24px', fontWeight: '600', lineHeight: '1.3'},
        h4: {fontSize: '20px', fontWeight: '600', lineHeight: '1.4'},
        h5: {fontSize: '16px', fontWeight: '600', lineHeight: '1.4'},
        h6: {fontSize: '14px', fontWeight: '600', lineHeight: '1.5'},
        body: {fontSize: '14px', fontWeight: '400', lineHeight: '1.6'},
        small: {fontSize: '12px', fontWeight: '400', lineHeight: '1.5'},
        caption: {fontSize: '11px', fontWeight: '500', lineHeight: '1.4'},
      },

      weights: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },

      // CSS Variables
      cssVars: {
        '--pw-font': fontFamily,
        '--pw-font-h1-size': '32px',
        '--pw-font-body-size': '14px',
      },
    };
  }

  /**
   * Spacing system
   * Reutilizable: xs, sm, md, lg, xl, 2xl
   */
  static _buildSpacing() {
    return {
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',

      // Para gaps y paddings
      gaps: {
        compact: '0.5rem',
        normal: '1rem',
        spacious: '1.5rem',
      },

      cssVars: {
        '--sp-xs': '0.5rem',
        '--sp-sm': '0.75rem',
        '--sp-md': '1rem',
        '--sp-lg': '1.5rem',
        '--sp-xl': '2rem',
        '--sp-2xl': '3rem',
      },
    };
  }

  /**
   * Border radius escalable
   * Según white-label level: branded → menos custom → más custom
   */
  static _buildRadius(whiteLabel) {
    // Nivel 0-1: radius fijo (Pathway brand)
    // Nivel 2-3: radius más personalizable
    const isCustomizable = whiteLabel >= 2;

    return {
      none: '0px',
      xs: '2px',
      sm: '4px',
      md: '6px',
      lg: '8px',
      xl: '12px',
      full: '9999px',

      // Componentes
      button: isCustomizable ? '8px' : '6px',
      card: isCustomizable ? '12px' : '8px',
      modal: isCustomizable ? '16px' : '12px',
      input: isCustomizable ? '6px' : '4px',

      cssVars: {
        '--radius-sm': '4px',
        '--radius-md': '6px',
        '--radius-lg': '8px',
      },
    };
  }

  /**
   * Iconografía
   * Futuro: custom icons per brand
   */
  static _buildIcons(branding) {
    return {
      size: '20px',
      stroke: '2px',
      color: branding.neutral_dark || '#1F4030',

      cssVars: {
        '--pw-icon-size': '20px',
        '--pw-icon-stroke': '2px',
        '--pw-icon-color': branding.neutral_dark || '#1F4030',
      },
    };
  }

  /**
   * Estilos de componentes base
   * Button, input, card, etc.
   */
  static _buildComponents(branding, whiteLabel) {
    const primary = branding.primary_color || '#2D5016';

    return {
      button: {
        primary: {
          background: primary,
          color: '#fff',
          border: 'none',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: '600',
        },
        secondary: {
          background: 'transparent',
          color: primary,
          border: `1px solid ${primary}`,
          padding: '10px 16px',
        },
      },

      input: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
        padding: '8px 12px',
        fontSize: '14px',
      },

      card: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      },

      // Personalizable según white-label
      customizable: whiteLabel >= 2,
    };
  }

  /**
   * Densidad visual
   * Compacta vs espaciosa
   */
  static _buildDensity(whiteLabel) {
    // Enterprise tiende a compacta (más datos en pantalla)
    // Starter más espaciosa (más aire)
    const isEnterprise = whiteLabel >= 3;

    return {
      level: isEnterprise ? 'compact' : 'normal',
      padding: isEnterprise ? '8px' : '12px',
      gap: isEnterprise ? '8px' : '12px',
      lineHeight: isEnterprise ? '1.4' : '1.6',
    };
  }

  /**
   * Dark mode (futuro)
   */
  static _buildDarkMode(branding) {
    return {
      background: '#0F172A',
      text: '#F1F5F9',
      border: '#1E293B',
      primary: this._tint(branding.primary_color, -0.3),
    };
  }

  // ───────────────────────────────────────────────────────
  // UTILIDADES DE COLOR
  // ───────────────────────────────────────────────────────

  static _tint(hex, factor) {
    // Aclarar color
    const rgb = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round((rgb >> 16) + (255 - (rgb >> 16)) * factor));
    const g = Math.min(255, Math.round(((rgb >> 8) & 0xff) + (255 - ((rgb >> 8) & 0xff)) * factor));
    const b = Math.min(255, Math.round((rgb & 0xff) + (255 - (rgb & 0xff)) * factor));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  static _shade(hex, factor) {
    // Oscurecer color
    const rgb = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.round((rgb >> 16) * (1 - factor)));
    const g = Math.max(0, Math.round(((rgb >> 8) & 0xff) * (1 - factor)));
    const b = Math.max(0, Math.round((rgb & 0xff) * (1 - factor)));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  static _getFontStack(fontName) {
    const stacks = {
      poppins: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      manrope: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    };
    return stacks[fontName] || stacks.poppins;
  }

  static _getDefaultTheme() {
    return {
      colors: {
        primary: {base: '#2D5016'},
        secondary: {base: '#8C7B80'},
        neutral: {dark: '#1F4030', light: '#F5F3F0'},
        feedback: {success: '#10B981', warning: '#F59E0B', error: '#EF4444'},
      },
      typography: {fontFamily: "'Poppins', sans-serif"},
      spacing: {xs: '0.5rem', sm: '0.75rem', md: '1rem'},
      radius: {xs: '2px', sm: '4px', md: '6px'},
      density: {level: 'normal'},
      whiteLabel: {level: 0, showPathwayBranding: true},
    };
  }
}

// Exportar para uso global
window.ThemeEngine = ThemeEngine;
