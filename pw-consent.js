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

  // No mostrar banner de cookies en app nativa (iOS/Android) — no hay tracking,
  // así que no se necesita consentimiento de cookies.
  if (typeof window !== 'undefined') {
    if (window.pw_native) return;
    if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform) {
      try { if (window.Capacitor.isNativePlatform()) return; } catch (e) {}
    }
  }

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

  var _prevOverflow = '';
  function decide(v) { window.__pwConsent = v; save(v); emit(v); removeBar(); }
  function removeBar() {
    var b = document.getElementById('pw-consent-bar');
    if (b && b.parentNode) b.parentNode.removeChild(b);
    try { document.documentElement.style.overflow = _prevOverflow; } catch (e) {}
  }

  function buildBar() {
    if (document.getElementById('pw-consent-bar')) return;
    // Overlay centrado con fondo oscuro (modal) → más visible = más aceptaciones.
    var ov = document.createElement('div');
    ov.id = 'pw-consent-bar';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Aviso de cookies');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(20,30,25,.55);' +
      'display:flex;align-items:center;justify-content:center;padding:20px;' +
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;' +
      'opacity:0;transition:opacity .22s ease';
    ov.innerHTML =
      '<div style="background:#fff;max-width:440px;width:100%;border-radius:18px;' +
        'box-shadow:0 24px 60px rgba(0,0,0,.28);padding:28px 26px 22px;text-align:center;' +
        'transform:translateY(8px);transition:transform .22s ease">' +
        '<div style="font-size:40px;line-height:1;margin-bottom:10px">🍪</div>' +
        '<h3 style="margin:0 0 8px;font-size:19px;font-weight:700;color:#1B2E26">Tu privacidad</h3>' +
        '<p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#4A5A50">' +
          'Usamos cookies propias y de terceros (Meta, LinkedIn) para medir nuestras ' +
          'campañas y mejorar la web. Podés aceptarlas o rechazarlas — vos elegís. ' +
          '<a href="/privacidad.html" style="color:#2D6A4F;font-weight:600;text-decoration:underline">Más info</a>.' +
        '</p>' +
        '<div style="display:flex;gap:10px;flex-direction:column">' +
          '<button type="button" id="pw-consent-yes" style="width:100%;padding:13px;border-radius:12px;' +
            'border:0;background:#2D6A4F;color:#fff;font-weight:700;font-size:15px;cursor:pointer;' +
            'font-family:inherit">Aceptar cookies</button>' +
          '<button type="button" id="pw-consent-no" style="width:100%;padding:11px;border-radius:12px;' +
            'border:0;background:transparent;color:#7A8A80;font-weight:600;font-size:13px;cursor:pointer;' +
            'font-family:inherit">Rechazar</button>' +
        '</div>' +
      '</div>';
    var host = document.body || document.documentElement;
    host.appendChild(ov);
    try { _prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; } catch (e) {}
    // Animación de entrada suave.
    requestAnimationFrame(function () { ov.style.opacity = '1'; var c = ov.firstChild; if (c) c.style.transform = 'translateY(0)'; });
    document.getElementById('pw-consent-yes').addEventListener('click', function () { decide('granted'); });
    document.getElementById('pw-consent-no').addEventListener('click', function () { decide('denied'); });
    // Click en el fondo oscuro: no decide nada (forzamos una elección explícita).
    ov.addEventListener('click', function (e) { if (e.target === ov) { /* mantener el modal */ } });
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
