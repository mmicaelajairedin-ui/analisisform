// pw-config.js — Configuración unificada de plataformas
// ============================================================
// Detecta automáticamente el dominio y carga la configuración adecuada.
// Soporta: pathwaycareercoach.com (histórico) + pathwayplatforms.com (nuevo)
//
// Uso: en el <head> antes de otros scripts pw-*
//   <script src="pw-config.js"></script>
//
// Expone: window.APP_CONFIG = {domain, platform, authMode, branding, ...}

(function(){
  if (window.APP_CONFIG) return; // ya cargado

  // Detectar dominio y ambiente
  const host = window.location.hostname;
  const isDev = host === 'localhost' || host.startsWith('127.');
  const isPreview = host.includes('pages.dev') || host.includes('cloudflareaccess.com');

  let platform = 'unknown';
  let domain = 'localhost';
  let authMode = 'pending'; // 'pending' | 'legacy' | 'oauth' | 'supabase'

  // Mapeo de dominio → configuración
  if (isDev || host === 'localhost') {
    domain = 'localhost';
    platform = 'pathwayplatforms'; // desarrollo por defecto para nuevo dominio
    authMode = 'pending';
  } else if (host.includes('pathwaycareercoach.com')) {
    domain = 'pathwaycareercoach.com';
    platform = 'pathwaycareercoach'; // plataforma histórica
    authMode = 'legacy'; // sigue usando el sistema actual
  } else if (host.includes('pathwayplatforms.com')) {
    domain = 'pathwayplatforms.com';
    platform = 'pathwayplatforms'; // plataforma nueva (MultiCoach)
    authMode = 'pending'; // OAuth/SSO pendiente
  } else if (isPreview) {
    domain = 'preview';
    platform = 'pathwayplatforms'; // preview va a pathwayplatforms
    authMode = 'pending';
  }

  // Configuración por plataforma
  const configs = {
    pathwaycareercoach: {
      domain: 'pathwaycareercoach.com',
      name: 'Pathway Career Coach',
      apiUrl: 'https://api.pathwaycareercoach.com',
      supabaseProjectRef: 'ddxnrsnjdvtqhxunxnwj', // el correcto (sin "bwj")
      branding: {
        primaryColor: '#1B4332', // verde Pathway
        accentColor: '#1B4332',
        secondaryColor: '#E0AA69',
        logoUrl: '/pathway-logo-dark.svg',
        favicon: '/favicon-app.svg'
      },
      features: {
        whiteLabelPortal: true,
        coachPanel: true,
        clientPortal: true,
        multiCoach: false
      },
      authMode: 'legacy', // no tocar
      redirectAfterAuth: '/panel-v2.html'
    },
    pathwayplatforms: {
      domain: 'pathwayplatforms.com',
      name: 'Pathway Platforms',
      apiUrl: 'https://api.pathwayplatforms.com', // futuro; por ahora mismo que pathwaycareercoach
      supabaseProjectRef: 'ddxnrsnjdvtqhxunxnwj', // compartir Supabase (sin "bwj")
      branding: {
        primaryColor: '#1B4332', // verde Pathway (consistente)
        accentColor: '#1B4332',
        secondaryColor: '#E0AA69',
        logoUrl: '/pathwayplatforms-logo-dark.svg',
        favicon: '/favicon-platforms.svg'
      },
      features: {
        whiteLabelPortal: false, // no es para coaches individuales
        coachPanel: false, // no es para coaches
        clientPortal: false, // no es para clientes
        multiCoach: true // TODO: MultiCoach es el producto
      },
      authMode: 'pending', // OAuth/SSO en desarrollo
      redirectAfterAuth: '/multicoach.html'
    }
  };

  const config = configs[platform] || configs.pathwayplatforms;

  // Sobrescribir con ambiente (preview/dev puede tocar API diferente)
  if (isPreview) {
    config.apiUrl = 'https://api.pathwaycareercoach.com'; // preview apunta a prod por ahora
  }

  // Exportar configuración global
  window.APP_CONFIG = {
    domain,
    platform,
    isDev,
    isPreview,
    authMode,
    // reexportar config completa
    ...config
  };

  // Log para debugging (solo en dev)
  if (isDev || isPreview) {
    console.log('[pw-config] Loaded:', {
      domain: window.APP_CONFIG.domain,
      platform: window.APP_CONFIG.platform,
      authMode: window.APP_CONFIG.authMode,
      apiUrl: window.APP_CONFIG.apiUrl
    });
  }

})();
