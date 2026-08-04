/**
 * Domain Engine — Gestiona dominios de organizaciones
 *
 * Responsabilidades:
 * 1. Cargar configuración de dominio desde Supabase
 * 2. Persistir dominio personalizado
 * 3. Validar DNS (mockeado por ahora)
 * 4. Gestionar estado de verificación
 * 5. Reutilizable en toda la plataforma
 */

class DomainEngine {
  constructor() {
    this.orgId = null;
    this.domainConfig = null;
    this.listeners = [];
  }

  /**
   * Cargar configuración de dominio desde Supabase
   * @param {string} orgId - ID de la organización
   * @param {string} orgSlug - slug de la organización
   * @returns {Promise<Object>} domain config
   */
  async loadDomainConfig(orgId, orgSlug = 'org') {
    if (!orgId) return null;

    try {
      this.orgId = orgId;

      // Fetch domain config
      const res = await fetch(
        `/rest/v1/organization_domains?organization_id=eq.${orgId}&select=*`,
        { headers: this._headers() }
      );

      if (!res.ok) {
        console.warn('[DomainEngine] No config found, creating default');
        this.domainConfig = this._getDefaultConfig(orgSlug);
        return this.domainConfig;
      }

      const data = await res.json();
      this.domainConfig = data?.[0] || this._getDefaultConfig(orgSlug);

      console.log('[DomainEngine] ✓ Loaded config', {
        org: orgId,
        subdomain: this.domainConfig.subdomain,
        custom_domain: this.domainConfig.custom_domain,
      });

      return this.domainConfig;
    } catch (err) {
      console.error('[DomainEngine] Error loading config:', err);
      return this._getDefaultConfig(orgSlug);
    }
  }

  /**
   * Guardar dominio personalizado
   * @param {string} customDomain - ej: 'coach.example.com'
   */
  async setCustomDomain(customDomain) {
    if (!this.orgId || !this.domainConfig) return false;

    try {
      const updated = {
        ...this.domainConfig,
        custom_domain: customDomain || null,
        custom_domain_verified: false,
        verification_token: this._generateToken(),
      };

      const res = await fetch(
        `/rest/v1/organization_domains?organization_id=eq.${this.orgId}&select=id`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...this._headers() },
          body: JSON.stringify(updated),
        }
      );

      if (!res.ok) {
        console.error('[DomainEngine] Save failed:', res.status);
        return false;
      }

      this.domainConfig = updated;
      this._notifyListeners('custom-domain-set', customDomain);
      console.log('[DomainEngine] ✓ Saved custom domain', customDomain);
      return true;
    } catch (err) {
      console.error('[DomainEngine] Error saving domain:', err);
      return false;
    }
  }

  /**
   * Verificar DNS (mockeado por ahora — en producción verificaría CNAME real)
   * @param {string} customDomain - dominio a verificar
   */
  async verifyDNS(customDomain) {
    if (!this.orgId || !this.domainConfig) return false;

    try {
      // MOCKEADO: En producción, aquí verificarías el CNAME en el DNS real
      // Por ahora, simulamos verificación exitosa después de 1s
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updated = {
        ...this.domainConfig,
        custom_domain_verified: true,
        verification_verified_at: new Date().toISOString(),
        ssl_enabled: true,
        ssl_cert_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const res = await fetch(
        `/rest/v1/organization_domains?organization_id=eq.${this.orgId}&select=id`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...this._headers() },
          body: JSON.stringify(updated),
        }
      );

      if (!res.ok) return false;

      this.domainConfig = updated;
      this._notifyListeners('dns-verified', customDomain);
      console.log('[DomainEngine] ✓ DNS verified', customDomain);
      return true;
    } catch (err) {
      console.error('[DomainEngine] Error verifying DNS:', err);
      return false;
    }
  }

  /**
   * Obtener subdominio (automático, no se puede cambiar)
   */
  getSubdomain() {
    return this.domainConfig?.subdomain || 'org';
  }

  /**
   * Obtener dominio personalizado
   */
  getCustomDomain() {
    return this.domainConfig?.custom_domain || null;
  }

  /**
   * Obtener estado de verificación
   */
  isVerified() {
    return this.domainConfig?.custom_domain_verified || false;
  }

  /**
   * Obtener token de verificación (para mostrar registro CNAME)
   */
  getVerificationToken() {
    return this.domainConfig?.verification_token || null;
  }

  /**
   * Obtener URL pública del subdomain
   */
  getPublicUrl(orgSlug = 'org') {
    return `https://${orgSlug}.pathwaycareercoach.com`;
  }

  /**
   * Obtener URL de dominio personalizado (si está verificado)
   */
  getCustomUrl() {
    if (this.isVerified() && this.getCustomDomain()) {
      return `https://${this.getCustomDomain()}`;
    }
    return null;
  }

  /**
   * Obtener configuración completa
   */
  getDomainConfig() {
    return this.domainConfig;
  }

  /**
   * Suscribirse a cambios
   */
  onDomainUpdated(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  _getDefaultConfig(slug) {
    return {
      id: null,
      organization_id: this.orgId,
      subdomain: slug,
      custom_domain: null,
      custom_domain_verified: false,
      verification_token: null,
      ssl_enabled: true,
      ssl_cert_expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  _notifyListeners(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('[DomainEngine] Listener error:', err);
      }
    });
  }

  _generateToken() {
    return 'verify_' + Math.random().toString(36).substr(2, 9);
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      ...(typeof PWAUTH !== 'undefined' ? PWAUTH.headers() : {}),
    };
  }
}

// Instancia global
window.DomainEngine = new DomainEngine();
