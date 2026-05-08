// ────────────────────────────────────────────────────────────────────
// Perfil publico — extiende Configuracion del panel con los campos del
// /coach/{slug} compartible.
//
// Se carga DESPUES del JS inline de panel.html y wrappea _renderConfig.
// Cuando la coach abre Configuracion, se inyecta una card "Perfil
// publico" debajo de la card "Tu perfil". Tiene su propio boton de
// guardar (independiente del existente) que escribe los campos nuevos
// en `usuarios` via PATCH directo.
//
// Campos: slug, titulo_profesional, tagline, mi_enfoque, especialidades,
// atiende, anios_experiencia, perfil_publico_activo.
// foto_url, bio y configuracion.calendly_url se siguen guardando con el
// boton "Guardar cambios" original (no los duplicamos).
// ────────────────────────────────────────────────────────────────────

(function(){
  if(typeof window._renderConfig !== 'function'){
    return;
  }

  var origRender = window._renderConfig;
  var SB_URL='https://ddxnrsnjdvtqhxunxnwj.supabase.co';
  var SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

  function escH(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}

  window._renderConfig = function(){
    origRender.apply(this, arguments);
    var tries=0;
    var poll=setInterval(function(){
      tries++;
      var bio=document.getElementById('cfg-bio');
      if(bio){
        clearInterval(poll);
        injectPerfilPublico(bio);
      } else if(tries>60){
        clearInterval(poll);
      }
    },100);
  };

  function injectPerfilPublico(bioEl){
    if(document.getElementById('pp-card'))return;

    var ME=window.ME||{};
    if(!ME.id){return;}

    fetch(SB_URL+'/rest/v1/usuarios?id=eq.'+encodeURIComponent(ME.id)+'&select=slug,titulo_profesional,tagline,mi_enfoque,especialidades,atiende,anios_experiencia,perfil_publico_activo&limit=1',{
      headers:{apikey:SB_ANON,Authorization:'Bearer '+SB_ANON}
    }).then(function(r){return r.ok?r.json():[];}).then(function(rows){
      var c=(rows&&rows[0])||{};
      var slug=c.slug||'';
      var titulo=c.titulo_profesional||'';
      var tagline=c.tagline||'';
      var enfoque=c.mi_enfoque||'';
      var esp=Array.isArray(c.especialidades)?c.especialidades.join(', '):'';
      var atiende=c.atiende||'';
      var anios=c.anios_experiencia||'';
      var pubActivo=!!c.perfil_publico_activo;

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
      h+='<div style="font-size:13px;color:var(--muted);margin-bottom:14px;">Tu página pública para compartir en LinkedIn, IG o WhatsApp. Reusa la foto y la bio que pusiste arriba.</div>';

      if(slug){
        h+='<div style="display:flex;align-items:stretch;gap:8px;margin-bottom:18px;background:#F8F5F5;border:1px solid var(--border);border-radius:10px;padding:8px 8px 8px 12px;">';
        h+='<div style="flex:1;min-width:0;display:flex;align-items:center;font-size:13px;font-family:monospace;color:var(--title);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+escH(pubUrl)+'">'+escH(pubUrl)+'</div>';
        h+='<button type="button" id="pp-copy" style="background:#fff;border:1px solid var(--border);color:var(--accent);padding:6px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;white-space:nowrap;">Copiar</button>';
        h+='<a href="'+escH(pubUrl)+'" target="_blank" rel="noopener" style="background:var(--accent);color:#fff;text-decoration:none;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:600;font-family:Inter,sans-serif;white-space:nowrap;display:inline-flex;align-items:center;">Ver →</a>';
        h+='</div>';
      } else {
        h+='<div style="background:#FFF7E6;border-left:3px solid #E9C46A;border-radius:6px;padding:10px 14px;margin-bottom:18px;font-size:12px;color:#8C6D2E;">Elegí un <b>slug</b> abajo y guardá para activar tu link público.</div>';
      }

      h+='<div style="margin-bottom:14px;"><label style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Slug · parte final del link</label>';
      h+='<div style="display:flex;align-items:center;gap:0;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;background:#fff;">';
      h+='<span style="padding:10px 4px 10px 12px;font-size:13px;color:var(--muted);font-family:monospace;white-space:nowrap;">/coach/</span>';
      h+='<input id="pp-slug" type="text" value="'+escH(slug)+'" placeholder="tu-nombre" style="flex:1;padding:10px 12px 10px 0;border:none;outline:none;font-size:14px;font-family:monospace;color:var(--title);background:transparent;">';
      h+='</div>';
      h+='<div style="font-size:11px;color:var(--muted);margin-top:6px;">Solo minúsculas, números y guiones. Ej: <code style="background:#F5EFEF;padding:1px 5px;border-radius:3px;">micaela-jairedin</code>. Una vez activo, evitá cambiarlo (rompe los links que ya compartiste).</div>';
      h+='</div>';

      h+='<div style="margin-bottom:14px;"><label style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Título profesional</label>';
      h+='<input id="pp-titulo" type="text" value="'+escH(titulo)+'" placeholder="Career Coach · Especialista en transición profesional" style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:Inter,sans-serif;"></div>';

      h+='<div style="margin-bottom:14px;"><label style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Tagline · una línea que te define</label>';
      h+='<input id="pp-tagline" type="text" value="'+escH(tagline)+'" maxlength="160" placeholder="Te ayudo a encontrar tu próximo paso profesional con claridad." style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:Inter,sans-serif;"></div>';

      h+='<div style="margin-bottom:14px;"><label style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Mi enfoque</label>';
      h+='<textarea id="pp-enfoque" rows="3" placeholder="Cómo trabajás con tus clientes." style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:Inter,sans-serif;resize:vertical;">'+escH(enfoque)+'</textarea></div>';

      h+='<div style="margin-bottom:14px;"><label style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Especialidades · separadas por coma</label>';
      h+='<input id="pp-esp" type="text" value="'+escH(esp)+'" placeholder="Transición de carrera, Ejecutivos, LinkedIn" style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:Inter,sans-serif;">';
      h+='<div style="font-size:11px;color:var(--muted);margin-top:6px;">Aparecen como chips en tu perfil público.</div></div>';

      h+='<div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:14px;">';
      h+='<div><label style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Dónde atendés</label>';
      h+='<input id="pp-atiende" type="text" value="'+escH(atiende)+'" placeholder="España y LATAM" style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:Inter,sans-serif;"></div>';
      h+='<div><label style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Años de exp.</label>';
      h+='<input id="pp-anios" type="number" min="0" max="60" value="'+(anios||'')+'" placeholder="5" style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:Inter,sans-serif;"></div>';
      h+='</div>';

      h+='<div style="display:flex;gap:12px;align-items:center;">';
      h+='<button type="button" id="pp-save-btn" style="background:var(--accent);color:#fff;border:none;padding:11px 24px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;font-family:Inter,sans-serif;">Guardar perfil público</button>';
      h+='<span id="pp-status" style="font-size:12px;color:var(--muted);"></span>';
      h+='</div>';

      card.innerHTML=h;

      var perfilCard=bioEl.closest('div[style*="background:#fff"]');
      if(perfilCard&&perfilCard.parentNode){
        perfilCard.parentNode.insertBefore(card,perfilCard.nextSibling);
      } else {
        var dp=document.getElementById('dynamic-panel');
        if(dp&&dp.firstChild)dp.firstChild.appendChild(card);
      }

      var actChk=document.getElementById('pp-activo');
      var actLbl=document.getElementById('pp-activo-lbl');
      if(actChk&&actLbl)actChk.addEventListener('change',function(){actLbl.textContent=actChk.checked?'Activo':'Inactivo';});

      var copyBtn=document.getElementById('pp-copy');
      if(copyBtn)copyBtn.addEventListener('click',function(){
        var s=((document.getElementById('pp-slug')||{}).value||'').trim().toLowerCase();
        if(!s)return;
        var url='https://pathwaycareercoach.com/coach/'+s;
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(url).then(function(){if(window.showToast)showToast('Link copiado');});
        }
      });

      var saveBtn=document.getElementById('pp-save-btn');
      if(saveBtn)saveBtn.addEventListener('click',savePerfilPublico);
    }).catch(function(_e){});
  }

  function savePerfilPublico(){
    var st=document.getElementById('pp-status');
    var ME=window.ME||{};
    var KEY=window.KEY||SB_ANON;
    var SB=window.SB||SB_URL;

    if(!ME||!ME.id){if(st){st.textContent='Sin sesión activa.';st.style.color='#c0756e';}return;}

    var slug=((document.getElementById('pp-slug')||{}).value||'').trim().toLowerCase();
    var titulo=((document.getElementById('pp-titulo')||{}).value||'').trim();
    var tagline=((document.getElementById('pp-tagline')||{}).value||'').trim();
    var enfoque=((document.getElementById('pp-enfoque')||{}).value||'').trim();
    var espRaw=((document.getElementById('pp-esp')||{}).value||'').trim();
    var especialidades=espRaw?espRaw.split(',').map(function(s){return s.trim();}).filter(function(s){return s.length>0;}):[];
    var atiende=((document.getElementById('pp-atiende')||{}).value||'').trim();
    var aniosRaw=((document.getElementById('pp-anios')||{}).value||'').trim();
    var anios=aniosRaw?parseInt(aniosRaw,10):null;
    if(anios!==null&&(isNaN(anios)||anios<0||anios>60))anios=null;
    var pubActivo=!!((document.getElementById('pp-activo')||{}).checked);

    if(slug && !/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)){
      if(st){st.textContent='El slug solo puede tener minúsculas, números y guiones.';st.style.color='#c0756e';}
      return;
    }
    if(pubActivo && !slug){
      if(st){st.textContent='Para activar el perfil público, primero elegí un slug.';st.style.color='#c0756e';}
      var sIn=document.getElementById('pp-slug');if(sIn)sIn.focus();
      return;
    }

    if(st){st.textContent='Guardando...';st.style.color='var(--muted)';}

    var fields={
      slug:slug||null,
      titulo_profesional:titulo||null,
      tagline:tagline||null,
      mi_enfoque:enfoque||null,
      especialidades:especialidades,
      atiende:atiende||null,
      anios_experiencia:anios,
      perfil_publico_activo:pubActivo
    };

    function patchOne(key,val){
      var body={};body[key]=val;
      return fetch(SB+'/rest/v1/usuarios?id=eq.'+encodeURIComponent(ME.id),{
        method:'PATCH',
        headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(body)
      }).then(function(r){
        if(!r.ok){
          if(r.status===409)return {key:key,ok:false,reason:'duplicate'};
          return {key:key,ok:false,status:r.status};
        }
        return r.json().then(function(rows){
          if(!rows||!rows.length)return {key:key,ok:false,reason:'no-rows'};
          return {key:key,ok:true};
        });
      }).catch(function(){return {key:key,ok:false};});
    }

    Promise.all(Object.keys(fields).map(function(k){return patchOne(k,fields[k]);})).then(function(results){
      if(!st)return;
      var dup=results.find(function(r){return r.key==='slug'&&r.reason==='duplicate';});
      if(dup){
        st.innerHTML='❌ El slug <code style="background:#F5EFEF;padding:1px 5px;border-radius:3px;">'+escH(slug)+'</code> ya está tomado. Elegí otro.';
        st.style.color='#c0756e';
        var sIn=document.getElementById('pp-slug');if(sIn)sIn.focus();
        return;
      }
      var failed=results.filter(function(r){return !r.ok;});
      if(!failed.length){
        st.textContent='✓ Guardado';
        st.style.color='#2D6A4F';
        setTimeout(function(){if(st)st.textContent='';},3500);
      } else {
        st.innerHTML='⚠️ No se guardaron: '+failed.map(function(r){return r.key;}).join(', ')+'. Revisá la consola.';
        st.style.color='#B8A44E';
        console.warn('[perfil-publico] failures', failed);
      }
    });
  }
})();
