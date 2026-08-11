/**
 * pw-environment.js — Detección de entorno y configuración por dominio
 *
 * Determina en qué dominio se ejecuta la app e inyecta configuración:
 * - pathwaycareercoach.com (Pathway — producción monodomain)
 * - multicoach.pathwayplatforms.com (MultiCoach — laboratorio)
 * - auth.pathwayplatforms.com (Auth centralizado — futuro)
 *
 * Uso: <script src="pw-environment.js"></script> ANTES de otros scripts
 */

(function() {
  'use strict';

  // Detectar dominio/origen
  const origin = window.location.origin;
  const hostname = window.location.hostname;

  // Determinar entorno y tier
  let env = {
    isDevelopment: hostname === 'localhost' || hostname === '127.0.0.1',
    isPreview: hostname.endsWith('.pages.dev') && !hostname.startsWith('analisisform'),
    isPathway: hostname.includes('pathwaycareercoach.com'),
    isMultiCoach: hostname.includes('multicoach.pathwayplatforms.com'),
    isAuthCentral: hostname.includes('auth.pathwayplatforms.com'),
    isFallback: hostname === 'analisisform.pages.dev',
  };

  // Validar que solo uno es verdadero
  const envCount = Object.values(env).filter(Boolean).length;
  if (envCount !== 1) {
    console.error('[pw-environment] ERROR: No exactamente un entorno detectado', env);
  }

  // Configuración por entorno
  const configs = {
    pathway: {
      name: 'Pathway (Monodomain)',
      tier: 'production',
      apiUrl: 'https://api.pathwaycareercoach.com',
      projectRef: 'ddxnrsnjdvtqhxunxnwj',
      webDomain: 'pathwaycareercoach.com',
      authDomain: 'pathwaycareercoach.com',
      multicoachUrl: null, // No disponible en Pathway
      supportsMultiOrg: false,
      oauthCallbackUrl: 'https://pathwaycareercoach.com/auth-callback.html',
      analyticsId: 'pathway-prod',
      environment: 'production',
    },
    multicoach: {
      name: 'MultiCoach (Nuevo)',
      tier: 'staging',
      apiUrl: 'https://api.pathwaycareercoach.com', // Compartida por ahora
      projectRef: 'ddxnrsnjdvtqhxunxnwj', // Mismo proyecto
      webDomain: 'multicoach.pathwayplatforms.com',
      authDomain: 'pathwayplatforms.com', // Dominio raíz para SSO
      pathwayUrl: 'https://pathwaycareercoach.com',
      supportsMultiOrg: true,
      oauthCallbackUrl: 'https://multicoach.pathwayplatforms.com/auth-callback.html',
      analyticsId: 'multicoach-staging',
      environment: 'staging',
    },
    authCentral: {
      name: 'Auth Centralizado (Futuro)',
      tier: 'staging',
      apiUrl: 'https://auth.pathwayplatforms.com',
      projectRef: 'ddxnrsnjdvtqhxunxnwj',
      webDomain: 'auth.pathwayplatforms.com',
      authDomain: 'auth.pathwayplatforms.com',
      supportsMultiOrg: true,
      oauthCallbackUrl: 'https://auth.pathwayplatforms.com/oauth/callback',
      analyticsId: 'auth-central-staging',
      environment: 'staging',
    },
    development: {
      name: 'Development (Local)',
      tier: 'local',
      apiUrl: 'http://localhost:3000', // Usar variable ENV en dev
      projectRef: 'ddxnrsnjdvtqhxunxnwj',
      webDomain: 'localhost',
      authDomain: 'localhost',
      supportsMultiOrg: true, // Permitir testing multiorg en dev
      oauthCallbackUrl: 'http://localhost:3000/auth-callback.html',
      analyticsId: 'dev-local',
      environment: 'development',
    },
    preview: {
      name: 'Preview (Cloudflare)',
      tier: 'preview',
      apiUrl: 'https://api.pathwaycareercoach.com',
      projectRef: 'ddxnrsnjdvtqhxunxnwj',
      webDomain: hostname, // Dinámico: hash.analisisform.pages.dev
      authDomain: 'pathwaycareercoach.com', // Usar Pathway para auth
      supportsMultiOrg: false,
      oauthCallbackUrl: 'https://pathwaycareercoach.com/auth-callback.html',
      analyticsId: 'preview-cloudflare',
      environment: 'preview',
    },
    fallback: {
      name: 'Fallback (Analisisform)',
      tier: 'production',
      apiUrl: 'https://api.pathwaycareercoach.com',
      projectRef: 'ddxnrsnjdvtqhxunxnwj',
      webDomain: 'analisisform.pages.dev',
      authDomain: 'pathwaycareercoach.com',
      supportsMultiOrg: false,
      oauthCallbackUrl: 'https://pathwaycareercoach.com/auth-callback.html',
      analyticsId: 'fallback-analisisform',
      environment: 'production',
    },
  };

  // Determinar configuración actual
  let activeConfig;
  if (env.isPathway) {
    activeConfig = configs.pathway;
  } else if (env.isMultiCoach) {
    activeConfig = configs.multicoach;
  } else if (env.isAuthCentral) {
    activeConfig = configs.authCentral;
  } else if (env.isDevelopment) {
    activeConfig = configs.development;
  } else if (env.isPreview) {
    activeConfig = configs.preview;
  } else if (env.isFallback) {
    activeConfig = configs.fallback;
  }

  if (!activeConfig) {
    console.error('[pw-environment] ERROR: No se pudo detectar entorno', { origin, hostname });
    activeConfig = configs.pathway; // Fallback seguro a Pathway
  }

  // Inyectar en window
  window.PWENV = {
    // Métodos de detección
    is: {
      production: activeConfig.tier === 'production',
      staging: activeConfig.tier === 'staging',
      preview: activeConfig.tier === 'preview',
      development: activeConfig.tier === 'local',
      pathway: env.isPathway,
      multicoach: env.isMultiCoach,
      authCentral: env.isAuthCentral,
    },

    // Configuración
    config: activeConfig,

    // Métodos útiles
    getApiUrl() {
      return activeConfig.apiUrl;
    },

    getAuthDomain() {
      return activeConfig.authDomain;
    },

    getOAuthCallbackUrl() {
      return activeConfig.oauthCallbackUrl;
    },

    isMultiOrgSupported() {
      return activeConfig.supportsMultiOrg;
    },

    getAnalyticsId() {
      return activeConfig.analyticsId;
    },

    // Detectar si estamos en un dominio conocido (anti-phishing)
    isKnownDomain() {
      const knownDomains = [
        'pathwaycareercoach.com',
        'multicoach.pathwayplatforms.com',
        'auth.pathwayplatforms.com',
        'analisisform.pages.dev',
        'localhost',
        '127.0.0.1',
      ];
      return knownDomains.some(d => hostname.includes(d));
    },

    // Logging
    log(msg) {
      if (activeConfig.tier !== 'production' || true) { // Always log en dev/staging
        console.log(`[pw-environment] ${activeConfig.name}: ${msg}`);
      }
    },

    logError(msg) {
      console.error(`[pw-environment] ${activeConfig.name}: ${msg}`);
    },
  };

  // Validación post-detección
  if (!PWENV.isKnownDomain()) {
    console.error('[pw-environment] ⚠️  Dominio desconocido detectado:', hostname);
    console.error('[pw-environment] Posible ataque de phishing o dominio mal configurado');
  }

  // Log inicial
  console.log(
    `[pw-environment] ✓ Entorno: ${activeConfig.name} (${activeConfig.tier})`,
    `Origin: ${origin}`
  );

  // Agregar data attribute al <html> para estilos condicionales
  document.documentElement.setAttribute('data-pw-env', activeConfig.environment);
  document.documentElement.setAttribute('data-pw-tier', activeConfig.tier);

  // Feature flags según entorno
  window.PWFEATURES = {
    MULTICOACH_ENABLED: env.isMultiCoach,
    OAUTH_CENTRALIZED: false, // Activar en Phase 2
    TOKEN_REFRESH_ENABLED: true, // Activar después de Bloque 5
    RLS_MULTIORG: env.isMultiCoach, // Activar cuando RLS actualizado
    PHISHING_PROTECTION: true,
    ANALYTICS_ENABLED: !env.isDevelopment,
  };

})();
