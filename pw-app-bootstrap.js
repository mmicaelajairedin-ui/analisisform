/**
 * App Bootstrap — Punto único de entrada para toda la plataforma
 *
 * Responsabilidad:
 * 1. Resolver contexto (tenant, usuario, ambiente)
 * 2. Cargar Brand Engine
 * 3. Construir y aplicar Theme Engine
 * 4. Cargar Landing Engine (si aplica)
 * 5. Cargar Domain Engine (si aplica)
 * 6. Conectar Realtime
 * 7. Iniciar aplicación
 *
 * Único punto de entrada para:
 * - Notificaciones
 * - Preferencias de usuario
 * - Idioma
 * - Feature flags
 * - A/B tests
 * - Etc.
 */

class AppBootstrap {
  constructor() {
    this.context = null;
    this.brand = null;
    this.theme = null;
    this.isBootstrapped = false;
  }

  /**
   * Bootstrap principal — DEBE llamarse en cada página al cargar
   * @param {Object} options - {organizationId, target, skipRealtime}
   * @returns {Promise<Object>} {context, brand, theme}
   */
  async bootstrap(options = {}) {
    if (this.isBootstrapped) {
      console.log('[AppBootstrap] Already bootstrapped');
      return { context: this.context, brand: this.brand, theme: this.theme };
    }

    try {
      console.log('[AppBootstrap] Starting bootstrap...');

      // 1. Resolver contexto
      this.context = await this._resolveContext(options);
      if (!this.context?.isValid) {
        console.warn('[AppBootstrap] No valid context, using defaults');
        // Aplicar theme por defecto
        this._applyDefaultTheme(options.target);
        this.isBootstrapped = true;
        return { context: this.context, brand: null, theme: null };
      }

      // 2. Cargar Brand Engine
      if (!window.BrandEngine) {
        console.error('[AppBootstrap] BrandEngine not loaded');
        return null;
      }

      this.brand = await window.BrandEngine.loadOrganization(this.context.organization.id);
      if (!this.brand?.branding) {
        console.warn('[AppBootstrap] No branding data');
        this._applyDefaultTheme(options.target);
        this.isBootstrapped = true;
        return { context: this.context, brand: null, theme: null };
      }

      // 3. Construir Theme Engine
      if (!window.ThemeEngine) {
        console.error('[AppBootstrap] ThemeEngine not loaded');
        return null;
      }

      this.theme = window.ThemeEngine.buildTheme(this.brand.branding);

      // 4. Aplicar Theme a la página
      const target = options.target || document.documentElement;
      window.ThemeEngine.applyTheme(this.theme, target);

      // 5. Cargar Landing Engine (si aplica)
      if (window.LandingEngine && !options.skipLanding) {
        await window.LandingEngine.loadLandingConfig(this.context.organization.id);
      }

      // 6. Cargar Domain Engine (si aplica)
      if (window.DomainEngine && !options.skipDomain) {
        await window.DomainEngine.loadDomainConfig(
          this.context.organization.id,
          this.context.organization.slug
        );
      }

      // 7. Conectar Realtime (si está disponible y no se desactiva)
      if (!options.skipRealtime) {
        this._connectRealtime();
      }

      this.isBootstrapped = true;

      console.log('[AppBootstrap] ✓ Bootstrap complete', {
        org: this.context.organization.name,
        theme_version: this.theme._metadata.version,
        primary_color: this.brand.branding.primary_color,
      });

      return { context: this.context, brand: this.brand, theme: this.theme };
    } catch (err) {
      console.error('[AppBootstrap] Error during bootstrap:', err);
      this._applyDefaultTheme(options.target);
      return null;
    }
  }

  /**
   * Resolver contexto de la aplicación
   * @private
   */
  async _resolveContext(options) {
    // Si viene explícito
    if (options.organizationId) {
      const org = await this._fetchOrg(options.organizationId);
      return {
        organization: org,
        environment: this._detectEnvironment(),
        isValid: !!org,
      };
    }

    // Si hay context en window (MultiCoach, Panel, etc.)
    if (window.MC_ORG) {
      return {
        organization: window.MC_ORG,
        environment: this._detectEnvironment(),
        isValid: true,
      };
    }

    // Default (sin contexto)
    return {
      organization: null,
      environment: this._detectEnvironment(),
      isValid: false,
    };
  }

  /**
   * Traer organización desde Supabase
   * @private
   */
  async _fetchOrg(orgId) {
    try {
      const res = await fetch(`/rest/v1/organizations?id=eq.${orgId}&select=*`, {
        headers: typeof PWAUTH !== 'undefined' ? PWAUTH.headers() : {},
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.[0] || null;
    } catch (err) {
      console.error('[AppBootstrap] Error fetching org:', err);
      return null;
    }
  }

  /**
   * Detectar ambiente
   * @private
   */
  _detectEnvironment() {
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return 'local';
    if (hostname.includes('staging')) return 'staging';
    if (hostname.includes('preview')) return 'preview';
    if (hostname.includes('demo')) return 'demo';
    if (hostname.includes('qa')) return 'qa';
    return 'production';
  }

  /**
   * Aplicar theme por defecto
   * @private
   */
  _applyDefaultTheme(target = document.documentElement) {
    const defaultBrand = {
      primary_color: '#2D5016',
      secondary_color: '#8C7B80',
      neutral_dark: '#1F4030',
      neutral_light: '#F5F3F0',
      brand_font: 'poppins',
    };

    if (window.ThemeEngine) {
      const theme = window.ThemeEngine.buildTheme(defaultBrand);
      window.ThemeEngine.applyTheme(theme, target);
    }
  }

  /**
   * Conectar Realtime de Supabase para cambios en vivo
   * @private
   */
  _connectRealtime() {
    if (!window.supabase || !this.context?.organization?.id) return;

    const orgId = this.context.organization.id;

    // Escuchar cambios en branding
    const brandChannel = window.supabase.channel(`brand:${orgId}`);
    brandChannel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'organization_branding',
        filter: `organization_id=eq.${orgId}`,
      }, (payload) => {
        console.log('[AppBootstrap] Realtime: Branding updated', payload.new);
        this._onBrandingUpdated(payload.new);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[AppBootstrap] ✓ Listening to branding changes');
        }
      });

    // Escuchar cambios en landing
    if (window.LandingEngine) {
      const landingChannel = window.supabase.channel(`landing:${orgId}`);
      landingChannel
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'organization_landing_config',
          filter: `organization_id=eq.${orgId}`,
        }, (payload) => {
          console.log('[AppBootstrap] Realtime: Landing updated', payload.new);
          this._onLandingUpdated(payload.new);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[AppBootstrap] ✓ Listening to landing changes');
          }
        });
    }

    // Escuchar cambios en dominio
    if (window.DomainEngine) {
      const domainChannel = window.supabase.channel(`domain:${orgId}`);
      domainChannel
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'organization_domains',
          filter: `organization_id=eq.${orgId}`,
        }, (payload) => {
          console.log('[AppBootstrap] Realtime: Domain updated', payload.new);
          this._onDomainUpdated(payload.new);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[AppBootstrap] ✓ Listening to domain changes');
          }
        });
    }
  }

  /**
   * Callback: Branding actualizado vía Realtime
   * @private
   */
  _onBrandingUpdated(brandingData) {
    if (!window.ThemeEngine) return;

    // Reconstruir y aplicar theme
    const newTheme = window.ThemeEngine.buildTheme(brandingData);
    window.ThemeEngine.applyTheme(newTheme, document.documentElement);

    // Notificar a la app (si existe handler)
    if (window.onBrandingRealtimeUpdate) {
      window.onBrandingRealtimeUpdate(brandingData, newTheme);
    }

    console.log('[AppBootstrap] ✓ Theme applied (Realtime update)');
  }

  /**
   * Callback: Landing actualizado vía Realtime
   * @private
   */
  _onLandingUpdated(landingData) {
    console.log('[AppBootstrap] Landing updated via Realtime');
    // La app puede suscribirse a window.onLandingRealtimeUpdate
    if (window.onLandingRealtimeUpdate) {
      window.onLandingRealtimeUpdate(landingData);
    }
  }

  /**
   * Callback: Domain actualizado vía Realtime
   * @private
   */
  _onDomainUpdated(domainData) {
    console.log('[AppBootstrap] Domain updated via Realtime');
    if (window.onDomainRealtimeUpdate) {
      window.onDomainRealtimeUpdate(domainData);
    }
  }

  /**
   * Obtener contexto actual
   */
  getContext() {
    return this.context;
  }

  /**
   * Obtener brand actual
   */
  getBrand() {
    return this.brand;
  }

  /**
   * Obtener theme actual
   */
  getTheme() {
    return this.theme;
  }

  /**
   * Verificar si está bootstrapped
   */
  isReady() {
    return this.isBootstrapped;
  }
}

// Instancia global
window.AppBootstrap = new AppBootstrap();
