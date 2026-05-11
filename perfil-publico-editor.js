// ────────────────────────────────────────────────────────────────────
// Perfil publico — editor en Configuracion del panel.
//
// Inyecta dos cards debajo de "Tu perfil":
//   1. "Perfil publico" — info basica (slug, titulo, tagline, mi enfoque,
//      especialidades, atiende, anios, activo)
//   2. "Servicios, links y videos" — marketplace (servicios con precio,
//      videos YouTube, links Linktree)
// ────────────────────────────────────────────────────────────────────

(function(){
  if(typeof window._renderConfig !== 'function')return;
  var origRender = window._renderConfig;
  var SB_URL='https://ddxnrsnjdvtqhxunxnwj.supabase.co';
  var SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

  function escH(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  function $(id){return document.getElementById(id);}

  var EDIT={ servicios:[], videos:[], links:[] };

  // Cada llamada a _renderConfig incrementa _seq. El poll y el fetch
  // chequean su mySeq vs _seq actual — si el coach cambio de tab o
  // re-cliqueo en General mientras este fetch estaba en vuelo, descartamos
  // este inject para que no se acumulen duplicados (era el bug de los 3x
  // "Perfil publico" / "Servicios, links y videos").
  var _seq=0;
  var _activePoll=null;

  window._renderConfig = function(){
    origRender.apply(this, arguments);
    if(_activePoll){clearInterval(_activePoll);_activePoll=null;}
    var mySeq=++_seq;
    var tries=0;
    _activePoll=setInterval(function(){
      tries++;
      if(mySeq!==_seq){clearInterval(_activePoll);_activePoll=null;return;}
      var bio=$('cfg-bio');
      if(bio){clearInterval(_activePoll);_activePoll=null;injectAll(bio,mySeq);}
      else if(tries>60){clearInterval(_activePoll);_activePoll=null;}
    },100);
  };

  function injectAll(bioEl,mySeq){
    var ME=window.ME||{};
    if(!ME.id)return;

    fetch(SB_URL+'/rest/v1/usuarios?id=eq.'+encodeURIComponent(ME.id)+'&select=slug,titulo_profesional,tagline,mi_enfoque,especialidades,atiende,anios_experiencia,perfil_publico_activo,configuracion&limit=1',{
      headers:{apikey:SB_ANON,Authorization:'Bearer '+SB_ANON}
    }).then(function(r){return r.ok?r.json():[];}).then(function(rows){
      // Si despues de iniciar el fetch hubo otra llamada a _renderConfig
      // (otro tab, otro click), descartar este resultado.
      if(mySeq!==_seq)return;

      // Limpiar cards stale antes de insertar — defensa en profundidad
      // contra cualquier otra carrera que haya dejado sobrantes.
      var prev1=document.getElementById('pp-card');if(prev1)prev1.remove();
      var prev2=document.getElementById('pp-mkt-card');if(prev2)prev2.remove();

      // Re-resolver el anchor en el DOM actual (el render puede haber
      // reescrito #dynamic-panel entre que arrancamos el fetch y resolvio).
      var bioNow=$('cfg-bio');
      if(!bioNow)return;
      var perfilCard=bioNow.closest('div[style*="background:#fff"]');
      var anchor=perfilCard&&perfilCard.parentNode?perfilCard:null;
      if(!anchor)return;

      var c=(rows&&rows[0])||{};
      var cfg=c.configuracion||{};
      EDIT.servicios=Array.isArray(cfg.servicios)?cfg.servicios.slice():[];
      EDIT.videos=Array.isArray(cfg.videos)?cfg.videos.slice():[];
      EDIT.links=Array.isArray(cfg.links)?cfg.links.slice():[];

      var card1=buildPerfilCard(c);
      var card2=buildMarketplaceCard();
      anchor.parentNode.insertBefore(card1,anchor.nextSibling);
      card1.parentNode.insertBefore(card2,card1.nextSibling);
      wireCard1();wireCard2();
    }).catch(function(){});
  }

  function buildPerfilCard(c){
    var slug=c.slug||'',titulo=c.titulo_profesional||'',tagline=c.tagline||'',enfoque=c.mi_enfoque||'';
    var esp=Array.isArray(c.especialidades)?c.especialidades.join(', '):'';
    var atiende=c.atiende||'',anios=c.anios_experiencia||'',pubActivo=!!c.perfil_publico_activo;
    var pubUrl=slug?'https://pathwaycareercoach.com/coach/'+slug:'';

    var card=document.createElement('div');
    card.id='pp-card';
    card.style.cssText='background:#fff;border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:14px;';

    var h='';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">';
    h+='<div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;">Perfil público</div>';
    h+='<label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--body);cursor:pointer;user-select:none;">';
    h+='<input id="pp-activo" type="checkbox" '+(pubActivo?'checked':'')+' style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);">';
    h+='<span id="pp-activo-lbl">'+(pubActivo?'Activo':'Inactivo')+'</span>';
    h+='</label></div>';
    h+='<div style="font-size:13px;color:var(--muted);margin-bottom:14px;">Tu página pública para compartir. Reusa la foto y la bio que pusiste arriba.</div>';

    if(slug){
      h+='<div style="display:flex;align-items:stretch;gap:8px;margin-bottom:18px;background:#F8F5F5;border:1px solid var(--border);border-radius:10px;padding:8px 8px 8px 12px;">';
      h+='<div style="flex:1;min-width:0;display:flex;align-items:center;font-size:13px;font-family:monospace;color:var(--title);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escH(pubUrl)+'</div>';
      h+='<button type="button" id="pp-copy" style="background:#fff;border:1px solid var(--border);color:var(--accent);padding:6px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;white-space:nowrap;">Copiar</button>';
      h+='<a href="'+escH(pubUrl)+'" target="_blank" rel="noopener" style="background:var(--accent);color:#fff;text-decoration:none;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:600;font-family:Inter,sans-serif;white-space:nowrap;display:inline-flex;align-items:center;">Ver →</a>';
      h+='</div>';
    } else {
      h+='<div style="background:#FFF7E6;border-left:3px solid #E9C46A;border-radius:6px;padding:10px 14px;margin-bottom:18px;font-size:12px;color:#8C6D2E;">Elegí un <b>slug</b> abajo y guardá para activar tu link público.</div>';
    }

    h+=field('Slug · parte final del link','<div style="display:flex;align-items:center;gap:0;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;background:#fff;"><span style="padding:10px 4px 10px 12px;font-size:13px;color:var(--muted);font-family:monospace;white-space:nowrap;">/coach/</span><input id="pp-slug" type="text" value="'+escH(slug)+'" placeholder="tu-nombre" style="flex:1;padding:10px 12px 10px 0;border:none;outline:none;font-size:14px;font-family:monospace;color:var(--title);background:transparent;"></div><div style="font-size:11px;color:var(--muted);margin-top:6px;">Solo minúsculas, números y guiones.</div>');
    h+=field('Título profesional', input('pp-titulo',titulo,'Career Coach · Especialista en transición'));
    h+=field('Tagline · una línea que te define', input('pp-tagline',tagline,'Te ayudo a encontrar tu próximo paso profesional con claridad.','text','maxlength="160"'));
    h+=field('Mi enfoque', '<textarea id="pp-enfoque" rows="3" placeholder="Cómo trabajás con tus clientes." style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:Inter,sans-serif;resize:vertical;">'+escH(enfoque)+'</textarea>');
    h+=field('Especialidades · separadas por coma', input('pp-esp',esp,'Transición de carrera, Ejecutivos, LinkedIn'));
    h+='<div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:14px;">';
    h+='<div>'+field('Dónde atendés',input('pp-atiende',atiende,'España y LATAM'),true)+'</div>';
    h+='<div>'+field('Años de exp.','<input id="pp-anios" type="number" min="0" max="60" value="'+(anios||'')+'" placeholder="5" style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:Inter,sans-serif;">',true)+'</div>';
    h+='</div>';

    h+='<div style="display:flex;gap:12px;align-items:center;">';
    h+='<button type="button" id="pp-save-btn" style="background:var(--accent);color:#fff;border:none;padding:11px 24px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;font-family:Inter,sans-serif;">Guardar perfil público</button>';
    h+='<span id="pp-status" style="font-size:12px;color:var(--muted);"></span>';
    h+='</div>';

    card.innerHTML=h;
    return card;
  }

  function buildMarketplaceCard(){
    var card=document.createElement('div');
    card.id='pp-mkt-card';
    card.style.cssText='background:#fff;border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:14px;';

    var h='';
    h+='<div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Servicios, links y videos</div>';
    h+='<div style="font-size:13px;color:var(--muted);margin-bottom:18px;">Lo que ofrecés y dónde te encuentran. Aparece abajo de la bio en tu perfil público.</div>';

    h+='<div style="margin-bottom:22px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><div style="font-size:13px;font-weight:600;color:var(--title);">Servicios</div><button type="button" id="pp-add-servicio" style="background:#fff;border:1px solid var(--border);color:var(--accent);padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;">+ Agregar servicio</button></div><div id="pp-servicios-list" style="display:flex;flex-direction:column;gap:10px;"></div><div id="pp-servicios-empty" style="font-size:12px;color:var(--muted);font-style:italic;display:none;">Sin servicios todavía. Agregá uno para mostrarlo.</div></div>';

    h+='<div style="margin-bottom:22px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><div style="font-size:13px;font-weight:600;color:var(--title);">Videos de YouTube</div><button type="button" id="pp-add-video" style="background:#fff;border:1px solid var(--border);color:var(--accent);padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;">+ Agregar video</button></div><div id="pp-videos-list" style="display:flex;flex-direction:column;gap:8px;"></div><div id="pp-videos-empty" style="font-size:12px;color:var(--muted);font-style:italic;display:none;">Sin videos todavía.</div></div>';

    h+='<div style="margin-bottom:18px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><div style="font-size:13px;font-weight:600;color:var(--title);">Links externos</div><button type="button" id="pp-add-link" style="background:#fff;border:1px solid var(--border);color:var(--accent);padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;">+ Agregar link</button></div><div id="pp-links-list" style="display:flex;flex-direction:column;gap:8px;"></div><div id="pp-links-empty" style="font-size:12px;color:var(--muted);font-style:italic;display:none;">Sin links todavía. Ideal para LinkedIn, podcast, blog, micaelajairedin.com.</div></div>';

    h+='<div style="display:flex;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:16px;">';
    h+='<button type="button" id="pp-mkt-save-btn" style="background:var(--accent);color:#fff;border:none;padding:11px 24px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;font-family:Inter,sans-serif;">Guardar servicios y links</button>';
    h+='<span id="pp-mkt-status" style="font-size:12px;color:var(--muted);"></span>';
    h+='</div>';

    card.innerHTML=h;
    return card;
  }

  function wireCard1(){
    var actChk=$('pp-activo'),actLbl=$('pp-activo-lbl');
    if(actChk&&actLbl)actChk.addEventListener('change',function(){actLbl.textContent=actChk.checked?'Activo':'Inactivo';});
    var copyBtn=$('pp-copy');
    if(copyBtn)copyBtn.addEventListener('click',function(){
      var s=(($('pp-slug')||{}).value||'').trim().toLowerCase();
      if(!s)return;
      var url='https://pathwaycareercoach.com/coach/'+s;
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(function(){if(window.showToast)showToast('Link copiado');});
    });
    var saveBtn=$('pp-save-btn');
    if(saveBtn)saveBtn.addEventListener('click',saveBasic);
  }

  function saveBasic(){
    var st=$('pp-status'),ME=window.ME||{},KEY=window.KEY||SB_ANON,SB=window.SB||SB_URL;
    if(!ME||!ME.id){if(st){st.textContent='Sin sesión activa.';st.style.color='#c0756e';}return;}
    var slug=(($('pp-slug')||{}).value||'').trim().toLowerCase();
    var titulo=(($('pp-titulo')||{}).value||'').trim();
    var tagline=(($('pp-tagline')||{}).value||'').trim();
    var enfoque=(($('pp-enfoque')||{}).value||'').trim();
    var espRaw=(($('pp-esp')||{}).value||'').trim();
    var especialidades=espRaw?espRaw.split(',').map(function(s){return s.trim();}).filter(function(s){return s.length>0;}):[];
    var atiende=(($('pp-atiende')||{}).value||'').trim();
    var aniosRaw=(($('pp-anios')||{}).value||'').trim();
    var anios=aniosRaw?parseInt(aniosRaw,10):null;
    if(anios!==null&&(isNaN(anios)||anios<0||anios>60))anios=null;
    var pubActivo=!!(($('pp-activo')||{}).checked);

    if(slug && !/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)){if(st){st.textContent='El slug solo puede tener minúsculas, números y guiones.';st.style.color='#c0756e';}return;}
    if(pubActivo && !slug){if(st){st.textContent='Para activar el perfil público, primero elegí un slug.';st.style.color='#c0756e';}var sIn=$('pp-slug');if(sIn)sIn.focus();return;}

    if(st){st.textContent='Guardando...';st.style.color='var(--muted)';}
    var fields={slug:slug||null,titulo_profesional:titulo||null,tagline:tagline||null,mi_enfoque:enfoque||null,especialidades:especialidades,atiende:atiende||null,anios_experiencia:anios,perfil_publico_activo:pubActivo};

    Promise.all(Object.keys(fields).map(function(k){return patchOne(SB,KEY,ME.id,k,fields[k]);})).then(function(results){
      if(!st)return;
      var dup=results.find(function(r){return r.key==='slug'&&r.reason==='duplicate';});
      if(dup){st.innerHTML='❌ El slug <code style="background:#F5EFEF;padding:1px 5px;border-radius:3px;">'+escH(slug)+'</code> ya está tomado. Elegí otro.';st.style.color='#c0756e';var sIn=$('pp-slug');if(sIn)sIn.focus();return;}
      var failed=results.filter(function(r){return !r.ok;});
      if(!failed.length){st.textContent='✓ Guardado';st.style.color='#2D6A4F';setTimeout(function(){if(st)st.textContent='';},3500);}
      else {st.innerHTML='⚠️ No se guardaron: '+failed.map(function(r){return r.key;}).join(', ');st.style.color='#B8A44E';}
    });
  }

  function wireCard2(){
    renderServicios();renderVideos();renderLinks();
    $('pp-add-servicio').addEventListener('click',function(){EDIT.servicios.push({titulo:'',descripcion:'',precio:'',moneda:'EUR',duracion:'',cta_url:''});renderServicios();});
    $('pp-add-video').addEventListener('click',function(){EDIT.videos.push('');renderVideos();});
    $('pp-add-link').addEventListener('click',function(){EDIT.links.push({titulo:'',url:''});renderLinks();});
    $('pp-mkt-save-btn').addEventListener('click',saveMarketplace);
  }

  function renderServicios(){
    var box=$('pp-servicios-list'),empty=$('pp-servicios-empty');
    if(!EDIT.servicios.length){box.innerHTML='';empty.style.display='block';return;}
    empty.style.display='none';
    box.innerHTML=EDIT.servicios.map(function(s,i){
      return '<div style="background:#FAFDF9;border:1px solid var(--border);border-radius:10px;padding:14px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><div style="font-size:12px;font-weight:600;color:var(--accent);">Servicio #'+(i+1)+'</div><button type="button" data-srv-rm="'+i+'" style="background:transparent;border:none;color:#c0756e;font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;">Eliminar</button></div><div style="display:grid;gap:8px;">'
        +'<input data-srv-i="'+i+'" data-srv-k="titulo" type="text" placeholder="Título — ej: Sesión 1:1" value="'+escH(s.titulo)+'" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;">'
        +'<textarea data-srv-i="'+i+'" data-srv-k="descripcion" rows="2" placeholder="Descripción breve" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;resize:vertical;">'+escH(s.descripcion)+'</textarea>'
        +'<div style="display:grid;grid-template-columns:1fr 90px 1fr;gap:8px;"><input data-srv-i="'+i+'" data-srv-k="precio" type="number" min="0" placeholder="Precio" value="'+escH(s.precio)+'" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;"><select data-srv-i="'+i+'" data-srv-k="moneda" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;background:#fff;">'
        +['EUR','USD','ARS','MXN','COP','CLP','PEN'].map(function(m){return '<option value="'+m+'"'+((s.moneda||'EUR')===m?' selected':'')+'>'+m+'</option>';}).join('')
        +'</select><input data-srv-i="'+i+'" data-srv-k="duracion" type="text" placeholder="Duración — 60 min" value="'+escH(s.duracion)+'" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;"></div>'
        +'<input data-srv-i="'+i+'" data-srv-k="cta_url" type="url" placeholder="Link de reserva (Calendly, Stripe, etc.)" value="'+escH(s.cta_url)+'" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;"></div></div>';
    }).join('');
    box.querySelectorAll('[data-srv-rm]').forEach(function(b){b.addEventListener('click',function(){EDIT.servicios.splice(parseInt(b.getAttribute('data-srv-rm'),10),1);renderServicios();});});
    box.querySelectorAll('[data-srv-i]').forEach(function(el){el.addEventListener('input',function(){var i=parseInt(el.getAttribute('data-srv-i'),10);var k=el.getAttribute('data-srv-k');if(EDIT.servicios[i])EDIT.servicios[i][k]=el.value;});});
  }

  function renderVideos(){
    var box=$('pp-videos-list'),empty=$('pp-videos-empty');
    if(!EDIT.videos.length){box.innerHTML='';empty.style.display='block';return;}
    empty.style.display='none';
    box.innerHTML=EDIT.videos.map(function(v,i){return '<div style="display:flex;gap:8px;align-items:center;"><input data-vid-i="'+i+'" type="url" placeholder="https://youtube.com/watch?v=..." value="'+escH(v)+'" style="flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;"><button type="button" data-vid-rm="'+i+'" style="background:transparent;border:1px solid var(--border);color:#c0756e;padding:8px 12px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;">Quitar</button></div>';}).join('');
    box.querySelectorAll('[data-vid-i]').forEach(function(el){el.addEventListener('input',function(){EDIT.videos[parseInt(el.getAttribute('data-vid-i'),10)]=el.value;});});
    box.querySelectorAll('[data-vid-rm]').forEach(function(b){b.addEventListener('click',function(){EDIT.videos.splice(parseInt(b.getAttribute('data-vid-rm'),10),1);renderVideos();});});
  }

  function renderLinks(){
    var box=$('pp-links-list'),empty=$('pp-links-empty');
    if(!EDIT.links.length){box.innerHTML='';empty.style.display='block';return;}
    empty.style.display='none';
    box.innerHTML=EDIT.links.map(function(l,i){return '<div style="display:grid;grid-template-columns:1fr 2fr auto;gap:8px;align-items:center;"><input data-link-i="'+i+'" data-link-k="titulo" type="text" placeholder="Mi LinkedIn" value="'+escH(l.titulo)+'" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;"><input data-link-i="'+i+'" data-link-k="url" type="url" placeholder="https://..." value="'+escH(l.url)+'" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;"><button type="button" data-link-rm="'+i+'" style="background:transparent;border:1px solid var(--border);color:#c0756e;padding:8px 12px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;">Quitar</button></div>';}).join('');
    box.querySelectorAll('[data-link-i]').forEach(function(el){el.addEventListener('input',function(){var i=parseInt(el.getAttribute('data-link-i'),10);var k=el.getAttribute('data-link-k');if(EDIT.links[i])EDIT.links[i][k]=el.value;});});
    box.querySelectorAll('[data-link-rm]').forEach(function(b){b.addEventListener('click',function(){EDIT.links.splice(parseInt(b.getAttribute('data-link-rm'),10),1);renderLinks();});});
  }

  function saveMarketplace(){
    var st=$('pp-mkt-status'),ME=window.ME||{},KEY=window.KEY||SB_ANON,SB=window.SB||SB_URL;
    if(!ME||!ME.id){if(st){st.textContent='Sin sesión activa.';st.style.color='#c0756e';}return;}
    if(st){st.textContent='Guardando...';st.style.color='var(--muted)';}

    var servicios=EDIT.servicios.filter(function(s){return (s.titulo||'').trim().length>0;}).map(function(s){
      var p=(s.precio==null||s.precio==='')?null:parseFloat(s.precio);if(p!==null&&isNaN(p))p=null;
      return {titulo:(s.titulo||'').trim(),descripcion:(s.descripcion||'').trim()||null,precio:p,moneda:(s.moneda||'EUR').toUpperCase(),duracion:(s.duracion||'').trim()||null,cta_url:(s.cta_url||'').trim()||null};
    });
    var videos=EDIT.videos.map(function(v){return (v||'').trim();}).filter(function(v){return v.length>0;});
    var links=EDIT.links.filter(function(l){return (l.url||'').trim().length>0;}).map(function(l){return {titulo:(l.titulo||'').trim()||null, url:(l.url||'').trim()};});

    fetch(SB+'/rest/v1/usuarios?id=eq.'+encodeURIComponent(ME.id)+'&select=configuracion&limit=1',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}})
    .then(function(r){return r.ok?r.json():[];})
    .then(function(rows){
      var cfg=(rows&&rows[0]&&rows[0].configuracion)||{};
      cfg.servicios=servicios;cfg.videos=videos;cfg.links=links;
      return fetch(SB+'/rest/v1/usuarios?id=eq.'+encodeURIComponent(ME.id),{method:'PATCH',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({configuracion:cfg})});
    })
    .then(function(r){
      if(!st)return;
      if(!r){st.textContent='Error de red.';st.style.color='#c0756e';return;}
      if(!r.ok){st.textContent='Error '+r.status;st.style.color='#c0756e';return;}
      return r.json().then(function(rows){
        if(!rows||!rows.length){st.textContent='RLS bloqueó el guardado.';st.style.color='#c0756e';return;}
        st.textContent='✓ Guardado';st.style.color='#2D6A4F';
        setTimeout(function(){if(st)st.textContent='';},3500);
      });
    })
    .catch(function(){if(st){st.textContent='Error de red.';st.style.color='#c0756e';}});
  }

  function patchOne(SB,KEY,id,key,val){
    var body={};body[key]=val;
    return fetch(SB+'/rest/v1/usuarios?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(body)})
    .then(function(r){
      if(!r.ok){if(r.status===409)return {key:key,ok:false,reason:'duplicate'};return {key:key,ok:false,status:r.status};}
      return r.json().then(function(rows){if(!rows||!rows.length)return {key:key,ok:false,reason:'no-rows'};return {key:key,ok:true};});
    }).catch(function(){return {key:key,ok:false};});
  }

  function field(label,html,noMargin){var mb=noMargin?'':'margin-bottom:14px;';return '<div style="'+mb+'"><label style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">'+label+'</label>'+html+'</div>';}
  function input(id,val,ph,type,extra){type=type||'text';extra=extra||'';return '<input id="'+id+'" type="'+type+'" value="'+escH(val||'')+'" placeholder="'+escH(ph||'')+'" '+extra+' style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:Inter,sans-serif;">';}
})();
