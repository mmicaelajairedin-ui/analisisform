<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Panel — Micaela Jairedin</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Montserrat',sans-serif;background:#f5f5f3;color:#1a1a1a;min-height:100vh;}
.layout{display:grid;grid-template-columns:290px 1fr;min-height:100vh;}
.sidebar{background:#fff;border-right:1px solid #eee;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden;}
.sb-top{padding:14px 16px;border-bottom:1px solid #eee;}
.sb-top h1{font-size:14px;font-weight:700;}
.sb-top p{font-size:10px;color:#999;margin-top:1px;}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:8px;}
.stat{background:#f9f8f8;border-radius:7px;padding:8px 10px;}
.stat-l{font-size:9px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
.stat-v{font-size:18px;font-weight:700;color:#8C7B80;}
.refresh-btn{margin:0 8px 6px;padding:7px;font-size:11px;font-weight:600;font-family:'Montserrat',sans-serif;background:transparent;border:1px solid #eee;border-radius:7px;cursor:pointer;color:#666;width:calc(100% - 16px);}
.refresh-btn:hover{border-color:#8C7B80;color:#8C7B80;}
.clist{flex:1;overflow-y:auto;padding:6px;}
.crow{padding:9px 10px;border-radius:8px;cursor:pointer;margin-bottom:3px;border:1px solid transparent;transition:all .12s;}
.crow:hover{background:#f9f8f8;border-color:#eee;}
.crow.on{background:#f3efef;border-color:#8C7B80;}
.crow-top{display:flex;align-items:center;gap:8px;margin-bottom:3px;}
.av{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;}
.crow-name{font-size:12px;font-weight:600;flex:1;}
.crow-sub{font-size:10px;color:#999;margin-left:36px;}
.crow-pills{display:flex;gap:3px;margin-top:4px;margin-left:36px;flex-wrap:wrap;}
.pill{font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;}
.pill-new{background:#fef3e2;color:#b45309;}
.pill-ok{background:#E1F5EE;color:#085041;}
.pill-rep{background:#f3efef;color:#6B5A5F;}
.pill-pub{background:#e8f5e9;color:#2e7d32;}
.main{padding:20px;overflow-y:auto;}
.empty-main{display:flex;align-items:center;justify-content:center;min-height:60vh;color:#ccc;font-size:13px;}
.chead{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #eee;flex-wrap:wrap;}
.av-big{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;}
.chead-name{font-size:16px;font-weight:700;}
.chead-sub{font-size:11px;color:#999;margin-top:1px;}
.tabs{display:flex;border-bottom:1px solid #eee;margin-bottom:18px;overflow-x:auto;}
.tab{font-size:12px;padding:8px 13px;cursor:pointer;color:#666;border-bottom:2px solid transparent;margin-bottom:-1px;font-weight:500;white-space:nowrap;transition:all .12s;}
.tab.on{color:#8C7B80;border-bottom-color:#8C7B80;font-weight:700;}
.tc{display:none;}.tc.on{display:block;}
.btn{padding:8px 15px;font-size:12px;font-weight:600;font-family:'Montserrat',sans-serif;background:#8C7B80;color:#fff;border:none;border-radius:7px;cursor:pointer;}
.btn:hover{background:#6B5A5F;}
.btn-sec{padding:8px 15px;font-size:12px;font-weight:600;font-family:'Montserrat',sans-serif;background:transparent;color:#8C7B80;border:1.5px solid #8C7B80;border-radius:7px;cursor:pointer;}
.btn-sec:hover{background:#f3efef;}
.btn-green{background:#1D9E75;}.btn-green:hover{background:#0F6E56;}
.igrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px;}
.ii{background:#f9f8f8;border-radius:7px;padding:9px 11px;}
.iil{font-size:9px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;}
.iiv{font-size:12px;color:#1a1a1a;font-weight:500;line-height:1.4;}
.fw{grid-column:1/-1;}
.gen-box{background:#fff;border:1px solid #eee;border-radius:9px;padding:14px;margin-bottom:10px;}
.gen-box h3{font-size:13px;font-weight:700;margin-bottom:3px;}
.gen-box p{font-size:12px;color:#666;margin-bottom:8px;line-height:1.5;}
textarea{width:100%;padding:9px 11px;font-size:12px;font-family:'Montserrat',sans-serif;border:1.5px solid #ddd;border-radius:7px;resize:vertical;outline:none;line-height:1.5;color:#1a1a1a;}
textarea:focus{border-color:#8C7B80;}
.prompt-box{background:#f9f8f8;border-radius:7px;padding:9px;font-size:11px;font-family:monospace;color:#333;max-height:130px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;border:1px solid #eee;margin-bottom:7px;}
.status{font-size:11px;margin-top:6px;min-height:14px;}
.rbox{background:#f9f8f8;border-radius:10px;padding:14px;}
.rchip{display:inline-block;background:#D4C5C8;color:#4A3A3E;font-size:10px;font-weight:700;padding:3px 11px;border-radius:20px;margin-bottom:10px;}
.scores-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:14px;}
.sc{background:#fff;border-radius:7px;padding:9px 5px;text-align:center;}
.sc-lbl{font-size:8px;font-weight:700;color:#8C7B80;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;line-height:1.3;}
.sc-pct{font-size:18px;font-weight:700;}
.hi{color:#4a7c5f;}.mid{color:#8C7B80;}.lo{color:#c0756e;}
.sc-bar{height:3px;background:#eee;border-radius:2px;margin-top:4px;overflow:hidden;}
.sc-fill{height:3px;border-radius:2px;}
.fill-hi{background:#4a7c5f;}.fill-mid{background:#8C7B80;}.fill-lo{background:#c0756e;}
.sec{margin-bottom:14px;}
.sec-t{font-size:9px;font-weight:700;color:#8C7B80;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;display:flex;align-items:center;gap:5px;}
.sec-t::after{content:'';flex:1;height:1px;background:#ece8e8;}
.sec-body{font-size:12px;color:#2a2a2a;line-height:1.7;white-space:pre-wrap;}
.buls{list-style:none;padding:0;}
.buls li{font-size:12px;color:#2a2a2a;line-height:1.6;padding:4px 0 4px 13px;position:relative;border-bottom:.5px solid #f0ece8;}
.buls li:last-child{border-bottom:none;}
.buls li::before{content:'';position:absolute;left:0;top:11px;width:4px;height:4px;border-radius:50%;background:#8C7B80;}
.alert-b{background:#fdf6f6;border-left:3px solid #c0756e;border-radius:0 6px 6px 0;padding:7px 11px;margin-bottom:5px;font-size:12px;line-height:1.5;}
.motivador{background:#f3efef;border-radius:7px;padding:12px;font-size:12px;color:#4a3a3e;line-height:1.65;font-style:italic;border-left:3px solid #8C7B80;}
.narea{width:100%;font-size:12px;line-height:1.6;padding:9px 11px;border:1.5px solid #ddd;border-radius:7px;font-family:'Montserrat',sans-serif;resize:vertical;min-height:100px;outline:none;}
.narea:focus{border-color:#8C7B80;}
.code-box{background:#e8f5e9;border-radius:8px;padding:11px;margin-top:8px;}
.code-val{font-size:20px;font-weight:700;letter-spacing:.2em;color:#1a1a1a;background:#fff;display:inline-block;padding:3px 14px;border-radius:5px;}
/* MODAL */
.modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem;}
.modal-box{background:#fff;border-radius:13px;padding:22px;max-width:580px;width:100%;max-height:90vh;overflow-y:auto;}
.modal-box h3{font-size:14px;font-weight:700;margin-bottom:12px;}
.mf{margin-bottom:10px;}
.mf label{display:block;font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
.mf textarea,.mf input{width:100%;padding:8px 10px;font-size:12px;font-family:'Montserrat',sans-serif;border:1.5px solid #ddd;border-radius:7px;outline:none;color:#1a1a1a;resize:vertical;}
.mf textarea:focus,.mf input:focus{border-color:#8C7B80;}
.mf input[type=number]{width:80px;resize:none;}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;}
</style>
</head>
<body>
<div class="layout">
<div class="sidebar">
  <div class="sb-top"><h1>Panel del coach</h1><p>Micaela Jairedin &middot; Career Coach & Recruiter</p></div>
  <div class="stats">
    <div class="stat"><div class="stat-l">Total</div><div class="stat-v" id="st-tot">0</div></div>
    <div class="stat"><div class="stat-l">Informes</div><div class="stat-v" id="st-rep">0</div></div>
    <div class="stat"><div class="stat-l">CVs</div><div class="stat-v" id="st-cv">0</div></div>
    <div class="stat"><div class="stat-l">Nuevos</div><div class="stat-v" id="st-new">0</div></div>
  </div>
  <button class="refresh-btn" onclick="loadCands()">&#8635; Actualizar</button>
  <div class="clist" id="clist"><div style="padding:2rem;text-align:center;color:#999;font-size:12px;">Cargando...</div></div>
</div>
<div class="main" id="main"><div class="empty-main">Selecciona un candidato</div></div>
</div>

<!-- MODALS -->
<div class="modal-overlay" id="modal-edit-inf" style="display:none;" onclick="if(event.target===this)cerrarModal('modal-edit-inf')">
  <div class="modal-box">
    <h3>Editar informe</h3>
    <div class="mf"><label>Resumen ejecutivo</label><textarea id="ei-res" rows="3"></textarea></div>
    <div class="mf"><label>Fortalezas (una por linea)</label><textarea id="ei-for" rows="4"></textarea></div>
    <div class="mf"><label>Gaps (una por linea)</label><textarea id="ei-gap" rows="4"></textarea></div>
    <div class="mf"><label>Mercado 2025</label><textarea id="ei-mer" rows="3"></textarea></div>
    <div class="mf"><label>Estrategia</label><textarea id="ei-est" rows="3"></textarea></div>
    <div class="mf"><label>Acciones CV (una por linea)</label><textarea id="ei-cv" rows="4"></textarea></div>
    <div class="mf"><label>Acciones LinkedIn (una por linea)</label><textarea id="ei-li" rows="4"></textarea></div>
    <div class="mf"><label>Acciones networking (una por linea)</label><textarea id="ei-net" rows="4"></textarea></div>
    <div class="mf"><label>Preguntas sesion (una por linea)</label><textarea id="ei-preg" rows="4"></textarea></div>
    <div class="mf"><label>Alertas (una por linea)</label><textarea id="ei-alert" rows="3"></textarea></div>
    <div class="mf"><label>Mensaje al candidato</label><textarea id="ei-msg" rows="3"></textarea></div>
    <div class="mf"><label>Puntuaciones (%)</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;" id="ei-scores"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-sec" onclick="cerrarModal('modal-edit-inf')">Cancelar</button>
      <button class="btn btn-green" onclick="guardarInforme()">Guardar</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="modal-edit-cv" style="display:none;" onclick="if(event.target===this)cerrarModal('modal-edit-cv')">
  <div class="modal-box">
    <h3>Editar CV publicado</h3>
    <div class="mf"><label>Texto completo del CV</label><textarea id="ec-text" rows="20" style="font-family:monospace;font-size:11px;"></textarea></div>
    <div class="modal-actions">
      <button class="btn-sec" onclick="cerrarModal('modal-edit-cv')">Cancelar</button>
      <button class="btn btn-green" onclick="guardarCV()">Guardar y republicar</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="modal-pub-inf" style="display:none;" onclick="if(event.target===this)cerrarModal('modal-pub-inf')">
  <div class="modal-box">
    <h3>Revisar antes de publicar</h3>
    <p style="font-size:12px;color:#666;margin-bottom:12px;">Edita el informe antes de enviarselo al cliente.</p>
    <div class="mf"><label>Resumen ejecutivo</label><textarea id="pi-res" rows="3"></textarea></div>
    <div class="mf"><label>Mensaje al candidato</label><textarea id="pi-msg" rows="3"></textarea></div>
    <div class="mf"><label>Puntuaciones (%)</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;" id="pi-scores"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-sec" onclick="cerrarModal('modal-pub-inf')">Cancelar</button>
      <button class="btn btn-green" onclick="confirmarPublicar()">Publicar al cliente</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="modal-url" style="display:none;" onclick="if(event.target===this)cerrarModal('modal-url')">
  <div class="modal-box">
    <h3>URLs del cliente</h3>
    <div id="modal-url-content"></div>
    <div class="modal-actions">
      <button class="btn-sec" onclick="cerrarModal('modal-url')">Cerrar</button>
    </div>
  </div>
</div>

<script>
var SB='https://ddxnrsnjdvtqhxunxnwj.supabase.co';
var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
var BASE='https://mmicaelajairedin-ui.github.io/analisisform';
var COLORS=['#E8D5D8:#6B4A50','#D5DDE8:#4A5A6B','#D5E8D8:#4A6B4A','#E8E0D5:#6B5A4A','#E0D5E8:#5A4A6B'];

var cands=[], reps={}, cvs={}, notes={}, activeId=null, atab='datos', editInfId=null, editCvId=null, pubInfId=null, urlId=null;

function sbGet(table,filter){
  return fetch(SB+'/rest/v1/'+table+'?'+filter+'&order=created_at.desc',{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}}).then(function(r){if(!r.ok)throw new Error('API error '+r.status+' on '+table);return r.json();});
}
function sbPost(table,data){
  return fetch(SB+'/rest/v1/'+table,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'},body:JSON.stringify(data)}).then(function(r){if(!r.ok)throw new Error(r.status);});
}
function sbUpsert(table,data){
  var email=data.email||'';
  // Check if exists, then PATCH or POST
  return fetch(SB+'/rest/v1/'+table+'?email=eq.'+encodeURIComponent(email)+'&select=id',{
    headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
  }).then(function(r){return r.json();}).then(function(rows){
    if(rows&&rows.length){
      // PATCH existing
      return fetch(SB+'/rest/v1/'+table+'?email=eq.'+encodeURIComponent(email),{
        method:'PATCH',
        headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'},
        body:JSON.stringify(data)
      });
    } else {
      // POST new
      return fetch(SB+'/rest/v1/'+table,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'},
        body:JSON.stringify(data)
      });
    }
  }).then(function(r){if(r&&!r.ok)throw new Error(r.status);});
}
function escH(t){return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function toArr(id){return document.getElementById(id).value.split('\n').map(function(l){return l.trim();}).filter(Boolean);}
function cerrarModal(id){document.getElementById(id).style.display='none';}
function abrirModal(id){document.getElementById(id).style.display='flex';}
function showToast(msg){var t=document.createElement('div');t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;font-size:13px;font-weight:600;padding:11px 22px;border-radius:10px;z-index:99999;font-family:Montserrat,sans-serif;';t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove();},3000);}

function ini(name){return (name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();}
function col(i){return COLORS[i%COLORS.length].split(':');}

function loadCands(){
  document.getElementById('clist').innerHTML='<div style="padding:2rem;text-align:center;color:#999;font-size:12px;">Cargando...</div>';
  Promise.all([
    sbGet('candidatos','select=*'),
    sbGet('informes','select=*'),
    sbGet('cv_publicados','select=id,email,codigo,contenido,created_at')
  ]).then(function(res){
    var all=res[0], allReps=res[1], allCvs=res[2];
    var byEmail={};
    all.forEach(function(c){
      var k=(c.email||'').toLowerCase().trim();
      if(!byEmail[k])byEmail[k]=[];
      byEmail[k].push(c);
    });
    cands=Object.values(byEmail).map(function(g){
      g.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
      g[0]._subs=g.length;g[0]._hist=g;return g[0];
    });
    cands.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
    reps={};
    allReps.forEach(function(r){
      var k=(r.email||'').toLowerCase().trim();
      if(!reps[k])reps[k]=[];
      reps[k].push(r);
    });
    cvs={};
    allCvs.forEach(function(cv){cvs[(cv.email||'').toLowerCase().trim()]=cv;});
    try{notes=JSON.parse(localStorage.getItem('mj_notes')||'{}');}catch(e){notes={};}
    // Merge with Supabase notes
    cands.forEach(function(c){
      if(c.notas_coach){notes[c.id]=c.notas_coach;}
    });
    localStorage.setItem('mj_notes',JSON.stringify(notes));
    renderSidebar();
    if(activeId){var c=cands.find(function(x){return x.id===activeId;});if(c)renderMain(c);}
  }).catch(function(){
    document.getElementById('clist').innerHTML='<div style="padding:2rem;text-align:center;color:#999;font-size:12px;">Error. Pulsa Actualizar.</div>';
  });
}

function renderSidebar(){
  var newC=cands.filter(function(c){return !localStorage.getItem('seen_'+c.id);}).length;
  document.getElementById('st-tot').textContent=cands.length;
  document.getElementById('st-rep').textContent=Object.keys(reps).length;
  document.getElementById('st-cv').textContent=Object.keys(cvs).length;
  document.getElementById('st-new').textContent=newC;
  var list=document.getElementById('clist');
  if(!cands.length){list.innerHTML='<div style="padding:2rem;text-align:center;color:#999;font-size:12px;">No hay candidatos aun.</div>';return;}
  list.innerHTML='';
  cands.forEach(function(c,i){
    var seen=localStorage.getItem('seen_'+c.id);
    var email=(c.email||'').toLowerCase().trim();
    var hasRep=!!(reps[email]&&reps[email].length);
    var hasCv=!!cvs[email];
    var cl=col(i);
    var d=document.createElement('div');
    d.className='crow'+(activeId===c.id?' on':'');
    d.onclick=function(){openCand(c.id);};
    d.innerHTML='<div class="crow-top"><div class="av" style="background:'+cl[0]+';color:'+cl[1]+'">'+ini(c.nombre)+'</div>'
      +'<div class="crow-name">'+escH(c.nombre||'--')+(c._subs>1?' <span style="font-size:9px;background:#f3efef;color:#6B5A5F;padding:1px 5px;border-radius:8px;">'+c._subs+'x</span>':'')+'</div></div>'
      +'<div class="crow-sub">'+escH(c.rol||c.sector||'--')+' &middot; '+escH(c.ciudad||'--')+'</div>'
      +'<div class="crow-pills">'
      +(!seen?'<span class="pill pill-new">Nuevo</span>':'<span class="pill pill-ok">Visto</span>')
      +(hasRep?'<span class="pill pill-rep">Informe</span>':'')
      +(hasCv?'<span class="pill pill-pub">CV</span>':'')
      +'</div>';
    list.appendChild(d);
  });
}

function openCand(id){
  activeId=id;atab='datos';
  localStorage.setItem('seen_'+id,'1');
  var c=cands.find(function(x){return x.id===id;});
  renderSidebar();renderMain(c);
}

function renderMain(c){
  var email=(c.email||'').toLowerCase().trim();
  var hasRep=!!(reps[email]&&reps[email].length);
  var hasCv=!!cvs[email];
  var isPub=hasRep&&reps[email][0].published;
  var i=cands.findIndex(function(x){return x.id===c.id;});
  var cl=col(i);
  var tabs=['datos','generar','cv'];
  if(hasRep)tabs.splice(2,0,'informe','sesion');
  tabs.push('notas');
  var labels={datos:'Datos',generar:'Generar informe',sesion:'Para mi sesión',informe:'Informe',cv:'Generar CV',notas:'Notas'};
  var tabsHTML=tabs.map(function(t){return '<div class="tab'+(atab===t?' on':'')+'" onclick="switchTab(\''+t+'\','+c.id+')">'+labels[t]+'</div>';}).join('');
  document.getElementById('main').innerHTML=
    '<div class="chead">'
      +'<div class="av-big" style="background:'+cl[0]+';color:'+cl[1]+'">'+ini(c.nombre)+'</div>'
      +'<div><div class="chead-name">'+escH(c.nombre||'--')+'</div><div class="chead-sub">'+escH(c.email||'--')+' &middot; '+escH(c.ciudad||'--')+'</div></div>'
    +'</div>'
    +'<div class="tabs">'+tabsHTML+'</div>'
    +'<div id="tc">'+renderTab(c,atab)+'</div>';
}

function switchTab(tab,id){
  atab=tab;
  var c=cands.find(function(x){return x.id===id;});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
  event.target.classList.add('on');
  document.getElementById('tc').innerHTML=renderTab(c,tab);
  // Restore saved textarea values
  setTimeout(function(){
    var jel=document.getElementById('json-'+id);
    if(jel&&!jel.value){var s=localStorage.getItem('json_'+id);if(s)jel.value=s;}
    var cel=document.getElementById('cvt-'+id);
    if(cel&&!cel.value){var s2=localStorage.getItem('cvtext_'+id);if(s2)cel.value=s2;}
    if(jel)jel.oninput=function(){localStorage.setItem('json_'+id,this.value);};
    if(cel)cel.oninput=function(){localStorage.setItem('cvtext_'+id,this.value);};

  },30);
}

function renderTab(c,tab){
  if(tab==='datos')return tabDatos(c);
  if(tab==='generar')return tabGenerar(c);
  if(tab==='informe')return tabInforme(c);
  if(tab==='sesion')return tabSesion(c);
  if(tab==='cv')return tabCV(c);
  if(tab==='notas')return tabNotas(c);
  return '';
}

function tabDatos(c){
  var liUrl=c.linkedin?'linkedin.com/in/'+c.linkedin:'No tiene';
  var obs=(c.obstaculos||'').split('|').map(function(s){return s.trim();}).filter(Boolean);
  return '<div class="igrid">'
    +'<div class="ii"><div class="iil">Situacion</div><div class="iiv">'+escH(c.situacion||'--')+'</div></div>'
    +'<div class="ii"><div class="iil">Urgencia</div><div class="iiv">'+escH(c.urgencia||'--')+'</div></div>'
    +'<div class="ii"><div class="iil">Rol buscado</div><div class="iiv">'+escH(c.rol||'--')+'</div></div>'
    +'<div class="ii"><div class="iil">Salario</div><div class="iiv">'+escH(c.salario||'--')+'</div></div>'
    +'<div class="ii"><div class="iil">LinkedIn</div><div class="iiv">'+escH(liUrl)+'<br><span style="font-size:10px;color:#999">'+escH(c.li_estado||'--')+'</span></div></div>'
    +'<div class="ii"><div class="iil">CV</div><div class="iiv">'+escH(c.cv||'No subido')+(c.cv_url&&c.cv_url!=='No subido'?'<br><a href="'+escH(c.cv_url)+'" target="_blank" style="font-size:10px;color:#8C7B80;font-weight:600;">Descargar</a>':'')+'</div></div>'
    +'<div class="ii fw"><div class="iil">Objetivo</div><div class="iiv" style="font-weight:400;line-height:1.5">'+escH(c.objetivo||'--')+'</div></div>'
    +'<div class="ii fw"><div class="iil">Logro destacado</div><div class="iiv" style="font-weight:400;line-height:1.5">'+escH(c.logro||'--')+'</div></div>'
    +(c.extra&&c.extra!=='--'?'<div class="ii fw"><div class="iil">Fuera del CV</div><div class="iiv" style="font-weight:400;line-height:1.5">'+escH(c.extra)+'</div></div>':'')
    +'</div>'
    +'<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;">Obstaculos</div>'
    +'<div>'+(obs.length?obs.map(function(o){return '<div style="font-size:12px;padding:5px 0 5px 12px;position:relative;border-bottom:.5px solid #f0ece8;"><span style="position:absolute;left:0;top:12px;width:4px;height:4px;border-radius:50%;background:#c0756e;display:block;"></span>'+escH(o)+'</div>';}).join(''):'<span style="font-size:12px;color:#999;">No indicados</span>')+'</div></div>';
}

function tabGenerar(c){
  var email=(c.email||'').toLowerCase().trim();
  var liUrl=c.linkedin?'https://linkedin.com/in/'+c.linkedin:'No tiene';
  var fecha=new Date().toLocaleDateString('es-ES');
  var obs=(c.obstaculos||'').split('|').map(function(s){return s.trim();}).filter(Boolean).join('\n- ');
  var red=(c.red_profesional||'').split('|').map(function(s){return s.trim();}).filter(Boolean).join(', ');
  var prompt='Eres el asistente de Micaela Jairedin, Career Coach especializada en el mercado europeo.\n'
    +'Analiza este candidato y devuelve SOLO un JSON valido, sin markdown ni texto adicional. val=1-100.\n\n'
    +'=== DATOS ===\n'
    +'Nombre: '+(c.nombre||'--')+'\nEmail: '+(c.email||'--')+'\nCiudad: '+(c.ciudad||'--')+'\n'
    +'Experiencia: '+(c.exp||'--')+'\nSector: '+(c.sector||'--')+'\nCargo: '+(c.cargo||'--')+'\n'
    +'Situacion: '+(c.situacion||'--')+'\nObjetivo: '+(c.objetivo||'--')+'\n'
    +'Rol buscado: '+(c.rol||'--')+'\nEmpresa objetivo: '+(c.empresa||'--')+'\nModalidad: '+(c.modalidad||'--')+'\n'
    +'Salario: '+(c.salario||'--')+'\nMovilidad: '+(c.geo||'--')+'\nUrgencia: '+(c.urgencia||'--')+'\n'
    +'Habilidades: '+(c.habilidades||c.skills||'--')+'\nLogro: '+(c.logro||'--')+'\n'
    +'Obstaculos:\n- '+obs+'\nRed: '+red+'\nLinkedIn estado: '+(c.li_estado||'--')+'\n'
    +(c.linkedin?'LinkedIn: '+liUrl+'\n':'')
    +(c.cv_url&&c.cv_url!=='No subido'?'CV: '+c.cv_url+'\n':'')
    +'\n=== JSON EXACTO A DEVOLVER ===\n'
    +'{"candidato":"'+c.nombre+'","fecha":"'+fecha+'",'
    +'"scores":[{"label":"CV y marca personal","val":0},{"label":"LinkedIn","val":0},{"label":"Claridad de objetivo","val":0},{"label":"Red de contactos","val":0},{"label":"Propuesta de valor","val":0}],'
    +'"resumen":"situacion actual 3-4 frases","fortalezas":["f1","f2","f3","f4"],"gaps":["g1","g2","g3","g4"],'
    +'"mercado":"analisis mercado 2025","estrategia":"estrategia recomendada",'
    +'"cv_acciones":["a1","a2","a3","a4","a5"],"linkedin_acciones":["a1","a2","a3","a4","a5"],"networking_acciones":["a1","a2","a3","a4","a5"],'
    +'"preguntas":["p1","p2","p3"],"alertas":["al1","al2"],'
    +'"mensaje_candidato":"mensaje motivador de Micaela","nicho":"nicho recomendado"}';
  window['_p_'+c.id]=prompt;
  var saved=localStorage.getItem('json_'+c.id)||'';
  var savedCvLi=c.linkedin_texto||localStorage.getItem('cvli_'+c.id)||'';
  var html='';
  html+='<div class="gen-box">';
  html+='<h3>Paso 1 &mdash; Pega el CV y LinkedIn del cliente</h3>';
  html+='<p style="font-size:12px;color:#666;margin-bottom:8px;">Abre el CV y el LinkedIn del cliente, copia todo el texto y p\u00e9galo aqu\u00ed. Se incluir\u00e1 en el prompt autom\u00e1ticamente.</p>';
  html+='<textarea id="paste-area-'+c.id+'" rows="5" placeholder="Pega aqu\u00ed el texto del CV y LinkedIn del cliente..." style="width:100%;padding:8px 10px;font-size:11px;font-family:Montserrat,sans-serif;border:1.5px solid #f3c94b;border-radius:6px;resize:vertical;outline:none;background:#fffdf0;">'+escH(savedCvLi)+'</textarea>';
  html+='<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">';
  html+='<button class="btn" style="background:#f3a41b;" onclick="guardarCVLinkedIn('+c.id+')">Guardar</button>';
  html+='<span id="cvli-st-'+c.id+'" style="font-size:11px;color:#666;"></span>';
  html+='</div></div>';
  html+='<div class="gen-box">';
  html+='<h3>Paso 2 &mdash; Copia el prompt</h3>';
  html+='<p style="font-size:12px;color:#666;margin-bottom:8px;">Pega este prompt en Claude.ai y obtendr\u00e1s el JSON del informe.</p>';
  html+='<div class="prompt-box">'+escH(prompt)+'</div>';
  html+='<button class="btn" onclick="copiarPBtn(this)" data-cid="'+c.id+'">Copiar prompt</button>';
  html+='<div class="status" id="st-p-'+c.id+'"></div>';
  html+='</div>';
  html+='<div class="gen-box">';
  html+='<h3>Paso 3 &mdash; Pega el JSON</h3>';
  html+='<p style="font-size:12px;color:#666;margin-bottom:8px;">Pega aqu\u00ed el JSON que te devolvi\u00f3 Claude.ai y pulsa Generar.</p>';
  html+='<textarea id="json-'+c.id+'" rows="6" placeholder="Pega aqu\u00ed el JSON..." style="width:100%;padding:8px 10px;font-size:11px;font-family:Montserrat,sans-serif;border:1.5px solid #ddd;border-radius:6px;resize:vertical;outline:none;">'+saved+'</textarea>';
  html+='<button class="btn btn-green" style="margin-top:8px;" onclick="generarInforme('+c.id+')">Generar informe</button>';
  html+='<div class="status" id="st-gen-'+c.id+'"></div>';
  html+='</div>';
  return html;
}

function copiarPCV(btn){
  var cid=btn.getAttribute('data-cid');
  var val=window['_cp_'+cid]||'';
  var pasteEl=document.getElementById('paste-area-'+cid);
  var pasteText=pasteEl?pasteEl.value.trim():'';
  if(pasteText)val=val+'\n\n=== CV Y LINKEDIN ADICIONAL ===\n'+pasteText;
  navigator.clipboard.writeText(val).then(function(){btn.textContent='\u2713 Copiado';setTimeout(function(){btn.textContent='Copiar prompt';},2000);});
}
function copiarPBtn(btn){var cid=btn.getAttribute("data-cid");copiarP(cid,"_p_","st-p-"+cid);}
function copiarP(id,prefix,stId){
  var val=window[prefix+id]||'';
  if(typeof val==='function')val=val();
  // Include pasted CV+LinkedIn content
  var pasteEl=document.getElementById('paste-area-'+id);
  if(!pasteEl){
    var all=document.querySelectorAll('[id^="paste-area-"]');
    if(all.length)pasteEl=all[all.length-1];
  }
  var pasteText=pasteEl?pasteEl.value.trim():'';
  if(pasteText)val=val+'\n\n=== CV Y LINKEDIN DEL CLIENTE ===\n'+pasteText;
  navigator.clipboard.writeText(val).then(function(){
    var st=document.getElementById(stId);if(st){st.textContent='\u2713 Copiado. P\u00e9galo en Claude.ai';st.style.color='#8C7B80';}
  });
}

function generarInforme(id){
  var txt=document.getElementById('json-'+id).value.trim();
  var st=document.getElementById('st-gen-'+id);
  var d;
  try{d=JSON.parse(txt.replace(/```json|```/g,'').trim());}
  catch(e){st.textContent='JSON no valido.';st.style.color='#c0756e';return;}
  var c=cands.find(function(x){return x.id===id;});
  var email=(c.email||'').toLowerCase().trim();
  var prev=reps[email]&&reps[email].length?reps[email][0].data:null;
  if(!reps[email])reps[email]=[];
  reps[email].unshift({data:d,published:false,prev:prev});
  st.textContent='Informe generado. Ve a la pestana Informe.';st.style.color='#4a7c5f';
  setTimeout(function(){atab='informe';renderMain(c);},700);
}

function tabInforme(c){
  var email=(c.email||'').toLowerCase().trim();
  if(!reps[email]||!reps[email].length)return '<p style="color:#999;font-size:13px;padding:1rem 0;">Genera el informe primero en la pestana anterior.</p>';
  var rep=reps[email][0];
  var d=rep.data;if(typeof d==='string')d=JSON.parse(d);
  var isPub=!!rep.published;
  function sc(){return (d.scores||[]).map(function(s){var p=Math.min(100,Math.max(0,Math.round(s.val)));var cl=p>=70?'hi':p>=45?'mid':'lo';return '<div class="sc"><div class="sc-lbl">'+s.label+'</div><div class="sc-pct '+cl+'">'+p+'%</div><div class="sc-bar"><div class="sc-fill fill-'+cl+'" style="width:'+p+'%"></div></div></div>';}).join('');}
  function bul(arr){if(!arr||!arr.length)return '';return '<ul class="buls">'+arr.map(function(x){return '<li>'+escH(x)+'</li>';}).join('')+'</ul>';}
  function pro(t){return '<div class="sec-body">'+escH(t||'')+'</div>';}
  function alts(arr){if(!arr||!arr.length)return '';return arr.map(function(a){return '<div class="alert-b">'+escH(a)+'</div>';}).join('');}
  return '<div style="display:flex;gap:8px;margin-bottom:12px;">'
    +'<button class="btn-sec" style="font-size:11px;padding:6px 12px;" onclick="abrirEditInf('+c.id+')">Editar informe</button>'
    +(isPub?'<button class="btn-sec" style="font-size:11px;padding:6px 12px;" onclick="verURL('+c.id+')">Ver URL cliente</button>':'')
    +'</div>'
    +'<div class="rbox">'
    +'<div class="rchip">Informe &middot; '+(d.fecha||new Date().toLocaleDateString('es-ES'))+'</div>'
    +'<div class="scores-grid">'+sc()+'</div>'
    +'<div class="sec"><div class="sec-t">Resumen</div>'+pro(d.resumen)+'</div>'
    +'<div class="sec"><div class="sec-t">Fortalezas</div>'+bul(d.fortalezas)+'</div>'
    +'<div class="sec"><div class="sec-t">Gaps</div>'+bul(d.gaps)+'</div>'
    +'<div class="sec"><div class="sec-t">Mercado 2025</div>'+pro(d.mercado)+'</div>'
    +'<div class="sec"><div class="sec-t">Estrategia</div>'+pro(d.estrategia)+'</div>'
    +'<div class="sec"><div class="sec-t">Acciones CV</div>'+bul(d.cv_acciones)+'</div>'
    +'<div class="sec"><div class="sec-t">Acciones LinkedIn</div>'+bul(d.linkedin_acciones)+'</div>'
    +'<div class="sec"><div class="sec-t">Networking</div>'+bul(d.networking_acciones)+'</div>'
    +'<div class="sec"><div class="sec-t">Preguntas sesion</div>'+bul(d.preguntas)+'</div>'
    +'<div class="sec"><div class="sec-t">Alertas</div>'+alts(d.alertas)+'</div>'
    +(d.mensaje_candidato?'<div class="sec"><div class="sec-t">Mensaje</div><div class="motivador">'+escH(d.mensaje_candidato)+'</div></div>':'')
    +'</div>'
    +'<div style="margin-top:14px;">'
    +(!isPub
      ?'<button class="btn btn-green" onclick="abrirPubInf('+c.id+')">Publicar informe al cliente</button>'
      :'<div style="background:#e8f5e9;border-radius:8px;padding:12px;display:flex;align-items:center;justify-content:space-between;">'
        +'<div><div style="font-size:12px;font-weight:700;color:#2e7d32;">Publicado</div><div style="font-size:11px;color:#4a7c5f;">El cliente puede ver su informe</div></div>'
        +'<button class="btn btn-green" style="font-size:11px;padding:6px 12px;" onclick="verURL('+c.id+')">Ver URL del cliente</button>'
        +'</div>')
    +'</div>';
}

function tabSesion(c){
  var email=(c.email||'').toLowerCase().trim();
  var repData=reps[email]&&reps[email].length?reps[email][0].data||reps[email][0]:null;
  if(repData&&typeof repData==='string')repData=JSON.parse(repData);
  if(!repData)return '<p style="color:#999;font-size:13px;padding:1rem 0;">Genera el informe primero.</p>';
  var d=repData;
  function bul(arr){if(!arr||!arr.length)return'<p style="color:#999;font-size:12px;">-</p>';return'<ul style="list-style:none;padding:0;">'+arr.map(function(x){return'<li style="padding:5px 0 5px 14px;position:relative;font-size:12px;line-height:1.6;border-bottom:.5px solid #f0f0f0;"><span style="position:absolute;left:0;top:10px;width:5px;height:5px;border-radius:50%;background:#8C7B80;display:block;"></span>'+escH(x)+'</li>';}).join('')+'</ul>';}
  var html='<div style="display:flex;flex-direction:column;gap:12px;">';
  if(d.alertas&&d.alertas.length){
    html+='<div style="background:#fdf6f6;border-radius:10px;border-left:3px solid #c0756e;padding:14px 16px;">'
      +'<div style="font-size:10px;font-weight:700;color:#c0756e;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Alertas para la sesión</div>'
      +bul(d.alertas)+'</div>';
  }
  if(d.preguntas&&d.preguntas.length){
    html+='<div style="background:#EEF3F8;border-radius:10px;border-left:3px solid #4A7FA5;padding:14px 16px;">'
      +'<div style="font-size:10px;font-weight:700;color:#1B3A5C;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Preguntas para hacerle</div>'
      +bul(d.preguntas)+'</div>';
  }
  if(d.mercado){
    html+='<div style="background:#f9f8f8;border-radius:10px;border-left:3px solid #8C7B80;padding:14px 16px;">'
      +'<div style="font-size:10px;font-weight:700;color:#8C7B80;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Análisis de mercado</div>'
      +'<div style="font-size:12px;color:#333;line-height:1.75;">'+escH(d.mercado)+'</div></div>';
  }
  if(d.nicho){
    html+='<div style="background:#f0f7f0;border-radius:10px;border-left:3px solid #4a7c5f;padding:14px 16px;">'
      +'<div style="font-size:10px;font-weight:700;color:#4a7c5f;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Nicho recomendado</div>'
      +'<div style="font-size:12px;color:#333;line-height:1.75;">'+escH(d.nicho)+'</div></div>';
  }
  html+='<div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:14px 16px;">'
    +'<div style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Notas del candidato</div>'
    +'<div id="cand-notes-'+c.id+'" style="font-size:12px;color:#555;line-height:1.7;font-style:italic;">Cargando...</div>'
  +'</div>';
  html+='</div>';
  setTimeout(function(){
    var el=document.getElementById('cand-notes-'+c.id);
    if(!el)return;
    fetch(SB+'/rest/v1/candidatos?email=eq.'+encodeURIComponent(c.email)+'&select=notas_progreso&limit=1',{
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
    }).then(function(r){return r.json();}).then(function(rows){
      if(el)el.textContent=rows&&rows.length&&rows[0].notas_progreso?rows[0].notas_progreso:'(Sin notas aún)';
      if(el)el.style.fontStyle=el.textContent.startsWith('(')?'italic':'normal';
    }).catch(function(){if(el)el.textContent='Error al cargar';});
  },100);
  return html;
}

function tabCV(c){
  var email=(c.email||'').toLowerCase().trim();
  var liUrl=c.linkedin?'https://linkedin.com/in/'+c.linkedin:'No tiene';
  var cvLink=c.cv_url&&c.cv_url!=='No subido'?c.cv_url:'';
  var repData=reps[email]&&reps[email].length?reps[email][0].data||reps[email][0]:null;
  if(repData&&typeof repData==='string')repData=JSON.parse(repData);
  var nicho=repData?repData.nicho||'':'';
  var scores=repData?(repData.scores||[]).map(function(s){return s.label+': '+Math.round(s.val)+'%';}).join(' | '):'';
  var accCV=repData&&repData.cv_acciones?repData.cv_acciones.join('\n- '):'';
  var gaps=repData&&repData.gaps?repData.gaps.join('\n- '):'';
  var obs=(c.obstaculos||'').split('|').map(function(s){return s.trim();}).filter(Boolean).join(', ');
  var savedCvLi=c.linkedin_texto||localStorage.getItem('cvli_'+c.id)||'';

  var urgenciaInmediata=(c.urgencia||'').toLowerCase().indexOf('antes')>=0||
    (c.urgencia||'').toLowerCase().indexOf('urgent')>=0||
    (c.urgencia||'').toLowerCase().indexOf('inmedia')>=0;

  var cvPrompt='Eres experto en RRHH y redaccion de CVs para el mercado europeo (Espana).\n'
    +'Genera un CV profesional en espanol, maximo 2 paginas, con EXACTAMENTE estas secciones en MAYUSCULAS:\n\n'
    +'NOMBRE COMPLETO\n'
    +'ROL OBJETIVO\n'
    +'RESUMEN EJECUTIVO\n'
    +'EXPERIENCIA PROFESIONAL\n'
    +'FORMACION\n'
    +'CERTIFICACIONES\n'
    +'COMPETENCIAS\n'
    +'HERRAMIENTAS\n'
    +'IDIOMAS\n'
    +'OTROS DATOS\n\n'
    +'=== INSTRUCCIONES POR SECCION ===\n'
    +'ROL OBJETIVO: subtitulo profesional en mayusculas, enfocado al nicho del candidato.\n'
    +'RESUMEN EJECUTIVO: MAXIMO 3-4 lineas. Frases cortas con palabras clave ATS y 1-2 logros cuantificados. NO repetir info que ya aparece en experiencia.\n'
    +'  TITULO PUESTO - EMPRESA | Sector | Fechas\n'
    +'  Contexto: una linea describiendo empresa/contexto\n'
    +'  - Bullet: verbo accion + **palabra clave en negrita** + resultado cuantificado (usar numeros con puntos: 1.000)\n'
    +'  (minimo 4 bullets para ultimos 2 puestos, 2 para anteriores)\n'
    +'FORMACION: titulo | escuela | ano inicio - ano fin (de mas reciente a mas antiguo)\n'
    +'CERTIFICACIONES: solo cursos de menos de 1 ano, de mas reciente a mas antiguo\n'
    +'COMPETENCIAS: maximo 6 competencias BLANDAS relacionadas con el rol objetivo. Una por linea.\n'
    +'HERRAMIENTAS: herramientas, software, plataformas. Una por linea. Son tambien palabras clave ATS.\n'
    +'IDIOMAS: un idioma por linea con nivel en formato C1, C2, B2, Nativo (NO usar basico/intermedio/avanzado)\n'
    +'OTROS DATOS: informacion extra que no entra en otras secciones (vehiculo propio, carnet, disponibilidad geografica, etc.)\n'
    +(urgenciaInmediata?'  IMPORTANTE: incluye "Incorporacion inmediata" en OTROS DATOS porque el candidato busca trabajo urgente.\n':'')
    +'\n=== FUENTES DE INFORMACION (usa TODO lo disponible) ===\n'
    +'FORMULARIO DEL CANDIDATO:\n'
    +'Nombre: '+(c.nombre||'--')+'\nEmail: '+(c.email||'--')+'\nCiudad: '+(c.ciudad||'--')+'\n'
    +(c.linkedin?'LinkedIn: linkedin.com/in/'+c.linkedin+'\n':'')
    +(cvLink?'CV adjunto URL: '+cvLink+'\n':'')
    +'Anos experiencia: '+(c.exp||'--')+'\nSector: '+(c.sector||'--')+'\nCargo actual: '+(c.cargo||'--')+'\n'
    +'Rol buscado: '+(c.rol||'--')+'\nModalidad: '+(c.modalidad||'--')+'\nMovilidad: '+(c.geo||'--')+'\n'
    +'Urgencia: '+(c.urgencia||'--')+'\n'
    +'Habilidades: '+(c.habilidades||c.skills||'--')+'\n'
    +'Logro principal: '+(c.logro||'--')+'\n'
    +'Experiencia fuera del CV: '+(c.extra||'--')+'\n'
    +(obs?'Obstaculos: '+obs+'\n':'')
    +(nicho?'Nicho definido: '+nicho+'\n':'')
    +(scores?'Diagnostico scores: '+scores+'\n':'')
    +(savedCvLi?'\n=== TEXTO DEL CV Y LINKEDIN DEL CANDIDATO (FUENTE PRINCIPAL - extrae toda la info) ===\n'+savedCvLi+'\n':'\n(No hay texto de CV/LinkedIn disponible. Usa solo los datos del formulario.)\n')
    +'\n=== REGLAS FINALES ===\n'
    +'- Extrae TODA la experiencia, formacion, certificaciones e idiomas del texto del CV/LinkedIn pegado arriba.\n'
    +'- Usa **negrita** para palabras clave importantes dentro de los bullets.\n'
    +'- Formatea los numeros grandes con puntos: 1.000.000\n'
    +'- NO inventes datos. NO dejes secciones vacias si hay informacion disponible.\n'
    +'- NO repitas la misma informacion en distintas secciones. Cada dato aparece UNA sola vez.\n'
    +'- El RESUMEN no puede repetir bullets de EXPERIENCIA. Es un titular, no un resumen de cargos.\n'
    +'- Las COMPETENCIAS no deben repetirse en HERRAMIENTAS ni en RESUMEN.\n'
    +'- Si un logro ya esta en EXPERIENCIA no lo pongas tambien en RESUMEN.'
    +'- NO pongas notas del autor al final.\n'
    +'- Los titulos de seccion en MAYUSCULAS completas.\n'
    +'- El NOMBRE COMPLETO en mayusculas.\n'
    +'- Las empresas y titulos de puesto con Primera Letra En Mayuscula.\n'
    +'- El ROL OBJETIVO en mayusculas.'
  window['_cp_'+c.id]=cvPrompt;
  var hasCv=!!cvs[email];
  var savedTxt=localStorage.getItem('cvtext_'+c.id)||'';

  var html='';
  html+='<div class="gen-box">';
  html+='<h3>Paso 1 &mdash; CV y LinkedIn del candidato</h3>';
  html+='<p style="font-size:12px;color:#666;margin-bottom:8px;">Pega aqui el texto del CV y LinkedIn. Se incluira en el prompt.</p>';
  html+='<textarea id="paste-area-'+c.id+'" rows="4" placeholder="Pega el CV y LinkedIn del candidato..." style="border:1.5px solid #f3c94b;background:#fffdf0;">'+escH(savedCvLi)+'</textarea>';
  html+='<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">';
  html+='<button class="btn" style="background:#f3a41b;" onclick="guardarCVLinkedIn('+c.id+')">Guardar</button>';
  html+='<span id="cvli-st-'+c.id+'" style="font-size:11px;color:#666;"></span>';
  html+='</div></div>';

  html+='<div class="gen-box">';
  html+='<h3>Paso 2 &mdash; Copia el prompt del CV</h3>';
  html+='<p style="font-size:12px;color:#666;margin-bottom:8px;">Pega en Claude.ai y te devolvera el CV optimizado en texto.</p>';
  html+='<div class="prompt-box">'+escH(cvPrompt)+'</div>';
  html+='<button class="btn" onclick="copiarPCV(this)" data-cid="'+c.id+'">Copiar prompt</button>';
  html+='<div class="status" id="st-cp-'+c.id+'"></div>';
  html+='</div>';

  html+='<div class="gen-box">';
  html+='<h3>Paso 3 &mdash; Pega el CV generado</h3>';
  html+='<p style="font-size:12px;color:#666;margin-bottom:8px;">Pega el texto del CV que te dio Claude.</p>';
  html+='<textarea id="cvt-'+c.id+'" rows="8" placeholder="Pega aqui el CV generado por Claude...">'+escH(savedTxt)+'</textarea>';
  html+='<div id="cvgs-'+c.id+'" style="font-size:12px;color:#4a7c5f;text-align:center;min-height:20px;margin:6px 0;"></div>';
  html+='<div style="margin-top:8px;display:flex;align-items:center;gap:8px;">';
  html+='<button class="btn btn-green" onclick="publicarCV('+c.id+')">Publicar CV</button>';
  html+='<div class="status" id="st-cvpub-'+c.id+'"></div>';
  html+='</div>';
  if(hasCv){
    html+='<div style="margin-top:10px;padding:8px 10px;background:#f9f8f8;border-radius:7px;display:flex;align-items:center;justify-content:space-between;">'
      +'<span style="font-size:11px;color:#4a7c5f;font-weight:600;">CV publicado.</span>'
      +'<button class="btn-sec" style="font-size:11px;padding:5px 10px;" onclick="abrirEditCV('+c.id+')">Editar CV publicado</button>'
      +'</div>';
  }
  html+='</div>';
  return html;
}

function tabNotas(c){
  var saved=notes[c.id]||'';
  return '<p style="font-size:12px;color:#999;margin-bottom:7px;">Notas privadas — el candidato nunca las vera.</p>'
    +'<textarea class="narea" id="nota-'+c.id+'" placeholder="Escribe tus observaciones...">'+escH(saved)+'</textarea>'
    +'<div style="margin-top:7px;display:flex;align-items:center;gap:8px;">'
    +'<button class="btn" onclick="saveNote('+c.id+')">Guardar</button>'
    +'<span id="notaok-'+c.id+'" style="font-size:11px;color:#8C7B80;font-weight:600;display:none;">Guardado</span>'
    +'</div>';
}

function saveNote(id){
  var c=cands.find(function(x){return x.id===id;});
  var val=document.getElementById('nota-'+id).value;
  notes[id]=val;
  localStorage.setItem('mj_notes',JSON.stringify(notes));
  var el=document.getElementById('notaok-'+id);
  el.textContent='Guardando...';el.style.display='inline';el.style.color='#999';
  // Save to Supabase
  fetch(SB+'/rest/v1/candidatos?id=eq.'+id,{
    method:'PATCH',
    headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
    body:JSON.stringify({notas_coach:val})
  }).then(function(r){
    el.textContent=r.ok?'\u2713 Guardado':'\u2713 Local';
    el.style.color=r.ok?'#4a7c5f':'#8C7B80';
    setTimeout(function(){el.style.display='none';},2500);
  }).catch(function(){
    el.textContent='\u2713 Local';el.style.color='#8C7B80';
    setTimeout(function(){el.style.display='none';},2500);
  });
}

// Nueva función textToHtml con el formato exacto de Micaela
function textToHtml(text, candidato, emailCand, cvEmail) {
  // email del candidato para auto-save
  var _cvEmail = cvEmail || emailCand || '';

  // Pre-process secciones
  // Normalize accented chars for section detection
  var SECS = ['NOMBRE COMPLETO','ROL OBJETIVO','RESUMEN EJECUTIVO','EXPERIENCIA PROFESIONAL',
    'FORMACIÓN','FORMACION','EDUCACIÓN','EDUCACION','DATOS ACADÉMICOS','DATOS ACADEMICOS',
    'TITULACIÓN','TITULACION','ESTUDIOS','CERTIFICACIONES','CURSOS','COMPETENCIAS',
    'HABILIDADES','HERRAMIENTAS','IDIOMAS','OTROS DATOS','DATOS ADICIONALES'];
  SECS.forEach(function(s) {
    var re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    text = text.replace(re, '\n\n' + s.toUpperCase() + '\n');
  });
  // Also handle FORMACION without accent
  text = text.replace(/\bFORMACION\b/gi, '\n\nFORMACI\u00d3N\n');

  var lines = text.split('\n').map(function(l){ return l.trim(); });

  function norm(s){return (s||'').toUpperCase().replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E').replace(/[ÍÌÏÎ]/g,'I').replace(/[ÓÒÖÔ]/g,'O').replace(/[ÚÙÜÛ]/g,'U').replace(/Ñ/g,'N');}
  function getSec(kw) {
    var kwn = norm(kw);
    var idx = -1;
    for (var i = 0; i < lines.length; i++) {
      var u = norm(lines[i]);
      if (u.indexOf(kwn) === 0 && lines[i].length < 80) { idx = i; break; }
    }
    if (idx === -1) return [];
    var out = [];
    var next = ['NOMBRE','ROL OBJ','RESUMEN','EXPERIENCIA','FORMAC','EDUCAC','TITULAC','ESTUDIO','CERTIF','CURSO','HABILIDAD','COMPETENC','HERRAMIENTA','IDIOMA','OTRO','DATO','INFORMAC'];
    for (var j = idx + 1; j < lines.length; j++) {
      var u2 = norm(lines[j]).replace(/[^A-Z\s]/g, '');
      if (u2.length > 2 && u2.length < 60 && next.some(function(k){ return u2.trim().indexOf(k) === 0; }) && out.length > 0) break;
      if (lines[j]) out.push(lines[j]);
    }
    return out;
  }

  function esc(t) { return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function bold(t) {
    // Convert **text** to <strong>text</strong>
    return esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
  function fmtNum(t) {
    // Format numbers with dot separator: 1000000 → 1.000.000
    return t.replace(/\b(\d{4,})\b/g, function(m) {
      return m.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    });
  }

  // Extract header
  var name = '', role = '', email = '', phone = '', city = '', linkedin = '';
  var roleLines = getSec('ROL OBJETIVO');
  if (roleLines.length) role = roleLines[0];
  var nameLines = getSec('NOMBRE COMPLETO');
  if (nameLines.length) name = nameLines[0];
  if (!name) {
    for (var i = 0; i < Math.min(5, lines.length); i++) {
      var l = lines[i];
      if (l && !l.includes('@') && !l.match(/^\+?\d/) && l.toUpperCase() === l.replace(/[^A-ZÁÉÍÓÚÑÜ\s]/g,'') && l.length > 3 && l.length < 50) {
        name = l; break;
      }
    }
  }
  if (!name) name = candidato || 'CV';

  var em = text.match(/[\w.+-]+@[\w.-]+\.\w+/); if (em) email = em[0];
  var ph = text.match(/\+?[\d][\d\s().+\-]{7,15}/); if (ph) phone = ph[0].trim();
  var li = text.match(/linkedin\.com\/in\/[\w-]+/i); if (li) linkedin = li[0];
  var cy = text.match(/(Madrid|Barcelona|Valencia|Sevilla|Bilbao|Galicia|Boiro|España|Spain|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ *,? *(España|Spain))/i);
  if (cy) city = cy[0].trim();

  var ini = (name||'CV').split(' ').map(function(w){ return w[0]||''; }).join('').slice(0,2).toUpperCase();

  // Parse sections
  var summary = getSec('RESUMEN EJECUTIVO').join(' ').trim();
  var expLines = getSec('EXPERIENCIA PROFESIONAL');
  var formLines = getSec('FORMACIÓN').length ? getSec('FORMACIÓN') :
    getSec('FORMACION').length ? getSec('FORMACION') :
    getSec('EDUCACIÓN').length ? getSec('EDUCACIÓN') :
    getSec('EDUCACION').length ? getSec('EDUCACION') :
    getSec('DATOS ACADÉMICOS').length ? getSec('DATOS ACADÉMICOS') :
    getSec('DATOS ACADEMICOS').length ? getSec('DATOS ACADEMICOS') :
    getSec('TITULACIÓN').length ? getSec('TITULACIÓN') :
    getSec('TITULACION').length ? getSec('TITULACION') :
    getSec('ESTUDIOS');
  var certLines = getSec('CERTIFICACIONES').length ? getSec('CERTIFICACIONES') : getSec('CURSOS');
  var skillLines = getSec('COMPETENCIAS').length ? getSec('COMPETENCIAS') : getSec('HABILIDADES');
  var toolLines = getSec('HERRAMIENTAS');
  var langLines = getSec('IDIOMAS');
  var otherLines = getSec('OTROS DATOS').length ? getSec('OTROS DATOS') : getSec('DATOS');

  // Parse competencias (soft, max 6) and herramientas (technical)
  var skills = [];
  skillLines.forEach(function(l) {
    var cl = l.replace(/^[-·•·▸\s]+/, '').trim();
    // Skip lines that look like categories (contain colon)
    if (cl.includes(':')) {
      // Extract after colon
      var after = cl.split(':')[1]||'';
      after.split(/[•·,]/g).forEach(function(s){ if(s.trim().length>2) skills.push(s.trim()); });
      return;
    }
    if (cl.includes('·') || cl.includes('•')) {
      cl.split(/[·•]/).forEach(function(s){ if(s.trim().length>2) skills.push(s.trim()); });
    } else if (cl.length > 2) skills.push(cl);
  });
  // Keep only soft skills (filter out technical terms)
  var techWords = /workday|ats|power bi|tableau|excel|greenhouse|linkedin|beamery|bamboo|oracle|boolean|github|analytics|hris|successfactor|smartrecruit|lever|stack/i;
  var softSkills = skills.filter(function(s){ return !techWords.test(s); }).slice(0,6);
  if (!softSkills.length) softSkills = skills.slice(0,6);
  skills = softSkills;

  // Parse tools
  var tools = [];
  if (toolLines.length) {
    toolLines.forEach(function(l) {
      var cl = l.replace(/^[-·•·▸\s]+/, '').trim();
      if (cl.includes(':')) cl = (cl.split(':')[1]||cl);
      cl.split(/[•·,]/g).forEach(function(s){ if(s.trim().length>1) tools.push(s.trim()); });
    });
  } else {
    // Extract tools from habilidades lines that look technical
    skillLines.forEach(function(l) {
      var cl = l.replace(/^[-·•·▸\s]+/, '').trim();
      if (cl.includes(':')) {
        var label = cl.split(':')[0].toLowerCase();
        if (/ats|analytic|herram|tool|sourcing|hris|sector/i.test(label)) {
          var after = cl.split(':')[1]||'';
          after.split(/[•·,]/g).forEach(function(s){ if(s.trim().length>1) tools.push(s.trim()); });
        }
      }
    });
  }
  tools = tools.slice(0,10);

  // Parse languages (C1, C2, B2 format)
  var langs = [];
  langLines.forEach(function(l) {
    var cl = l.replace(/^[-·•·\s]+/, '').trim();
    var lm = cl.match(/^(.+?)[\s:·\-]+([A-C][12]|Nativo|Bilingüe|Fluido|Avanzado|Intermedio|Básico|Native|Fluent)/i);
    if (lm) langs.push({n: lm[1].trim(), l: lm[2].trim()});
    else if (cl.length > 1) langs.push({n: cl, l: ''});
  });

  // Parse education
  var edu = [];
  formLines.forEach(function(l) {
    var cl = l.replace(/^[-·•·\s]+/, '').trim();
    if (!cl || cl.length < 3) return;
    var yr = cl.match(/(\d{4})\s*[-–]\s*(\d{4}|\bActual\b|\bPresente\b)/i) || cl.match(/\d{4}/);
    var parts = cl.split(/[·\|]/);
    edu.push({
      deg: (parts[0]||cl).replace(/\d{4}.*/,'').trim(),
      school: (parts[1]||'').trim(),
      yr: yr ? yr[0] : ''
    });
  });

  // Parse certs (courses < 1 year, newest first)
  var certs = [];
  certLines.forEach(function(l) {
    var cl = l.replace(/^[-·•·\s]+/, '').trim();
    if (cl.length > 2) certs.push(cl);
  });

  // Parse other data
  var others = [];
  otherLines.forEach(function(l) {
    var cl = l.replace(/^[-·•·\s]+/, '').trim();
    if (cl.length > 2) others.push(cl);
  });

  // Parse experience blocks
  var expBlocks = [], cur = [];
  expLines.forEach(function(l) {
    var hasDate = /\d{4}/.test(l);
    var notBullet = !l.match(/^[-·•]/);
    var notLower = !l.match(/^[a-záéíóúñü]/);
    var ok = l.length > 3 && l.length < 140;
    if (hasDate && notBullet && notLower && ok && cur.length > 1) {
      expBlocks.push(cur); cur = [l];
    } else cur.push(l);
  });
  if (cur.length) expBlocks.push(cur);
  // Sort newest first (by year)
  expBlocks.sort(function(a, b) {
    var ya = (a[0]||'').match(/\d{4}/g)||[0]; var yb = (b[0]||'').match(/\d{4}/g)||[0];
    return Math.max.apply(null,yb.map(Number)) - Math.max.apply(null,ya.map(Number));
  });

  // Build HTML
  var h = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">';
  h += '<meta name="viewport" content="width=device-width,initial-scale=1.0">';
  h += '<title>CV — ' + esc(name) + '</title>';
  h += '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">';
  h += '<style>';
  h += ':root{--A:#1B3A5C;--A2:#4A7FA5;--AB:#EEF3F8;--SB:#F4F6F9;--T:#1a1a1a;--S:#555;--BD:#E5E5E5;}';
  h += '.f{--A:#1D4A35;--A2:#3A8060;--AB:#EAF3EE;--SB:#F2F7F4;}.b{--A:#5C1B2E;--A2:#A54A65;--AB:#F4EEF0;--SB:#F7F2F4;}';
  h += '*{box-sizing:border-box;margin:0;padding:0;}';
  h += 'body{font-family:"DM Sans",sans-serif;background:#E8E6E2;padding:2rem 1rem 5rem;font-size:12px;}';
  h += '.bar{max-width:800px;margin:0 auto 1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}';
  h += '.bar-l{font-size:11px;font-weight:600;color:#8C7B80;background:#fff;padding:5px 14px;border-radius:20px;border:1px solid #e0d8d5;}';
  h += '.bar-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}';
  h += '.cdot{width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:.15s;}';
  h += '.cdot.on{border-color:#fff;box-shadow:0 0 0 2px var(--A);}';
  h += '.xbtn{padding:6px 14px;font-size:11px;font-weight:700;font-family:"DM Sans",sans-serif;border-radius:7px;cursor:pointer;border:none;transition:.15s;}';
  h += '.xbtn-o{background:#fff;color:#555;border:1.5px solid #ddd;}.xbtn-o:hover{border-color:var(--A);color:var(--A);}';
  h += '.xbtn-y{background:#f3a41b;color:#fff;}.xbtn-p{background:var(--A);color:#fff;}';
  h += '#save-st{font-size:10px;color:#999;}';
  h += '.cv{max-width:800px;margin:0 auto;background:#fff;box-shadow:0 6px 40px rgba(0,0,0,.12);page-break-inside:avoid;}';
  // Header
  h += '.hd{background:var(--A);padding:28px 32px 22px;position:relative;overflow:hidden;}';
  h += '.hd::after{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.04);pointer-events:none;}';
  h += '.hd-inner{display:flex;align-items:center;gap:20px;position:relative;z-index:2;}';
  h += '.ph-wrap{flex-shrink:0;}';
  h += '.ph-c{width:80px;height:80px;border-radius:50%;border:2.5px solid rgba(255,255,255,.3);overflow:hidden;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer;}';
  h += '.ph-c img{width:100%;height:100%;object-fit:cover;display:none;}';
  h += '.ph-ini{font-family:"Playfair Display",serif;font-size:26px;font-weight:800;color:rgba(255,255,255,.9);}';
  h += '.ph-hint{font-size:9px;color:rgba(255,255,255,.45);text-align:center;margin-top:3px;}';
  h += '.hi{flex:1;}';
  h += '.nm{font-family:"Playfair Display",serif;font-size:26px;font-weight:800;color:#fff;line-height:1.1;letter-spacing:.04em;text-transform:uppercase;margin-bottom:3px;}';
  h += '.rl{font-size:9px;font-weight:700;color:rgba(255,255,255,.7);letter-spacing:.18em;text-transform:uppercase;margin-bottom:10px;}';
  h += '.cts{display:flex;flex-wrap:wrap;gap:3px 16px;margin-bottom:8px;}';
  h += '.ct{font-size:10.5px;color:rgba(255,255,255,.75);}';
  h += '.ct strong{color:#fff;font-weight:600;}';
  h += '.ct a{color:#fff;text-decoration:underline;text-decoration-color:rgba(255,255,255,.4);}';
  h += '.ct a:hover{text-decoration-color:#fff;}';
  h += '.tags{display:flex;flex-wrap:wrap;gap:4px;}';
  h += '.tag{font-size:9px;font-weight:600;color:rgba(255,255,255,.88);background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);padding:2px 9px;border-radius:20px;}';
  // Body 2 columns
  h += '.bd{display:grid;grid-template-columns:185px 1fr;}';
  // Sidebar
  h += '.sd{background:var(--SB);padding:22px 16px;border-right:1px solid var(--BD);}';
  h += '.ss{margin-bottom:20px;}.ss:last-child{margin-bottom:0;}';
  h += '.sh{font-size:7.5px;font-weight:700;color:var(--A);text-transform:uppercase;letter-spacing:.2em;margin-bottom:7px;padding-bottom:4px;border-bottom:1.5px solid var(--A);}';
  h += '.sk{font-size:11px;color:var(--T);padding:3px 0 3px 11px;border-bottom:.5px solid var(--BD);line-height:1.4;position:relative;display:block;}';
  h += '.sk::before{content:"";position:absolute;left:0;top:9px;width:3.5px;height:3.5px;border-radius:50%;background:var(--A2);}';
  h += '.sk:last-child{border-bottom:none;}';
  h += '.lg-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:.5px solid var(--BD);}';
  h += '.lg-row:last-child{border-bottom:none;}';
  h += '.lg-n{font-size:11px;color:var(--T);font-weight:500;}';
  h += '.lg-l{font-size:8.5px;font-weight:700;color:#fff;background:var(--A);padding:1px 7px;border-radius:10px;}';
  h += '.ed{margin-bottom:11px;padding-bottom:11px;border-bottom:.5px solid var(--BD);}';
  h += '.ed:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}';
  h += '.ed-d{font-size:11px;font-weight:700;color:var(--T);line-height:1.3;}';
  h += '.ed-s{font-size:10px;color:var(--A2);font-weight:500;margin-top:1px;}';
  h += '.ed-y{font-size:9.5px;color:var(--S);margin-top:1px;}';
  h += '.ct2{font-size:10.5px;color:var(--T);padding:2.5px 0 2.5px 11px;border-bottom:.5px solid var(--BD);line-height:1.4;position:relative;display:block;}';
  h += '.ct2::before{content:"";position:absolute;left:0;top:8px;width:3.5px;height:3.5px;border-radius:50%;background:var(--A2);}';
  h += '.ct2:last-child{border-bottom:none;}';
  // Main
  h += '.mn{padding:22px 28px;}';
  h += '.ms{margin-bottom:20px;}.ms:last-child{margin-bottom:0;}';
  h += '.mh{font-size:7.5px;font-weight:700;color:var(--A);text-transform:uppercase;letter-spacing:.2em;margin-bottom:8px;padding-bottom:4px;border-bottom:1.5px solid var(--A);}';
  h += '.sum{font-size:11.5px;color:var(--T);line-height:1.8;}';
  h += '.sum strong{font-weight:700;color:var(--A);}';
  // Experience
  h += '.ex{margin-bottom:14px;padding-bottom:14px;border-bottom:.5px solid var(--BD);}';
  h += '.ex:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}';
  h += '.ex-top{display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:1px;}';
  h += '.ex-t{font-family:"Playfair Display",serif;font-size:12.5px;font-weight:700;color:var(--T);line-height:1.2;flex:1;text-transform:capitalize;}';
  h += '.ex-d{font-size:9px;font-weight:700;color:#fff;background:var(--A);padding:2px 8px;border-radius:8px;flex-shrink:0;white-space:nowrap;}';
  h += '.ex-co{font-size:10.5px;color:var(--A2);font-weight:600;margin-bottom:4px;}';
  h += '.ex-ctx{font-size:10px;color:#888;background:var(--AB);border-radius:3px;padding:3px 8px;margin-bottom:5px;line-height:1.5;border-left:2px solid var(--A2);font-style:italic;}';
  h += '.ul{list-style:none;padding:0;}';
  h += '.ul li{font-size:11px;color:var(--T);line-height:1.7;padding:2px 0 2px 13px;position:relative;}';
  h += '.ul li::before{content:"";position:absolute;left:0;top:8px;width:4px;height:4px;border-radius:50%;background:var(--A);}';
  h += '.ul li strong{font-weight:700;color:var(--A);}';
  h += '.bc{display:none;}body.editing .bc{display:flex;gap:5px;margin-top:5px;}';
  h += '.bb{padding:2px 9px;font-size:9.5px;font-weight:700;font-family:"DM Sans",sans-serif;border:1.5px solid var(--BD);background:#fff;color:var(--S);border-radius:5px;cursor:pointer;}';
  h += '.bb:hover{border-color:var(--A);color:var(--A);}.bb.rem{border-color:#e5c5c5;color:#c0756e;}.bb.rem:hover{border-color:#c0756e;background:#fdf6f6;}';
  // Editable
  h += '[contenteditable]{outline:none;border-radius:2px;transition:background .12s;}';
  h += 'body.editing [contenteditable]:hover{background:rgba(27,58,92,.06);cursor:text;}';
  h += 'body.editing [contenteditable]:focus{background:rgba(27,58,92,.1);}';
  h += 'body.editing .hd [contenteditable]:hover{background:rgba(255,255,255,.15);}';
  h += 'body.editing .hd [contenteditable]:focus{background:rgba(255,255,255,.22);}';
  // Print
  h += '@media print{body{background:#fff;padding:0;}.bar{display:none;}.bc{display:none!important;}';
  h += '.cv{box-shadow:none;max-width:100%;}.hd,.sd,.ex-d,.lg-l{-webkit-print-color-adjust:exact;print-color-adjust:exact;}';
  h += '@page{margin:.4cm;size:A4;}}';
  h += '</style></head><body>';

  // TOOLBAR
  h += '<div class="bar">';
  h += '<div class="bar-l">Micaela Jairedin &middot; Career Coach &amp; Recruiter</div>';
  h += '<div class="bar-r">';
  h += '<span style="font-size:10px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Color</span>';
  h += '<div class="cdot on" style="background:#1B3A5C" onclick="setT(\'\',this)"></div>';
  h += '<div class="cdot" style="background:#1D4A35" onclick="setT(\'f\',this)"></div>';
  h += '<div class="cdot" style="background:#5C1B2E" onclick="setT(\'b\',this)"></div>';
  h += '<input type="file" id="pf" accept="image/*" style="display:none" onchange="loadPh(this)">';
  h += '<button class="xbtn xbtn-o" onclick="document.getElementById(\'pf\').click()">+ Foto</button>';
  h += '<span id="save-st"></span>';
  h += '<button class="xbtn xbtn-y" id="eb" onclick="toggleEdit()">\u270F Editar</button>';
  h += '<button class="xbtn xbtn-p" onclick="window.print()">\u2193 PDF</button>';
  h += '</div></div>';

  // CV
  h += '<div class="cv">';

  // HEADER
  h += '<div class="hd"><div class="hd-inner">';
  h += '<div class="ph-wrap"><div class="ph-c" onclick="document.getElementById(\'pf\').click()">';
  h += '<img id="pi" src="" alt=""><span id="pn" class="ph-ini">' + esc(ini) + '</span></div>';
  h += '<div class="ph-hint">+ Foto</div></div>';
  h += '<div class="hi">';
  h += '<div class="nm" contenteditable="false">' + esc(name) + '</div>';
  h += '<div class="rl" contenteditable="false">' + esc(role) + '</div>';
  h += '<div class="cts">';
  if (email) h += '<div class="ct" contenteditable="false"><strong>' + esc(email) + '</strong></div>';
  if (phone) h += '<div class="ct" contenteditable="false">' + esc(phone) + '</div>';
  if (city) h += '<div class="ct" contenteditable="false">' + esc(city) + '</div>';
  if (linkedin) h += '<div class="ct"><a href="https://' + esc(linkedin) + '" target="_blank" contenteditable="false">' + esc(linkedin) + '</a></div>';
  h += '</div>';
  // Tags: otros datos
  h += '<div class="tags">';
  if (others.length) {
    others.forEach(function(o) { h += '<span class="tag" contenteditable="false">' + esc(o) + '</span>'; });
  } else {
    h += '<span class="tag" contenteditable="false">Incorporaci\u00f3n inmediata</span>';
    h += '<span class="tag" contenteditable="false">Disponible para viajar</span>';
  }
  h += '</div>';
  h += '</div></div></div>';

  // BODY
  h += '<div class="bd">';

  // SIDEBAR
  h += '<div class="sd">';

  // Idiomas
  if (langs.length) {
    h += '<div class="ss"><div class="sh">Idiomas</div>';
    langs.forEach(function(l) {
      h += '<div class="lg-row"><span class="lg-n" contenteditable="false">' + esc(l.n) + '</span>';
      if (l.l) h += '<span class="lg-l" contenteditable="false">' + esc(l.l) + '</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  // Competencias (soft, max 6)
  if (skills.length) {
    h += '<div class="ss"><div class="sh">Competencias</div>';
    skills.forEach(function(s) { h += '<div class="sk" contenteditable="false">' + esc(s) + '</div>'; });
    h += '</div>';
  }

  // Herramientas
  if (tools.length) {
    h += '<div class="ss"><div class="sh">Herramientas</div>';
    tools.forEach(function(t) { h += '<div class="sk" contenteditable="false">' + esc(t) + '</div>'; });
    h += '</div>';
  }

  // Formación
  if (edu.length) {
    h += '<div class="ss"><div class="sh">Formaci\u00f3n</div>';
    edu.forEach(function(e) {
      h += '<div class="ed"><div class="ed-d" contenteditable="false">' + esc(e.deg) + '</div>';
      if (e.school) h += '<div class="ed-s" contenteditable="false">' + esc(e.school) + '</div>';
      if (e.yr) h += '<div class="ed-y" contenteditable="false">' + esc(e.yr) + '</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  // Certificaciones/Cursos
  if (certs.length) {
    h += '<div class="ss"><div class="sh">Cursos y certificaciones</div>';
    certs.forEach(function(c) { h += '<div class="ct2" contenteditable="false">' + esc(c) + '</div>'; });
    h += '</div>';
  }

  h += '</div>'; // end sidebar

  // MAIN
  h += '<div class="mn">';

  // Resumen
  if (summary) {
    h += '<div class="ms"><div class="mh">Resumen ejecutivo</div>';
    h += '<div class="sum" contenteditable="false">' + bold(fmtNum(summary)) + '</div></div>';
  }

  // Experiencia
  h += '<div class="ms"><div class="mh">Experiencia profesional</div>';
  expBlocks.filter(function(b) { return b.join('').trim().length > 10; }).forEach(function(block, ei) {
    var blines = block.filter(function(l){ return l.trim(); });
    if (!blines.length) return;
    var title = blines[0], dates = '', company = '', ctx = '', bullets = [];
    var dm = title.match(/\d{4}\s*[-–—]\s*(\d{4}|Actualidad|Presente|Actual)/i)
           || title.match(/\d{2}\/\d{4}\s*[-–—]\s*\S+/i);
    if (dm) { dates = dm[0]; title = title.replace(dm[0], '').replace(/[|·—\-]+/g,' ').replace(/\s+/g,' ').trim(); }
    for (var j = 1; j < blines.length; j++) {
      var bl = blines[j];
      if (/^(Contexto|Context):/i.test(bl)) { ctx = bl.replace(/^[^:]+:\s*/, ''); continue; }
      if (j === 1 && !bl.match(/^[-·•]/) && bl.length < 90 && !bl.match(/^[a-z]/)) { company = bl; continue; }
      bullets.push(bl.replace(/^[-·•·\s]+/, ''));
    }
    var ulId = 'ul' + ei;
    h += '<div class="ex">';
    h += '<div class="ex-top"><div class="ex-t" contenteditable="false">' + bold(esc(title)) + '</div>';
    if (dates) h += '<div class="ex-d" contenteditable="false">' + esc(dates) + '</div>';
    h += '</div>';
    if (company) h += '<div class="ex-co" contenteditable="false">' + esc(company) + '</div>';
    if (ctx) h += '<div class="ex-ctx" contenteditable="false">' + esc(ctx) + '</div>';
    if (bullets.length) {
      h += '<ul class="ul" id="' + ulId + '">';
      bullets.forEach(function(b) {
        h += '<li contenteditable="false">' + bold(fmtNum(esc(b))) + '</li>';
      });
      h += '</ul>';
    } else {
      h += '<ul class="ul" id="' + ulId + '"></ul>';
    }
    h += '<div class="bc">';
    h += '<button class="bb" onclick="addB(\'' + ulId + '\')">+ Bullet</button>';
    h += '<button class="bb rem" onclick="remB(\'' + ulId + '\')">&#8722; Quitar</button>';
    h += '</div>';
    h += '</div>';
  });
  h += '</div>';

  h += '</div></div></div>'; // end mn, bd, cv

  // SCRIPT
  var cvEmailJs = JSON.stringify(_cvEmail);
  h += '<script>';
  h += 'var SB="https://ddxnrsnjdvtqhxunxnwj.supabase.co";';
  h += 'var KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU";';
  h += 'var _em=' + cvEmailJs + ';';
  h += 'var _saveT=null,_ed=false;';
  h += 'function setT(c,b){document.body.className=c+(_ed?" editing":"");document.querySelectorAll(".cdot").forEach(function(d){d.classList.remove("on");});b.classList.add("on");}'
  h += 'function loadPh(i){if(!i.files[0])return;var r=new FileReader();r.onload=function(e){var img=document.getElementById("pi");var ini=document.getElementById("pn");img.src=e.target.result;img.style.display="block";if(ini)ini.style.display="none";schedSave();};r.readAsDataURL(i.files[0]);}';
  h += 'function toggleEdit(){';
  h += '_ed=!_ed;var b=document.getElementById("eb");var cls=document.body.className.replace(" editing","");';
  h += 'if(_ed){';
  h += 'document.body.className=cls+" editing";b.textContent="\u2713 Listo";b.style.background="#4a7c5f";';
  h += 'document.querySelectorAll("[contenteditable]").forEach(function(e){e.contentEditable="true";e.oninput=schedSave;});';
  h += 'document.querySelectorAll(".ul li").forEach(function(li){';
  h += 'if(li.querySelector(".del-btn"))return;';
  h += 'var x=document.createElement("button");x.className="del-btn";x.title="Eliminar bullet";';
  h += 'x.innerHTML="&times;";x.onclick=function(ev){ev.stopPropagation();li.remove();schedSave();};';
  h += 'li.style.position="relative";li.appendChild(x);});';
  h += '}else{';
  h += 'document.body.className=cls;b.textContent="\u270F Editar";b.style.background="";';
  h += 'document.querySelectorAll("[contenteditable]").forEach(function(e){e.contentEditable="false";});';
  h += 'document.querySelectorAll(".del-btn").forEach(function(x){x.remove();});';
  h += 'saveNow();}}';
  h += 'function addB(id){var u=document.getElementById(id);if(!u)return;var li=document.createElement("li");li.contentEditable=_ed?"true":"false";li.textContent="Escribe aqui...";li.style.color="#aaa";li.oninput=schedSave;li.onfocus=function(){if(this.textContent==="Escribe aqui..."){this.textContent="";this.style.color="";}};if(_ed){var x=document.createElement("button");x.className="del-btn";x.innerHTML="&times;";x.onclick=function(ev){ev.stopPropagation();li.remove();schedSave();};li.style.position="relative";li.appendChild(x);}u.appendChild(li);li.focus();schedSave();}';
  h += 'function remB(id){var u=document.getElementById(id);if(!u)return;var items=u.querySelectorAll("li");if(!items.length)return;items[items.length-1].remove();schedSave();}';
  h += 'function schedSave(){clearTimeout(_saveT);_saveT=setTimeout(saveNow,2000);showSt("Guardando...",false);}';
  h += 'function saveNow(){if(!_em)return;var html=document.documentElement.outerHTML;fetch(SB+"/rest/v1/cv_publicados?email=eq."+encodeURIComponent(_em),{method:"PATCH",headers:{"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({contenido:html})}).then(function(r){showSt(r.ok||r.status===204?"\u2713 Guardado":"Error al guardar",r.ok||r.status===204);}).catch(function(){showSt("Error",false);});}';
  h += 'function showSt(msg,ok){var s=document.getElementById("save-st");if(s){s.textContent=msg;s.style.color=ok?"#4a7c5f":"#999";setTimeout(function(){if(s.textContent===msg)s.textContent="";},3000);}}';
  h += 'var st=document.createElement("style");st.textContent=".del-btn{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:16px;height:16px;border-radius:50%;background:#c0756e;color:#fff;border:none;cursor:pointer;font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;opacity:.7;}.del-btn:hover{opacity:1;}";document.head.appendChild(st);';
  h += '<\/script></body></html>';

  return h;
}






async function generarInformeAuto(id){
  var c=cands.find(function(x){return x.id===id;});
  if(!c){alert('Candidato no encontrado');return;}
  var st=document.getElementById('inf-gen-st-'+id);
  if(st){st.textContent='Generando informe con IA...';st.style.color='#666';}

  var fecha=new Date().toLocaleDateString('es-ES');
  var obs=(c.obstaculos||'').split('|').map(function(s){return s.trim();}).filter(Boolean).join(', ');
  var red=(c.red_profesional||'').split('|').map(function(s){return s.trim();}).filter(Boolean).join(', ');

  var prompt='Eres el asistente de Micaela Jairedin, Career Coach & Recruiter. '
    +'Analiza este candidato y devuelve SOLO un JSON valido, sin markdown, sin texto adicional. val = porcentaje del 1 al 100.\n'
    +'DATOS:\nNombre: '+(c.nombre||'--')+'\nEmail: '+(c.email||'--')+'\nCiudad: '+(c.ciudad||'--')+'\nExp: '+(c.exp||'--')+'\n'
    +'Sector: '+(c.sector||'--')+'\nCargo: '+(c.cargo||'--')+'\nRol buscado: '+(c.rol||'--')+'\n'
    +'Empresa objetivo: '+(c.empresa||'--')+'\nModalidad: '+(c.modalidad||'--')+'\nSalario: '+(c.salario||'--')+'\n'
    +'Movilidad: '+(c.geo||'--')+'\nSituacion: '+(c.situacion||'--')+'\nUrgencia: '+(c.urgencia||'--')+'\n'
    +'Logro principal: '+(c.logro||'--')+'\nHabilidades: '+(c.habilidades||'--')+'\n'
    +'Obstaculos: '+obs+'\nRed profesional: '+red+'\nObjetivo: '+(c.objetivo||'--')+'\n'
    +'LinkedIn estado: '+(c.li_estado||'--')+'\n'
    +(c.linkedin_texto?'\nPERFIL LINKEDIN/WEB:\n'+c.linkedin_texto+'\n':'')
    +'\nDevuelve exactamente este JSON (sustituye los valores):\n'
    +'{"candidato":"'+c.nombre+'","fecha":"'+fecha+'",'
    +'"scores":[{"label":"CV y marca personal","val":0},{"label":"LinkedIn","val":0},{"label":"Claridad de objetivo","val":0},{"label":"Red de contactos","val":0},{"label":"Propuesta de valor","val":0}],'
    +'"resumen":"situacion actual del candidato",'
    +'"fortalezas":["f1","f2","f3","f4"],'
    +'"gaps":["g1","g2","g3","g4"],'
    +'"mercado":"analisis mercado 2025",'
    +'"estrategia":"estrategia recomendada",'
    +'"cv_acciones":["a1","a2","a3","a4","a5"],'
    +'"linkedin_acciones":["a1","a2","a3","a4","a5"],'
    +'"networking_acciones":["a1","a2","a3","a4","a5"],'
    +'"preguntas":["p1","p2","p3"],'
    +'"alertas":["al1","al2"],'
    +'"mensaje_candidato":"mensaje motivador de Micaela",'
    +'"nicho":"nicho de mercado recomendado"}';

  try{
    var resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2000,messages:[{role:'user',content:prompt}]})
    });
    var data=await resp.json();
    var text=data.content&&data.content[0]?data.content[0].text:'';
    if(!text)throw new Error('Respuesta vacia');
    var clean=text.replace(/```json|```/g,'').trim();
    var parsed=JSON.parse(clean);
    var ta=document.getElementById('json-'+id);
    if(ta){ta.value=JSON.stringify(parsed,null,2);localStorage.setItem('json_'+id,ta.value);}
    generarInforme(id);
    if(st){st.textContent='Informe generado. Revisa y publica.';st.style.color='#4a7c5f';}
  }catch(e){
    if(st){st.textContent='Error: '+e.message;st.style.color='#c0756e';}
  }
}

async function generarCVAuto(id){
  var c=cands.find(function(x){return x.id===id;});
  if(!c){alert('Candidato no encontrado');return;}
  var st=document.getElementById('cvgs-'+id);
  if(st){st.textContent='Generando CV con IA...';st.style.color='#666';}
  var ta=document.getElementById('cvt-'+id);

  var email=(c.email||'').toLowerCase().trim();
  var repData=reps[email]&&reps[email].length?reps[email][0].data||reps[email][0]:null;
  if(repData&&typeof repData==='string')repData=JSON.parse(repData);
  var nicho=repData?repData.nicho||'':'';
  var obs=(c.obstaculos||'').split('|').map(function(s){return s.trim();}).filter(Boolean).join(', ');

  var prompt='Eres experto en RRHH y redaccion de CVs para el mercado europeo (Espana). '
    +'Genera un CV profesional optimizado para ATS en espanol, maximo 2 paginas. '
    +'Usa EXACTAMENTE este formato de secciones con estos titulos en mayusculas:\n'
    +'NOMBRE COMPLETO\nROL OBJETIVO\nRESUMEN EJECUTIVO\nEXPERIENCIA PROFESIONAL\nFORMACION\nCERTIFICACIONES\nHABILIDADES\nIDIOMAS\n\n'
    +'Para cada puesto en EXPERIENCIA usa: Titulo — Empresa | Sector | Fechas, luego Contexto: una linea, luego bullets con verbo de accion + resultado cuantificado.\n\n'
    +'DATOS DEL CANDIDATO:\n'
    +'Nombre: '+(c.nombre||'--')+'\nEmail: '+(c.email||'--')+'\nTelefono: '+(c.telefono||'--')+'\n'
    +'Ciudad: '+(c.ciudad||'--')+'\nLinkedIn: '+(c.linkedin?'linkedin.com/in/'+c.linkedin:'--')+'\n'
    +'Anos experiencia: '+(c.exp||'--')+'\nSector: '+(c.sector||'--')+'\nCargo actual: '+(c.cargo||'--')+'\n'
    +'Rol buscado: '+(c.rol||'--')+'\nEmpresa objetivo: '+(c.empresa||'--')+'\n'
    +'Modalidad: '+(c.modalidad||'--')+'\nSalario esperado: '+(c.salario||'--')+'\nMovilidad: '+(c.geo||'--')+'\n'
    +'Logro principal: '+(c.logro||'--')+'\nHabilidades: '+(c.habilidades||'--')+'\nObstaculos: '+obs+'\n'
    +(nicho?'Nicho definido: '+nicho+'\n':'')
    +(c.linkedin_texto?'\nCONTENIDO LINKEDIN/WEB DEL CANDIDATO:\n'+c.linkedin_texto+'\n':'');

  try{
    var resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2000,messages:[{role:'user',content:prompt}]})
    });
    var data=await resp.json();
    var text=data.content&&data.content[0]?data.content[0].text:'';
    if(!text)throw new Error('Respuesta vacia');
    if(ta)ta.value=text;
    localStorage.setItem('cvtext_'+id,text);
    if(st){st.textContent='CV generado. Revisa, edita si necesitas y publica.';st.style.color='#4a7c5f';}
  }catch(e){
    if(st){st.textContent='Error: '+e.message;st.style.color='#c0756e';}
  }
}

function publicarCV(id){
  var cvText=document.getElementById('cvt-'+id).value.trim();
  var st=document.getElementById('st-cvpub-'+id);
  if(!cvText){if(st){st.textContent='Pega el CV antes de publicar.';st.style.color='#c0756e';}return;}
  var c=cands.find(function(x){return x.id===id;});
  var cvHtml=textToHtml(cvText,c.nombre||'',c.email||'',c.email||'');
  if(st){st.textContent='Publicando...';st.style.color='#666';}
  sbUpsert('cv_publicados',{email:c.email,candidato_id:id,contenido:cvHtml,codigo:''}).then(function(){
    var email=(c.email||'').toLowerCase().trim();
    cvs[email]={email:c.email,codigo:'',contenido:cvHtml};
    var cvUrl=BASE+'/cliente.html?email='+encodeURIComponent(c.email)+'&cv=1';
    window._lastCvUrl=cvUrl;
    if(st){
      st.innerHTML='<div class="code-box">'
        +'<div style="font-size:11px;font-weight:700;color:#2e7d32;margin-bottom:5px;">\u2713 CV publicado</div>'
        +'<div style="font-size:11px;color:#666;margin-bottom:7px;">'+escH(cvUrl)+'</div>'
        +'<button class="btn" style="font-size:11px;padding:6px 12px;" onclick="navigator.clipboard.writeText(window._lastCvUrl).then(function(){showToast(\'Copiado\');})">Copiar URL</button>'
        +'</div>';
    }
    renderSidebar();
  }).catch(function(e){if(st){st.textContent='Error: '+e.message;st.style.color='#c0756e';}});
}

function copiarCodigoCV(){
  navigator.clipboard.writeText('Codigo CV: '+window._lastCode+' | URL: '+window._lastUrl);
  showToast('Copiado');
}

// EDIT INFORME
function abrirEditInf(id){
  editInfId=id;
  var c=cands.find(function(x){return x.id===id;});
  var email=(c.email||'').toLowerCase().trim();
  var d=reps[email][0].data;if(typeof d==='string')d=JSON.parse(d);
  document.getElementById('ei-res').value=d.resumen||'';
  document.getElementById('ei-for').value=(d.fortalezas||[]).join('\n');
  document.getElementById('ei-gap').value=(d.gaps||[]).join('\n');
  document.getElementById('ei-mer').value=d.mercado||'';
  document.getElementById('ei-est').value=d.estrategia||'';
  document.getElementById('ei-cv').value=(d.cv_acciones||[]).join('\n');
  document.getElementById('ei-li').value=(d.linkedin_acciones||[]).join('\n');
  document.getElementById('ei-net').value=(d.networking_acciones||[]).join('\n');
  document.getElementById('ei-preg').value=(d.preguntas||[]).join('\n');
  document.getElementById('ei-alert').value=(d.alertas||[]).join('\n');
  document.getElementById('ei-msg').value=d.mensaje_candidato||'';
  var scEl=document.getElementById('ei-scores');
  scEl.innerHTML=(d.scores||[]).map(function(s,i){
    return '<div><label style="font-size:10px;color:#666;display:block;margin-bottom:2px;">'+s.label+'</label>'
      +'<input type="number" id="eisc-'+i+'" min="0" max="100" value="'+Math.round(s.val)+'" style="width:75px;padding:5px;font-size:13px;font-family:Montserrat,sans-serif;border:1.5px solid #ddd;border-radius:6px;outline:none;"></div>';
  }).join('');
  abrirModal('modal-edit-inf');
}

function guardarInforme(){
  if(editInfId===null)return;
  var c=cands.find(function(x){return x.id===editInfId;});
  var email=(c.email||'').toLowerCase().trim();
  var d=reps[email][0].data;if(typeof d==='string')d=JSON.parse(d);
  d.resumen=document.getElementById('ei-res').value;
  d.fortalezas=toArr('ei-for');
  d.gaps=toArr('ei-gap');
  d.mercado=document.getElementById('ei-mer').value;
  d.estrategia=document.getElementById('ei-est').value;
  d.cv_acciones=toArr('ei-cv');
  d.linkedin_acciones=toArr('ei-li');
  d.networking_acciones=toArr('ei-net');
  d.preguntas=toArr('ei-preg');
  d.alertas=toArr('ei-alert');
  d.mensaje_candidato=document.getElementById('ei-msg').value;
  d.scores=d.scores.map(function(s,i){return Object.assign({},s,{val:parseInt(document.getElementById('eisc-'+i).value)||s.val});});
  reps[email][0].data=d;
  cerrarModal('modal-edit-inf');
  renderMain(c);
  showToast('Informe actualizado');
}

// PUBLISH INFORME
function abrirPubInf(id){
  pubInfId=id;
  var c=cands.find(function(x){return x.id===id;});
  var email=(c.email||'').toLowerCase().trim();
  var d=reps[email][0].data;if(typeof d==='string')d=JSON.parse(d);
  document.getElementById('pi-res').value=d.resumen||'';
  document.getElementById('pi-msg').value=d.mensaje_candidato||'';
  var scEl=document.getElementById('pi-scores');
  scEl.innerHTML=(d.scores||[]).map(function(s,i){
    return '<div><label style="font-size:10px;color:#666;display:block;margin-bottom:2px;">'+s.label+'</label>'
      +'<input type="number" id="pisc-'+i+'" min="0" max="100" value="'+Math.round(s.val)+'" style="width:75px;padding:5px;font-size:13px;font-family:Montserrat,sans-serif;border:1.5px solid #ddd;border-radius:6px;outline:none;"></div>';
  }).join('');
  abrirModal('modal-pub-inf');
}

function confirmarPublicar(){
  if(pubInfId===null)return;
  var c=cands.find(function(x){return x.id===pubInfId;});
  var email=(c.email||'').toLowerCase().trim();
  var d=reps[email][0].data;if(typeof d==='string')d=JSON.parse(d);
  d.resumen=document.getElementById('pi-res').value;
  d.mensaje_candidato=document.getElementById('pi-msg').value;
  d.scores=d.scores.map(function(s,i){return Object.assign({},s,{val:parseInt(document.getElementById('pisc-'+i).value)||s.val});});
  var prev=reps[email].length>1?JSON.stringify(reps[email][1].data||reps[email][1]):null;
  sbPost('informes',{candidato_id:c.id,email:c.email,data:JSON.stringify(d),prev:prev}).then(function(){
    reps[email][0].published=true;reps[email][0].data=d;
    cerrarModal('modal-pub-inf');renderSidebar();renderMain(c);
    showToast('Informe publicado');
    setTimeout(function(){verURL(c.id);},500);
  }).catch(function(e){alert('Error: '+e.message);});
}

// EDIT CV
function abrirEditCV(id){
  editCvId=id;
  var c=cands.find(function(x){return x.id===id;});
  var email=(c.email||'').toLowerCase().trim();
  var cvRow=cvs[email];
  if(!cvRow){alert('No hay CV publicado aun.');return;}
  document.getElementById('ec-text').value=cvRow.contenido||'';
  abrirModal('modal-edit-cv');
}

function guardarCV(){
  if(editCvId===null)return;
  var c=cands.find(function(x){return x.id===editCvId;});
  var email=(c.email||'').toLowerCase().trim();
  var cvRow=cvs[email];if(!cvRow)return;
  var newText=document.getElementById('ec-text').value;
  sbUpsert('cv_publicados',{email:c.email,candidato_id:c.id,contenido:newText,codigo:cvRow.codigo}).then(function(){
    cvs[email].contenido=newText;
    cerrarModal('modal-edit-cv');renderMain(c);
    showToast('CV actualizado');
  }).catch(function(e){alert('Error: '+e.message);});
}

// URL MODAL
function verURL(id){
  urlId=id;
  var c=cands.find(function(x){return x.id===id;});
  var email=(c.email||'').toLowerCase().trim();
  var infUrl=BASE+'/cliente.html?email='+encodeURIComponent(c.email);
  var cvRow=cvs[email];
  var cvUrl=cvRow?BASE+'/cliente.html?email='+encodeURIComponent(c.email):'';
  var html='<div style="margin-bottom:12px;">'
    +'<div style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Informe del cliente</div>'
    +'<div style="background:#f9f8f8;border-radius:6px;padding:8px;font-size:11px;font-family:monospace;word-break:break-all;margin-bottom:6px;">'+infUrl+'</div>'
    +'<button class="btn" style="font-size:11px;padding:6px 12px;" id="btn-copy-inf">Copiar link informe</button>'
    +'</div>';
  if(cvUrl){
    html+='<div style="margin-bottom:8px;">'
      +'<div style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">CV optimizado &mdash; Codigo: <strong>'+escH(cvRow.codigo)+'</strong></div>'
      +'<div style="background:#f9f8f8;border-radius:6px;padding:8px;font-size:11px;font-family:monospace;word-break:break-all;margin-bottom:6px;">'+cvUrl+'</div>'
      +'<button class="btn" style="font-size:11px;padding:6px 12px;" id="btn-copy-cv">Copiar link CV</button>'
      +'</div>';
  }
  document.getElementById('modal-url-content').innerHTML=html;
  document.getElementById('btn-copy-inf').onclick=function(){navigator.clipboard.writeText(infUrl);this.textContent='Copiado';};
  if(cvUrl)document.getElementById('btn-copy-cv').onclick=function(){navigator.clipboard.writeText(cvUrl);this.textContent='Copiado';};
  abrirModal('modal-url');
}

// ── VER / CAMBIAR CONTRASEÑA DEL CLIENTE ──
function verPass(id){
  var c=cands.find(function(x){return x.id===id;});
  if(!c)return;
  var email=(c.email||'').toLowerCase().trim();
  fetch(SB+'/rest/v1/usuarios?email=eq.'+encodeURIComponent(email)+'&select=password_hash',{
    headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
  }).then(function(r){return r.json();}).then(function(rows){
    var el=document.getElementById('pv-'+id);
    if(rows&&rows.length){
      el.textContent=rows[0].password_hash.substring(0,12)+'...';
      setTimeout(function(){el.textContent='••••••••';},5000);
    } else {
      el.textContent='Sin cuenta';
    }
  }).catch(function(){
    var el=document.getElementById('pv-'+id);if(el)el.textContent='Error';
  });
}

function cambiarPass(id,email){
  var inp=document.getElementById('np-'+id);
  var st=document.getElementById('ps-'+id);
  if(!inp||!st)return;
  var newPass=inp.value.trim();
  if(newPass.length<6){st.textContent='Mínimo 6 caracteres';st.style.color='#c0756e';return;}
  st.textContent='Guardando...';st.style.color='#666';
  var emailClean=(email||'').toLowerCase().trim();
  // Hash con SHA-256
  var encoder=new TextEncoder();
  crypto.subtle.digest('SHA-256',encoder.encode(newPass)).then(function(buf){
    var hash=Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
    // Check if user exists
    return fetch(SB+'/rest/v1/usuarios?email=eq.'+encodeURIComponent(emailClean)+'&select=id',{
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
    }).then(function(r){return r.json();}).then(function(rows){
      if(rows&&rows.length){
        // Update existing
        return fetch(SB+'/rest/v1/usuarios?email=eq.'+encodeURIComponent(emailClean),{
          method:'PATCH',
          headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'},
          body:JSON.stringify({password_hash:hash})
        });
      } else {
        // Create new user
        return fetch(SB+'/rest/v1/usuarios',{
          method:'POST',
          headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'},
          body:JSON.stringify({email:emailClean,password_hash:hash,rol:'cliente',nombre:cands.find(function(x){return x.id===id;}).nombre||'',activo:true})
        });
      }
    });
  }).then(function(r){
    if(r&&r.ok){
      st.textContent='✓ Contraseña actualizada';st.style.color='#4a7c5f';
      inp.value='';
    } else {
      st.textContent='Error al guardar';st.style.color='#c0756e';
    }
  }).catch(function(err){
    st.textContent='Error: '+err.message;st.style.color='#c0756e';
  });
}

loadCands();
</script>
</body>
</html>
