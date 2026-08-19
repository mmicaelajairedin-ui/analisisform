// pw-rankings-load.js — Cargar rankings mensual/semanal a window.RMONTH/RWEEK
(function(){
  "use strict";

  // Inyectar CSS para ocultar avatares/fotos en el podio
  var style = document.createElement('style');
  style.textContent = `
    /* Ocultar avatares en ranking de la revista */
    .novedad-ranking-podio .avatar,
    .ranking-avatar,
    [data-ranking-photo],
    .podio-photo {
      display: none !important;
    }
    /* Ocultar círculos de color con iniciales */
    .rank-circle,
    .coach-circle,
    .podium-circle {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  // Calcular claves de período actual
  function pwMonthKey(){ var d=new Date(); return "M-"+d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2); }
  function pwWeekKey(){
    var now=new Date();
    var d=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
    var day=d.getUTCDay()||7;
    d.setUTCDate(d.getUTCDate()+4-day);
    var ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var wk=Math.ceil((((d-ys)/86400000)+1)/7);
    return "W-"+d.getUTCFullYear()+"-"+("0"+wk).slice(-2);
  }

  // URLs Supabase
  var SB = "https://api.pathwaycareercoach.com";
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

  function loadRankings(){
    var monthKey = pwMonthKey();
    var weekKey = pwWeekKey();

    // Cargar ranking mensual CON fotos desde usuarios
    fetch(SB + "/rest/v1/ranking_mensual?ym=eq." + encodeURIComponent(monthKey) + "&select=coach_id,nombre,pts&order=pts.desc&limit=80", {
      headers: { apikey: KEY, "Accept": "application/json" }
    })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      // Buscar fotos en usuarios por coach_id
      if(rows && rows.length){
        var coachIds = rows.map(function(r){ return r.coach_id; });
        return fetch(SB + "/rest/v1/usuarios?id=in.(" + coachIds.map(function(id){ return '"'+id+'"'; }).join(',') + ")&select=id,foto_url", {
          headers: { apikey: KEY, "Accept": "application/json" }
        })
        .then(function(r){ return r.json(); })
        .then(function(users){
          var photoMap = {};
          (users||[]).forEach(function(u){ if(u.id) photoMap[u.id] = u.foto_url; });
          rows.forEach(function(r){ r.photo = photoMap[r.coach_id] || ""; });
          return rows;
        });
      }
      return rows;
    })
    .then(function(rows){
      window.RMONTH = rows || [];
      if(typeof render === 'function') render();
    })
    .catch(function(e){ console.error('[pw-rankings] Error cargando RMONTH:', e); });

    // Cargar ranking semanal CON fotos desde usuarios
    fetch(SB + "/rest/v1/ranking_mensual?ym=eq." + encodeURIComponent(weekKey) + "&select=coach_id,nombre,pts&order=pts.desc&limit=80", {
      headers: { apikey: KEY, "Accept": "application/json" }
    })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      // Buscar fotos en usuarios por coach_id
      if(rows && rows.length){
        var coachIds = rows.map(function(r){ return r.coach_id; });
        return fetch(SB + "/rest/v1/usuarios?id=in.(" + coachIds.map(function(id){ return '"'+id+'"'; }).join(',') + ")&select=id,foto_url", {
          headers: { apikey: KEY, "Accept": "application/json" }
        })
        .then(function(r){ return r.json(); })
        .then(function(users){
          var photoMap = {};
          (users||[]).forEach(function(u){ if(u.id) photoMap[u.id] = u.foto_url; });
          rows.forEach(function(r){ r.photo = photoMap[r.coach_id] || ""; });
          return rows;
        });
      }
      return rows;
    })
    .then(function(rows){
      window.RWEEK = rows || [];
      if(typeof render === 'function') render();
    })
    .catch(function(e){ console.error('[pw-rankings] Error cargando RWEEK:', e); });
  }

  // Cargar al listo el documento
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', loadRankings);
  } else {
    loadRankings();
  }

  // Exportar función para recarga manual
  window.pw_load_rankings = loadRankings;
})();
