/**
 * pw-core-timeline.js
 * Core Experience: Timeline as Activity Stream
 *
 * Reusable components for session timelines, activity feeds, and scheduling.
 * Used by: panel-v2, multicoach, cliente
 *
 * ⚠️ PURO: Sin dependencias de panel-v2, multicoach o cliente.
 * Las dependencias externas se inyectan vía opciones.
 */

window.PWCoreTimeline = window.PWCoreTimeline || {};

// Helper: escapar HTML
PWCoreTimeline._esc = function(str){
  if(typeof esc === 'function') return esc(str);
  if(!str) return "";
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;');
};

// Helper: human-readable time ago (e.g. "hace 2 horas")
PWCoreTimeline.timeAgo = function(dateStr){
  if(!dateStr) return "";
  var date = new Date(dateStr);
  if(isNaN(date.getTime())) return "";

  var now = new Date();
  var diff = now.getTime() - date.getTime();
  var sec = Math.floor(diff / 1000);
  var min = Math.floor(sec / 60);
  var hour = Math.floor(min / 60);
  var day = Math.floor(hour / 24);

  if(sec < 60) return "Ahora";
  if(min < 60) return "Hace "+min+" min";
  if(hour < 24) return "Hace "+hour+" "+(hour===1?"hora":"horas");
  if(day < 7) return "Hace "+day+" "+(day===1?"día":"días");

  return date.toLocaleDateString('es-ES');
};

// Sort sessions by date (most recent first or upcoming)
PWCoreTimeline.sortSessions = function(sessions, direction){
  direction = direction || 'upcoming'; // 'upcoming' o 'recent'
  if(!Array.isArray(sessions)) return [];

  var sorted = sessions.slice();
  sorted.sort(function(a, b){
    var aDate = new Date(a.fecha + (a.hora ? "T"+a.hora : "T23:59")).getTime();
    var bDate = new Date(b.fecha + (b.hora ? "T"+b.hora : "T23:59")).getTime();
    return direction === 'upcoming' ? aDate - bDate : bDate - aDate;
  });
  return sorted;
};

// Get past sessions (already happened)
PWCoreTimeline.getPastSessions = function(sessions){
  if(!Array.isArray(sessions)) return [];
  var now = Date.now();

  return sessions.filter(function(s){
    if(!s.fecha) return false;
    var d = new Date(s.fecha + (s.hora ? "T"+s.hora : "T23:59"));
    return !isNaN(d) && d.getTime() < now;
  });
};

// Get upcoming sessions
PWCoreTimeline.getUpcomingSessions = function(sessions){
  if(!Array.isArray(sessions)) return [];
  var now = Date.now();

  return sessions.filter(function(s){
    if(!s.fecha) return false;
    var d = new Date(s.fecha + (s.hora ? "T"+s.hora : "T23:59"));
    return !isNaN(d) && d.getTime() >= now;
  });
};

// Render single session item (for timelines/lists)
PWCoreTimeline.renderSessionItem = function(session, opts){
  opts = opts || {};
  if(!session) return "";

  var _esc = PWCoreTimeline._esc;
  var compact = opts.compact || false;
  var showAvatar = opts.showAvatar !== false;
  var showStatus = opts.showStatus !== false;
  var onClick = opts.onClick; // callback

  var statusColor = {completada:'var(--pw-bosque)',pendiente:'var(--pw-warning)',cancelada:'var(--pw-error)'}[session.estado]||'var(--pw-border)';
  var statusLabel = {completada:'Completada',pendiente:'Pendiente',cancelada:'Cancelada'}[session.estado]||'Sin estado';

  return "<div class='cp-card' style='background:#fff;border:1px solid var(--pw-border);cursor:pointer;transition:all .15s' onmouseover=\"this.style.background='var(--pw-niebla-2)'\" onmouseout=\"this.style.background='#fff'\">"+
    "<div class='cp-card-pad' style='display:flex;align-items:center;gap:12px'>"+
      (showAvatar ? "<span style='width:36px;height:36px;border-radius:50%;flex:none;background:"+statusColor+";display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff'>"+(session.avatar||"📅")+"</span>" : "")+
      "<div style='flex:1;min-width:0'>"+
        "<div style='font-size:"+(compact?'12':'13')+"px;font-weight:600;color:var(--pw-carbon)'>"+_esc(session.titulo||'Sesión sin título')+"</div>"+
        "<div style='font-size:11px;color:var(--pw-text-soft);margin-top:2px'>"+
          (session.fecha ? PWCoreTimeline._esc(session.fecha)+(session.hora?" · "+PWCoreTimeline._esc(session.hora):"") : "Fecha pendiente")+
        "</div>"+
        (session.trabajado ? "<div style='font-size:10px;color:var(--pw-text-muted);margin-top:2px'>"+PWCoreTimeline._esc(session.trabajado)+"</div>" : "")+
      "</div>"+
      (showStatus ? "<span style='font-size:10px;padding:4px 8px;border-radius:4px;background:"+statusColor+";color:#fff;flex:none;font-weight:600'>"+statusLabel+"</span>" : "")+
    "</div>"+
  "</div>";
};

// Render timeline (vertical list of sessions)
PWCoreTimeline.renderTimeline = function(sessions, opts){
  opts = opts || {};
  if(!Array.isArray(sessions) || sessions.length === 0) return "";

  var direction = opts.direction || 'upcoming';
  var limit = opts.limit || null;
  var showDivider = opts.showDivider !== false;
  var compact = opts.compact || false;

  var sorted = PWCoreTimeline.sortSessions(sessions, direction);
  var toRender = limit ? sorted.slice(0, limit) : sorted;

  var html = "<div style='display:flex;flex-direction:column;gap:8px'>";

  toRender.forEach(function(s, idx){
    html += PWCoreTimeline.renderSessionItem(s, {compact: compact});
    if(showDivider && idx < toRender.length - 1){
      html += "<div style='height:1px;background:var(--pw-border);margin:4px 0'></div>";
    }
  });

  html += "</div>";
  return html;
};

// Render activity feed entry
PWCoreTimeline.renderActivityEntry = function(activity, opts){
  opts = opts || {};
  if(!activity) return "";

  var _esc = PWCoreTimeline._esc;
  var icon = opts.icon || "●";
  var showTime = opts.showTime !== false;

  var timeStr = showTime ? "<span style='font-size:10px;color:var(--pw-text-muted)'>"+PWCoreTimeline.timeAgo(activity.fecha)+"</span>" : "";

  return "<div style='display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--pw-border-light)'>"+
    "<span style='color:var(--pw-text-soft);font-size:12px;flex:none;margin-top:2px'>"+icon+"</span>"+
    "<div style='flex:1;min-width:0'>"+
      "<div style='font-size:12px;color:var(--pw-carbon)'>"+_esc(activity.titulo||'Actividad sin título')+"</div>"+
      (activity.detalle ? "<div style='font-size:11px;color:var(--pw-text-soft);margin-top:2px'>"+_esc(activity.detalle)+"</div>" : "")+
      "<div style='margin-top:2px'>"+timeStr+"</div>"+
    "</div>"+
  "</div>";
};

// Render activity feed (vertical list)
PWCoreTimeline.renderActivityFeed = function(activities, opts){
  opts = opts || {};
  if(!Array.isArray(activities) || activities.length === 0) return "";

  var limit = opts.limit || null;
  var toRender = limit ? activities.slice(0, limit) : activities;

  var html = "<div>";
  toRender.forEach(function(a){
    html += PWCoreTimeline.renderActivityEntry(a, opts);
  });
  html += "</div>";

  return html;
};

// Get session stats (total, completed, upcoming)
PWCoreTimeline.getSessionStats = function(sessions){
  if(!Array.isArray(sessions)) return {total: 0, completadas: 0, pendientes: 0, canceladas: 0};

  var stats = {total: sessions.length, completadas: 0, pendientes: 0, canceladas: 0};
  sessions.forEach(function(s){
    if(s.estado === 'completada') stats.completadas++;
    else if(s.estado === 'cancelada') stats.canceladas++;
    else stats.pendientes++;
  });
  return stats;
};

// Get session progress bar (completed / total)
PWCoreTimeline.renderSessionProgressBar = function(sessions, opts){
  opts = opts || {};
  if(!Array.isArray(sessions) || sessions.length === 0) return "";

  var stats = PWCoreTimeline.getSessionStats(sessions);
  var progress = Math.round((stats.completadas / stats.total) * 100);

  return "<div style='display:flex;align-items:center;gap:8px'>"+
    "<div style='flex:1;height:8px;background:var(--pw-border);border-radius:4px;overflow:hidden'>"+
      "<div style='height:100%;background:var(--pw-bosque);width:"+progress+"%'></div>"+
    "</div>"+
    "<span style='font-size:11px;font-weight:600;color:var(--pw-carbon)'>"+stats.completadas+"/"+stats.total+"</span>"+
  "</div>";
};
