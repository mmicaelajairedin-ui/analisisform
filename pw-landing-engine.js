/**
 * Landing Engine — Gestiona configuración de landing pages
 *
 * Responsabilidades:
 * 1. Cargar configuración de landing bloques desde Supabase
 * 2. Persistir orden de bloques
 * 3. Persistir estado (activo/inactivo) de cada bloque
 * 4. Persistir contenido de cada bloque
 * 5. Reutilizable en toda la plataforma
 */

class LandingEngine {
  constructor() {
    this.orgId = null;
    this.landingConfig = null;
    this.listeners = [];
    this.defaultBlocks = {
      hero: {
        name: 'Hero',
        enabled: true,
        icon: '🎯',
        config: {
          title: 'Tu próximo trabajo en 4 semanas',
          subtitle: 'Coaching de carrera profesional',
          cta_text: 'Comenzar ahora',
          cta_url: '/formulario.html',
          background_type: 'gradient',
          height: 'large',
        },
      },
      features: {
        name: 'Features',
        enabled: true,
        icon: '✨',
        config: {
          title: 'Módulos de coaching',
          items: [
            { icon: '📋', title: 'Análisis', desc: 'Diagnóstico profesional' },
            { icon: '📄', title: 'CV', desc: 'Optimización de CV' },
            { icon: '💬', title: 'Entrevistas', desc: 'Preparación' },
            { icon: '🤝', title: 'Networking', desc: 'Estrategia' },
          ],
        },
      },
      testimonials: {
        name: 'Testimonios',
        enabled: true,
        icon: '⭐',
        config: {
          title: '4 casos de éxito',
          items: [
            { name: 'Juan', role: 'Senior Dev', text: 'Conseguí trabajo en 3 semanas' },
            { name: 'María', role: 'Product Manager', text: 'Aumenté mi salario 40%' },
          ],
        },
      },
      cta: {
        name: 'CTA',
        enabled: true,
        icon: '🎯',
        config: {
          title: '¿Listo para cambiar tu carrera?',
          subtitle: 'Comienza tu mentoría hoy',
          button_text: 'Solicitar sesión',
          button_url: '/formulario.html',
        },
      },
      footer: {
        name: 'Footer',
        enabled: true,
        icon: '🔗',
        config: {
          copyright: 'Todos los derechos reservados',
          links: [
            { label: 'Política de privacidad', url: '#' },
            { label: 'Términos de servicio', url: '#' },
            { label: 'Contacto', url: '#' },
          ],
        },
      },
    };
  }

  /**
   * Cargar configuración de landing desde Supabase
   * @param {string} orgId - ID de la organización
   * @returns {Promise<Object>} landing config
   */
  async loadLandingConfig(orgId) {
    if (!orgId) return null;

    try {
      this.orgId = orgId;

      // Fetch landing config
      const res = await fetch(
        `/rest/v1/organization_landing_config?organization_id=eq.${orgId}&select=*`,
        { headers: this._headers() }
      );

      if (!res.ok) {
        console.warn('[LandingEngine] No config found, using defaults');
        return this._getDefaultConfig();
      }

      const data = await res.json();
      this.landingConfig = data?.[0] || this._getDefaultConfig();

      console.log('[LandingEngine] ✓ Loaded config', {
        org: orgId,
        blocks_order: this.landingConfig.blocks_order,
      });

      return this.landingConfig;
    } catch (err) {
      console.error('[LandingEngine] Error loading config:', err);
      return this._getDefaultConfig();
    }
  }

  /**
   * Guardar orden de bloques
   * @param {Array<string>} blockOrder - ['hero', 'features', 'cta', 'footer']
   */
  async saveBlocksOrder(blockOrder) {
    if (!this.orgId || !this.landingConfig) return false;

    try {
      const updated = { ...this.landingConfig, blocks_order: blockOrder };

      const res = await fetch(
        `/rest/v1/organization_landing_config?organization_id=eq.${this.orgId}&select=id`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...this._headers() },
          body: JSON.stringify(updated),
        }
      );

      if (!res.ok) {
        console.error('[LandingEngine] Save order failed:', res.status);
        return false;
      }

      this.landingConfig = updated;
      this._notifyListeners('order-changed', blockOrder);
      console.log('[LandingEngine] ✓ Saved order', blockOrder);
      return true;
    } catch (err) {
      console.error('[LandingEngine] Error saving order:', err);
      return false;
    }
  }

  /**
   * Guardar estado de un bloque (activo/inactivo)
   * @param {string} blockName - 'hero' | 'features' | etc
   * @param {boolean} enabled - true/false
   */
  async toggleBlock(blockName, enabled) {
    if (!this.orgId || !this.landingConfig) return false;

    try {
      const configKey = blockName + '_config';
      const current = this.landingConfig[configKey] || {};
      const updated = {
        ...this.landingConfig,
        [configKey]: { ...current, enabled },
      };

      const res = await fetch(
        `/rest/v1/organization_landing_config?organization_id=eq.${this.orgId}&select=id`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...this._headers() },
          body: JSON.stringify(updated),
        }
      );

      if (!res.ok) return false;

      this.landingConfig = updated;
      this._notifyListeners('block-toggled', { block: blockName, enabled });
      return true;
    } catch (err) {
      console.error('[LandingEngine] Error toggling block:', err);
      return false;
    }
  }

  /**
   * Guardar contenido de un bloque
   * @param {string} blockName - 'hero' | 'features' | etc
   * @param {Object} content - contenido del bloque
   */
  async updateBlockContent(blockName, content) {
    if (!this.orgId || !this.landingConfig) return false;

    try {
      const configKey = blockName + '_config';
      const updated = {
        ...this.landingConfig,
        [configKey]: { ...this.landingConfig[configKey], ...content },
      };

      const res = await fetch(
        `/rest/v1/organization_landing_config?organization_id=eq.${this.orgId}&select=id`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...this._headers() },
          body: JSON.stringify(updated),
        }
      );

      if (!res.ok) return false;

      this.landingConfig = updated;
      this._notifyListeners('content-updated', { block: blockName, content });
      return true;
    } catch (err) {
      console.error('[LandingEngine] Error updating content:', err);
      return false;
    }
  }

  /**
   * Obtener configuración de un bloque específico
   * @param {string} blockName - 'hero' | 'features' | etc
   */
  getBlockConfig(blockName) {
    const configKey = blockName + '_config';
    return this.landingConfig?.[configKey] || this.defaultBlocks[blockName]?.config;
  }

  /**
   * Obtener lista de bloques en orden
   */
  getBlocksOrder() {
    return this.landingConfig?.blocks_order || ['hero', 'cta', 'footer'];
  }

  /**
   * Obtener configuración completa del landing
   */
  getLandingConfig() {
    return this.landingConfig;
  }

  /**
   * Suscribirse a cambios
   */
  onLandingUpdated(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  _getDefaultConfig() {
    return {
      id: null,
      organization_id: this.orgId,
      blocks_order: ['hero', 'features', 'cta', 'footer'],
      hero_config: this.defaultBlocks.hero.config,
      features_config: this.defaultBlocks.features.config,
      testimonials_config: this.defaultBlocks.testimonials.config,
      cta_config: this.defaultBlocks.cta.config,
      footer_config: this.defaultBlocks.footer.config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  _notifyListeners(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('[LandingEngine] Listener error:', err);
      }
    });
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      ...(typeof PWAUTH !== 'undefined' ? PWAUTH.headers() : {}),
    };
  }
}

// Instancia global
window.LandingEngine = new LandingEngine();
