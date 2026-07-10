// pw-dropzone.js — Drag & drop universal para TODA subida de archivos.
//
// Convierte automáticamente cada <input type="file"> de la página en una zona
// donde se puede SOLTAR el archivo (además del clic de siempre). No cambia la
// lógica de guardado: al soltar, le pasa el archivo al mismo <input> y dispara
// su evento "change", así corre el handler que ya existe (sube y guarda en el
// registro correcto). Cero riesgo de mezclar datos entre clientes/coaches.
//
// - Funciona con contenido dinámico (MutationObserver): si el panel redibuja y
//   crea inputs nuevos, se registran solos.
// - "Sin salirse": el cartel de arrastre es un overlay absoluto DENTRO de la
//   caja del input (no desborda el layout).
// - Respeta el atributo accept del input (imagen/pdf/etc.): si soltás un tipo
//   que no corresponde, no hace nada.
//
// Uso: <script src="pw-dropzone.js?v=1"></script>  (sin configuración)

(function(){
  'use strict';
  if (window.__pwDzLoaded) return;
  window.__pwDzLoaded = true;

  // Estilos (una sola vez).
  var css =
    '.pwdz-zone{position:relative;}' +
    '.pwdz-zone.pwdz-over{outline:2px dashed #2D6A4F;outline-offset:2px;border-radius:10px;}' +
    '.pwdz-ov{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:rgba(45,106,79,.10);color:#2D6A4F;font-weight:700;font-size:12px;' +
      'border-radius:10px;pointer-events:none;z-index:5;text-align:center;padding:4px;' +
      'font-family:inherit;-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px);}' +
    '.pwdz-zone.pwdz-over .pwdz-ov{display:flex;}';
  var st = document.createElement('style');
  st.id = 'pwdz-css';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  // ¿El archivo soltado matchea el accept del input? (imagen/*, .pdf, etc.)
  function accepts(input, file){
    var acc = (input.getAttribute('accept') || '').trim();
    if (!acc) return true;
    var name = (file.name || '').toLowerCase();
    var type = (file.type || '').toLowerCase();
    return acc.split(',').map(function(s){return s.trim().toLowerCase();}).some(function(rule){
      if (!rule) return false;
      if (rule.charAt(0) === '.') return name.slice(-rule.length) === rule;      // .pdf
      if (rule.slice(-2) === '/*') return type.indexOf(rule.slice(0,-1)) === 0;   // image/*
      return type === rule;                                                        // application/pdf
    });
  }

  // Deja el archivo dentro del input y dispara "change" (corre el handler real).
  function feed(input, file){
    try {
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    } catch(e) {
      // Navegador viejo sin DataTransfer asignable: no rompemos, el clic sigue.
      return false;
    }
    input.dispatchEvent(new Event('change', {bubbles:true}));
    return true;
  }

  function pickZone(input){
    // Preferimos el <label> que envuelve al input; si no, el contenedor padre.
    return input.closest('label') || input.parentElement || null;
  }

  function register(input){
    if (input.__pwdz) return;
    if (input.type !== 'file') return;
    if (input.disabled) return;
    var zone = pickZone(input);
    if (!zone) return;
    input.__pwdz = true;
    zone.classList.add('pwdz-zone');
    // El overlay necesita un contexto de posicionamiento.
    var pos = (window.getComputedStyle ? getComputedStyle(zone).position : '');
    if (pos === 'static' || !pos) zone.style.position = 'relative';
    if (!zone.querySelector('.pwdz-ov')) {
      var ov = document.createElement('div');
      ov.className = 'pwdz-ov';
      ov.textContent = 'Soltá el archivo aquí';
      zone.appendChild(ov);
    }

    var depth = 0; // dragenter/leave anidados
    zone.addEventListener('dragenter', function(e){
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types||[], 'Files') < 0) return;
      e.preventDefault(); depth++; zone.classList.add('pwdz-over');
    });
    zone.addEventListener('dragover', function(e){
      if (!e.dataTransfer) return;
      var t = e.dataTransfer.types || [];
      if (Array.prototype.indexOf.call(t, 'Files') < 0) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'copy'; } catch(_){}
    });
    zone.addEventListener('dragleave', function(){
      depth = Math.max(0, depth-1);
      if (depth === 0) zone.classList.remove('pwdz-over');
    });
    zone.addEventListener('drop', function(e){
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation();
      depth = 0; zone.classList.remove('pwdz-over');
      var file = null;
      for (var i=0;i<e.dataTransfer.files.length;i++){
        if (accepts(input, e.dataTransfer.files[i])) { file = e.dataTransfer.files[i]; break; }
      }
      if (!file) {
        // Tipo no aceptado: aviso breve, sin romper nada.
        zone.classList.add('pwdz-over');
        var ov = zone.querySelector('.pwdz-ov');
        if (ov){ var prev = ov.textContent; ov.textContent = 'Tipo de archivo no válido'; setTimeout(function(){ zone.classList.remove('pwdz-over'); ov.textContent = prev; }, 1400); }
        return;
      }
      feed(input, file);
    });
  }

  function scan(root){
    var nodes = (root || document).querySelectorAll ? (root||document).querySelectorAll('input[type="file"]') : [];
    for (var i=0;i<nodes.length;i++) register(nodes[i]);
  }

  // Evitar que soltar FUERA de una zona abra el archivo en el navegador.
  window.addEventListener('dragover', function(e){
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types||[], 'Files') >= 0) e.preventDefault();
  });
  window.addEventListener('drop', function(e){
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types||[], 'Files') >= 0) e.preventDefault();
  });

  function boot(){
    scan(document);
    // Contenido dinámico: registrar inputs nuevos a medida que aparecen.
    if (window.MutationObserver) {
      var mo = new MutationObserver(function(muts){
        for (var i=0;i<muts.length;i++){
          var added = muts[i].addedNodes;
          for (var j=0;j<added.length;j++){
            var n = added[j];
            if (n.nodeType !== 1) continue;
            if (n.matches && n.matches('input[type="file"]')) register(n);
            else if (n.querySelectorAll) scan(n);
          }
        }
      });
      mo.observe(document.body || document.documentElement, {childList:true, subtree:true});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
