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
    },
    labels: labels_param,
    theme: theme,
    locale: locale
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
  var state = scheduler.getEstado();
  var labels = state.labels || {};
  var theme = state.theme || {};
  var locale = state.locale || "es";
  var view = options.view || "mes";
  var compact = options.compact || false;

  // Default labels (i18n fallback)
  var defaultLabels = {
    hoy: "Hoy",
    manana: "Mañana",
    sin_eventos: "Sin eventos programados",
    crear_evento: "Crear evento",
    participantes: "participante(s)",
    grupal: "Grupal",
    sesiones_hoy: "Sesiones hoy",
    atenciones_semana: "Atenciones semana",
    clases_semana: "Clases semana",
    total_eventos: "Total eventos",
    sin_eventos_hoy: "Sin eventos hoy"
  };
  Object.keys(defaultLabels).forEach(function(key){
    if(!labels[key]) labels[key] = defaultLabels[key];
  });

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
    if(diff === 0) nombreDia = labels.hoy;
    else if(diff === 1) nombreDia = labels.manana;
    else nombreDia = d.toLocaleDateString(locale, {weekday: "long"});
    var fecha = d.toLocaleDateString(locale, {day: "numeric", month: "long"});
    return (nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)) + " · " + fecha;
  }

  function _renderEvento(evt){
    var hora = new Date(evt.start).toLocaleTimeString(locale, {hour: "2-digit", minute: "2-digit"});
    var titulo = esc(evt.title);
    var tipo = (evt.metadata && evt.metadata.event_type) ? esc(evt.metadata.event_type.replace(/_/g, " ")) : "Evento";
    var estado_badge = "";

    // Theme-aware colors: use theme colors if provided, fallback to defaults
    var colores_estado = {
      confirmed: "background:" + (theme.successBg || "var(--pw-success-bg)") + ";color:" + (theme.successText || "var(--pw-bosque)"),
      pending: "background:" + (theme.warningBg || "#FFF3E0") + ";color:" + (theme.warningText || "#E65100"),
      cancelled: "background:" + (theme.dangerBg || "#FFEBEE") + ";color:" + (theme.dangerText || "#C62828")
    };
    if(evt.state && colores_estado[evt.state]){
      estado_badge = "<span style='font-size:9px;padding:2px 6px;border-radius:4px;" + colores_estado[evt.state] + "'>" + esc(evt.state.toUpperCase()) + "</span>";
    }

    // Support branding colors if available (prioritize branding over default)
    var brandColor = (evt.branding && evt.branding.org_color) || (theme.accentColor || "var(--pw-bosque)");
    var foto = (evt.metadata && evt.metadata.client_photo) || (evt.branding && evt.branding.coach_avatar) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Crect fill='%23ccc' width='36' height='36'/%3E%3C/svg%3E";
    var grupal = (evt.participants && evt.participants.length > 2) ? "<span style='font-size:9px;padding:2px 6px;border-radius:4px;background:#E1EDF1;color:#2E7587'>" + labels.grupal + "</span>" : "";

    return "<div class='ag-event-card' style='cursor:pointer;padding:8px;border-radius:" + (theme.borderRadius || "8px") + ";background:#f9f8f6;border:1px solid var(--pw-border);margin-bottom:6px' data-event-id='" + esc(evt.id) + "'>" +
      "<div style='display:flex;gap:8px;align-items:start'>" +
      "<div style='font-weight:600;color:" + brandColor + ";min-width:50px'>" + esc(hora) + "</div>" +
      "<div style='flex:1;min-width:0'>" +
      "<div class='ag-event-card__client' style='font-size:13px;font-weight:600;margin-bottom:2px'>" + titulo + "</div>" +
      "<div class='ag-event-card__type' style='font-size:10px;text-transform:uppercase;color:var(--pw-text-muted);margin-bottom:4px'>" + tipo + "</div>" +
      "<div style='font-size:11px;color:var(--pw-text-soft); display:flex;gap:6px;align-items:center'>" +
      "<span>" + (evt.participants ? evt.participants.length : 0) + " " + labels.participantes + estado_badge + "</span>" +
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
        labels.sin_eventos + ". " +
        (acciones.crear ? "<button class='cp-btn cp-btn-primary' style='margin-top:8px' data-act='sch-create'>" + labels.crear_evento + "</button>" : "") +
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
        "<button class='cp-btn cp-btn-primary' style='width:100%' data-act='sch-create'>" + labels.crear_evento + "</button>" +
        "</div>";
    }

    return html;
  }

  if(view === "semana"){
    // Week view: hora × día grid
    var hoy = new Date();
    var inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay() + (state ? state.fecha_navegacion.semana_offset * 7 : 0));

    var diasSemana = [];
    for(var d = 0; d < 7; d++){
      var fecha = new Date(inicioSemana);
      fecha.setDate(fecha.getDate() + d);
      diasSemana.push(fecha);
    }

    var AG_START = 8;
    var AG_END = 18;
    var AG_ROWH = 30;
    var DOW = ["L", "M", "X", "J", "V", "S", "D"];

    var grupos = _agruparPorFecha();
    var headRow = "<div style='display:grid;grid-template-columns:50px repeat(7,1fr);gap:1px;border:1px solid var(--pw-border);border-radius:8px;overflow:hidden;margin-bottom:12px'>";
    headRow += "<div style='background:var(--pw-niebla-2);padding:8px;font-weight:700;font-size:11px'></div>";

    diasSemana.forEach(function(fecha, idx){
      var isToday = fecha.toDateString() === hoy.toDateString();
      headRow += "<div style='background:" + (isToday ? "var(--pw-success-bg)" : "var(--pw-niebla-2)") + ";padding:8px;font-weight:700;font-size:11px;text-align:center'>" +
        DOW[idx] + "<br>" + fecha.getDate() + "</div>";
    });
    headRow += "</div>";

    var colGrid = "<div style='display:grid;grid-template-columns:50px repeat(7,1fr);gap:1px;background:var(--pw-border);border:1px solid var(--pw-border);border-radius:8px;overflow:hidden'>";

    for(var h = AG_START; h < AG_END; h++){
      colGrid += "<div style='background:var(--pw-niebla-2);padding:4px;font-size:10px;font-weight:700;text-align:right;color:var(--pw-text-muted)'>" + h + ":00</div>";

      diasSemana.forEach(function(fecha){
        var fechaStr = fecha.getFullYear() + "-" + ("0" + (fecha.getMonth() + 1)).slice(-2) + "-" + ("0" + fecha.getDate()).slice(-2);
        var evtsHora = (grupos[fechaStr] || []).filter(function(evt){
          var startHour = new Date(evt.start).getHours();
          return startHour === h;
        });

        colGrid += "<div style='background:#fff;min-height:30px;padding:2px;border:1px solid var(--pw-border)'>";
        evtsHora.forEach(function(evt){
          colGrid += "<div style='font-size:9px;padding:2px;background:var(--pw-success-bg);border-radius:4px;margin-bottom:1px;cursor:pointer' data-event-id='" + esc(evt.id) + "' data-act='sch-edit'>" +
            esc(evt.title.substring(0, 15)) + "</div>";
        });
        colGrid += "</div>";
      });
    }
    colGrid += "</div>";

    return headRow + colGrid;
  }

  if(view === "dia"){
    // Day view: detailed day schedule
    var hoy = new Date();
    var grupos = _agruparPorFecha();

    var fechaStr = hoy.getFullYear() + "-" + ("0" + (hoy.getMonth() + 1)).slice(-2) + "-" + ("0" + hoy.getDate()).slice(-2);
    var evtosDia = (grupos[fechaStr] || []).sort(function(a, b){
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    var AG_START = 8;
    var AG_END = 18;

    var html = "<div style='padding:8px 0'>";
    html += "<div style='font-size:13px;font-weight:600;margin-bottom:12px'>" + labels.hoy + ", " + hoy.toLocaleDateString(locale, {day: "numeric", month: "long"}) + "</div>";

    if(evtosDia.length === 0){
      html += "<div style='padding:24px;text-align:center;color:var(--pw-text-soft)'>" + labels.sin_eventos_hoy + "</div>";
    } else {
      html += "<div style='display:flex;flex-direction:column;gap:8px'>";
      evtosDia.forEach(function(evt){
        html += _renderEvento(evt);
      });
      html += "</div>";
    }

    html += "</div>";
    return html;
  }

  return "<div style='padding:16px;text-align:center;color:var(--pw-text-soft)'>Vista no soportada: " + esc(view) + "</div>";
}

// ── KPI Rendering Helper ────────────────────────────────────────────────────
function renderSchedulerKPIs(scheduler){
  var kpis = scheduler.getKPIs();
  var state = scheduler.getEstado();
  var labels = state.labels || {};
  var theme = state.theme || {};

  // Default KPI labels (i18n fallback)
  var defaultLabels = {
    sesiones_hoy: "Sesiones hoy",
    atenciones_semana: "Atenciones semana",
    clases_semana: "Clases semana",
    total_eventos: "Total eventos"
  };
  Object.keys(defaultLabels).forEach(function(key){
    if(!labels[key]) labels[key] = defaultLabels[key];
  });

  var bgColor = theme.kpiBg || "var(--pw-niebla-2)";
  var textColor = theme.kpiText || "var(--pw-bosque)";
  var borderRadius = theme.borderRadius || "9px";

  return "<div class='agkpis' style='display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px'>" +
    "<div class='agkpi' style='padding:12px;background:" + bgColor + ";border-radius:" + borderRadius + "'>" +
      "<div style='font-size:11px;color:var(--pw-text-muted);text-transform:uppercase'>" + labels.sesiones_hoy + "</div>" +
      "<div style='font-size:20px;font-weight:700;color:" + textColor + "'>" + kpis.sesiones_hoy + "</div>" +
    "</div>" +
    "<div class='agkpi' style='padding:12px;background:" + bgColor + ";border-radius:" + borderRadius + "'>" +
      "<div style='font-size:11px;color:var(--pw-text-muted);text-transform:uppercase'>" + labels.atenciones_semana + "</div>" +
      "<div style='font-size:20px;font-weight:700;color:" + textColor + "'>" + kpis.atenciones_semana + "</div>" +
    "</div>" +
    "<div class='agkpi' style='padding:12px;background:" + bgColor + ";border-radius:" + borderRadius + "'>" +
      "<div style='font-size:11px;color:var(--pw-text-muted);text-transform:uppercase'>" + labels.clases_semana + "</div>" +
      "<div style='font-size:20px;font-weight:700;color:" + textColor + "'>" + kpis.clases_semana + "</div>" +
    "</div>" +
    "<div class='agkpi' style='padding:12px;background:" + bgColor + ";border-radius:" + borderRadius + "'>" +
      "<div style='font-size:11px;color:var(--pw-text-muted);text-transform:uppercase'>" + labels.total_eventos + "</div>" +
      "<div style='font-size:20px;font-weight:700;color:" + textColor + "'>" + kpis.total_eventos + "</div>" +
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

// ── Drag & Drop Helpers (Sprint A.3) ────────────────────────────────────────
var _schedulerDragData = null;

function schedulerDragStart(event, eventId, scheduler) {
  if(!scheduler.getAcciones().mover) return;
  _schedulerDragData = {eventId: eventId, event: event};
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", eventId);
}

function schedulerDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function schedulerDrop(event, newDate, scheduler) {
  event.preventDefault();
  if(!_schedulerDragData) return;

  var eventId = _schedulerDragData.eventId;
  if(scheduler.getAcciones().mover) {
    scheduler.reprogramarEvento(eventId, newDate);
  }
  _schedulerDragData = null;
}

// ── Availability Helpers (Sprint A.3) ───────────────────────────────────────
var _availabilityState = null;

function schedulerAvailabilityInit(currentState) {
  _availabilityState = {
    days: currentState.days || [1, 2, 3, 4, 5],
    from: currentState.from || "09:00",
    to: currentState.to || "18:00",
    min_notice_h: currentState.min_notice_h || 2,
    buffer_min: currentState.buffer_min || 0,
    bloqueados: currentState.bloqueados || []
  };
  return _availabilityState;
}

function schedulerAvailabilityAddBlock(date) {
  if(!_availabilityState) return;
  var dateStr = date.getFullYear() + "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) + "-" +
    ("0" + date.getDate()).slice(-2);
  if(_availabilityState.bloqueados.indexOf(dateStr) < 0) {
    _availabilityState.bloqueados.push(dateStr);
  }
}

function schedulerAvailabilityRemoveBlock(dateStr) {
  if(!_availabilityState) return;
  _availabilityState.bloqueados = _availabilityState.bloqueados.filter(function(d){
    return d !== dateStr;
  });
}

function schedulerAvailabilityToggleDay(dayOfWeek) {
  if(!_availabilityState) return;
  var idx = _availabilityState.days.indexOf(dayOfWeek);
  if(idx >= 0) {
    _availabilityState.days.splice(idx, 1);
  } else {
    _availabilityState.days.push(dayOfWeek);
  }
}

function schedulerGetAvailability() {
  return _availabilityState;
}

// ── Multiple Participant Support (Sprint A.3 motor-only) ───────────────────
var PARTICIPANT_ROLES = [
  "organizer",      // creador del evento
  "collaborator",   // colaborador que edita
  "coach",          // coach de la sesión
  "client",         // cliente participante
  "recruiter",      // reclutador (procesos)
  "observer",       // observador (sin modificar)
  "guest"           // invitado opcional
];

function validateParticipantRole(role) {
  return PARTICIPANT_ROLES.indexOf(role) >= 0;
}
