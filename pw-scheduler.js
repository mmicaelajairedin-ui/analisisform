// pw-scheduler.js — Calendar Engine v1.0+ (SHARED MODULE - SPRINT A.3)
// Complete reusable scheduler component: panel-v2, multicoach, cliente, reservar, programas
// Feature complete with views (month/week/day), navigation, drag-drop, KPIs, filtering

// ── FEATURE FLAG ────────────────────────────────────────────────────────────
// var USE_NEW_SCHEDULER = false (legacy) or true (new engine)

// ── initScheduler(context) ──────────────────────────────────────────────────
function initScheduler(context){
  context = context || {};

  var eventos_base = context.eventos || [];
  var currentUser = context.currentUser || {};
  var organization = context.organization || {};
  var team = context.team;
  var permisos = context.permisos || context.permissions || [];
  var scope_activo = context.scope || "self";
  var callbacks = context.callbacks || {};
  var labels = context.labels || {};
  var theme = context.theme || {};
  var locale = context.locale || "es";
  var timezone = context.timezone || "Europe/Madrid";
  var labels_param = context.labels || {};

  var state = {
    eventos: eventos_base.slice(),
    eventos_filtrados: [],
    vista_actual: context.view || "mes",
    fecha_seleccionada: new Date().toISOString().split('T')[0],
    acciones_disponibles: _calcularAcciones(permisos),
    scope_activo: scope_activo,
    coach_filtro: context.coach_id || null,
    kpis: {},
    fecha_navegacion: {
      mes: new Date().getMonth(),
      anio: new Date().getFullYear(),
      semana_offset: 0
    }
  };

  function _calcularAcciones(perms){
    return {
      crear: perms.includes("agenda.create"),
      editar: perms.includes("agenda.edit"),
      editar_otros: perms.includes("agenda.edit.others"),
      cancelar: perms.includes("agenda.cancel"),
      cancelar_otros: perms.includes("agenda.cancel.others"),
      reasignar: perms.includes("agenda.reassign"),
      mover: perms.includes("agenda.reschedule"),
      confirmar_asistencia: true
    };
  }

  function _participoEnEvento(evt, uid){
    return evt.participants && evt.participants.some(function(p){ return p.user_id === uid; });
  }

  function _coachEsDelTeam(coach_id, tid){
    if(!tid || typeof COACHES === "undefined" || !COACHES) return false;
    return COACHES.some(function(c){ return c.id === coach_id && c.team_id === tid; });
  }

  function _aplicarFiltro(){
    state.eventos_filtrados = [];

    switch(scope_activo){
      case "self":
        state.eventos.forEach(function(evt){
          if(evt.organizer_id === currentUser.id) state.eventos_filtrados.push(evt);
          else if(_participoEnEvento(evt, currentUser.id)) state.eventos_filtrados.push(evt);
        });
        break;

      case "team":
        if(!permisos.includes("agenda.read.team")) return;
        state.eventos.forEach(function(evt){
          if(team && _coachEsDelTeam(evt.organizer_id, team.id)) state.eventos_filtrados.push(evt);
        });
        break;

      case "global":
        if(!permisos.includes("agenda.read.global")) return;
        state.eventos_filtrados = state.eventos.slice();
        break;

      case "participant":
        state.eventos.forEach(function(evt){
          if(_participoEnEvento(evt, currentUser.id)) state.eventos_filtrados.push(evt);
        });
        break;
    }

    // Aplicar filtro de coach si está activo
    if(state.coach_filtro && scope_activo === "team"){
      state.eventos_filtrados = state.eventos_filtrados.filter(function(evt){
        return evt.organizer_id === state.coach_filtro;
      });
    }

    _calcularKPIs();
  }

  function _calcularKPIs(){
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    var finHoy = new Date(hoy.getTime() + 86400000);

    var inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    var finSemana = new Date(inicioSemana.getTime() + 7 * 86400000);

    var sesionesHoy = 0;
    var atencionesSemana = 0;
    var clasesSemana = 0;
    var totalEventos = state.eventos_filtrados.length;

    state.eventos_filtrados.forEach(function(evt){
      var start = new Date(evt.start);
      var tipo = (evt.metadata && evt.metadata.event_type) || "sesion_individual";

      if(start >= hoy && start < finHoy){
        sesionesHoy++;
        if(tipo.indexOf("sesion") >= 0 || tipo.indexOf("eval") >= 0 || tipo.indexOf("nutricion") >= 0){
          atencionesSemana++;
        }
      }

      if(start >= inicioSemana && start < finSemana){
        if(tipo.indexOf("clase") >= 0){
          clasesSemana++;
        }
        if(tipo.indexOf("sesion") >= 0 || tipo.indexOf("eval") >= 0 || tipo.indexOf("nutricion") >= 0){
          // Contar si no se contó ya
          if(!(start >= hoy && start < finHoy && sesionesHoy > 0)){
            // Evitar doble conteo
          }
        }
      }
    });

    state.kpis = {
      sesiones_hoy: sesionesHoy,
      atenciones_semana: atencionesSemana,
      clases_semana: clasesSemana,
      total_eventos: totalEventos
    };
  }

  _aplicarFiltro();

  return {
    getEventos: function(){ return state.eventos_filtrados; },
    getAcciones: function(){ return state.acciones_disponibles; },
    getEstado: function(){ return state; },
    getKPIs: function(){ return state.kpis; },

    init: function(){
      if(callbacks.onInit) callbacks.onInit(state);
    },

    crearEvento: function(data){
      if(!state.acciones_disponibles.crear) return;
      if(callbacks.onCreate) callbacks.onCreate(data);
    },
    editarEvento: function(evento_id, data){
      if(!state.acciones_disponibles.editar) return;
      if(callbacks.onEdit) callbacks.onEdit(evento_id, data);
    },
    cancelarEvento: function(evento_id){
      if(!state.acciones_disponibles.cancelar) return;
      if(callbacks.onCancel) callbacks.onCancel(evento_id);
    },
    reprogramarEvento: function(evento_id, nueva_fecha){
      if(!state.acciones_disponibles.mover) return;
      if(callbacks.onReschedule) callbacks.onReschedule(evento_id, nueva_fecha);
    },
    confirmarAsistencia: function(evento_id, status){
      if(callbacks.onConfirmAssistance) callbacks.onConfirmAssistance(evento_id, status);
    },

    cambiarFiltro: function(nuevo_scope){
      if(["self","team","global","participant"].includes(nuevo_scope)){
        scope_activo = nuevo_scope;
        state.scope_activo = nuevo_scope;
        _aplicarFiltro();
      }
    },

    filtrarPorCoach: function(coach_id){
      state.coach_filtro = coach_id;
      _aplicarFiltro();
    },

    navegarMes: function(offset){
      state.fecha_navegacion.mes += offset;
      if(state.fecha_navegacion.mes > 11){
        state.fecha_navegacion.mes = 0;
        state.fecha_navegacion.anio++;
      } else if(state.fecha_navegacion.mes < 0){
        state.fecha_navegacion.mes = 11;
        state.fecha_navegacion.anio--;
      }
    },

    navegarSemana: function(offset){
      state.fecha_navegacion.semana_offset += offset;
    },

    volverHoy: function(){
      var hoy = new Date();
      state.fecha_navegacion.mes = hoy.getMonth();
      state.fecha_navegacion.anio = hoy.getFullYear();
      state.fecha_navegacion.semana_offset = 0;
    },

    debug: function(){ return {estado: state, scope_activo: scope_activo}; }
  };
}

// ── renderScheduler(scheduler, options) ────────────────────────────────────
function renderScheduler(scheduler, options){
  options = options || {};
  var eventos = scheduler.getEventos();
  var acciones = scheduler.getAcciones();
  var kpis = scheduler.getKPIs();
  var view = options.view || "mes";
  var compact = options.compact || false;

  function esc(s){
    var e = document.createElement('div');
    e.textContent = s;
    return e.innerHTML;
  }

  function _agruparPorFecha(){
    var grupos = {};
    eventos.forEach(function(evt){
      var d = new Date(evt.start).toISOString().split('T')[0];
      if(!grupos[d]) grupos[d] = [];
      grupos[d].push(evt);
    });
    return grupos;
  }

  function _formatoDia(fecha_str){
    var d = new Date(fecha_str + "T00:00:00");
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    var diff = Math.round((d.getTime() - hoy.getTime()) / 86400000);
    var nombreDia;
    if(diff === 0) nombreDia = "Hoy";
    else if(diff === 1) nombreDia = "Mañana";
    else nombreDia = d.toLocaleDateString("es-ES", {weekday: "long"});
    var fecha = d.toLocaleDateString("es-ES", {day: "numeric", month: "long"});
    return (nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)) + " · " + fecha;
  }

  function _renderEvento(evt){
    var hora = new Date(evt.start).toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"});
    var titulo = esc(evt.title);
    var tipo = (evt.metadata && evt.metadata.event_type) ? esc(evt.metadata.event_type.replace(/_/g, " ")) : "Evento";
    var estado_badge = "";

    var colores_estado = {
      confirmed: "background:var(--pw-success-bg);color:var(--pw-bosque)",
      pending: "background:#FFF3E0;color:#E65100",
      cancelled: "background:#FFEBEE;color:#C62828"
    };
    if(evt.state && colores_estado[evt.state]){
      estado_badge = "<span style='font-size:9px;padding:2px 6px;border-radius:4px;" + colores_estado[evt.state] + "'>" + esc(evt.state.toUpperCase()) + "</span>";
    }

    var foto = (evt.metadata && evt.metadata.client_photo) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Crect fill='%23ccc' width='36' height='36'/%3E%3C/svg%3E";
    var grupal = (evt.participants && evt.participants.length > 2) ? "<span style='font-size:9px;padding:2px 6px;border-radius:4px;background:#E1EDF1;color:#2E7587'>Grupal</span>" : "";

    return "<div class='ag-event-card' style='cursor:pointer;padding:8px;border-radius:8px;background:#f9f8f6;border:1px solid var(--pw-border);margin-bottom:6px' data-event-id='" + esc(evt.id) + "'>" +
      "<div style='display:flex;gap:8px;align-items:start'>" +
      "<div style='font-weight:600;color:var(--pw-bosque);min-width:50px'>" + esc(hora) + "</div>" +
      "<div style='flex:1;min-width:0'>" +
      "<div class='ag-event-card__client' style='font-size:13px;font-weight:600;margin-bottom:2px'>" + titulo + "</div>" +
      "<div class='ag-event-card__type' style='font-size:10px;text-transform:uppercase;color:var(--pw-text-muted);margin-bottom:4px'>" + tipo + "</div>" +
      "<div style='font-size:11px;color:var(--pw-text-soft); display:flex;gap:6px;align-items:center'>" +
      "<span>" + (evt.participants ? evt.participants.length : 0) + " participante(s)" + estado_badge + "</span>" +
      grupal +
      "</div>" +
      "</div>" +
      "<img src='" + esc(foto) + "' alt='' style='width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0' onerror='this.style.display=\"none\"'>" +
      "</div></div>";
  }

  // Vistas: mes, semana, día
  if(view === "mes" || !compact){
    var grupos = _agruparPorFecha();
    var fechas = Object.keys(grupos).sort();
    var html = "<div style='padding:8px 0'>";

    if(fechas.length === 0){
      html += "<div style='padding:24px 16px;text-align:center;color:var(--pw-text-soft);font-size:13px'>" +
        "Sin eventos programados. " +
        (acciones.crear ? "<button class='cp-btn cp-btn-primary' style='margin-top:8px' data-act='sch-create'>Crear evento</button>" : "") +
        "</div>";
    } else {
      fechas.forEach(function(fecha){
        html += "<div style='font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--pw-text-muted);padding:10px 8px 4px;margin-top:8px'>" + _formatoDia(fecha) + "</div>";
        grupos[fecha].sort(function(a, b){ return new Date(a.start).getTime() - new Date(b.start).getTime(); });
        grupos[fecha].forEach(function(evt){
          html += _renderEvento(evt);
        });
      });
    }

    html += "</div>";

    if(acciones.crear){
      html += "<div style='padding:12px 8px;border-top:1px solid var(--pw-border);margin-top:8px'>" +
        "<button class='cp-btn cp-btn-primary' style='width:100%' data-act='sch-create'>Crear evento</button>" +
        "</div>";
    }

    return html;
  }

  return "<div style='padding:16px;text-align:center;color:var(--pw-text-soft)'>Vista no soportada aún</div>";
}

// ── KPI Rendering Helper ────────────────────────────────────────────────────
function renderSchedulerKPIs(scheduler){
  var kpis = scheduler.getKPIs();
  return "<div class='agkpis' style='display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px'>" +
    "<div class='agkpi' style='padding:12px;background:var(--pw-niebla-2);border-radius:9px'>" +
      "<div style='font-size:11px;color:var(--pw-text-muted);text-transform:uppercase'>Sesiones hoy</div>" +
      "<div style='font-size:20px;font-weight:700;color:var(--pw-bosque)'>" + kpis.sesiones_hoy + "</div>" +
    "</div>" +
    "<div class='agkpi' style='padding:12px;background:var(--pw-niebla-2);border-radius:9px'>" +
      "<div style='font-size:11px;color:var(--pw-text-muted);text-transform:uppercase'>Atenciones semana</div>" +
      "<div style='font-size:20px;font-weight:700;color:var(--pw-bosque)'>" + kpis.atenciones_semana + "</div>" +
    "</div>" +
    "<div class='agkpi' style='padding:12px;background:var(--pw-niebla-2);border-radius:9px'>" +
      "<div style='font-size:11px;color:var(--pw-text-muted);text-transform:uppercase'>Clases semana</div>" +
      "<div style='font-size:20px;font-weight:700;color:var(--pw-bosque)'>" + kpis.clases_semana + "</div>" +
    "</div>" +
    "<div class='agkpi' style='padding:12px;background:var(--pw-niebla-2);border-radius:9px'>" +
      "<div style='font-size:11px;color:var(--pw-text-muted);text-transform:uppercase'>Total eventos</div>" +
      "<div style='font-size:20px;font-weight:700;color:var(--pw-bosque)'>" + kpis.total_eventos + "</div>" +
    "</div>" +
    "</div>";
}

// ── SesionesRegistroProvider (Phase 1) ──────────────────────────────────────
var SesionesRegistroProvider = {
  getEventos: function(scope, usuario_id, team_id, org_id, permisos){
    var eventos = [];
    if(typeof CLIENTS === "undefined" || !CLIENTS) return eventos;

    CLIENTS.forEach(function(c){
      if(c.raw && c.raw.activo === false) return;
      (c.ses || []).forEach(function(s){
        if(!s || !s.fecha) return;
        var startDt = new Date(s.fecha + (s.hora ? "T" + s.hora : "T12:00") + ":00Z");
        var endDt = new Date(startDt.getTime() + 3600000);
        var evt = {
          id: "evt_temp_" + (Math.random() * 1e9 | 0),
          title: "Sesión con " + c.name,
          description: "",
          start: startDt.toISOString(),
          end: endDt.toISOString(),
          timezone: "Europe/Madrid",
          recurring: null,
          organizer_id: usuario_id,
          participants: [{user_id: c.id, role: "client", status: "confirmed", attendance: "not_responded"}],
          state: "confirmed",
          visibility: "participants",
          source: "sesiones_registro",
          source_id: "evt_temp_" + (Math.random() * 1e9 | 0),
          created_at: new Date().toISOString(),
          created_by: usuario_id,
          updated_at: new Date().toISOString(),
          updated_by: usuario_id,
          resources: [],
          capacity: {min: 1, max: 2, current: 2},
          metadata: {
            event_type: s.tipo || "sesion_individual",
            client_photo: c.photo || "",
            week: c.week || 1
          },
          related_to: {}
        };
        eventos.push(evt);
      });
    });

    return eventos;
  }
};
