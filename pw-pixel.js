/* pw-pixel.js — Tracking de anuncios (Meta Pixel) + atribución de origen.
   ---------------------------------------------------------------------------
   UNA sola fuente de verdad para el tracking de campañas. Hace 3 cosas:
     1) Carga el Meta Pixel (Facebook/Instagram Ads) y manda PageView.
     2) Captura DE DÓNDE vino cada visitante (utm_*, fbclid, gclid, referrer),
        con lógica first-touch, y lo guarda en localStorage (`pw_attr`). Así,
        aunque la persona navegue a otra página antes de dejar el lead, el
        origen viaja con ella y se guarda junto al lead en Supabase.
     3) Expone helpers para disparar eventos de conversión (Lead, registro,
        trial, demo, compra) desde cualquier página, de forma segura.

   ▶ PARA ACTIVAR EL PIXEL: poné tu Pixel ID de Meta abajo (PW_META_PIXEL_ID).
     Lo sacás de  Meta Events Manager → tu pixel → Configuración  (son ~15-16
     dígitos). Mientras diga 'TU_PIXEL_ID', el pixel NO carga (no rompe nada),
     pero la ATRIBUCIÓN de origen SÍ se sigue capturando — así no perdés datos
     de qué anuncio trae leads aunque todavía no tengas el ID cargado.

   ▶ Se incluye con  <script src="pw-pixel.js"></script>  en las páginas por
     donde entran los anuncios (landing, soy-coach, formulario, registro…).
   --------------------------------------------------------------------------- */
(function () {
  'use strict';

  // Deshabilitar tracking en app nativa (iOS/Android) — Apple requiere App
  // Tracking Transparency. En app, no hacemos tracking; en web, sí.
  if (typeof window !== 'undefined') {
    if (window.pw_native) return;
    if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform) {
      try { if (window.Capacitor.isNativePlatform()) return; } catch (e) {}
    }
  }

  // ===========================================================================
  // ⚙️  CONFIG — Pixel ID de Meta (Events Manager). Pathway Career Coach.
  var PW_META_PIXEL_ID = '1037557745446059';
  // ===========================================================================

  var STORE_KEY = 'pw_attr';       // first-touch (persistente)
  var LAST_KEY  = 'pw_attr_last';  // last-touch (por sesión, informativo)

  // --- storage seguro (modo incógnito puede tirar) --------------------------
  function _get(store, k) { try { return JSON.parse(store.getItem(k) || 'null'); } catch (e) { return null; } }
  function _set(store, k, v) { try { store.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // --- leer parámetros de campaña de la URL ---------------------------------
  function attrFromUrl() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return null; }
    var o = {}, has = false;
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      var v = q.get(k);
      if (v) { o[k] = ('' + v).slice(0, 120); has = true; }
    });
    var fbclid = q.get('fbclid'); if (fbclid) { o.fbclid = ('' + fbclid).slice(0, 300); has = true; }
    var gclid  = q.get('gclid');  if (gclid)  { o.gclid  = ('' + gclid).slice(0, 300);  has = true; }
    // Si vino con fbclid pero sin utm_source, asumimos Meta como fuente.
    if (o.fbclid && !o.utm_source) { o.utm_source = 'facebook'; o.utm_medium = o.utm_medium || 'paid'; }
    if (o.gclid  && !o.utm_source) { o.utm_source = 'google';   o.utm_medium = o.utm_medium || 'cpc'; }
    if (!has) return null;
    o.landing = ('' + (location.pathname || '')).slice(0, 120);
    try {
      var r = document.referrer || '';
      if (r && r.indexOf(location.host) === -1) o.referrer = r.slice(0, 300);
    } catch (e) {}
    o.ts = new Date().toISOString();
    return o;
  }

  // --- resolver atribución (first-touch: no se pisa si ya había una) --------
  var stored = _get(localStorage, STORE_KEY);
  var fresh  = attrFromUrl();
  if (fresh) {
    _set(sessionStorage, LAST_KEY, fresh);           // último toque (informativo)
    if (!stored) { stored = fresh; _set(localStorage, STORE_KEY, fresh); } // primer toque
  }
  // Fallback de origen orgánico: si nunca hubo campaña pero sí un referrer
  // externo reconocible, lo guardamos como fuente (una sola vez).
  if (!stored) {
    try {
      var ref = document.referrer || '';
      if (ref && ref.indexOf(location.host) === -1) {
        var host = '';
        try { host = new URL(ref).hostname.replace(/^www\./, ''); } catch (e) {}
        if (host) {
          stored = { utm_source: host, utm_medium: 'referral', referrer: ref.slice(0, 300),
                     landing: ('' + (location.pathname || '')).slice(0, 120), ts: new Date().toISOString() };
          _set(localStorage, STORE_KEY, stored);
        }
      }
    } catch (e) {}
  }

  // Devuelve la atribución guardada ({} si no hay). Uso: pwAttr() al guardar un lead.
  window.pwAttr = function () { return _get(localStorage, STORE_KEY) || {}; };
  // Etiqueta corta y legible del origen (para logs/emails). Ej: "facebook · verano_fit".
  window.pwAttrLabel = function () {
    var a = window.pwAttr();
    if (!a || !a.utm_source) return '';
    return a.utm_source + (a.utm_campaign ? ' · ' + a.utm_campaign : '');
  };

  // ===========================================================================
  // Dentro de la app de tienda (iOS/Android) NUNCA cargamos el pixel de Meta:
  // la app sigue el modelo "reader" (iniciar sesión y usar), sin seguimiento
  // publicitario. Así la ficha de Privacidad puede declarar "sin tracking" y es
  // 100% cierto. Detecta ?app=1, el flag pw_native o Capacitor nativo. (La
  // atribución local de utm_* sigue funcionando: es localStorage, no es tracking.)
  var IN_APP = (function () {
    try {
      var qs = new URLSearchParams(location.search || '');
      if (qs.get('app') === '1') return true;
      if (localStorage.getItem('pw_native') === '1') return true;
      var C = window.Capacitor;
      if (C && (typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : C.isNative)) return true;
    } catch (e) {}
    return false;
  })();

  // ===========================================================================
  // Meta Pixel — carga SOLO si hay un ID real, consentimiento de cookies (RGPD)
  // Y NO estamos dentro de la app de tienda.
  var ID_OK = /^\d{6,}$/.test(PW_META_PIXEL_ID) && !IN_APP;
  function loadMetaPixel() {
    if (window.__pwPixelLoaded) return; window.__pwPixelLoaded = true;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    try { window.fbq('init', PW_META_PIXEL_ID); window.fbq('track', 'PageView'); } catch (e) {}
  }
  if (ID_OK) {
    if (window.pwConsent) {
      // Sistema de consentimiento presente (pw-consent.js): cargar solo si aceptó.
      if (window.pwConsent() === 'granted') loadMetaPixel();
      else if (window.pwOnConsent) window.pwOnConsent(loadMetaPixel);
    } else {
      // Sin pw-consent.js cargado: fallback conservador — NO cargar hasta que
      // llegue un consentimiento (por si el script de consent aparece después).
      window.addEventListener('pw-consent-change', function (e) {
        if (e && e.detail && e.detail.value === 'granted') loadMetaPixel();
      });
    }
  }

  // ===========================================================================
  // Helpers de eventos — disparan a Meta si el pixel está activo; si no, no-op
  // seguro. Siempre adjuntan la atribución para poder cruzar en Events Manager.
  function track(ev, params) {
    try {
      if (window.fbq) {
        var p = params || {};
        var a = window.pwAttr();
        if (a && a.utm_campaign && p.content_name == null) p.content_name = a.utm_campaign;
        window.fbq('track', ev, p);
      }
    } catch (e) {}
  }
  window.pwTrack         = track;
  window.pwTrackLead     = function (p) { track('Lead', p); };                 // dejó su contacto
  window.pwTrackReg      = function (p) { track('CompleteRegistration', p); }; // completó el registro
  window.pwTrackTrial    = function (p) { track('StartTrial', p); };           // arrancó el trial gratis
  window.pwTrackDemo     = function (p) { track('Schedule', p); };             // agendó una demo
  window.pwTrackPurchase = function (p) { track('Purchase', p); };             // pagó

  // ===========================================================================
  // Auto-atribución de leads (una sola fuente de verdad): intercepta cualquier
  // POST a contactos_chat en la página y (1) le adjunta el origen del anuncio y
  // (2) dispara el evento Lead a Meta. Así cada formulario de contacto del sitio
  // (soy-candidato, coaches, etc.) queda cubierto sin tocarlo uno por uno.
  // A prueba de errores: ante cualquier duda, deja el fetch original intacto.
  if (!window.__pwLeadHook) {
    window.__pwLeadHook = true;
    var _fetch = window.fetch;
    if (typeof _fetch === 'function') {
      window.fetch = function (input, init) {
        try {
          var url = (typeof input === 'string') ? input : (input && input.url) || '';
          var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          if (method === 'POST' && /\/rest\/v1\/contactos_chat(\?|$)/.test(url) && init && typeof init.body === 'string') {
            var a = window.pwAttr ? window.pwAttr() : null;
            if (a && a.utm_source) {
              var parsed = JSON.parse(init.body);
              var attach = function (o) { if (o && typeof o === 'object' && o.origen == null) o.origen = a; return o; };
              parsed = Array.isArray(parsed) ? parsed.map(attach) : attach(parsed);
              init = Object.assign({}, init, { body: JSON.stringify(parsed) });
            }
            // Evento de conversión: este contacto cuenta como Lead (no-op si no hay pixel/consent).
            try { window.pwTrackLead && window.pwTrackLead(); } catch (e) {}
          }
        } catch (e) { /* nunca romper un guardado por culpa del tracking */ }
        return _fetch.apply(this, arguments.length > 1 ? [input, init] : [input]);
      };
    }
  }
})();
