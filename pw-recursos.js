// ── Biblioteca de recursos UNIFICADA de Pathway ──────────────────────────────
// Un solo componente para los 3 nichos (carrera, fitness, finanzas). Toma la
// lista de recursos del coach (o del owner de la red) y arma la biblioteca:
// buscador, filtros por tipo, orden, tarjetas premium con portada + badge,
// guardar (bookmark) y bloque de progreso ("X de N recursos completados").
//
// Estilo premium (Notion/Linear): portada = miniatura real (YouTube / cover del
// coach) o, si no hay, un degradado MUY suave (paleta Pathway: verde/verde
// claro/beige/piedra) con un ícono LINEAL chico en un chip blanco. El tipo lo
// dice el BADGE, no el color de la portada.
//
// Uso:
//   PwRecursos.render(hostEl, recursos, {
//     clientKey:'email-o-id', accent:'#2D6A4F', coachName:'Gonza', title:'Recursos'
//   });
// recursos: [{ titulo, url, descripcion?, tipo?, semana?, cover?, destacado?, nuevo?, meta? }]

(function(){
  // Íconos lineales (stroke). Chicos, para que el TÍTULO gane peso.
  var ICONS={
    play:    '<circle cx="12" cy="12" r="9"/><path d="M10.2 8.4l5.4 3.6-5.4 3.6z" fill="currentColor" stroke="none"/>',
    doc:     '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    layout:  '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 10v10"/>',
    activity:'<path d="M22 12h-4l-3 8-6-16-3 8H2"/>',
    article: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    search:  '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>'
  };
  // Paleta reducida y coherente: solo verdes suaves, beige y piedra.
  var TONES={
    green: 'linear-gradient(135deg,#EAF3EC,#D8E9DD)',
    green2:'linear-gradient(135deg,#EDF4E9,#DBEAD2)',
    beige: 'linear-gradient(135deg,#F6F1E7,#ECE3D2)',
    stone: 'linear-gradient(135deg,#EFF1F0,#E1E6E3)'
  };
  // Ilustraciones LIMPIAS por tipo (estilo Pathway) — hacen de "portada" cuando
  // no hay imagen real (para video, la miniatura de YouTube manda). Son SVG
  // planos, on-brand, que llenan la tarjeta → se ven premium y cargan al instante.
  var ILLUS={
    video:'<rect x="33" y="24" width="94" height="60" rx="11" fill="#fff"/><rect x="33" y="24" width="94" height="60" rx="11" fill="#2D6A4F" opacity=".05"/><circle cx="80" cy="54" r="18" fill="#2D6A4F"/><path d="M75 45l15 9-15 9z" fill="#fff"/><rect x="46" y="92" width="68" height="6" rx="3" fill="#2D6A4F" opacity=".16"/>',
    pdf:'<rect x="52" y="18" width="56" height="74" rx="8" fill="#fff"/><path d="M96 18h4l8 8h-12z" fill="#E4D7BC"/><rect x="62" y="34" width="34" height="7" rx="3" fill="#2D6A4F" opacity=".82"/><rect x="62" y="48" width="30" height="4" rx="2" fill="#A7B2AB"/><rect x="62" y="57" width="34" height="4" rx="2" fill="#A7B2AB"/><rect x="62" y="66" width="24" height="4" rx="2" fill="#A7B2AB"/><rect x="62" y="78" width="22" height="8" rx="4" fill="#C99A2E" opacity=".55"/>',
    plantilla:'<rect x="38" y="24" width="84" height="62" rx="9" fill="#fff"/><rect x="47" y="33" width="66" height="11" rx="3" fill="#2D6A4F" opacity=".16"/><rect x="47" y="50" width="29" height="28" rx="5" fill="#2D6A4F" opacity=".12"/><rect x="84" y="50" width="29" height="28" rx="5" fill="#52B788" opacity=".28"/>',
    ejercicio:'<circle cx="80" cy="55" r="31" fill="#fff"/><path d="M58 55h9l6-16 11 30 6-14h12" stroke="#2D6A4F" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    articulo:'<rect x="46" y="22" width="68" height="66" rx="8" fill="#fff"/><rect x="55" y="31" width="40" height="9" rx="3" fill="#2D6A4F" opacity=".72"/><rect x="55" y="48" width="50" height="4" rx="2" fill="#A7B2AB"/><rect x="55" y="57" width="50" height="4" rx="2" fill="#A7B2AB"/><rect x="55" y="66" width="40" height="4" rx="2" fill="#A7B2AB"/><rect x="55" y="75" width="28" height="4" rx="2" fill="#A7B2AB"/>'
  };
  function _illus(tipo){ return '<svg class="pwr-illus" viewBox="0 0 160 110" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+(ILLUS[tipo]||ILLUS.articulo)+'</svg>'; }
  var TYPES = {
    video:     { label:'Video',      chip:'Videos',        action:'Ver ahora',     icon:'play',     tone:'green'  },
    pdf:       { label:'PDF',        chip:'Guías y PDFs',   action:'Descargar',     icon:'doc',      tone:'beige'  },
    plantilla: { label:'Plantilla',  chip:'Plantillas',     action:'Descargar',     icon:'layout',   tone:'stone'  },
    ejercicio: { label:'Ejercicio',  chip:'Ejercicios',     action:'Ver ejercicio', icon:'activity', tone:'green2' },
    articulo:  { label:'Artículo',   chip:'Artículos',      action:'Leer',          icon:'article',  tone:'beige'  }
  };
  var CHIP_ORDER = ['video','pdf','plantilla','ejercicio','articulo'];

  function esc(s){ return (''+(s==null?'':s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _hash(s){ var h=5381,i=(''+s).length; while(i) h=(h*33)^(''+s).charCodeAt(--i); return (h>>>0).toString(36); }
  function _icon(name,cls){ return '<svg class="'+(cls||'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[name]||ICONS.article)+'</svg>'; }

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
    // Preview real (og:image) — OPCIONAL, se activa si el portal pasa
    // opts.previewUrl (la Edge Function link-preview). Cache local por URL.
    var previewMode=!!(opts&&opts.previewUrl);
    var OGKEY='pw_og_v1', ogMap={};
    try{ ogMap=JSON.parse(localStorage.getItem(OGKEY)||'{}')||{}; }catch(e){ ogMap={}; }
    if(!ogMap||typeof ogMap!=='object') ogMap={};

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

    // Imagen real de un recurso: su portada propia / miniatura de YouTube, o la
    // og:image que trajo la Edge Function. "Todas o nada": solo mostramos fotos
    // reales si TODAS las tarjetas tienen una; si falta alguna, quedan las
    // ilustraciones (consistente). Fuera de previewMode, comportamiento actual.
    function _effCover(r){ return r.cover || (r.url && ogMap[r.url]) || ''; }
    function _allReal(){ for(var i=0;i<items.length;i++){ if(!_effCover(items[i])) return false; } return true; }
    // ¿Ya tenemos el dato de preview de TODOS? (cover propia, o la og:image ya
    // resuelta/cacheada). Hasta tenerlo, NO tocamos nada (mostramos lo de hoy) →
    // si la función no está desplegada, no hay regresión. Con el dato completo
    // aplicamos "todas o nada".
    function _haveAllData(){ for(var i=0;i<items.length;i++){ var r=items[i]; if(!(r.cover || !r.url || (r.url in ogMap))) return false; } return true; }

    _injectCss();

    if(!items.length){
      host.innerHTML='<div class="pwr" style="--acc:'+esc(accent)+'"><div class="pwr-empty">Tu coach todavía no cargó recursos. Cuando lo haga, van a aparecer acá.</div></div>';
      return;
    }

    function _store(){ try{ return JSON.parse(localStorage.getItem(STKEY)||'{}')||{}; }catch(e){ return {}; } }
    function _save(o){ try{ localStorage.setItem(STKEY, JSON.stringify(o)); }catch(e){} }
    var store=_store(); store.bm=store.bm||{}; store.seen=store.seen||{};

    var state={ q:'', cat:'todos', sort:'recientes' };
    var present={}; items.forEach(function(r){ present[r.tipo]=1; });
    var cats=['todos'].concat(CHIP_ORDER.filter(function(t){ return present[t]; }));

    function _visibles(){
      var q=state.q.trim().toLowerCase();
      var list=items.filter(function(r){
        if(state.cat!=='todos' && r.tipo!==state.cat) return false;
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
      // Previsualización AUTOMÁTICA: la portada siempre tiene el degradado suave
      // + una ilustración limpia por tipo (se genera sola). Si hay imagen real
      // (miniatura de YouTube o cover del coach) la superpone; si falla (onerror)
      // se quita y queda la ilustración → nunca queda rota ni vacía.
      var _real = (previewMode && _haveAllData()) ? (_allReal()?_effCover(r):'') : r.cover;
      var cov = '<div class="pwr-cov" style="background:'+TONES[T.tone]+'">'+
          _illus(r.tipo)+
          (_real?'<img class="pwr-cov-img" src="'+esc(_real)+'" alt="" loading="lazy" onerror="this.remove()">':'')+
          (r.meta?'<span class="pwr-cov-meta">'+esc(r.meta)+'</span>':'')+
          (seen?'<span class="pwr-cov-seen" title="Completado">✓</span>':'')+
        '</div>';
      var tags='<span class="pwr-tag pwr-tag-type">'+T.label+'</span>';
      if(r.nuevo) tags+='<span class="pwr-tag pwr-tag-new">Nuevo</span>';
      else if(r.destacado) tags+='<span class="pwr-tag pwr-tag-star">Recomendada</span>';
      if(r.semana) tags+='<span class="pwr-tag">Semana '+esc(r.semana)+'</span>';
      var action;
      if(!r.url){ action='<span class="pwr-action pwr-action-off">Sin enlace</span>'; }
      else if(seen){ action='<a class="pwr-action pwr-action-done" href="'+esc(r.url)+'" target="_blank" rel="noopener" data-act="open" data-id="'+r.id+'"><span class="pwr-chk">✓</span> Abrir de nuevo</a>'; }
      else { action='<a class="pwr-action pwr-action-go" href="'+esc(r.url)+'" target="_blank" rel="noopener" data-act="open" data-id="'+r.id+'">'+esc(T.action)+'</a>'; }
      return '<article class="pwr-card'+(seen?' is-done':'')+'" data-id="'+r.id+'">'+
        cov+
        '<div class="pwr-body">'+
          '<div class="pwr-tags">'+tags+'</div>'+
          '<h3 class="pwr-title">'+esc(r.titulo)+'</h3>'+
          (r.desc?'<p class="pwr-desc">'+esc(r.desc)+'</p>':(r.host?'<p class="pwr-desc pwr-host">'+esc(r.host)+'</p>':'')) +
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
          '<div class="pwr-head"><h2 class="pwr-h2">'+esc(opts.title||'Recursos')+'</h2><p class="pwr-h-sub">'+sub+'</p></div>'+
          '<div class="pwr-progband">'+
            '<div class="pwr-progband-top"><span class="pwr-progband-lbl">Tu progreso</span>'+
              '<span class="pwr-progband-n"><strong>'+done+'</strong> de '+total+' recursos completados</span></div>'+
            '<div class="pwr-progband-bar"><span style="width:'+pct+'%"></span></div>'+
          '</div>'+
          '<div class="pwr-toolbar">'+
            '<div class="pwr-search">'+_icon('search','pwr-search-ic')+
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
      if(inp) inp.addEventListener('input', function(){ state.q=inp.value; _repaintGrid(); });
      root.addEventListener('click', function(ev){
        var el=ev.target.closest('[data-act]'); if(!el) return;
        var act=el.getAttribute('data-act');
        if(act==='cat'){ state.cat=el.getAttribute('data-cat'); paint(); return; }
        if(act==='sort'){ state.sort=(state.sort==='az'?'recientes':'az'); paint(); return; }
        if(act==='bm'){ ev.preventDefault(); var id=el.getAttribute('data-id'); if(store.bm[id]) delete store.bm[id]; else store.bm[id]=1; _save(store); el.classList.toggle('on'); var sv=el.querySelector('svg'); if(sv) sv.setAttribute('fill', el.classList.contains('on')?'currentColor':'none'); return; }
        if(act==='open'){ var oid=el.getAttribute('data-id'); if(!store.seen[oid]){ store.seen[oid]=1; _save(store); setTimeout(paint,60); } return; }
      });
    }
    function _repaintGrid(){
      var vis=_visibles();
      var cur=host.querySelector('.pwr-grid,.pwr-empty'); if(!cur) return;
      var html = vis.length ? '<div class="pwr-grid">'+vis.map(_card).join('')+'</div>' : '<div class="pwr-empty">No hay recursos que coincidan con tu búsqueda.</div>';
      cur.outerHTML=html;
    }
    paint();

    // Preview real en 2º plano: pedimos la og:image de los recursos que todavía
    // no tienen imagen; si con eso TODAS quedan con foto, re-pintamos con las
    // reales (todas o nada). Cacheado; si falla, quedan las ilustraciones.
    if(previewMode){
      var _need=[]; items.forEach(function(r){ if(r.url && !r.cover && !(r.url in ogMap) && _need.indexOf(r.url)<0) _need.push(r.url); });
      if(_need.length){
        try{
          fetch(opts.previewUrl,{method:'POST',headers:{'Content-Type':'application/json',apikey:(opts.previewKey||''),Authorization:'Bearer '+(opts.previewKey||'')},body:JSON.stringify({urls:_need})})
            .then(function(rr){ return rr.ok?rr.json():null; })
            .then(function(res){
              if(!res||!res.previews) return;
              var changed=false;
              _need.forEach(function(u){ if(!(u in ogMap)){ ogMap[u]=res.previews[u]||''; changed=true; } });
              try{ localStorage.setItem(OGKEY, JSON.stringify(ogMap)); }catch(e){}
              if(changed) paint();
            }).catch(function(){});
        }catch(e){}
      }
    }
  }

  function _injectCss(){
    if(document.getElementById('pw-rec-css')) return;
    var st=document.createElement('style'); st.id='pw-rec-css';
    st.textContent=[
      '.pwr{--acc:#2D6A4F;font-family:inherit;color:#1B2E26;}',
      '.pwr-empty{padding:28px 16px;text-align:center;color:#8a8a82;font-size:14px;background:#fff;border:1px solid rgba(45,106,79,.12);border-radius:16px;}',
      '.pwr-head{margin-bottom:16px;}',
      '.pwr-h2{font-family:Fraunces,Georgia,serif;font-size:clamp(24px,4vw,32px);font-weight:600;letter-spacing:-.6px;margin:0;}',
      '.pwr-h-sub{margin:4px 0 0;color:#6a7a70;font-size:13.5px;line-height:1.5;}',
      /* Progreso PROMINENTE. */
      '.pwr-progband{background:#fff;border:1px solid rgba(45,106,79,.14);border-radius:14px;padding:15px 18px;margin-bottom:18px;}',
      '.pwr-progband-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:10px;flex-wrap:wrap;}',
      '.pwr-progband-lbl{font-weight:700;font-size:14.5px;color:#1B2E26;}',
      '.pwr-progband-n{font-size:13px;color:#6a7a70;}.pwr-progband-n strong{color:var(--acc);font-size:15px;}',
      '.pwr-progband-bar{height:11px;border-radius:99px;background:#EAF0EC;overflow:hidden;}',
      '.pwr-progband-bar>span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--acc),#6FB894);transition:width .5s;}',
      /* Toolbar. */
      '.pwr-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px;}',
      '.pwr-search{flex:1;min-width:200px;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(45,106,79,.16);border-radius:11px;padding:0 12px;height:42px;color:#9aa89f;}',
      '.pwr-search-ic{width:17px;height:17px;flex-shrink:0;}',
      '.pwr-search-in{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:14px;color:#1B2E26;height:100%;}',
      '.pwr-chips{display:flex;gap:7px;flex-wrap:wrap;}',
      '.pwr-chip{border:1px solid rgba(45,106,79,.18);background:#fff;color:#3a4a40;border-radius:99px;padding:8px 14px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:.12s;}',
      '.pwr-chip:hover{border-color:var(--acc);}.pwr-chip.on{background:var(--acc);color:#fff;border-color:var(--acc);}',
      '.pwr-sort{margin-left:auto;border:1px solid rgba(45,106,79,.18);background:#fff;color:#3a4a40;border-radius:11px;padding:9px 13px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;}',
      /* Grid + tarjetas premium. */
      '.pwr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,224px),1fr));gap:18px;}',
      '.pwr-card{background:#fff;border:1px solid rgba(45,106,79,.11);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s,border-color .15s;}',
      '.pwr-card:hover{transform:translateY(-3px);box-shadow:0 16px 32px rgba(27,46,38,.09);border-color:rgba(45,106,79,.2);}',
      '.pwr-card.is-done{background:#FCFDFC;}',
      /* Portada: imagen real o degradado suave + chip con ícono lineal (chico). */
      '.pwr-cov{position:relative;height:150px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#EEF3EF;}',
      '.pwr-illus{position:absolute;inset:0;width:100%;height:100%;display:block;}',
      '.pwr-cov-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}',
      '.pwr-cov-meta{position:absolute;right:9px;bottom:9px;background:rgba(20,28,24,.74);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:7px;}',
      '.pwr-cov-seen{position:absolute;left:9px;top:9px;min-width:22px;height:22px;padding:0 4px;border-radius:11px;background:var(--acc);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.2);}',
      '.pwr-cov-seen svg{display:none;}',
      /* Cuerpo con más aire. */
      '.pwr-body{padding:14px 15px 15px;display:flex;flex-direction:column;gap:10px;flex:1;}',
      '.pwr-tags{display:flex;gap:6px;flex-wrap:wrap;}',
      '.pwr-tag{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:7px;background:#EEF3EF;color:#4a5a50;letter-spacing:.2px;}',
      '.pwr-tag-type{background:#E7F0EA;color:#2D6A4F;}',
      '.pwr-tag-new{background:#E7F7EE;color:#1E9E5A;}.pwr-tag-star{background:#F3EDE1;color:#9A7B3A;}',
      '.pwr-title{font-size:15px;font-weight:700;line-height:1.32;margin:0;color:#1B2E26;}',
      '.pwr-desc{font-size:12.5px;color:#6a7a70;line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.pwr-desc.pwr-host{color:#9aa89f;}',
      '.pwr-foot{display:flex;align-items:center;gap:9px;margin-top:auto;padding-top:4px;}',
      /* Botón: verde SOLO si está pendiente; con borde + check si ya se abrió. */
      '.pwr-action{flex:1;font-size:13.5px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;border-radius:11px;transition:filter .12s,transform .12s,background .12s;}',
      '.pwr-action-go{background:var(--acc);color:#fff;}',
      '.pwr-action-go:hover{filter:brightness(1.06);transform:translateY(-1px);text-decoration:none;}',
      '.pwr-action-done{background:#fff;color:var(--acc);border:1.5px solid rgba(45,106,79,.35);}',
      '.pwr-action-done:hover{border-color:var(--acc);text-decoration:none;}',
      '.pwr-action-done .pwr-chk{font-weight:900;}',
      '.pwr-action-off{flex:1;justify-content:center;background:#f0f2f0;color:#b9c2bc;font-weight:600;}',
      '.pwr-bm{flex-shrink:0;width:40px;height:40px;border-radius:11px;border:1px solid rgba(45,106,79,.16);background:#fff;color:#9aa89f;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
      '.pwr-bm svg{width:16px;height:16px;}.pwr-bm.on{color:var(--acc);border-color:var(--acc);}',
      '@media(max-width:560px){.pwr-sort{margin-left:0;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // Portada de UN recurso (para preview en vivo en el editor del coach/owner).
  // Deduce tipo, usa la portada propia / miniatura de YouTube, o la ilustración.
  function coverHtml(r, o){
    o=o||{}; r=r||{};
    _injectCss();
    var tipo=_deduceTipo(r), T=TYPES[tipo]||TYPES.articulo;
    var url=(''+(r.url||'')).trim(), safe=/^https?:\/\//i.test(url)?url:'', yt=_ytId(safe);
    var cover=(r.cover&&(''+r.cover).trim()) || (o.image||'') || (yt?('https://i.ytimg.com/vi/'+yt+'/hqdefault.jpg'):'');
    var meta=(r.meta&&(''+r.meta).trim())||'';
    return '<div class="pwr-cov" style="background:'+TONES[T.tone]+';border-radius:12px'+(o.h?';height:'+o.h:'')+'">'+
      _illus(tipo)+
      (cover?'<img class="pwr-cov-img" src="'+esc(cover)+'" alt="" loading="lazy" onerror="this.remove()">':'')+
      (meta&&o.meta!==false?'<span class="pwr-cov-meta">'+esc(meta)+'</span>':'')+
    '</div>';
  }
  window.PwRecursos = { render: render, coverHtml: coverHtml };

  // ── Link preview para el CHAT (estilo WhatsApp, compacto) ──────────────────
  // Detecta un link en una burbuja de chat y le agrega una tarjetita chica con
  // la imagen real (og:image, vía la Edge Function) + el dominio. Se auto-activa
  // con un MutationObserver, así funciona en cualquier chat sin cablear cada uno.
  var _LP=null, _lpOG=null, _lpTO=null;
  var _LPURL=/(https?:\/\/[^\s<>"'()]+)/i;
  function _lpOGmap(){ if(_lpOG) return _lpOG; try{ _lpOG=JSON.parse(localStorage.getItem('pw_og_v1')||'{}')||{}; }catch(e){ _lpOG={}; } if(typeof _lpOG!=='object') _lpOG={}; return _lpOG; }
  function _lpCss(){
    if(document.getElementById('pw-lp-css')) return;
    var st=document.createElement('style'); st.id='pw-lp-css';
    st.textContent=[
      '.pwlp-card{display:flex;align-items:stretch;margin-top:6px;border:1px solid rgba(45,106,79,.16);border-radius:9px;overflow:hidden;text-decoration:none;background:rgba(255,255,255,.7);max-width:210px;}',
      '.pwlp-thumb{width:40px;flex-shrink:0;background:#EAF0EC;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#5b7a6a;}',
      '.pwlp-thumb img{width:100%;height:100%;object-fit:cover;}.pwlp-thumb svg{width:16px;height:16px;}',
      '.pwlp-body{min-width:0;flex:1;padding:5px 8px;display:flex;flex-direction:column;justify-content:center;gap:1px;}',
      '.pwlp-domain{font-size:10.5px;color:#2D6A4F;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25;}',
      '.pwlp-u{font-size:9.5px;color:#8a8a82;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25;}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function _lpFetch(url){
    var og=_lpOGmap();
    if(url in og) return Promise.resolve(og[url]);
    if(!_LP||!_LP.previewUrl) return Promise.resolve('');
    return fetch(_LP.previewUrl,{method:'POST',headers:{'Content-Type':'application/json',apikey:(_LP.previewKey||''),Authorization:'Bearer '+(_LP.previewKey||'')},body:JSON.stringify({urls:[url]})})
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(res){ var img=(res&&res.previews&&res.previews[url])||''; og[url]=img; try{ localStorage.setItem('pw_og_v1',JSON.stringify(og)); }catch(e){} return img; })
      .catch(function(){ return ''; });
  }
  function _lpEnrich(b){
    if(!b || b.getAttribute('data-pwlp')==='1') return;
    b.setAttribute('data-pwlp','1');
    var m=(b.textContent||'').match(_LPURL); if(!m) return;
    var url=m[1].replace(/[.,)]+$/,''); var host=_host(url); if(!host) return;
    _lpCss();
    var card=document.createElement('a'); card.className='pwlp-card'; card.href=url; card.target='_blank'; card.rel='noopener';
    card.innerHTML='<span class="pwlp-thumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg></span>'+
      '<span class="pwlp-body"><span class="pwlp-domain">'+esc(host)+'</span><span class="pwlp-u">'+esc(url.replace(/^https?:\/\//,'').slice(0,60))+'</span></span>';
    b.appendChild(card);
    _lpFetch(url).then(function(img){ if(!img) return; var th=card.querySelector('.pwlp-thumb'); if(th) th.innerHTML='<img src="'+esc(img)+'" alt="" onerror="this.remove()">'; });
  }
  function _lpScan(){ if(!_LP) return; var els=document.querySelectorAll(_LP.bubbleSel); for(var i=0;i<els.length;i++) _lpEnrich(els[i]); }
  function _lpInit(opts){
    if(!document.body){ document.addEventListener('DOMContentLoaded', function(){ _lpInit(opts); }); return; }
    _LP={ previewUrl:opts&&opts.previewUrl, previewKey:opts&&opts.previewKey, bubbleSel:(opts&&opts.bubbleSel)||'.pmsg' };
    _lpScan();
    try{ var obs=new MutationObserver(function(){ if(_lpTO) clearTimeout(_lpTO); _lpTO=setTimeout(_lpScan,140); }); obs.observe(document.body,{childList:true,subtree:true}); }catch(e){}
  }
  window.PwLinkPreview = { init:_lpInit, scan:_lpScan };
})();
