/* ============================================================================
   pw-i18n-panel.js — Traducción ES↔EN del PANEL DEL COACH (panel-v2.html).
   ---------------------------------------------------------------------------
   Método liviano (sin tocar las ~1000 cadenas inline): un DICCIONARIO
   español→inglés + un BARRIDO del DOM que reemplaza el texto visible al vuelo.
   - Base = español (el HTML se escribe en español). Solo se traduce a inglés.
   - Cubre lo estático Y lo dinámico: un MutationObserver re-barre lo que el
     panel dibuja después (tarjetas, listas, toasts…).
   - Bidireccional: al volver a español, revierte con el mapa inverso.
   - Seguro: si una cadena NO está en el diccionario, queda como está (no rompe
     nada). Nunca toca datos (nombres de coach/cliente, emails, números): esos
     no están en el diccionario, así que no matchean.
   Selector: botones "Español / English" en el menú de cuenta (#pw-usermenu-panel).
   Fuente de verdad del idioma: localStorage 'pw_lang' (compartido con los
   portales del cliente y la landing).
   ============================================================================ */
(function(){
  'use strict';

  // ── DICCIONARIO español → inglés (generado; ver scripts de build) ──
  // Claves = texto EXACTO visible en español (ya sin entidades HTML ni espacios
  // de sobra). Valores = inglés natural.
  var DICT = window.PW_PANEL_DICT || {
    /*__DICT__*/
  };

  // Mapa inverso (inglés → español) para revertir al volver a español.
  var _rev = null;
  function rev(){
    if(_rev) return _rev;
    _rev = {};
    for(var k in DICT){ if(DICT.hasOwnProperty(k)){ var v=DICT[k]; if(v && !(v in _rev)) _rev[v]=k; } }
    return _rev;
  }

  // ── Idioma actual ──
  var LANG = 'es';
  try{
    var s = localStorage.getItem('pw_lang');
    if(s==='es' || s==='en') LANG = s;
    else { var n=(navigator.language||navigator.userLanguage||'es').toLowerCase(); LANG = n.indexOf('en')===0 ? 'en' : 'es'; }
  }catch(e){}

  var ATTRS = ['placeholder','title','aria-label','aria-placeholder'];
  var SKIP_TAGS = {SCRIPT:1,STYLE:1,NOSCRIPT:1,TEMPLATE:1,CODE:1,PRE:1,svg:1,path:1,SVG:1,PATH:1};

  // Traduce una cadena cruda respetando espacios y (opcional) un prefijo de
  // símbolos/emoji al inicio (ej. "⚙️ Módulos" → "⚙️ Modules").
  function conv(map, raw){
    if(!raw) return null;
    var t = raw.trim();
    if(!t) return null;
    if(map.hasOwnProperty(t)) return raw.replace(t, map[t]);
    // Fallback: separar prefijo no-alfabético (emoji, flecha, símbolo).
    var m;
    try{ m = t.match(/^([^\p{L}\d]+)(.+)$/u); }catch(e){ m = t.match(/^([^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+)(.+)$/); }
    if(m && map.hasOwnProperty(m[2])) return raw.replace(t, m[1] + map[m[2]]);
    return null;
  }

  function skip(node){
    var p = node.parentNode;
    while(p && p.nodeType===1){
      if(SKIP_TAGS[p.nodeName]) return true;
      if(p.hasAttribute && p.hasAttribute('data-no-i18n')) return true;
      p = p.parentNode;
    }
    return false;
  }

  // Barre un subárbol traduciendo con `map` (es→en o en→es).
  function sweep(root, map){
    if(!root) return;
    try{
      // 1) Nodos de texto.
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode:function(n){
          if(!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if(skip(n)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var n;
      while((n = walker.nextNode())){
        var r = conv(map, n.nodeValue);
        if(r !== null && r !== n.nodeValue) n.nodeValue = r;
      }
    }catch(e){}
    // 2) Atributos (placeholder, title, aria-label…).
    try{
      var sel = '[placeholder],[title],[aria-label],[aria-placeholder]';
      var els = root.querySelectorAll ? root.querySelectorAll(sel) : [];
      for(var i=0;i<els.length;i++){
        var el = els[i];
        if(el.hasAttribute('data-no-i18n') || (el.closest && el.closest('[data-no-i18n]'))) continue;
        for(var a=0;a<ATTRS.length;a++){
          var av = el.getAttribute(ATTRS[a]); if(!av) continue;
          var rr = conv(map, av);
          if(rr !== null && rr !== av) el.setAttribute(ATTRS[a], rr);
        }
      }
      // El propio root también puede tener atributos.
      if(root.nodeType===1 && !(root.hasAttribute && root.hasAttribute('data-no-i18n'))){
        for(var b=0;b<ATTRS.length;b++){
          var rav = root.getAttribute && root.getAttribute(ATTRS[b]); if(!rav) continue;
          var rrr = conv(map, rav);
          if(rrr !== null && rrr !== rav) root.setAttribute(ATTRS[b], rrr);
        }
      }
    }catch(e){}
  }

  var _active = (LANG === 'en');   // ¿estamos traduciendo a inglés?
  var _obs = null, _queue = [], _raf = 0;

  function flush(){
    _raf = 0;
    if(!_active) return;
    var nodes = _queue; _queue = [];
    for(var i=0;i<nodes.length;i++) sweep(nodes[i], DICT);
  }

  function startObserver(){
    if(_obs || typeof MutationObserver==='undefined') return;
    _obs = new MutationObserver(function(muts){
      if(!_active) return;
      for(var i=0;i<muts.length;i++){
        var m = muts[i];
        if(m.type==='childList' && m.addedNodes){
          for(var j=0;j<m.addedNodes.length;j++){
            var nd = m.addedNodes[j];
            if(nd.nodeType===1 || nd.nodeType===3) _queue.push(nd);
          }
        } else if(m.type==='characterData'){
          _queue.push(m.target);
        }
      }
      if(_queue.length && !_raf) _raf = (window.requestAnimationFrame||setTimeout)(flush, 0);
    });
    try{ _obs.observe(document.body, {childList:true, subtree:true, characterData:true}); }catch(e){}
  }

  // Estilo del selector según idioma activo.
  function paintBtns(){
    var es = document.getElementById('pw-lang-es');
    var en = document.getElementById('pw-lang-en');
    if(es){ es.style.background = LANG==='es' ? 'var(--pw-carbon,#1f2a23)' : 'transparent'; es.style.color = LANG==='es' ? '#fff' : 'var(--pw-text-soft,#5A6A60)'; es.setAttribute('aria-pressed', LANG==='es'); }
    if(en){ en.style.background = LANG==='en' ? 'var(--pw-carbon,#1f2a23)' : 'transparent'; en.style.color = LANG==='en' ? '#fff' : 'var(--pw-text-soft,#5A6A60)'; en.setAttribute('aria-pressed', LANG==='en'); }
  }

  // API pública: cambiar idioma.
  window.pwPanelSetLang = function(l){
    if(l!=='es' && l!=='en') return;
    if(l===LANG){ paintBtns(); return; }
    LANG = l;
    try{ localStorage.setItem('pw_lang', l); }catch(e){}
    try{ document.documentElement.lang = l; }catch(e){}
    if(l==='en'){ _active = true; sweep(document.body, DICT); startObserver(); }
    else { _active = false; sweep(document.body, rev()); }   // revertir a español
    paintBtns();
  };
  window.pwPanelGetLang = function(){ return LANG; };

  function boot(){
    try{ document.documentElement.lang = LANG; }catch(e){}
    paintBtns();
    if(LANG==='en'){ _active = true; sweep(document.body, DICT); startObserver(); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
