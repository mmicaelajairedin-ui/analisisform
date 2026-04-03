// @charset utf-8

const SB_URL='https://ddxnrsnjdvtqhxunxnwj.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
const BASE='https://mmicaelajairedin-ui.github.io/analisisform';

async function sbGet(table,filter){
  const url=SB_URL+'/rest/v1/'+table+'?'+filter+'&order=created_at.desc';
  const r=await fetch(url,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
  return r.json();
}
async function sbInsert(table,data){
  const r=await fetch(SB_URL+'/rest/v1/'+table,{method:'POST',headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=minimal'},body:JSON.stringify(data)});
  if(!r.ok)throw new Error(await r.text());
}
async function sbUpdate(table,id,data){
  const r=await fetch(SB_URL+'/rest/v1/'+table+'?id=eq.'+id,{method:'PATCH',headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY},body:JSON.stringify(data)});
  if(!r.ok)throw new Error(await r.text());
}

let cands=[], reps={}, notes={}, activeId=null, atab='datos';
const COLORS=['#E8D5D8:#6B4A50','#D5DDE8:#4A5A6B','#D5E8D8:#4A6B4A','#E8E0D5:#6B5A4A','#E0D5E8:#5A4A6B'];

async function loadCands(){
  document.getElementById('clist').innerHTML='<div class="empty-list">Cargando...</div>';
  try{
    const all=await sbGet('candidatos','select=*');
    // Group by email '+'\u2014'+' keep most recent per email, track submission count
    const byEmail={};
    all.forEach(c=>{
      const key=(c.email||'sin-email').toLowerCase().trim();
      if(!byEmail[key]){byEmail[key]=[];}
      byEmail[key].push(c);
    });
    // For each email group: sort by created_at desc, keep most recent as main record
    cands=Object.values(byEmail).map(group=>{
      group.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      const main=group[0];
      main._submissions=group.length;
      main._history=group;
      return main;
    });
    // Sort all by most recent submission
    cands.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    reps=JSON.parse(localStorage.getItem('mj_panel_reps')||'{}');
    notes=JSON.parse(localStorage.getItem('mj_panel_notes')||'{}');
    renderSidebar();
  }catch(e){
    document.getElementById('clist').innerHTML='<div class="empty-list">Error al cargar. Pulsa Actualizar.</div>';
  }
}

function renderSidebar(){
  const newC=cands.filter(c=>!localStorage.getItem('seen_p_'+c.id)).length;
  const repC=Object.keys(reps).length;
  const pubC=Object.values(reps).filter(r=>r.published).length;
  document.getElementById('st-tot').textContent=cands.length;
  document.getElementById('st-new').textContent=newC;
  document.getElementById('st-rep').textContent=repC;
  document.getElementById('st-pub').textContent=pubC;

  const list=document.getElementById('clist');
  if(!cands.length){list.innerHTML='<div class="empty-list">No hay candidatos aún.<br>Cuando alguien complete el formulario aparecerá aquí.</div>';return;}
  list.innerHTML='';
  cands.forEach((c,i)=>{
    const seen=localStorage.getItem('seen_p_'+c.id);
    const hasRep=!!reps[c.id];
    const isPub=hasRep&&reps[c.id].published;
    const col=COLORS[i%COLORS.length].split(':');
    const ini=(c.nombre||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
    const d=document.createElement('div');
    d.className='crow'+(activeId===c.id?' on':'');
    d.onclick=()=>openCand(c.id);
    d.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'
      +'<div class="av" style="width:30px;height:30px;font-size:11px;background:'+col[0]+';color:'+col[1]+'">'+ini+'</div>'
      +'<div class="crow-name">'+(c.nombre||''+'\u2014'+'')+'</div>'
      +(c._submissions>1?'<span style="font-size:9px;font-weight:700;background:#f3efef;color:#6B5A5F;padding:2px 6px;border-radius:10px;">'+c._submissions+'x</span>':'')
      +'</div>'
      +'<div class="crow-sub">'+(c.rol||c.sector||''+'\u2014'+'')+' &middot; '+(c.ciudad||''+'\u2014'+'')+'</div>'
      +'<div class="crow-pills">'
      +(!seen?'<span class="pill pill-new">Nuevo</span>':'')
      +(hasRep?'<span class="pill pill-rep">Informe \u2713</span>':'')
      +(isPub?'<span class="pill pill-pub">Publicado</span>':'')
      +'</div>';
    list.appendChild(d);
  });
}

function openCand(id){
  activeId=id;atab='datos';
  localStorage.setItem('seen_p_'+id,'1');
  const c=cands.find(x=>x.id===id);
  renderSidebar();
  renderMain(c);
}

function renderMain(c){
  const hasRep=!!reps[c.id];
  const isPub=hasRep&&reps[c.id].published;
  const i=cands.findIndex(x=>x.id===c.id);
  const col=COLORS[i%COLORS.length].split(':');
  const ini=(c.nombre||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();

  document.getElementById('main').innerHTML=
    '<div class="chead">'
      +'<div class="av" style="background:'+col[0]+';color:'+col[1]+'">'+ini+'</div>'
      +'<div><div class="chead-name">'+(c.nombre||''+'\u2014'+'')+'</div><div class="chead-sub">'+(c.email||''+'\u2014'+'')+' &middot; '+(c.ciudad||''+'\u2014'+'')+'</div></div>'
      +'<div class="chead-actions">'
        +(hasRep?'<button class="btn" onclick="printReport()">Descargar PDF</button>':'')
        +(hasRep&&!isPub?'<button class="btn-sec" onclick="publicarInforme('+c.id+')">Publicar al cliente</button>':'')
        +(isPub?'<button class="btn-sec" onclick="verUrlCliente('+c.id+')">Ver URL cliente</button>':'')
      +'</div>'
    +'</div>'
    +'<div class="tabs">'
      +'<div class="tab '+(atab==='datos'?'on':'')+'" onclick="switchTab(\'datos\','+c.id+')">Datos</div>'
      +'<div class="tab '+(atab==='generar'?'on':'')+'" onclick="switchTab(\'generar\','+c.id+')">Generar informe</div>'
      +(hasRep?'<div class="tab '+(atab==='informe'?'on':'')+'" onclick="switchTab(\'informe\','+c.id+')">Informe</div>':'')
      +'<div class="tab '+(atab==='notas'?'on':'')+'" onclick="switchTab(\'notas\','+c.id+')">Mis notas</div>'
    +'</div>'
    +'<div id="tab-content">'+renderTab(c, atab)+'</div>';
}

function switchTab(tab,id){
  atab=tab;
  const c=cands.find(x=>x.id===id);
  document.getElementById('tab-content').innerHTML=renderTab(c,tab);
}

function renderTab(c,tab){
  if(tab==='datos') return tabDatos(c);
  if(tab==='generar') return tabGenerar(c);
  if(tab==='informe') return tabInforme(c);
  if(tab==='notas') return tabNotas(c);
  return '';
}

function tabDatos(c){
  const liUrl=c.linkedin?'linkedin.com/in/'+c.linkedin:'No tiene';
  const obs=(c.obstaculos||'').split('|').map(s=>s.trim()).filter(s=>s&&s!==''+'\u2014'+'');
  const ski=(c.skills||'').split(',').map(s=>s.trim()).filter(s=>s&&s!==''+'\u2014'+'');
  return '<div class="igrid">'
    +'<div class="ii"><div class="iil">Situación</div><div class="iiv">'+(c.situacion||''+'\u2014'+'')+'</div></div>'
    +'<div class="ii"><div class="iil">Urgencia</div><div class="iiv">'+(c.urgencia||''+'\u2014'+'')+'</div></div>'
    +'<div class="ii"><div class="iil">Rol buscado</div><div class="iiv">'+(c.rol||''+'\u2014'+'')+'</div></div>'
    +'<div class="ii"><div class="iil">Salario esperado</div><div class="iiv">'+(c.salario||''+'\u2014'+'')+'</div></div>'
    +'<div class="ii"><div class="iil">Empresa</div><div class="iiv">'+(c.empresa||''+'\u2014'+'')+'</div></div>'
    +'<div class="ii"><div class="iil">Modalidad</div><div class="iiv">'+(c.modalidad||''+'\u2014'+'')+'</div></div>'
    +'<div class="ii"><div class="iil">LinkedIn</div><div class="iiv">'+liUrl+'<br><span style="font-size:10px;color:#999">'+(c.li_estado||''+'\u2014'+'')+'</span></div></div>'
    +'<div class="ii"><div class="iil">CV</div><div class="iiv">'+(c.cv||'No subido')+(c.cv_url&&c.cv_url!=='No subido'?'<br><a href="'+c.cv_url+'" target="_blank" style="font-size:10px;color:#8C7B80;font-weight:600;">Descargar -></a>':'')+'</div></div>'
    +'<div class="ii fw"><div class="iil">Objetivo</div><div class="iiv" style="font-weight:400;line-height:1.5">"'+(c.objetivo||''+'\u2014'+'')+'"</div></div>'
    +'<div class="ii fw"><div class="iil">Logro destacado</div><div class="iiv" style="font-weight:400;line-height:1.5">"'+(c.logro||''+'\u2014'+'')+'"</div></div>'
    +(c.extra&&c.extra!==''+'\u2014'+''?'<div class="ii fw"><div class="iil">Fuera del CV</div><div class="iiv" style="font-weight:400;line-height:1.5">"'+c.extra+'"</div></div>':'')
    +'</div>'
    +'<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Obstáculos</div>'
    +'<div class="olist">'+(obs.length?obs.map(o=>'<div class="oi"><div class="odot"></div>'+o+'</div>').join(''):'<div style="font-size:12px;color:#999;">No indicados</div>')+'</div></div>'
    +'<div><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Habilidades</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;">'+(ski.map(s=>'<span style="background:#f3efef;color:#6B5A5F;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">'+s+'</span>').join('')||'<span style="font-size:12px;color:#999;">No indicadas</span>')+'</div></div>'
    +(c._submissions>1
      ?'<div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;">'
        +'<div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">Historial ('+c._submissions+' formularios enviados)</div>'
        +c._history.map(function(h,i){
          return '<div style="background:#f9f8f8;border-radius:8px;padding:8px 12px;margin-bottom:6px;">'
            +'<div style="font-size:12px;font-weight:600;color:#1a1a1a;">'+(i===0?'Formulario más reciente':'Formulario '+String(c._submissions-i))+' &middot; '+new Date(h.created_at).toLocaleDateString('es-ES')+'</div>'
            +'<div style="font-size:11px;color:#999;margin-top:2px;">Rol: '+(h.rol||''+'\u2014'+'')+' &middot; Situación: '+(h.situacion||''+'\u2014'+'')+'</div>'
            +'</div>';
        }).join('')
        +'</div>'
      :'')
    ;
}

function tabGenerar(c){
  const liUrl=c.linkedin?'linkedin.com/in/'+c.linkedin:'No tiene';
  const cvLink=c.cv_url&&c.cv_url!=='No subido'?c.cv_url:'';
  const fecha=new Date().toLocaleDateString('es-ES');

  const datos='Nombre: '+(c.nombre||''+'\u2014'+'')+' | Email: '+(c.email||''+'\u2014'+'')+' | Ciudad: '+(c.ciudad||''+'\u2014'+'')+' | Exp: '+(c.exp||''+'\u2014'+'')+'\n'
    +'Sector: '+(c.sector||''+'\u2014'+'')+' | Cargo: '+(c.cargo||''+'\u2014'+'')+'\n'
    +'Situacion: '+(c.situacion||''+'\u2014'+'')+'\n'
    +'Objetivo: '+(c.objetivo||''+'\u2014'+'')+'\n'
    +'Rol buscado: '+(c.rol||''+'\u2014'+'')+' | Empresa: '+(c.empresa||''+'\u2014'+'')+' | Modalidad: '+(c.modalidad||''+'\u2014'+'')+'\n'
    +'Salario: '+(c.salario||''+'\u2014'+'')+' | Urgencia: '+(c.urgencia||''+'\u2014'+'')+'\n'
    +'Skills: '+(c.skills||''+'\u2014'+'')+'\n'
    +'Logro: '+(c.logro||''+'\u2014'+'')+'\n'
    +(c.extra&&c.extra!==''+'\u2014'+''?'Extra: '+c.extra+'\n':'')
    +'LinkedIn: '+liUrl+' ('+( c.li_estado||''+'\u2014'+'')+')\n'
    +'CV: '+(c.cv||'No subido')+(cvLink?' '+cvLink:'')+'\n'
    +'Obstaculos: '+(c.obstaculos||''+'\u2014'+'')+'\n'
    +'Red: '+(c.red||''+'\u2014'+'')+'\n'
    +(c.nota&&c.nota!==''+'\u2014'+''?'Notas: '+c.nota+'\n':'')
    +(c.resp_ia&&c.resp_ia!==''+'\u2014'+''?'Respuesta final: '+c.resp_ia+'\n':'');

  const prompt='Eres el asistente de Micaela Jairedin, Career Coach & Recruiter. Analiza este candidato y devuelve SOLO un JSON valido, sin markdown, sin texto adicional. val = porcentaje del 1 al 100.\n\n'
    +'DATOS:\n'+datos+'\n'
    +(cvLink?'Descarga y analiza el CV en: '+cvLink+'\n':'')
    +(liUrl!=='No tiene'?'Analiza el LinkedIn en: https://'+liUrl+'\n':'')
    +'\nDevuelve este JSON:\n'
    +'{"candidato":"'+( c.nombre||'Candidato')+'","fecha":"'+fecha+'",'
    +'"scores":[{"label":"CV y marca personal","val":N},{"label":"LinkedIn","val":N},{"label":"Claridad de objetivo","val":N},{"label":"Red de contactos","val":N},{"label":"Propuesta de valor","val":N}],'
    +'"resumen":"3-4 frases","fortalezas":["f1","f2","f3","f4"],"gaps":["g1","g2","g3","g4"],'
    +'"mercado":"analisis mercado 2025","estrategia":"estrategia recomendada",'
    +'"cv_acciones":["a1","a2","a3","a4","a5"],"linkedin_acciones":["a1","a2","a3","a4","a5"],'
    +'"networking_acciones":["a1","a2","a3","a4","a5"],"preguntas":["p1","p2","p3","p4","p5"],'
    +'"alertas":["al1","al2","al3"],"mensaje_candidato":"mensaje motivador de Micaela al candidato"}';

  window['_prompt_'+c.id]=prompt;

  return '<div class="gen-box">'
    +'<h3>Paso 1 '+'\u2014'+' Copia el prompt y pégalo en Claude</h3>'
    +'<p>El prompt ya incluye todos los datos del candidato. Cópialo, pégalo en Claude.ai y Claude te dará el JSON del análisis.</p>'
    +'<div class="prompt-area" id="prompt-'+c.id+'">'+escH(prompt)+'</div>'
    +'<button class="btn" onclick="copiarPrompt('+c.id+')">Copiar prompt</button>'
    +'<div class="status" id="st-copy-'+c.id+'"></div>'
    +'</div>'
    +'<div class="gen-box">'
    +'<h3>Paso 2 '+'\u2014'+' Pega el JSON que te dio Claude</h3>'
    +'<p>Copia el JSON de la respuesta de Claude y pégalo aquí para generar el informe con tu diseño.</p>'
    +'<textarea id="json-'+c.id+'" rows="5" placeholder=\'{"candidato":"...","scores":[...],...}\'></textarea>'
    +'<div style="margin-top:10px;display:flex;gap:8px;">'
    +'<button class="btn" onclick="generarInforme('+c.id+')">Generar informe -></button>'
    +'</div>'
    +'<div class="status" id="st-gen-'+c.id+'"></div>'
    +'</div>';
}

function copiarPrompt(id){
  const p=window['_prompt_'+id];
  navigator.clipboard.writeText(p).then(()=>{
    const st=document.getElementById('st-copy-'+id);
    st.textContent='\u2713 Copiado. Pégalo en Claude.ai';
    st.style.color='#8C7B80';
  });
}

function generarInforme(id){
  const jsonTxt=document.getElementById('json-'+id).value.trim();
  const st=document.getElementById('st-gen-'+id);
  let d;
  try{ d=JSON.parse(jsonTxt.replace(/```json|```/g,'').trim()); }
  catch(e){ st.textContent='JSON no válido. Cópialo exactamente como lo generó Claude.'; st.style.color='#c0756e'; return; }

  // Check if there's a previous report for progress tracking
  const prev=reps[id]?reps[id].data:null;
  reps[id]={data:d, published:false, prev:prev, createdAt:new Date().toISOString()};
  localStorage.setItem('mj_panel_reps',JSON.stringify(reps));

  st.textContent='\u2713 Informe generado. Ve a la pestaña "Informe".';
  st.style.color='#4a7c5f';

  // Switch to informe tab
  setTimeout(()=>{atab='informe';renderMain(cands.find(x=>x.id===id));},800);
}

function tabInforme(c){
  const rep=reps[c.id];
  if(!rep) return '<p style="color:#999;font-size:13px;">Genera el informe primero.</p>';
  const d=rep.data;
  const prev=rep.prev;

  function sc(arr){
    return arr.map(s=>{
      const pct=Math.min(100,Math.max(0,Math.round(s.val)));
      const cl=pct>=70?'hi':pct>=45?'mid':'lo';
      let delta='';
      if(prev){
        const prevScore=prev.scores.find(ps=>ps.label===s.label);
        if(prevScore){const diff=pct-Math.round(prevScore.val);delta='<div class="sc-delta '+(diff>=0?'up':'same')+'">'+(diff>=0?'+':'')+diff+'%</div>';}
      }
      return '<div class="score-card"><div class="sc-label">'+s.label+'</div>'
        +'<div class="sc-pct '+cl+'">'+pct+'%</div>'
        +'<div class="sc-track"><div class="sc-fill fill-'+cl+'" style="width:'+pct+'%"></div></div>'
        +delta+'</div>';
    }).join('');
  }
  function bul(arr){if(!arr||!arr.length)return '<p style="font-size:12px;color:#999;">'+'\u2014'+'</p>';return '<ul class="bullets">'+arr.map(x=>'<li>'+x+'</li>').join('')+'</ul>';}
  function alts(arr){if(!arr||!arr.length)return '';return arr.map(a=>'<div class="alert-box">'+a+'</div>').join('');}
  function pro(t){return '<div class="sec-body">'+(t||''+'\u2014'+'')+'</div>';}

  // Progress banner if there's a previous report
  let progressHTML='';
  if(prev){
    progressHTML='<div class="progress-banner"><h4>Progreso desde el primer análisis</h4>'
      +d.scores.map(s=>{
        const cur=Math.round(s.val);
        const prevS=prev.scores.find(ps=>ps.label===s.label);
        const pre=prevS?Math.round(prevS.val):0;
        const diff=cur-pre;
        return '<div class="prog-row">'
          +'<div class="prog-label">'+s.label+'</div>'
          +'<div class="prog-bars">'
          +'<div class="prog-bar-wrap"><div class="prog-bar-bg"><div class="prog-bar-fill bar-before" style="width:'+pre+'%"></div></div><div class="prog-bar-lbl" style="color:#999;">'+pre+'%</div></div>'
          +'<div class="prog-bar-wrap"><div class="prog-bar-bg"><div class="prog-bar-fill bar-after" style="width:'+cur+'%"></div></div><div class="prog-bar-lbl" style="color:#8C7B80;">'+cur+'%</div></div>'
          +'</div>'
          +'<div class="prog-change">'+(diff>=0?'+':'')+diff+'%</div>'
          +'</div>';
      }).join('')+'</div>';
  }

  return progressHTML
    +'<div class="report">'
    +'<div class="rhead">'
      +'<div><div class="rhead-name">Micaela Jairedin</div><div class="rhead-title">Career Coach & Recruiter</div></div>'
      +'<div class="rhead-meta"><div class="rhead-tag">Informe de perfil</div><div class="rhead-cand">'+(d.candidato||''+'\u2014'+'')+'</div><div class="rhead-date">'+(d.fecha||new Date().toLocaleDateString('es-ES'))+'</div></div>'
    +'</div>'
    +'<div class="rbody">'
      +'<div class="scores-grid">'+sc(d.scores||[])+'</div>'
      +'<div class="sec"><div class="sec-title">Resumen ejecutivo</div>'+pro(d.resumen)+'</div>'
      +'<div class="sec"><div class="sec-title">Fortalezas a explotar</div>'+bul(d.fortalezas)+'</div>'
      +'<div class="sec"><div class="sec-title">Gaps y puntos de mejora</div>'+bul(d.gaps)+'</div>'
      +'<div class="sec"><div class="sec-title">Contexto del mercado 2025</div>'+pro(d.mercado)+'</div>'
      +'<div class="sec"><div class="sec-title">Estrategia recomendada</div>'+pro(d.estrategia)+'</div>'
      +'<div class="sec"><div class="sec-title">Acciones '+'\u2014'+' CV</div>'+bul(d.cv_acciones)+'</div>'
      +'<div class="sec"><div class="sec-title">Acciones '+'\u2014'+' LinkedIn</div>'+bul(d.linkedin_acciones)+'</div>'
      +'<div class="sec"><div class="sec-title">Acciones '+'\u2014'+' Networking</div>'+bul(d.networking_acciones)+'</div>'
      +'<div class="sec"><div class="sec-title">Alertas internas (solo coach)</div>'+alts(d.alertas)+'</div>'
      +(d.mensaje_candidato?'<div class="sec"><div class="sec-title">Mensaje para el candidato</div><div class="motivador">'+d.mensaje_candidato+'</div></div>':'')
    +'</div>'
    +'<div class="rfooter"><div class="rfooter-brand">Micaela Jairedin &middot; Career Coach & Recruiter</div><div class="rfooter-note">Documento confidencial</div></div>'
    +'</div>';
}

function tabNotas(c){
  const saved=notes[c.id]||'';
  return '<div>'
    +'<p style="font-size:12px;color:#999;margin-bottom:10px;">Notas privadas '+'\u2014'+' el candidato nunca las verá.</p>'
    +'<textarea class="narea" id="note-'+c.id+'" placeholder="Escribe tus observaciones, ideas para la sesión...">'+saved+'</textarea>'
    +'<div style="margin-top:8px;display:flex;align-items:center;gap:8px;">'
    +'<button class="btn" onclick="saveNote('+c.id+')">Guardar</button>'
    +'<span class="saveok" id="sok-'+c.id+'">Guardado \u2713</span>'
    +'</div></div>';
}

function saveNote(id){
  notes[id]=document.getElementById('note-'+id).value;
  localStorage.setItem('mj_panel_notes',JSON.stringify(notes));
  const el=document.getElementById('sok-'+id);el.style.display='inline';setTimeout(()=>el.style.display='none',2500);
}

function publicarInforme(id){
  const rep=reps[id];if(!rep)return;
  const c=cands.find(x=>x.id===id);
  const d=rep.data;

  // Show editor modal before publishing
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem;';
  modal.innerHTML='<div style="background:#fff;border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;font-family:Montserrat,sans-serif;">'
    +'<h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">Revisar antes de publicar</h3>'
    +'<p style="font-size:12px;color:#666;margin-bottom:16px;line-height:1.5;">Edita el informe antes de enviárselo al cliente. Los cambios solo afectan a la versión publicada.</p>'
    +'<div style="margin-bottom:12px;">'
      +'<label style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px;">Resumen ejecutivo</label>'
      +'<textarea id="ed-resumen" style="width:100%;padding:10px;font-size:12px;font-family:Montserrat,sans-serif;border:1.5px solid #ddd;border-radius:8px;resize:vertical;min-height:80px;outline:none;" onfocus="this.style.borderColor='#8C7B80'" onblur="this.style.borderColor='#ddd'">'+( d.resumen||'')+'</textarea>'
    +'</div>'
    +'<div style="margin-bottom:12px;">'
      +'<label style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px;">Mensaje para el cliente</label>'
      +'<textarea id="ed-mensaje" style="width:100%;padding:10px;font-size:12px;font-family:Montserrat,sans-serif;border:1.5px solid #ddd;border-radius:8px;resize:vertical;min-height:80px;outline:none;" onfocus="this.style.borderColor='#8C7B80'" onblur="this.style.borderColor='#ddd'">'+( d.mensaje_candidato||'')+'</textarea>'
    +'</div>'
    +'<div style="margin-bottom:16px;">'
      +'<label style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px;">Puntuaciones (%)</label>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
      +d.scores.map((s,i)=>'<div><label style="font-size:10px;color:#999;display:block;margin-bottom:3px;">'+s.label+'</label>'
        +'<input type="number" id="ed-score-'+i+'" min="0" max="100" value="'+Math.round(s.val)+'" style="width:100%;padding:7px 10px;font-size:13px;font-family:Montserrat,sans-serif;border:1.5px solid #ddd;border-radius:8px;outline:none;" onfocus="this.style.borderColor='#8C7B80'" onblur="this.style.borderColor='#ddd'"></div>').join('')
      +'</div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end;">'
      +'<button class="btn-sec" onclick="this.closest('div[style*=fixed]').remove()">Cancelar</button>'
      +'<button class="btn" onclick="confirmarPublicar('+id+',this)">Publicar al cliente -></button>'
    +'</div>'
  +'</div>';
  document.body.appendChild(modal);
}

function confirmarPublicar(id, btn){
  const rep=reps[id];if(!rep)return;
  const c=cands.find(x=>x.id===id);
  const d=rep.data;

  // Apply edits
  d.resumen=document.getElementById('ed-resumen').value;
  d.mensaje_candidato=document.getElementById('ed-mensaje').value;
  d.scores=d.scores.map((s,i)=>({...s,val:parseInt(document.getElementById('ed-score-'+i).value)||s.val}));

  btn.textContent='Publicando...';btn.disabled=true;

  // Find previous published informe for this email to use as prev
  const prevRep=rep.prev;

  rep.data=d;rep.published=true;
  localStorage.setItem('mj_panel_reps',JSON.stringify(reps));

  sbInsert('informes',{candidato_id:id,email:c.email,data:JSON.stringify(d),prev:prevRep?JSON.stringify(prevRep):null})
    .then(()=>{
      document.querySelector('div[style*="position:fixed"]').remove();
      renderSidebar();renderMain(c);
      // Show URL
      verUrlCliente(id);
    })
    .catch(()=>{btn.textContent='Publicar al cliente ->';btn.disabled=false;alert('Error al publicar. Inténtalo de nuevo.');});
}

function verUrlCliente(id){
  const c=cands.find(x=>x.id===id);
  const url=BASE+'/cliente.html?email='+encodeURIComponent(c.email);
  const box=document.createElement('div');
  box.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;';
  box.innerHTML='<div style="background:#fff;border-radius:14px;padding:24px;max-width:480px;width:90%;font-family:Montserrat,sans-serif;">'
    +'<h3 style="font-size:15px;font-weight:700;margin-bottom:8px;">URL del cliente</h3>'
    +'<p style="font-size:12px;color:#666;margin-bottom:12px;">Envía este link al candidato para que vea su informe:</p>'
    +'<div style="background:#f9f8f8;border-radius:8px;padding:10px;font-size:11px;font-family:monospace;word-break:break-all;color:#333;margin-bottom:12px;">'+url+'</div>'
    +'<div style="display:flex;gap:8px;">'
    +'<button class="btn" onclick="navigator.clipboard.writeText(\''+url+'\').then(()=>this.textContent=\'Copiado \u2713\')">Copiar link</button>'
    +'<button class="btn-sec" onclick="this.closest(\'div[style*=fixed]\').remove()">Cerrar</button>'
    +'</div></div>';
  document.body.appendChild(box);
}

function printReport(){window.print();}
function escH(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

loadCands();
