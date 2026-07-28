/* ============================================================================
   pw-cli-chrome.js — Gestos del cromo unificado del cliente (móvil).
   · Pasar de página deslizando de costado (izq = siguiente, der = anterior).
   · Cerrar una hoja (dropdown) deslizando hacia abajo.
   El portal declara window.PWCLI ANTES de cargar este script:
     PWCLI.pages()   -> array de ids de página en orden (las solapas visibles)
     PWCLI.current() -> id de la página actual
     PWCLI.go(id)    -> navegar a esa página
     PWCLI.blocked() -> (opcional) true si NO hay que capturar el swipe (menú abierto…)
     PWCLI.sheets    -> (opcional) array de selectores de hojas que cierran al deslizar
     PWCLI.sheetClose(el) -> (opcional) cómo cerrar esa hoja
   Todo defensivo: si algo falta, no rompe el portal.
   ============================================================================ */
(function(){
  var C = window.PWCLI = window.PWCLI || {};
  function mobile(){ return window.innerWidth <= 900; }

  /* ── Pasar de página de costado ── */
  function pages(){ try{ return (C.pages && C.pages()) || []; }catch(e){ return []; } }
  function cur(){ try{ return C.current && C.current(); }catch(e){ return null; } }
  function scrollActiveIntoView(){
    try{ var t = document.querySelector('.pwc-tab.on'); if(t && t.scrollIntoView) t.scrollIntoView({inline:'center', block:'nearest', behavior:'smooth'}); }catch(e){}
  }
  function nav(dir){
    var p = pages(); if(!p.length) return;
    var i = p.indexOf(cur()); if(i < 0) i = 0;
    var j = i + dir; if(j < 0 || j >= p.length) return;   // sin dar la vuelta
    try{ C.go && C.go(p[j]); }catch(e){}
    setTimeout(scrollActiveIntoView, 40);
  }
  // Al tocar una solapa, centrarla en la tira (por si hay que hacer scroll de tabs).
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('.pwc-tab');
    if(t) setTimeout(scrollActiveIntoView, 40);
  }, true);
  var x0=0, y0=0, t0=0, track=false;
  document.addEventListener('touchstart', function(e){
    track = false;
    if(!mobile() || e.touches.length !== 1) return;
    try{ if(C.blocked && C.blocked()) return; }catch(e2){}
    var t = e.target;
    if(t.closest && t.closest('input,textarea,select,button,a,label,[data-noswipe],.pwc-tabs,.rm-row,.dl-switch,.pnotif-dd,[style*="overflow-x"]')) return;
    var tt = e.touches[0]; x0 = tt.clientX; y0 = tt.clientY; t0 = Date.now(); track = true;
  }, {passive:true});
  document.addEventListener('touchend', function(e){
    if(!track) return; track = false;
    var tt = e.changedTouches[0], dx = tt.clientX - x0, dy = tt.clientY - y0, dt = Date.now() - t0;
    if(dt > 600 || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.7) return;
    nav(dx < 0 ? 1 : -1);
  }, {passive:true});

  /* ── Cerrar una hoja deslizando hacia abajo ── */
  function wireSheet(sel){
    var panel = document.querySelector(sel); if(!panel || panel._grabWired) return; panel._grabWired = true;
    var startY = 0, drag = false;
    panel.addEventListener('touchstart', function(e){
      drag = false; if(!mobile() || e.touches.length !== 1) return;
      var r = panel.getBoundingClientRect();
      if(e.touches[0].clientY - r.top > 74) return;    // solo desde la franja de arriba
      startY = e.touches[0].clientY; drag = true; panel.style.transition = 'none';
    }, {passive:true});
    panel.addEventListener('touchmove', function(e){
      if(!drag) return; var d = e.touches[0].clientY - startY; if(d > 0) panel.style.transform = 'translateY(' + d + 'px)';
    }, {passive:true});
    panel.addEventListener('touchend', function(e){
      if(!drag) return; drag = false;
      var d = e.changedTouches[0].clientY - startY; panel.style.transition = 'transform .2s ease';
      if(d > 80){ panel.style.transform = 'translateY(110%)'; setTimeout(function(){
        panel.style.transform = ''; panel.style.transition = '';
        try{ (C.sheetClose ? C.sheetClose(panel) : (panel.classList.remove('open'), panel.style.display='none')); }catch(_){}
      }, 190); }
      else { panel.style.transform = 'translateY(0)'; setTimeout(function(){ panel.style.transform=''; panel.style.transition=''; }, 200); }
    }, {passive:true});
  }
  function wireAll(){ try{ (C.sheets || []).forEach(wireSheet); }catch(e){} }
  if(document.readyState !== 'loading') wireAll(); else document.addEventListener('DOMContentLoaded', wireAll);
  C._wireSheets = wireAll; // por si el portal agrega hojas después
})();
