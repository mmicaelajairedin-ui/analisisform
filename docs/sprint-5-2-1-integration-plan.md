# Sprint 5.2.1 — Plan de Integración del Scheduler

**Estado**: Validación arquitectónica (antes de integración)  
**Objetivo**: Garantizar que el Scheduler es verdaderamente reutilizable y agnóstico de datos/rol

---

## 1. Adaptador de Datos (Interface, no Implementación)

### Principio
El Scheduler NO lee directamente de `sesiones_registro`, `agendas`, ni ninguna tabla.
Usa un **adaptador** que implementa una interfaz estándar.

### Interfaz del Adaptador
```javascript
var SchedulerDataAdapter = {
  // Retorna array de eventos que el usuario puede VER
  // según su contexto (permisos, participación, rol, team_id, etc.)
  getEventos: function(filtro, usuario_id, team_id, org_id, permisos) {
    // Implementación concreta por tipo de dato
    // Phase 1: lee sesiones_registro
    // Phase 2: lee tabla agendas + RLS
    return eventos[];
  },
  
  // Calcula disponibilidad del usuario
  getDisponibilidad: function(usuario_id, fecha_inicio, fecha_fin) {
    // Retorna: horario_laboral - vacaciones - bloqueos - eventos
    return disponibilidad{};
  },
  
  // Guarda/actualiza un evento
  guardarEvento: function(evento) {
    // Phase 1: sessionStorage/localStorage
    // Phase 2: POST a Supabase
    return {success: true, evento_id: "..."};
  }
};
```

### Implementación Actual (Phase 1)
```javascript
var Phase1Adapter = {
  getEventos: function(filtro, usuario_id, team_id, org_id, permisos) {
    // Lee CLIENTS + sesiones_registro
    // Aplicaría filtro desde la lógica del adapter
    var eventos = [];
    CLIENTS.forEach(...);
    return eventos;
  },
  
  getDisponibilidad: function(usuario_id, fecha_inicio, fecha_fin) {
    // Calcula: horario_laboral - vacaciones - bloqueos - eventos
    return {};
  },
  
  guardarEvento: function(evento) {
    // Guarda en localStorage/sesiones_registro
    return {success: true};
  }
};
```

### Cambio en Sprint 5.2.3 (Phase 2)
```javascript
var Phase2Adapter = {
  getEventos: function(filtro, usuario_id, team_id, org_id, permisos) {
    // Lee tabla `agendas` + RLS
    // El filtro se aplica en la query (WHERE scope = X AND ...)
    return fetch(...).then(r => r.json());
  },
  // ... más métodos
};
```

**Cambio en initScheduler():**
```javascript
function initScheduler(config){
  var adapter = config.adapter || Phase1Adapter;  // inyectado
  // Ahora: adapter.getEventos(...) en lugar de leer CLIENTS
}
```

---

## 2. Agnóstico de Rol

### Problema Actual
```javascript
if(usuario_rol==="coach") { /* lógica coach */ }
else if(usuario_rol==="owner") { /* lógica owner */ }
```

### Solución
**No hay roles en el Scheduler. Solo hay:**
- `usuario_id` (quién soy)
- `permisos` (qué puedo hacer)
- `team_id` (mi contexto: equipo)
- `org_id` (mi contexto: organización)

El **filtro** (`self`, `team`, `global`, `participant`) determina qué ve, no el rol.

### Ejemplo: Dos coaches, diferentes vistas
```javascript
// Coach 1 (sin permisos de equipo)
var sch1 = initScheduler({
  usuario_id: "coach_1",
  permisos: ["agenda.read.self"],  // NO "agenda.read.team"
  filtro: "self"  // SOLO sus eventos
});

// Coach 2 (con permisos de senior)
var sch2 = initScheduler({
  usuario_id: "coach_2",
  permisos: ["agenda.read.self", "agenda.read.team"],  // SÍ tiene acceso a team
  filtro: "team"  // Ve TODO el equipo
});

// Owner
var sch3 = initScheduler({
  usuario_id: "owner_1",
  permisos: ["agenda.read.self", "agenda.read.team", "agenda.read.global"],
  filtro: "global"  // Ve toda la org
});

// Cliente
var sch4 = initScheduler({
  usuario_id: "cliente_ana",
  permisos: ["agenda.read.self"],  // NO tiene read.team ni read.global
  filtro: "participant"  // SOLO eventos donde participa
});
```

**Cambio en initScheduler():**
- Eliminar toda lógica if(usuario_rol)
- Usar permisos como fuente de verdad
- El adaptador maneja los detalles

---

## 3. Integración Gradual (Feature Flag)

### Constante Global
```javascript
var USE_NEW_SCHEDULER = false;  // Feature flag
```

### En viewDashboard()
```javascript
if(USE_NEW_SCHEDULER){
  // Usar nuevo Scheduler
  var scheduler = initScheduler({...});
  var agendaCard = renderScheduler(scheduler);
}
else{
  // Usar agenda legacy (actual)
  var sess = [];
  // ... código actual ...
  var agendaCard = "<div>...</div>";
}
```

### Flujo QA
1. `USE_NEW_SCHEDULER = false` → Ver agenda legacy
2. `USE_NEW_SCHEDULER = true` → Ver Scheduler nuevo
3. Comparar ambas, validar que funcionan igual
4. Una vez validado, eliminar rama else

---

## 4. Validación de Reutilización

### Mismo Scheduler en 3 Contextos

#### panel-v2.html (coach independiente o de equipo)
```javascript
var scheduler = initScheduler({
  usuario_id: ME.id,
  permisos: ME.permisos,
  team_id: ME.team_id,
  org_id: ME.org_id,
  filtro: "self",  // coach ve su agenda
  adapter: Phase1Adapter
});
```

#### multicoach.html (owner/senior)
```javascript
var scheduler = initScheduler({
  usuario_id: ME.id,
  permisos: ME.permisos,
  team_id: ME.team_id,
  org_id: ME.org_id,
  filtro: "team",  // owner/senior ven equipo
  adapter: Phase1Adapter
});
```

#### cliente.html (cliente)
```javascript
var scheduler = initScheduler({
  usuario_id: C.id,  // Cliente
  permisos: ["agenda.read.self"],  // Cliente solo ve su agenda
  team_id: null,  // No aplica
  org_id: ORG.id,
  filtro: "participant",  // Cliente solo ve donde participa
  adapter: Phase1Adapter
});
```

**Validación:** ¿El código del Scheduler es idéntico en los 3 casos?
✅ SÍ — cambian solo las props, no el componente.

---

## 5. Checklist Pre-Integración

- [ ] **Crear Phase1Adapter** — lee CLIENTS + sesiones_registro
- [ ] **Refactorizar initScheduler()** — usa adapter.getEventos() en lugar de lectura directa
- [ ] **Eliminar lógica por rol** — usar permisos + contexto
- [ ] **Agregar feature flag** — USE_NEW_SCHEDULER = false
- [ ] **Probar Scheduler sin integración** — llamar initScheduler + renderScheduler en consola
- [ ] **Integrar en panel-v2** — detrás del feature flag
- [ ] **Integrar en multicoach** — mismo componente, diferentes props
- [ ] **Testing QA** — old vs new, comparar visuales
- [ ] **Cambiar feature flag** — USE_NEW_SCHEDULER = true cuando validado
- [ ] **Eliminar agenda legacy** — cuando feature flag sea definitivo

---

## Próximos Pasos

1. Crear `Phase1Adapter` (lee CLIENTS + sesiones_registro, agnóstico de rol)
2. Refactorizar `initScheduler()` para inyectar adapter
3. Agregar feature flag en panel-v2.html
4. Luego sí: integración en panel-v2, multicoach, cliente

**No integrar aún. Validar primero.**

---

*Plan de integración para Sprint 5.2.1*  
*Versión: 1.0*  
*Listo para revisión*
