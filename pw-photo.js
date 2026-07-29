/* ============================================================================
   pw-photo.js — Fotos nítidas en los portales del cliente (avatares/fotos).
   Pide al CDN el recorte EXACTO al tamaño mostrado (×dpr) con máxima calidad y
   webp, así las fotos chicas no se ven borrosas/apagadas. Cubre Uploadcare y el
   Storage de Supabase (endpoint de transformación).

   SEGURO: nunca rompe ni deja en blanco una foto. Primero PRUEBA la versión
   mejorada en segundo plano (probe); solo si carga bien, reemplaza el src
   visible. Si el CDN no soporta la transformación, la foto original queda tal
   cual. Solo toca <img> con object-fit:cover (fotos recortadas = avatares), no
   ilustraciones/logos (la cabra, etc.).
   ============================================================================ */
(function(){
  'use strict';
  var DPR = 1; try{ DPR = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1))); }catch(e){}

  function targetSize(img){
    var r = img.getBoundingClientRect();
    return Math.round(Math.max(r.width, r.height));
  }

  // Devuelve la URL mejorada (sized + calidad + webp) o null si no aplica.
  function build(src, s){
    // Uploadcare: …/<uuid>/…  → scale_crop inteligente
    if(/ucarecd(n)?\.(net|com)/i.test(src)){
      var m = src.match(/^(https?:\/\/[^\/]+\/[0-9a-fA-F-]{36}\/)/);
      if(m) return m[1] + '-/scale_crop/' + s + 'x' + s + '/smart/-/quality/best/-/format/auto/';
      return null;
    }
    // Supabase Storage — objeto público → endpoint de transformación de imagen.
    var so = src.match(/^(https?:\/\/[^\/]+)\/storage\/v1\/object\/public\/([^?]+)/);
    if(so) return so[1] + '/storage/v1/render/image/public/' + so[2] + '?width=' + s + '&height=' + s + '&resize=cover&quality=82';
    // Ya es render/image → solo re-dimensiona.
    var sr = src.match(/^(.*\/storage\/v1\/render\/image\/public\/[^?]+)/);
    if(sr) return sr[1] + '?width=' + s + '&height=' + s + '&resize=cover&quality=82';
    return null;
  }

  function upgrade(img){
    try{
      if(img.dataset.pwq) return;                                   // ya evaluada
      if(getComputedStyle(img).objectFit !== 'cover') return;       // solo fotos recortadas
      var src = img.getAttribute('src') || '';
      if(!src || /^data:/i.test(src)) return;
      // Uploadcare ya recortado por _thumb() del panel → no re-procesar.
      if(/ucarecd(n)?\.(net|com)/i.test(src) && /-\/scale_crop\//.test(src)){ img.dataset.pwq='1'; return; }
      var s = targetSize(img);
      if(!s){ // todavía sin layout: reintentar en el próximo frame (una vez)
        if(!img.dataset.pwqr){ img.dataset.pwqr = '1'; requestAnimationFrame(function(){ upgrade(img); }); }
        return;
      }
      s = Math.max(48, s * DPR);
      var out = build(src, s);
      img.dataset.pwq = '1';
      if(!out || out === src) return;
      // Probe: cargar la versión mejorada en segundo plano; recién si carga OK,
      // reemplazar la visible. Nunca rompe la foto original.
      var probe = new Image();
      probe.onload = function(){ if(img.getAttribute('src') === src) img.src = out; };
      probe.onerror = function(){ /* transformación no disponible → dejar original */ };
      probe.src = out;
    }catch(e){}
  }

  // ── Redimensionar una foto ANTES de subirla (garantiza nitidez + peso liviano
  //    aunque el CDN no transforme). Devuelve un Blob JPEG; si algo falla, el
  //    archivo original. Ignora gif/svg. ────────────────────────────────────────
  window.pwResizeImage = function(file, max){
    max = max || 720;
    return new Promise(function(resolve){
      try{
        if(!file || !/^image\//i.test(file.type||'') || /gif|svg/i.test(file.type||'')){ resolve(file); return; }
        var url = URL.createObjectURL(file), im = new Image();
        im.onload = function(){
          try{
            var w = im.naturalWidth, h = im.naturalHeight;
            if(!w || !h || Math.max(w,h) <= max){ URL.revokeObjectURL(url); resolve(file); return; }
            var sc = max / Math.max(w,h), cw = Math.round(w*sc), ch = Math.round(h*sc);
            var c = document.createElement('canvas'); c.width = cw; c.height = ch;
            var ctx = c.getContext('2d'); try{ ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }catch(e){}
            ctx.drawImage(im, 0, 0, cw, ch);
            c.toBlob(function(b){ URL.revokeObjectURL(url); resolve((b && b.size) ? b : file); }, 'image/jpeg', 0.9);
          }catch(e){ URL.revokeObjectURL(url); resolve(file); }
        };
        im.onerror = function(){ URL.revokeObjectURL(url); resolve(file); };
        im.src = url;
      }catch(e){ resolve(file); }
    });
  };

  function scan(root){ try{ (root || document).querySelectorAll('img').forEach(upgrade); }catch(e){} }
  function boot(){
    scan();
    try{
      var mo = new MutationObserver(function(muts){
        for(var i=0;i<muts.length;i++){ var a = muts[i].addedNodes; if(!a) continue;
          for(var j=0;j<a.length;j++){ var n = a[j]; if(n.nodeType !== 1) continue;
            if(n.tagName === 'IMG') upgrade(n);
            else if(n.querySelectorAll) n.querySelectorAll('img').forEach(upgrade);
          } }
      });
      mo.observe(document.body || document.documentElement, {childList:true, subtree:true});
    }catch(e){}
  }
  if(document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
