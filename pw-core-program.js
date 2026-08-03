/**
 * pw-core-program.js
 * Core Experience: Program as Work Center
 *
 * Reusable components for program/client/session integration.
 * Used by: panel-v2, multicoach, cliente
 *
 * No pantalla-específico. Solo lógica de composición reutilizable.
 */

window.PWCoreProgram = window.PWCoreProgram || {};

// Helper: obtener próxima sesión válida de un array
PWCoreProgram.getNextSession = function(sessions){
  if(!Array.isArray(sessions) || sessions.length === 0) return null;
  var now = Date.now();
  var next = null;
  sessions.forEach(function(s){
    if(!s || !s.fecha) return;
    var d = new Date(s.fecha + (s.hora ? "T"+s.hora : "T23:59"));
    if(!isNaN(d) && d.getTime() >= now){
      if(!next || d.getTime() < new Date(next.fecha + (next.hora ? "T"+next.hora : "T23:59")).getTime()){
        next = s;
      }
    }
  });
  return next;
};

// Helper: renderizar card de recurso individual (reutilizable)
PWCoreProgram.renderResourceCard = function(resource, opts){
  opts = opts || {};
  if(!resource) return "";
  var size = opts.size || 'normal'; // 'compact' o 'normal'
  var tipo = (resource.tipo||'artículo').charAt(0).toUpperCase()+(resource.tipo||'artículo').slice(1);
  var compact = size === 'compact';

  return "<a href='"+esc(resource.url||'#')+"' target='_blank' rel='noopener' style='display:flex;align-items:center;gap:"+(compact?'6':'8')+"px;padding:"+(compact?'6':'8')+"px;border-radius:"+(compact?'6':'8')+"px;background:#fff;text-decoration:none;color:var(--pw-carbon);transition:background .15s;border:1px solid transparent' onmouseover=\"this.style.background='var(--pw-niebla-2)'\" onmouseout=\"this.style.background='#fff'\">"+
    "<span style='flex:1;min-width:0'>"+
      "<div style='font-size:"+(compact?'12':'12.5')+"px;font-weight:600;color:var(--pw-carbon)'>"+esc(resource.titulo||'Recurso')+"</div>"+
      (compact ? "" : "<div style='font-size:11px;color:var(--pw-text-soft)'>"+tipo+(resource.meta?" · "+esc(resource.meta):"")+"</div>")+
    "</span>"+
    (typeof PWI !== 'undefined' ? PWI.svg('arrowRight',{sm:true}) : "→")+
  "</a>";
};

// Helper: renderizar lista de recursos (reutilizable)
PWCoreProgram.renderResourceList = function(resources, opts){
  opts = opts || {};
  if(!Array.isArray(resources) || resources.length === 0) return "";

  var limit = opts.limit || 3;
  var size = opts.size || 'normal';
  var showViewMore = opts.showViewMore !== false;

  var html = "<div style='display:flex;flex-direction:column;gap:"+(size==='compact'?'6':'8')+"px'>";
  resources.slice(0, limit).forEach(function(r){
    html += PWCoreProgram.renderResourceCard(r, {size: size});
  });
  html += "</div>";

  if(showViewMore && resources.length > limit){
    html += "<div style='margin-top:"+(size==='compact'?'6':'8')+"px;text-align:center'>"+
      "<button class='cp-btn cp-btn-ghost' style='height:28px;padding:0 12px;font-size:11px' onclick=\"state.section='configuracion';state.configTab='recursos';render()\">Ver todos ("+(resources.length)+")</button>"+
    "</div>";
  }

  return html;
};

// Helper: renderizar card de próxima sesión (reutilizable)
PWCoreProgram.renderNextSessionCard = function(session, opts){
  opts = opts || {};
  if(!session) return "";

  var heroStyle = opts.heroStyle || false;

  if(heroStyle){
    // Hero style (grande, como en sesiones tab)
    return "<div class='cp-ses-hero'>"+
      "<div>"+
        "<div class='cp-ses-hero-lbl'>● Próxima sesión</div>"+
        "<div class='cp-ses-hero-date'>"+esc(session.fecha||"")+(session.hora?" · "+esc(session.hora):"")+"</div>"+
        (session.trabajado ? "<div class='cp-ses-hero-sub'>"+esc(session.trabajado)+"</div>" : "")+
      "</div>"+
    "</div>";
  } else {
    // Compact card style
    return "<div class='cp-card' style='background:rgba(45,106,79,.04);border:1px solid rgba(45,106,79,.12)'>"+
      "<div class='cp-card-pad' style='display:flex;align-items:center;gap:12px'>"+
        "<span style='width:36px;height:36px;border-radius:10px;flex:none;background:rgba(45,106,79,.10);display:flex;align-items:center;justify-content:center'>"+(typeof PWI !== 'undefined' ? PWI.svg('calendar',{sm:true}) : "📅")+"</span>"+
        "<div style='flex:1;min-width:0'>"+
          "<div style='font-size:13px;font-weight:700;color:var(--pw-carbon)'>Próxima sesión</div>"+
          "<div style='font-size:12px;color:var(--pw-text-soft)'>"+esc(session.fecha||"")+(session.hora?" · "+esc(session.hora):"")+"</div>"+
          (session.trabajado ? "<div style='font-size:11px;color:var(--pw-text-muted);margin-top:2px'>"+esc(session.trabajado)+"</div>" : "")+
        "</div>"+
      "</div>"+
    "</div>";
  }
};

// Helper: renderizar etapas/programa como roadmap (reutilizable)
PWCoreProgram.renderEtapasRoadmap = function(etapas, opts){
  opts = opts || {};
  if(!Array.isArray(etapas) || etapas.length === 0) return "";

  var compact = opts.compact || false;
  var showProgress = opts.showProgress !== false;

  var html = "<div class='cp-card' style='background:rgba(45,106,79,.02);border:1px solid rgba(45,106,79,.08)'>"+
    "<div class='cp-card-pad'>"+
      "<div style='display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--pw-carbon)'>"+
        (typeof PWI !== 'undefined' ? PWI.svg('mapPin',{sm:true}) : "📍")+" Roadmap del programa"+
      "</div>"+
      "<div style='display:flex;gap:"+(compact?'6':'8')+"px;flex-wrap:wrap'>";

  etapas.forEach(function(e, idx){
    var isDone = e.estado === 'completada' || e.completada || (e.progress >= 100);
    var isActive = idx === 0 || (!isDone && (idx === 0 || etapas[idx-1].completada));
    html += "<div style='flex:1;min-width:"+(compact?'80':'120')+"px;padding:"+(compact?'8':'10')+"px;border-radius:"+(compact?'8':'10')+"px;"+
      "border:1.5px solid "+(isDone?"var(--pw-bosque)":"var(--pw-border)")+";"+
      "background:"+(isDone?"rgba(45,106,79,.08)":"#fff")+";"+
      "text-align:center;cursor:pointer;transition:all .15s"+
      "' onmouseover=\"this.style.background='"+(isDone?"rgba(45,106,79,.12)":"var(--pw-niebla-2)")+"'\" "+
      "onmouseout=\"this.style.background='"+(isDone?"rgba(45,106,79,.08)":"#fff")+"'\">"+
        "<div style='font-size:"+(compact?'11':'12')+"px;font-weight:700;color:var(--pw-carbon)'>"+esc(e.nombre||"Etapa")+"</div>"+
        (showProgress && e.progress ? "<div style='font-size:10px;color:var(--pw-text-soft);margin-top:3px'>"+Math.round(e.progress)+"%</div>" : "")+
      "</div>";
  });

  html += "</div></div>";
  return html;
};

// Helper: renderizar tareas de sesión (reutilizable)
PWCoreProgram.renderSessionTasks = function(tasks, doneIndexes, opts){
  opts = opts || {};
  if(!Array.isArray(tasks) || tasks.length === 0) return "";

  var doneIndexes = doneIndexes || [];
  var compact = opts.compact || false;
  var doneCnt = doneIndexes.length;

  var html = "<div style='background:"+(compact?"transparent":"var(--pw-niebla-2)")+";"+(compact?"":" border-radius:10px;padding:10px 12px")+"'>"+
    "<div class='cp-eyebrow' style='margin-bottom:"+(compact?'4':'6')+"px'>"+(compact?"":(doneCnt+"/"+tasks.length+" hechas"))</div>"+
    "<div style='display:flex;flex-direction:column;gap:"+(compact?'3':'4')+"px'>";

  tasks.forEach(function(task, idx){
    var isDone = doneIndexes.indexOf(idx) !== -1;
    html += "<div style='display:flex;align-items:center;gap:6px;font-size:"+(compact?'11':'12')+"px;color:"+(isDone?"var(--pw-text-muted)":"var(--pw-carbon)")+";"+(isDone?"text-decoration:line-through":"")+"'>"+
      "<span style='width:14px;height:14px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;"+
        "background:"+(isDone?"var(--pw-bosque)":"transparent")+";"+
        "border:1.2px solid "+(isDone?"var(--pw-bosque)":"var(--pw-border-strong)")+";"+
        "color:#fff;font-size:8px'>"+(isDone?"✓":"")+"</span>"+
      "<span>"+esc(task)+"</span>"+
    "</div>";
  });

  html += "</div></div>";
  return html;
};

// Helper: renderizar comunidad filtrada automáticamente (reutilizable)
PWCoreProgram.renderCommunityAuto = function(clienteId, opts){
  opts = opts || {};
  var c = (typeof CLIENTS !== 'undefined' && CLIENTS) ? CLIENTS.filter(function(x){return String(x.id)===String(clienteId);})[0] : null;
  if(!c) return "";

  var nicho = (c.raw && c.raw.nicho) || (typeof RCFG !== 'undefined' && RCFG && RCFG.coach_type) || 'carrera';
  var etapa = (c.raw && c.raw.etapas && c.raw.etapas[0]) ? c.raw.etapas[0].nombre : '';
  var nichoLabel = {carrera:'Carrera',fitness:'Fitness',financiero:'Finanzas',nutrition:'Nutrición',wellness:'Bienestar',executive:'Executive',business:'Business'}[nicho]||'Comunidad';

  var url = '/comunidad.html?nicho='+encodeURIComponent(nicho);
  if(etapa && opts.filterByEtapa) url += '&etapa='+encodeURIComponent(etapa);

  return "<div class='cp-card' style='background:rgba(45,106,79,.02);border:1px solid rgba(45,106,79,.08)'>"+
    "<div class='cp-card-pad'>"+
      "<div style='display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--pw-carbon)'>"+
        (typeof PWI !== 'undefined' ? PWI.svg('messageCircle',{sm:true}) : "💬")+" Comunidad "+nichoLabel+
      "</div>"+
      "<div style='font-size:12px;color:var(--pw-text-soft);line-height:1.5;margin-bottom:12px'>"+
        "Conecta con otros coaches en "+nichoLabel+". Comparte casos, feedback y mejores prácticas."+
      "</div>"+
      "<a href='"+esc(url)+"' target='_blank' rel='noopener' class='cp-btn cp-btn-ghost' style='display:inline-block;height:32px;padding:0 14px;font-size:12px;text-decoration:none;text-align:center;line-height:32px;width:100%'>"+
        "Abrir comunidad "+nichoLabel+" "+(typeof PWI !== 'undefined' ? PWI.svg('arrowRight',{sm:true}) : "→")+
      "</a>"+
    "</div>"+
  "</div>";
};

// MASTER: renderizar Program Work Center (orquestador principal)
PWCoreProgram.renderWorkCenter = function(client, opts){
  opts = opts || {};
  if(!client) return "";

  var html = "";

  // 1. Next Session Hero (if exists)
  var nextSession = PWCoreProgram.getNextSession(client.ses || []);
  if(nextSession){
    html += PWCoreProgram.renderNextSessionCard(nextSession, {heroStyle: opts.heroStyle});
  }

  // 2. Etapas Roadmap (if exists)
  if(client.raw && client.raw.etapas){
    html += PWCoreProgram.renderEtapasRoadmap(client.raw.etapas, {compact: opts.compact});
  }

  // 3. Resources (if exists in global RCFG)
  if(typeof RCFG !== 'undefined' && RCFG && RCFG.recursos){
    var nicho = (client.raw && client.raw.nicho) || (RCFG.coach_type) || 'carrera';
    var recursos = RCFG.recursos.filter(function(r){
      return !r.nicho || r.nicho === nicho || r.nicho === 'general';
    });
    if(recursos.length > 0){
      html += "<div class='cp-card' style='background:rgba(45,106,79,.02);border:1px solid rgba(45,106,79,.08)'>"+
        "<div class='cp-card-pad'>"+
          "<div style='display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--pw-carbon)'>"+
            (typeof PWI !== 'undefined' ? PWI.svg('bookOpen',{sm:true}) : "📚")+" Recursos relacionados"+
          "</div>"+
          PWCoreProgram.renderResourceList(recursos, {limit: 3, size: 'normal'})+
        "</div>"+
      "</div>";
    }
  }

  // 4. Community Auto-filtered
  if(opts.showCommunity){
    html += PWCoreProgram.renderCommunityAuto(client.id, {filterByEtapa: opts.filterByEtapa});
  }

  return html;
};
