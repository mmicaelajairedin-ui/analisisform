/* pw-consent.js — Banner de consentimiento de cookies (RGPD).
   ---------------------------------------------------------------------------
   Cumplimiento europeo: los trackers de terceros (Meta Pixel, LinkedIn Insight)
   NO deben cargar hasta que la persona acepte. Este script:
     1) Muestra un banner la primera vez (Aceptar / Rechazar).
     2) Recuerda la decisión en localStorage (`pw_consent`).
     3) Expone una API para que pw-pixel.js (y el tag de LinkedIn) carguen SOLO
        si hubo consentimiento:
          - window.pwConsent()        → 'granted' | 'denied' | null
          - window.pwOnConsent(cb)    → llama cb() ahora si ya aceptó, o cuando acepte
          - window.pwOpenConsent()    → reabre el banner (para "Preferencias de cookies")

   ▶ Debe incluirse ANTES de pw-pixel.js:
        <script src="/pw-consent.js"></script>
        <script src="/pw-pixel.js"></script>

   Nota: la captura de origen first-party (UTM en localStorage de pw-pixel.js) sí
   sigue, porque es dato propio y solo se persiste cuando la persona ENVÍA un
   formulario por su cuenta. Lo que se gatea es el envío a terceros (Meta/LinkedIn).
   --------------------------------------------------------------------------- */
(function () {
  'use strict';
  var KEY = 'pw_consent';               // 'granted' | 'denied'

  function get()   { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function emit(v) { try { window.dispatchEvent(new CustomEvent('pw-consent-change', { detail: { value: v } })); } catch (e) {} }

  window.__pwConsent = get();
  window.pwConsent = function () { return window.__pwConsent || null; };

  // Ejecuta cb ahora si ya se aceptó; si no, queda a la espera del "Aceptar".
  window.pwOnConsent = function (cb) {
    if (typeof cb !== 'function') return;
    if (window.pwConsent() === 'granted') { try { cb(); } catch (e) {} return; }
    window.addEventListener('pw-consent-change', function h(e) {
      if (e && e.detail && e.detail.value === 'granted') {
        window.removeEventListener('pw-consent-change', h);
        try { cb(); } catch (_) {}
      }
    });
  };

  function decide(v) { window.__pwConsent = v; save(v); emit(v); removeBar(); }
  function removeBar() { var b = document.getElementById('pw-consent-bar'); if (b && b.parentNode) b.parentNode.removeChild(b); }

  function buildBar() {
    if (document.getElementById('pw-consent-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'pw-consent-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Aviso de cookies');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;' +
      'max-width:720px;margin:0 auto;background:#fff;border:1px solid rgba(45,106,79,.22);' +
      'box-shadow:0 10px 34px rgba(0,0,0,.16);border-radius:14px;padding:15px 18px;' +
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;' +
      'display:flex;gap:14px;align-items:center;flex-wrap:wrap';
    bar.innerHTML =
      '<div style="flex:1;min-width:220px;font-size:13.5px;line-height:1.5">' +
        '🍪 Usamos cookies propias y de terceros (Meta, LinkedIn) para medir nuestras ' +
        'campañas y mejorar la web. Podés aceptarlas o rechazarlas. ' +
        '<a href="/privacidad.html" style="color:#2D6A4F;font-weight:600;text-decoration:underline">Más info</a>.' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-shrink:0">' +
        '<button type="button" id="pw-consent-no" style="padding:9px 16px;border-radius:10px;' +
          'border:1.5px solid rgba(45,106,79,.3);background:#fff;color:#2D6A4F;font-weight:600;' +
          'font-size:13px;cursor:pointer;font-family:inherit">Rechazar</button>' +
        '<button type="button" id="pw-consent-yes" style="padding:9px 20px;border-radius:10px;' +
          'border:0;background:#2D6A4F;color:#fff;font-weight:700;font-size:13px;cursor:pointer;' +
          'font-family:inherit">Aceptar</button>' +
      '</div>';
    (document.body || document.documentElement).appendChild(bar);
    document.getElementById('pw-consent-yes').addEventListener('click', function () { decide('granted'); });
    document.getElementById('pw-consent-no').addEventListener('click', function () { decide('denied'); });
  }

  // Reabrir el banner (para un link "Preferencias de cookies").
  window.pwOpenConsent = function () { buildBar(); };

  // Arranque: si ya hay decisión, re-emitimos el estado (por si pw-pixel.js se
  // registró antes de este script) y no molestamos con el banner. Si no, lo mostramos.
  var cur = get();
  if (cur) {
    emit(cur);
  } else if (document.body) {
    buildBar();
  } else {
    document.addEventListener('DOMContentLoaded', buildBar);
  }
})();
