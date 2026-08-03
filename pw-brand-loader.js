/**
 * Brand Loader — Carga Brand Engine + Build Theme (no aplica todavía)
 *
 * ARQUITECTURA CONGELADA:
 * 1. resolveContext() — resuelve tenant (hostname, preview, org_id, environment)
 * 2. getBrand() — carga Brand Engine desde API
 * 3. buildTheme() — transforma a Theme (colors, typography, spacing, radius, icons, components, density, darkMode)
 * 4. applyTheme() — aplica theme a página (CSS variables, logos, white-label)
 *
 * STATUS: Carga todo, prepara todo, pero NO aplica todavía.
 * Espera explícita de applyTheme() antes de renderizar.
 */

class BrandLoader {
  constructor() {
    this.context = null;
    this.brand = null;
    this.theme = null;
    this.channel = null;
  }

  /**
   * Boot: Resuelve y carga, pero NO aplica todavía
   * 1. Resolve context (hostname, org, environment, user)
   * 2. Load Brand Engine
   * 3. Build Theme
   * 4. Setup listener (NO aplica)
   */
  async boot(options = {}) {
    try {
      // 1. Resolver contexto
      this.context = await window.IDENTITY_HELPERS.resolveContext(options);

      if (!this.context.isValid) {
        console.log('[BrandLoader] No valid organization context, using defaults');
        this.brand = null;
        this.theme = window.ThemeEngine._getDefaultTheme();
        return true;
      }

      // 2. Cargar Brand Engine
      this.brand = await window.IDENTITY_HELPERS.getBrand(this.context.organization.id);

      // 3. Construir Theme (NO aplicar)
      this.theme = window.IDENTITY_HELPERS.buildTheme(this.brand);

      // 4. Cargar configuración regional
      const regional = await window.IDENTITY_HELPERS.getTenantRegionalConfig(
        this.context.organization.id
      );
      window.IDENTITY_HELPERS.applyTenantRegionalConfig(regional);

      // 5. Escuchar actualizaciones de marca (si está en producción)
      if (this.context.organization.id && this.context.environment === 'production') {
        this.listenUpdates();
      }

      console.log('[BrandLoader] ✓ Loaded (not applied)', {
        org: this.context.organization.slug,
        environment: this.context.environment,
        themeVersion: this.theme._metadata.version,
        whiteLabel: this.theme.whiteLabel.level,
      });

      return true;
    } catch (err) {
      console.error('[BrandLoader] Error during boot:', err);
      return false;
    }
  }

  /**
   * Aplicar theme explícitamente
   * Llamar cuando ya haya sido aprobado por Micaela
   */
  apply() {
    if (!this.theme) {
      console.warn('[BrandLoader] No theme loaded');
      return false;
    }

    window.IDENTITY_HELPERS.applyTheme(this.theme);

    console.log('[BrandLoader] ✓ Theme applied', {
      org: this.context?.organization?.slug,
      whiteLabel: this.theme.whiteLabel.level,
    });

    return true;
  }

  /**
   * Escucha cambios de marca en tiempo real
   */
  listenUpdates() {
    if (!this.context?.organization?.id) return;

    this.channel = window.IDENTITY_HELPERS.listenBrandUpdates(
      this.context.organization.id,
      () => {
        console.log('[BrandLoader] Brand updated on server, reloading...');
        location.reload();
      }
    );
  }

  /**
   * Fuerza recarga de marca desde servidor
   */
  async refresh() {
    if (!this.context?.organization?.id) return false;

    this.brand = await window.IDENTITY_HELPERS.getBrand(
      this.context.organization.id,
      'current'
    );
    this.theme = window.IDENTITY_HELPERS.buildTheme(this.brand);

    console.log('[BrandLoader] ✓ Refreshed');

    return true;
  }

  /**
   * Limpieza al logout
   */
  destroy() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.context = null;
    this.brand = null;
    this.theme = null;
  }
}

// Instancia global
window.BRAND_LOADER = new BrandLoader();

// Boot automático (NO aplica)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.BRAND_LOADER && !window.BRAND_LOADER.context) {
      window.BRAND_LOADER.boot();
    }
  });
} else {
  // Ya está ready
  window.BRAND_LOADER.boot();
}
