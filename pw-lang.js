// pw-lang.js — Idioma ES/EN para las páginas públicas de Pathway.
//
// Hace 3 cosas:
//   1) DETECTA el idioma del visitante (por navegador) y lo manda a la versión
//      correcta — salvo que ya haya elegido a mano (queda guardado).
//   2) RECUERDA la elección en localStorage (pw_lang) y la respeta en todas
//      las páginas y en las próximas visitas.
//   3) Asegura un toggle EN/ES: engancha los links de idioma que ya existan
//      (para que persistan la elección) o, si la página no tiene ninguno,
//      inyecta un pequeño switcher flotante.
//
// Convención de archivos: la versión inglesa es "<nombre>-en.html"
//   index.html  ↔  index-en.html        (home se sirve en "/")
//   coaches.html ↔ coaches-en.html, etc.
//
// Incluir en el <head> (lo más arriba posible) de cada página bilingüe:
//   <script src="/pw-lang.js"></script>
(function () {
  function cleanPath(p) { return (p === '/' || p === '') ? '/index.html' : p; }
  function pretty(p) { return p === '/index.html' ? '/' : p; }

  var file = cleanPath(location.pathname);
  var isEN = /-en\.html$/.test(file);
  var cpPath = isEN ? file.replace(/-en\.html$/, '.html') : file.replace(/\.html$/, '-en.html');
  var cpURL = pretty(cpPath) + location.search + location.hash;          // a dónde ir al cambiar de idioma
  var selfURL = pretty(file) + location.search + location.hash;

  // ── 1 + 2) Detección / preferencia guardada ──────────────────────
  var stored = '';
  try { stored = localStorage.getItem('pw_lang') || ''; } catch (e) {}
  var nav = (navigator.language || navigator.userLanguage || 'es').toLowerCase().slice(0, 2);
  var want = stored || (nav === 'es' ? 'es' : 'en');

  // Persistir el idioma detectado para que el resto del sitio y los emails
  // (que leen pw_lang) sigan el mismo idioma, aunque no haya tocado el toggle.
  if (!stored) { try { localStorage.setItem('pw_lang', want); } catch (e) {} }

  if (want === 'en' && !isEN) { location.replace(cpURL); return; }
  if (want === 'es' && isEN) { location.replace(cpURL); return; }

  // ── 3) Toggle ────────────────────────────────────────────────────
  function setLang(lng) {
    try { localStorage.setItem('pw_lang', lng); } catch (e) {}
    var goEN = (lng === 'en');
    location.href = (goEN === isEN) ? selfURL : cpURL;
  }
  window.pwSetLang = setLang;

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(function () {
    var cpAbs = pretty(cpPath);
    var found = false;
    // Enganchar cualquier link que ya apunte a la versión en el otro idioma,
    // para que al hacer click quede guardada la preferencia (y no rebote).
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
      var hp = (a.getAttribute('href') || '').replace(/[#?].*$/, '');
      if (hp === '') hp = '/';
      if (hp === cpAbs) {
        a.addEventListener('click', function () {
          try { localStorage.setItem('pw_lang', isEN ? 'es' : 'en'); } catch (e) {}
        });
        found = true;
      }
    });
    if (found) return;

    // Si no había ningún link de idioma, inyectar un switcher flotante.
    var d = document.createElement('div');
    d.setAttribute('aria-label', 'Language / Idioma');
    d.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;display:flex;gap:4px;font-family:Inter,-apple-system,sans-serif;';
    function btn(l, label) {
      var on = (l === 'en') === isEN;
      return '<button data-l="' + l + '" style="padding:4px 10px;font-size:11px;font-weight:600;border-radius:20px;border:1.5px solid rgba(45,106,79,.2);background:' + (on ? '#2D6A4F' : '#fff') + ';color:' + (on ? '#fff' : '#7a857f') + ';cursor:pointer;box-shadow:0 2px 8px rgba(27,46,38,.12)">' + label + '</button>';
    }
    d.innerHTML = btn('es', 'ES') + btn('en', 'EN');
    d.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-l]') : null;
      if (b) setLang(b.getAttribute('data-l'));
    });
    document.body.appendChild(d);
  });
})();
