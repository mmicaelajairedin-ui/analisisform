/**
 * Brand Loader — Simplificado con helpers
 * Usa pw-identity-helpers.js para resolución de tenant y aplicación de branding
 *
 * REGLA ARQUITECTÓNICA:
 * El Brand Engine NUNCA decide permisos.
 * Solo carga y aplica: identidad visual + white-label level.
 */

class BrandLoader {
  constructor() {
    this.org_id = null;
    this.brand = null;
    this.channel = null;
  }

  /**
   * Boot: Inicializa el loader
   * 1. Resuelve tenant desde dominio
   * 2. Carga Brand Engine
   * 3. Aplica marca a la página
   * 4. Escucha invalidaciones
   */
  async boot() {
    try {
      // 1. Resolver tenant
      this.org_id = (await window.IDENTITY_HELPERS.resolveTenant())?.id;

      // 2. Cargar Brand Engine
      this.brand = await window.IDENTITY_HELPERS.getBrand(this.org_id);

      // 3. Aplicar marca
      window.IDENTITY_HELPERS.applyBrand(this.brand);

      // 4. Cargar configuración regional
      const regional = await window.IDENTITY_HELPERS.getTenantRegionalConfig(this.org_id);
      window.IDENTITY_HELPERS.applyTenantRegionalConfig(regional);

      // 5. Escuchar actualizaciones
      if (this.org_id) {
        this.listenUpdates();
      }

      console.log('[BrandLoader] ✓ Initialized', {
        org_id: this.org_id,
        version: this.brand?.version,
        white_label_level: this.brand?.branding?.white_label_level,
      });

      return true;
    } catch (err) {
      console.error('[BrandLoader] Error during boot:', err);
      return false;
    }
  }

  /**
   * Escucha cambios de marca en tiempo real
   */
  listenUpdates() {
    if (!this.org_id) return;

    this.channel = window.IDENTITY_HELPERS.listenBrandUpdates(
      this.org_id,
      () => {
        console.log('[BrandLoader] Brand updated, reloading...');
        // Recarga limpia la página con nueva marca
        location.reload();
      }
    );
  }

  /**
   * Limpieza al logout
   */
  destroy() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.org_id = null;
    this.brand = null;
  }
}

// Instancia global + auto-boot
window.BRAND_LOADER = new BrandLoader();

// Auto-boot en DOMContentLoaded (si aún no está listo)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.BRAND_LOADER && !window.BRAND_LOADER.org_id) {
      window.BRAND_LOADER.boot();
    }
  });
} else {
  // Ya está ready, booteamos ya
  window.BRAND_LOADER.boot();
}
