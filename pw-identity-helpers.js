/**
 * Identity Platform — Helpers
 * Funciones reutilizables para Brand Engine, Tenant Resolution, Branding Application
 *
 * IMPORTANTE: El Brand Engine NUNCA decide permisos.
 * Solo gestiona: identidad visual + tenant + dominio + landing + white-label.
 *
 * Motores separados:
 * - Brand Engine (identidad visual)
 * - Tenant Engine (configuración regional)
 * - Capacidades Engine (permisos)
 * - Agenda Engine (programación)
 * - Programs Engine (programas)
 * - Community Engine (comunidad)
 * - etc.
 */

// ─────────────────────────────────────────────────────────────
// 1. resolveContext(options)
// ─────────────────────────────────────────────────────────────
// Resuelve contexto completo (tenant + usuario + ambiente)
// Scalable para: localhost, preview, staging, demo, QA, share links, impersonation
//
// Opción: {hostname, organizationId, previewToken, user, environment}
// Devuelve: {organization, user, environment, preview}

async function resolveContext(options = {}) {
  const {
    hostname = window.location.hostname,
    organizationId = null,
    previewToken = null,
    user = null,
    environment = _detectEnvironment(),
  } = options;

  let org = null;

  // Priority 1: Explicit organizationId
  if (organizationId) {
    org = await _sbGet('organizations', {id: organizationId})?.[0];
  }

  // Priority 2: Preview Token (share links, demos)
  if (!org && previewToken) {
    const preview = await _sbGet('preview_tokens', {
      token: `eq.${previewToken}`,
      is_active: 'eq.true',
    })?.[0];
    if (preview?.organization_id) {
      org = await _sbGet('organizations', {id: preview.organization_id})?.[0];
    }
  }

  // Priority 3: Hostname resolution (production routing)
  if (!org) {
    org = await _resolveTenantFromHostname(hostname);
  }

  // Build context
  return {
    organization: org,
    user: user || null,
    environment,
    preview: {
      token: previewToken,
      isActive: !!previewToken,
    },
    isValid: !!org,
  };
}

// Helper privado: resolver tenant desde hostname
async function _resolveTenantFromHostname(hostname) {
  // Case 1: Subdominio pathwaycareercoach.com
  if (hostname.includes('pathwaycareercoach.com')) {
    const parts = hostname.split('.');
    if (parts[0] && parts[0] !== 'www') {
      const slug = parts[0];
      return await _sbGet('organizations', {slug: `eq.${slug}`})?.[0];
    }
    return null;
  }

  // Case 2: Dominio custom
  const domain = await _sbGet('organization_domains', {
    custom_domain: `eq.${hostname}`,
  })?.[0];

  if (domain?.organization_id) {
    return await _sbGet('organizations', {id: domain.organization_id})?.[0];
  }

  return null;
}

// Helper privado: detectar ambiente
function _detectEnvironment() {
  const hostname = window.location.hostname;
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return 'local';
  if (hostname.includes('staging')) return 'staging';
  if (hostname.includes('preview')) return 'preview';
  if (hostname.includes('demo')) return 'demo';
  if (hostname.includes('qa')) return 'qa';
  return 'production';
}

// ─────────────────────────────────────────────────────────────
// 2. getTenant(org_id)
// ─────────────────────────────────────────────────────────────
// Obtiene toda la configuración de un tenant (branding + regional)

async function getTenant(org_id) {
  if (!org_id) return null;

  const org = await _sbGet('organizations', {id: `eq.${org_id}`})?.[0];
  if (!org) return null;

  const branding = await _sbGet('organization_branding', {
    organization_id: `eq.${org_id}`
  })?.[0];

  const domains = await _sbGet('organization_domains', {
    organization_id: `eq.${org_id}`
  })?.[0];

  const landing = await _sbGet('organization_landing_config', {
    organization_id: `eq.${org_id}`
  })?.[0];

  return {
    organization: org,
    branding: branding || _getDefaultBranding(),
    domains: domains || _getDefaultDomains(org.slug),
    landing: landing || _getDefaultLanding(),
  };
}

// ─────────────────────────────────────────────────────────────
// 3. getBrand(org_id, version = 'current')
// ─────────────────────────────────────────────────────────────
// Obtiene Brand Engine completo: branding + assets

async function getBrand(org_id, version = 'current') {
  if (!org_id) {
    return _getPathwayDefaultBrand();
  }

  // Intentar cache
  const cached = _getBrandCache(org_id, version);
  if (cached) return cached;

  // Fetch desde API
  try {
    const res = await fetch(
      `/rest/v1/rpc/get_brand_engine?org_id=${org_id}&version=${version}`,
      {headers: PWAUTH.headers()}
    );

    if (!res.ok) {
      console.warn(`Failed to load brand for org ${org_id}:`, res.status);
      return _getPathwayDefaultBrand();
    }

    const brand = await res.json();
    if (!brand) return _getPathwayDefaultBrand();

    // Cache
    _setBrandCache(org_id, version, brand);
    return brand;
  } catch (err) {
    console.error('Error loading brand:', err);
    return _getPathwayDefaultBrand();
  }
}

// ─────────────────────────────────────────────────────────────
// 4. buildTheme(brand, isDarkMode)
// ─────────────────────────────────────────────────────────────
// Transforma Brand Engine en Theme (mediante Theme Engine)
// Input: Brand Engine
// Output: Theme {colors, typography, spacing, radius, icons, components, density, darkMode}

function buildTheme(brand, isDarkMode = false) {
  if (!brand) {
    return window.ThemeEngine._getDefaultTheme();
  }

  return window.ThemeEngine.buildTheme(brand, isDarkMode);
}

// ─────────────────────────────────────────────────────────────
// 5. applyTheme(theme, target = document.documentElement)
// ─────────────────────────────────────────────────────────────
// Aplica Theme a la página (CSS variables, logos, white-label, etc.)
// NO es directo brand → theme es escalable y extensible

function applyTheme(theme, target = document.documentElement) {
  if (!theme) return;

  // 1. Aplicar CSS Variables de colores
  if (theme.colors.cssVars) {
    Object.entries(theme.colors.cssVars).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });
  }

  // 2. Aplicar CSS Variables de tipografía
  if (theme.typography.cssVars) {
    Object.entries(theme.typography.cssVars).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });
    document.body.style.fontFamily = theme.typography.fontFamily;
  }

  // 3. Aplicar CSS Variables de spacing
  if (theme.spacing.cssVars) {
    Object.entries(theme.spacing.cssVars).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });
  }

  // 4. Aplicar CSS Variables de radius
  if (theme.radius.cssVars) {
    Object.entries(theme.radius.cssVars).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });
  }

  // 5. Aplicar CSS Variables de iconografía
  if (theme.icons.cssVars) {
    Object.entries(theme.icons.cssVars).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });
  }

  // 6. Inyectar logos/assets en elementos
  if (theme.assets) {
    document.querySelectorAll('[data-brand-logo]').forEach(el => {
      const logoType = el.dataset.brandLogo || 'logo_dark';
      if (theme.assets[logoType]) {
        el.src = theme.assets[logoType];
        el.alt = 'Logo';
      }
    });

    // Favicon
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && theme.assets.favicon) {
      favicon.href = theme.assets.favicon;
    }

    // OG Image
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && theme.assets.og_image) {
      ogImage.content = theme.assets.og_image;
    }
  }

  // 7. Aplicar white-label level (mostrar/ocultar elementos)
  const wlLevel = theme.whiteLabel.level;
  document.querySelectorAll('[data-wl-min]').forEach(el => {
    const minLevel = parseInt(el.dataset.wlMin, 10);
    el.style.display = wlLevel >= minLevel ? '' : 'none';
  });

  document.querySelectorAll('[data-wl-only]').forEach(el => {
    const level = parseInt(el.dataset.wlOnly, 10);
    el.style.display = wlLevel === level ? '' : 'none';
  });

  // 8. Guardar en window para acceso global
  window.THEME_ENGINE_CURRENT = theme;
}

// ─────────────────────────────────────────────────────────────
// 5. listenBrandUpdates(org_id, callback)
// ─────────────────────────────────────────────────────────────
// Escucha invalidaciones de Brand Engine via Supabase Realtime

function listenBrandUpdates(org_id, callback) {
  if (!org_id || !window.supabase) return;

  const channel = supabase.channel(`brand:${org_id}`);

  channel
    .on('broadcast', {event: 'update'}, (payload) => {
      // Limpiar cache
      _clearBrandCache(org_id);

      // Llamar callback (típicamente: reload, o recargar brand)
      if (callback) callback(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Brand] Listening to org ${org_id} updates`);
      }
    });

  return channel;
}

// ─────────────────────────────────────────────────────────────
// 6. getTenantRegionalConfig(org_id)
// ─────────────────────────────────────────────────────────────
// Obtiene configuración regional del tenant (idioma, zona horaria, etc.)
// Devuelve: {language, timezone, dateFormat, currency, country}

async function getTenantRegionalConfig(org_id) {
  const org = await _sbGet('organizations', {id: `eq.${org_id}`})?.[0];
  if (!org) {
    return _getDefaultRegionalConfig();
  }

  return {
    language: org.default_language || 'es',
    timezone: org.timezone || 'UTC',
    dateFormat: org.date_format || 'DD/MM/YYYY',
    currency: org.currency || 'EUR',
    country: org.country || 'ES',
  };
}

// ─────────────────────────────────────────────────────────────
// 7. applyTenantRegionalConfig(config)
// ─────────────────────────────────────────────────────────────
// Aplica configuración regional a la página

function applyTenantRegionalConfig(config) {
  if (!config) return;

  // Guardar en window para acceso global
  window.TENANT_CONFIG = config;

  // HTML lang
  document.documentElement.lang = config.language;

  // Guardar en localStorage para acceso sincrónico
  localStorage.setItem('tenant_regional_config', JSON.stringify(config));
}

// ─────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ─────────────────────────────────────────────────────────────

function _getDefaultBranding() {
  return {
    primary_color: '#2D5016',
    secondary_color: '#8C7B80',
    neutral_dark: '#1F4030',
    neutral_light: '#F5F3F0',
    brand_font: 'poppins',
    white_label_level: 0,
    current_version: 'v1.0',
  };
}

function _getDefaultDomains(slug) {
  return {
    subdomain: slug,
    custom_domain: null,
    custom_domain_verified: false,
    ssl_enabled: false,
  };
}

function _getDefaultLanding() {
  return {
    blocks_order: ['hero', 'cta', 'footer'],
    hero_config: {
      title: 'Welcome',
      subtitle: 'Powered by Pathway',
      cta_text: 'Get Started',
      cta_url: '/',
      background_type: 'gradient',
      height: 'large',
    },
    cta_config: {
      title: 'Ready to get started?',
      cta_text: 'Contact us',
      cta_url: '/contact',
    },
    footer_config: {
      copyright: 'All rights reserved',
    },
  };
}

function _getDefaultRegionalConfig() {
  return {
    language: 'es',
    timezone: 'UTC',
    dateFormat: 'DD/MM/YYYY',
    currency: 'EUR',
    country: 'ES',
  };
}

function _getPathwayDefaultBrand() {
  return {
    version: 'default',
    branding: _getDefaultBranding(),
    assets: {
      logo_dark: '/logo.svg',
      logo_light: '/logo-light.svg',
      favicon: '/favicon-app.svg',
      og_image: '/og-default.png',
      email_logo: '/logo-email.png',
    },
    white_label_level: 0,
  };
}

function _getBrandCache(org_id, version) {
  const key = `brand_${org_id}_${version}`;
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  try {
    const {data, expires} = JSON.parse(cached);
    if (Date.now() < expires) return data;
    localStorage.removeItem(key);
  } catch {}
  return null;
}

function _setBrandCache(org_id, version, brand) {
  const key = `brand_${org_id}_${version}`;
  const expires = Date.now() + 24 * 60 * 60 * 1000;  // 24h
  try {
    localStorage.setItem(key, JSON.stringify({data: brand, expires}));
  } catch (e) {
    console.warn('Failed to cache brand:', e);
  }
}

function _clearBrandCache(org_id) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`brand_${org_id}_`)) {
      localStorage.removeItem(key);
    }
  }
}

// Helper para acceso a Supabase (asumir que existe sbGet en el contexto)
async function _sbGet(table, filter = {}) {
  try {
    let url = `/rest/v1/${table}?`;
    for (const [key, value] of Object.entries(filter)) {
      url += `${key}=${encodeURIComponent(value)}&`;
    }

    const res = await fetch(url, {headers: PWAUTH.headers()});
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Error fetching ${table}:`, err);
    return null;
  }
}

// Exportar para uso global
window.IDENTITY_HELPERS = {
  resolveContext,
  getTenant,
  getBrand,
  buildTheme,
  applyTheme,
  listenBrandUpdates,
  getTenantRegionalConfig,
  applyTenantRegionalConfig,

  // Internals (para testing)
  _resolveTenantFromHostname,
  _detectEnvironment,
};
