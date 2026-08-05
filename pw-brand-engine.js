/**
 * Brand Engine — Gestiona identidad de organizaciones desde Supabase
 *
 * Responsabilidades:
 * 1. Cargar branding de una organización
 * 2. Persistir cambios a Supabase
 * 3. Mantener sincronización en vivo
 * 4. Reutilizable en toda la plataforma (MultiCoach, Panel, Portal, etc.)
 */

class BrandEngine {
  constructor() {
    this.orgId = null;
    this.orgData = null;
    this.brandingData = null;
    this.listeners = [];
  }

  /**
   * Cargar datos completos de una organización
   * @param {string} orgId - ID de la organización
   * @returns {Promise<Object>} {organization, branding}
   */
  async loadOrganization(orgId) {
    if (!orgId) return null;

    try {
      this.orgId = orgId;

      // Fetch organization + branding en paralelo
      const [orgRes, brandRes] = await Promise.all([
        _sbGet('organizaciones', { id: `eq.${orgId}` }),
        _sbGet('organization_branding', { organization_id: `eq.${orgId}` }),
      ]);

      this.orgData = orgRes?.[0] || null;
      this.brandingData = brandRes?.[0] || this._getDefaultBranding();

      console.log('[BrandEngine] ✓ Loaded org', {
        name: this.orgData?.name,
        slug: this.orgData?.slug,
        branding_version: this.brandingData?.current_version,
      });

      return { organization: this.orgData, branding: this.brandingData };
    } catch (err) {
      console.error('[BrandEngine] Error loading organization:', err);
      return null;
    }
  }

  /**
   * Guardar cambios de branding a Supabase
   * @param {Object} changes - {primary_color, secondary_color, brand_font, ...}
   * @returns {Promise<boolean>}
   */
  async saveBranding(changes = {}) {
    if (!this.orgId || !this.brandingData) return false;

    try {
      const merged = { ...this.brandingData, ...changes };

      const res = await fetch(
        `/rest/v1/organization_branding?organization_id=eq.${this.orgId}&select=id`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...PWAUTH.headersSync() },
          body: JSON.stringify(merged),
        }
      );

      if (!res.ok) {
        console.error('[BrandEngine] Save failed:', res.status);
        return false;
      }

      this.brandingData = merged;
      this._notifyListeners('branding-updated', merged);

      console.log('[BrandEngine] ✓ Saved branding', changes);
      return true;
    } catch (err) {
      console.error('[BrandEngine] Error saving branding:', err);
      return false;
    }
  }

  /**
   * Actualizar un color y guardar
   * @param {string} colorKey - 'primary_color' | 'secondary_color' | ...
   * @param {string} colorValue - hex color
   */
  async updateColor(colorKey, colorValue) {
    if (!this.brandingData) return false;

    this.brandingData[colorKey] = colorValue;
    return await this.saveBranding({ [colorKey]: colorValue });
  }

  /**
   * Actualizar tipografía y guardar
   * @param {string} fontFamily - 'poppins' | 'inter' | 'manrope'
   */
  async updateTypography(fontFamily) {
    if (!this.brandingData) return false;

    this.brandingData.brand_font = fontFamily;
    return await this.saveBranding({ brand_font: fontFamily });
  }

  /**
   * Obtener branding actual
   */
  getBranding() {
    return this.brandingData || this._getDefaultBranding();
  }

  /**
   * Obtener organización actual
   */
  getOrganization() {
    return this.orgData;
  }

  /**
   * Suscribirse a cambios de branding
   */
  onBrandingUpdated(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  _notifyListeners(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('[BrandEngine] Listener error:', err);
      }
    });
  }

  _getDefaultBranding() {
    return {
      id: null,
      organization_id: this.orgId,
      primary_color: '#2D5016',
      secondary_color: '#8C7B80',
      neutral_dark: '#1F4030',
      neutral_light: '#F5F3F0',
      brand_font: 'poppins',
      white_label_level: 0,
      current_version: 'v1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

// Instancia global
window.BrandEngine = new BrandEngine();

// Helper privado para Supabase (async version)
async function _sbGet(table, filter = {}) {
  try {
    let url = `/rest/v1/${table}?`;
    for (const [key, value] of Object.entries(filter)) {
      url += `${key}=${encodeURIComponent(value)}&`;
    }

    const res = await fetch(url, { headers: PWAUTH.headersSync() });
    if (!res.ok) {
      console.warn(`[_sbGet] Failed ${table}:`, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[_sbGet] Error fetching ${table}:`, err);
    return null;
  }
}
