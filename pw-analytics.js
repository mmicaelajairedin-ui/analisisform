/* pw-analytics.js — Analítica de producto: GA4 + Microsoft Clarity.
   ---------------------------------------------------------------------------
   QUÉ MIDE, Y POR QUÉ NO LO CUBRE `pw-pixel.js`. El pixel de Meta mide
   CONVERSIONES DE ANUNCIOS: dice si una campaña pagada trajo un registro. No
   dice de dónde viene el tráfico que NO es de anuncios — la búsqueda orgánica,
   que es el escalón donde empieza el embudo de este producto— ni permite
   separarlo por sección (directorio, herramientas, contenido). Son dos
   preguntas distintas y hacen falta las dos.

   TRES REGLAS, y las tres vienen de incidentes de este proyecto:

   1) SIN IDENTIFICADOR NO SE CARGA NADA. No es «se carga y no envía»: no se
      inyecta ningún script, no se abre ninguna conexión y no se pone ninguna
      cookie. Dejar una constante vacía apaga esa mitad entera.

   2) EL MISMO CONSENTIMIENTO QUE EL PIXEL, sin excepción. GA4 pone cookies y
      Clarity GRABA LA SESIÓN: si algo necesita permiso explícito en Europa, es
      esto. Se usa la API que ya existe (`window.pwConsent` / `pwOnConsent` de
      `pw-consent.js`), y el respaldo es conservador — sin sistema de
      consentimiento cargado NO se carga nada y se queda esperando el evento.
      Igual que hace `pw-pixel.js`: no se inventa una doctrina nueva.

      ▶ Por eso este fichero va SIEMPRE DESPUÉS de `pw-consent.js`:
           <script src="/pw-consent.js"></script>
           <script src="/pw-analytics.js"></script>
        Sin él, el respaldo conservador deja la página sin medir. Es exactamente
        lo que le pasaba a `coach.html`, `reservar.html` y `pago-listo.html`:
        se les añadió el pixel y no el consentimiento, así que el instrumento
        estaba puesto y no podía dispararse nunca.

   3) NINGÚN EVENTO NUEVO. Este fichero manda la vista de página y nada más. Los
      dos escalones que faltan —ACTIVATION y la reserva— están descritos en
      `docs/FASE4-MEDICION.md` §E y necesitan que alguien los NOMBRE y los dé de
      alta antes de cablearlos; un evento inventado desde el código mide en un
      sitio donde nadie mira.
   --------------------------------------------------------------------------- */
(function () {
  'use strict';

  // Igual que `pw-pixel.js` y `pw-consent.js`: en la app nativa no se mide.
  // Apple exige App Tracking Transparency y aquí no hay nada que pedir.
  if (typeof window !== 'undefined') {
    if (window.pw_native) return;
    if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform) {
      try { if (window.Capacitor.isNativePlatform()) return; } catch (e) {}
    }
  }

  // ===========================================================================
  // ⚙️  CONFIG — Pathway Career Coach (`pathwaycareercoach.com`).
  //     Los dos son identificadores PÚBLICOS: viajan en el HTML de cada página
  //     y los ve cualquier visitante. No son credenciales.
  //     Vaciar una constante apaga esa mitad, sin tocar nada más.
  var PW_GA4_ID = 'G-58YWJ242GW';     // GA4 → Administrar → Flujos de datos
  var PW_CLARITY_ID = 'yjs66fo80e';   // clarity.microsoft.com → Configuración
  // ===========================================================================

  var GA4_OK = /^G-[A-Z0-9]{6,}$/.test(PW_GA4_ID);
  var CLARITY_OK = /^[a-z0-9]{6,}$/.test(PW_CLARITY_ID);
  if (!GA4_OK && !CLARITY_OK) return;

  function inyectar(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    var primero = document.getElementsByTagName('script')[0];
    if (primero && primero.parentNode) primero.parentNode.insertBefore(s, primero);
    else document.head.appendChild(s);
  }

  function cargarGA4() {
    if (window.__pwGA4Loaded) return; window.__pwGA4Loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', PW_GA4_ID);
    inyectar('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(PW_GA4_ID));
  }

  function cargarClarity() {
    if (window.__pwClarityLoaded) return; window.__pwClarityLoaded = true;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    inyectar('https://www.clarity.ms/tag/' + encodeURIComponent(PW_CLARITY_ID));
  }

  function cargar() {
    try { if (GA4_OK) cargarGA4(); } catch (e) {}
    try { if (CLARITY_OK) cargarClarity(); } catch (e) {}
  }

  // Puerta de consentimiento — la MISMA que `pw-pixel.js`, a propósito.
  if (window.pwConsent) {
    if (window.pwConsent() === 'granted') cargar();
    else if (window.pwOnConsent) window.pwOnConsent(cargar);
  } else {
    // Respaldo conservador: sin sistema de consentimiento cargado no se mide, y
    // se queda escuchando por si `pw-consent.js` aparece después.
    window.addEventListener('pw-consent-change', function (e) {
      if (e && e.detail && e.detail.value === 'granted') cargar();
    });
  }
})();
