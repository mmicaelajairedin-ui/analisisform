// ── Biblioteca de recursos UNIFICADA de Pathway ──────────────────────────────
// Un solo componente para los 3 nichos (carrera, fitness, finanzas). Toma la
// lista de recursos del coach (o los de ejemplo) y arma la biblioteca completa:
// buscador, filtros por tipo, orden, tarjetas con portada + badges, guardar
// (bookmark) y barra de progreso ("X de N · % completado").
//
// Uso:
//   PwRecursos.render(hostEl, recursos, {
//     clientKey: 'email-o-id',   // para guardar bookmarks/vistos por cliente
//     accent: '#2D6A4F',         // color de marca
//     coachName: 'Gonza',        // para el subtítulo
//     title: 'Recursos'
//   });
//
// recursos: [{ titulo, url, descripcion?, tipo?, semana?, cover?, destacado?, nuevo?, meta? }]
//   tipo?  : 'video'|'pdf'|'plantilla'|'ejercicio'|'articulo' (si falta, se deduce)
//   cover? : URL de imagen de portada (si falta: miniatura de YouTube o degradado)
//   meta?  : etiqueta en la portada (ej. "8:24", "18 págs."); si falta, se omite
//
// Bookmarks y "vistos" se guardan en localStorage por cliente (sin base de
// datos). El progreso es la proporción de recursos marcados como vistos.

(function(){
  var TYPES = {
    video:     { label:'Video',      chip:'Videos',        emoji:'🎬', grad:'linear-gradient(135deg,#F2685E,#C0392B)', action:'Ver ahora',    aico:'▶' },
    pdf:       { label:'PDF',        chip:'Guías y PDFs',   emoji:'📄', grad:'linear-gradient(135deg,#5AB48A,#2D6A4F)', action:'Descargar',    aico:'↓' },
    plantilla: { label:'Plantilla',  chip:'Plantillas',     emoji:'📋', grad:'linear-gradient(135deg,#9B87D4,#5B4B9E)', action:'Descargar',    aico:'↓' },
    ejercicio: { label:'Ejercicio',  chip:'Ejercicios',     emoji:'🏋️', grad:'linear-gradient(135deg,#5B9BD5,#2C6E9E)', action:'Ver ejercicio',aico:'→' },
    articulo:  { label:'Artículo',   chip:'Artículos',      emoji:'📰', grad:'linear-gradient(135deg,#E8B04B,#C99A2E)', action:'Leer',         aico:'→' }
  };
  var CHIP_ORDER = ['video','pdf','plantilla','ejercicio','articulo'];

  function esc(s){ return (''+(s==null?'':s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _hash(s){ var h=5381,i=(''+s).length; while(i) h=(h*33)^(''+s).charCodeAt(--i); return (h>>>0).toString(36); }

  // id de video de YouTube (watch?v=, youtu.be/, /embed/). Las URL de búsqueda
  // (results?search_query=) NO tienen id → no hay miniatura, se usa el degradado.
  function _ytId(u){
    u=''+(u||'');
    var m=u.match(/[?&]v=([A-Za-z0-9_-]{11})/) || u.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || u.match(/\/embed\/([A-Za-z0-9_-]{11})/) || u.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
    return m?m[1]:'';
  }
  function _deduceTipo(r){
    if(r.tipo && TYPES[r.tipo]) return r.tipo;
    var t=((r.titulo||'')+' '+(r.url||'')).toLowerCase();
    if(/youtu|vimeo|\bvideo\b|watch|\.mp4|reel/.test(t)) return 'video';
    if(/plantilla|template|planilla|formato/.test(t)) return 'plantilla';
    if(/pdf|\bgu[ií]a\b|ebook|libro|drive\.google|\.docx?\b|checklist|descarg/.test(t)) return 'pdf';
    if(/ejercicio|rutina|entren|t[eé]cnica|estira|movil|cardio|fuerza|\bgym\b/.test(t)) return 'ejercicio';
    return 'articulo';
  }
  function _host(u){ try{ return new URL(u).hostname.replace(/^www\./,''); }catch(e){ return ''; } }

  function render(host, resources, opts){
    if(!host) return;
    opts=opts||{};
    var accent=opts.accent||'#2D6A4F';
    var ckey=(''+(opts.clientKey||'anon')).toLowerCase();
    var STKEY='pw_rec_'+_hash(ckey);

    // Normalizar + deducir metadatos.
    var items=(resources||[]).map(function(r,i){
      r=r||{};
      var url=(''+(r.url||'')).trim(); var safe=/^https?:\/\//i.test(url)?url:'';
      var tipo=_deduceTipo(r);
      var yt=_ytId(safe);
      var cover=(r.cover&&(''+r.cover).trim())||'';
      var coverImg=cover || (yt?('https://i.ytimg.com/vi/'+yt+'/hqdefault.jpg'):'');
      return {
        id:_hash((r.titulo||'')+'|'+url+'|'+i),
        titulo:(r.titulo&&(''+r.titulo).trim())||url||'Recurso',
        desc:(r.descripcion&&(''+r.descripcion).trim())||'',
        url:safe, host:_host(safe),
        tipo:tipo, semana:(r.semana!=null&&(''+r.semana).trim())?(''+r.semana).trim():'',
        cover:coverImg, meta:(r.meta&&(''+r.meta).trim())||'',
        destacado:!!r.destacado, nuevo:!!r.nuevo, ord:i
      };
    }).filter(function(r){ return r.titulo || r.url; });

    if(!items.length){
      host.innerHTML='<div class="pwr-empty">Tu coach todavía no cargó recursos. Cuando lo haga, van a aparecer acá.</div>';
      _injectCss();
      return;
    }

    _injectCss();

    // Estado guardado (bookmarks + vistos) por cliente.
    function _store(){ try{ return JSON.parse(localStorage.getItem(STKEY)||'{}')||{}; }catch(e){ return {}; } }
    function _save(o){ try{ localStorage.setItem(STKEY, JSON.stringify(o)); }catch(e){} }
    var store=_store(); store.bm=store.bm||{}; store.seen=store.seen||{};

    var state={ q:'', cat:'todos', sort:'recientes', soloGuardados:false };

    // Categorías presentes (para no mostrar filtros vacíos).
    var present={}; items.forEach(function(r){ present[r.tipo]=1; });
    var cats=['todos'].concat(CHIP_ORDER.filter(function(t){ return present[t]; }));

    function _visibles(){
      var q=state.q.trim().toLowerCase();
      var list=items.filter(function(r){
        if(state.cat!=='todos' && r.tipo!==state.cat) return false;
        if(state.soloGuardados && !store.bm[r.id]) return false;
        if(q && (r.titulo+' '+r.desc+' '+r.host).toLowerCase().indexOf(q)<0) return false;
        return true;
      });
      if(state.sort==='az') list.sort(function(a,b){ return a.titulo.localeCompare(b.titulo); });
      else list.sort(function(a,b){ return (b.nuevo-a.nuevo) || (b.destacado-a.destacado) || (a.ord-b.ord); });
      return list;
    }

    function _card(r){
      var T=TYPES[r.tipo]||TYPES.articulo;
      var seen=!!store.seen[r.id], bm=!!store.bm[r.id];
      var coverInner = r.cover
        ? '<img class="pwr-cov-img" src="'+esc(r.cover)+'" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'pwr-cov-fallback\')">'
        : '';
      var tags='<span class="pwr-tag pwr-tag-type" data-t="'+r.tipo+'">'+T.label+'</span>';
      if(r.semana) tags+='<span class="pwr-tag">Semana '+esc(r.semana)+'</span>';
      if(r.nuevo) tags+='<span class="pwr-tag pwr-tag-new">Nuevo</span>';
      else if(r.destacado) tags+='<span class="pwr-tag pwr-tag-star">Recomendada</span>';
      var metaBadge = r.meta ? '<span class="pwr-cov-meta">'+esc(r.meta)+'</span>' : '';
      var action = r.url
        ? '<a class="pwr-action" href="'+esc(r.url)+'" target="_blank" rel="noopener" data-act="open" data-id="'+r.id+'"><span aria-hidden="true" class="pwr-action-ic">'+T.aico+'</span> '+esc(T.action)+'</a>'
        : '<span class="pwr-action pwr-action-off">Sin enlace</span>';
      return '<article class="pwr-card'+(seen?' pwr-seen':'')+'" data-id="'+r.id+'">'+
        '<div class="pwr-cov '+(r.cover?'':'pwr-cov-fallback')+'" style="--g:'+T.grad+'">'+
          coverInner+
          '<span class="pwr-cov-emoji" aria-hidden="true">'+T.emoji+'</span>'+
          metaBadge+
          (seen?'<span class="pwr-cov-seen" title="Visto">✓</span>':'')+
        '</div>'+
        '<div class="pwr-body">'+
          '<h3 class="pwr-title">'+esc(r.titulo)+'</h3>'+
          (r.desc?'<p class="pwr-desc">'+esc(r.desc)+'</p>':(r.host?'<p class="pwr-desc pwr-host">'+esc(r.host)+'</p>':''))+
          '<div class="pwr-tags">'+tags+'</div>'+
          '<div class="pwr-foot">'+action+
            '<button class="pwr-bm'+(bm?' on':'')+'" data-act="bm" data-id="'+r.id+'" title="Guardar" aria-label="Guardar">'+
              '<svg viewBox="0 0 24 24" fill="'+(bm?'currentColor':'none')+'" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'+
            '</button>'+
          '</div>'+
        '</div>'+
      '</article>';
    }

    function paint(){
      var total=items.length, done=items.filter(function(r){ return store.seen[r.id]; }).length;
      var pct=total?Math.round(done/total*100):0;
      var sub=opts.coachName ? ('Material que preparó '+esc(opts.coachName)+' para acompañarte.') : 'Material de apoyo para tu proceso.';

      var chips=cats.map(function(c){
        var lbl=c==='todos'?'Todos':(TYPES[c]?TYPES[c].chip:c);
        return '<button class="pwr-chip'+(state.cat===c?' on':'')+'" data-act="cat" data-cat="'+c+'">'+esc(lbl)+'</button>';
      }).join('');

      var vis=_visibles();
      var grid = vis.length
        ? '<div class="pwr-grid">'+vis.map(_card).join('')+'</div>'
        : '<div class="pwr-empty">No hay recursos que coincidan con tu búsqueda.</div>';

      host.innerHTML=
        '<div class="pwr" style="--acc:'+esc(accent)+'">'+
          '<div class="pwr-head">'+
            '<div class="pwr-head-l"><h2 class="pwr-h2">'+esc(opts.title||'Recursos')+'</h2><p class="pwr-h-sub">'+sub+'</p></div>'+
            '<div class="pwr-prog">'+
              '<div class="pwr-prog-top"><span class="pwr-prog-lbl">Tu progreso</span><span class="pwr-prog-n">'+done+' de '+total+'</span></div>'+
              '<div class="pwr-prog-bar"><span style="width:'+pct+'%"></span></div>'+
              '<div class="pwr-prog-pct">'+pct+'% completado</div>'+
            '</div>'+
          '</div>'+
          '<div class="pwr-toolbar">'+
            '<div class="pwr-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>'+
              '<input type="search" class="pwr-search-in" placeholder="Buscar recursos…" value="'+esc(state.q)+'"></div>'+
            '<div class="pwr-chips">'+chips+'</div>'+
            '<button class="pwr-sort" data-act="sort">'+(state.sort==='az'?'A · Z':'Más recientes')+' <span aria-hidden="true">▾</span></button>'+
          '</div>'+
          grid+
        '</div>';

      _wire();
    }

    function _wire(){
      var root=host.querySelector('.pwr'); if(!root) return;
      var inp=root.querySelector('.pwr-search-in');
      if(inp) inp.addEventListener('input', function(){ state.q=inp.value; var g=host.querySelector('.pwr-grid,.pwr-empty'); _repaintGrid(); });
      root.addEventListener('click', function(ev){
        var el=ev.target.closest('[data-act]'); if(!el) return;
        var act=el.getAttribute('data-act');
        if(act==='cat'){ state.cat=el.getAttribute('data-cat'); paint(); return; }
        if(act==='sort'){ state.sort=(state.sort==='az'?'recientes':'az'); paint(); return; }
        if(act==='bm'){ ev.preventDefault(); var id=el.getAttribute('data-id'); if(store.bm[id]) delete store.bm[id]; else store.bm[id]=1; _save(store); el.classList.toggle('on'); var sv=el.querySelector('svg'); if(sv) sv.setAttribute('fill', el.classList.contains('on')?'currentColor':'none'); return; }
        if(act==='open'){ var oid=el.getAttribute('data-id'); if(!store.seen[oid]){ store.seen[oid]=1; _save(store); paint(); } return; }
      });
    }
    // Repintar SOLO la grilla (para no perder foco del buscador al tipear).
    function _repaintGrid(){
      var vis=_visibles();
      var cur=host.querySelector('.pwr-grid,.pwr-empty'); if(!cur) return;
      var html = vis.length ? '<div class="pwr-grid">'+vis.map(_card).join('')+'</div>' : '<div class="pwr-empty">No hay recursos que coincidan con tu búsqueda.</div>';
      cur.outerHTML=html;
    }

    paint();
  }

  function _injectCss(){
    if(document.getElementById('pw-rec-css')) return;
    var st=document.createElement('style'); st.id='pw-rec-css';
    st.textContent=[
      '.pwr{--acc:#2D6A4F;font-family:inherit;color:#1B2E26;}',
      '.pwr-empty{padding:26px 16px;text-align:center;color:#8a8a82;font-size:14px;background:#fff;border:1px solid rgba(45,106,79,.12);border-radius:14px;}',
      '.pwr-head{display:flex;gap:18px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px;}',
      '.pwr-h2{font-family:Fraunces,Georgia,serif;font-size:clamp(24px,4vw,32px);font-weight:600;letter-spacing:-.6px;margin:0;color:#1B2E26;}',
      '.pwr-h-sub{margin:3px 0 0;color:#6a7a70;font-size:13.5px;max-width:440px;line-height:1.5;}',
      /* Progreso: discreto pero útil (compacto, sin sombra). */
      '.pwr-prog{flex:0 0 auto;min-width:190px;background:#fff;border:1px solid rgba(45,106,79,.12);border-radius:12px;padding:10px 13px;}',
      '.pwr-prog-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;}',
      '.pwr-prog-lbl{font-size:11.5px;font-weight:600;color:#6a7a70;}.pwr-prog-n{font-size:12px;font-weight:700;color:var(--acc);}',
      '.pwr-prog-bar{height:6px;border-radius:99px;background:#EAF0EC;margin:7px 0 4px;overflow:hidden;}',
      '.pwr-prog-bar>span{display:block;height:100%;border-radius:99px;background:var(--acc);transition:width .4s;}',
      '.pwr-prog-pct{font-size:11px;color:#9aa89f;}',
      '.pwr-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px;}',
      '.pwr-search{flex:1;min-width:200px;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(45,106,79,.16);border-radius:11px;padding:0 12px;height:42px;color:#8a8a82;}',
      '.pwr-search svg{width:17px;height:17px;flex-shrink:0;}',
      '.pwr-search-in{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:14px;color:#1B2E26;height:100%;}',
      '.pwr-chips{display:flex;gap:7px;flex-wrap:wrap;}',
      '.pwr-chip{border:1px solid rgba(45,106,79,.18);background:#fff;color:#3a4a40;border-radius:99px;padding:8px 14px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:.12s;}',
      '.pwr-chip:hover{border-color:var(--acc);}',
      '.pwr-chip.on{background:var(--acc);color:#fff;border-color:var(--acc);}',
      '.pwr-sort{margin-left:auto;border:1px solid rgba(45,106,79,.18);background:#fff;color:#3a4a40;border-radius:11px;padding:9px 13px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;}',
      '.pwr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:16px;}',
      '.pwr-card{background:#fff;border:1px solid rgba(45,106,79,.12);border-radius:15px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s;}',
      '.pwr-card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(27,46,38,.10);}',
      /* Portada GRANDE: el ojo detecta el recurso al instante. */
      '.pwr-cov{position:relative;height:160px;background:var(--g,linear-gradient(135deg,#5AB48A,#2D6A4F));display:flex;align-items:center;justify-content:center;overflow:hidden;}',
      '.pwr-cov-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}',
      '.pwr-cov-emoji{font-size:46px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.28));opacity:0;}',
      '.pwr-cov-fallback .pwr-cov-emoji{opacity:1;}',
      '.pwr-cov-meta{position:absolute;right:8px;bottom:8px;background:rgba(20,28,24,.78);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:7px;}',
      '.pwr-cov-seen{position:absolute;left:8px;top:8px;width:22px;height:22px;border-radius:50%;background:var(--acc);color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25);}',
      '.pwr-body{padding:13px 14px 12px;display:flex;flex-direction:column;gap:8px;flex:1;}',
      '.pwr-title{font-size:14.5px;font-weight:700;line-height:1.3;margin:0;color:#1B2E26;}',
      '.pwr-desc{font-size:12.5px;color:#6a7a70;line-height:1.45;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.pwr-desc.pwr-host{color:#9aa89f;}',
      '.pwr-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;}',
      '.pwr-tag{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:6px;background:#EEF3EF;color:#4a5a50;}',
      '.pwr-tag-type[data-t=video]{background:#FCEBEA;color:#B23A2E;}',
      '.pwr-tag-type[data-t=pdf]{background:#E9F6EE;color:#217A4B;}',
      '.pwr-tag-type[data-t=plantilla]{background:#F0ECFA;color:#5B4B9E;}',
      '.pwr-tag-type[data-t=ejercicio]{background:#EAF2FF;color:#2C6E9E;}',
      '.pwr-tag-type[data-t=articulo]{background:#FBF3DE;color:#B5822A;}',
      '.pwr-tag-new{background:#E7F7EE;color:#1E9E5A;}.pwr-tag-star{background:#FDF1E3;color:#C98A2E;}',
      '.pwr-foot{display:flex;align-items:center;gap:8px;margin-top:6px;}',
      /* CTA grande: botón lleno, ocupa el ancho. */
      '.pwr-action{flex:1;background:var(--acc);color:#fff;font-size:13.5px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;border-radius:11px;transition:filter .12s,transform .12s;}',
      '.pwr-action:hover{filter:brightness(1.06);transform:translateY(-1px);text-decoration:none;}',
      '.pwr-action-ic{font-size:13px;}.pwr-action-off{flex:1;justify-content:center;background:#f0f2f0;color:#b9c2bc;font-weight:600;}',
      '.pwr-bm{flex-shrink:0;width:40px;height:40px;border-radius:11px;border:1px solid rgba(45,106,79,.16);background:#fff;color:#8a9a90;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
      '.pwr-bm svg{width:16px;height:16px;}.pwr-bm.on{color:var(--acc);border-color:var(--acc);}',
      '.pwr-seen{}',
      '@media(max-width:560px){.pwr-prog{width:100%;}.pwr-sort{margin-left:0;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  window.PwRecursos = { render: render };
})();
