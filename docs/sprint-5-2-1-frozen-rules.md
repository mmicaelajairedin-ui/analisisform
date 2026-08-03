# Sprint 5.2.1 — Reglas Congeladas del Scheduler

**Estado**: CONGELADO (inmutable sin revisión arquitectónica)  
**Fecha**: 2026-08-03

---

## Regla 1: SchedulerDataProvider (Interfaz Genérica)

### Principio
El Scheduler **NUNCA conoce el origen de los datos**. Solo habla con un `SchedulerDataProvider`.

### Interfaz
```javascript
var SchedulerDataProvider = {
  // Retorna eventos que el usuario puede ver según scope + permisos
  getEvents: function(scope, usuario_id, team_id, org_id, permisos) {
    // Retorna: array de eventos
    return Promise.resolve([]);
  },

  // Guarda/crea un evento
  createEvent: function(evento) {
    // Retorna: {success: true, evento_id: "..."}
    return Promise.resolve({success: true});
  },

  // Actualiza un evento existente
  updateEvent: function(evento_id, cambios) {
    // Retorna: {success: true, evento}
    return Promise.resolve({success: true});
  },

  // Elimina un evento
  deleteEvent: function(evento_id) {
    // Retorna: {success: true}
    return Promise.resolve({success: true});
  },

  // Confirma/rechaza asistencia del usuario a un evento
  confirmAttendance: function(evento_id, status) {
    // status: "will_attend" | "declined_attend" | "requested_reschedule"
    return Promise.resolve({success: true});
  },

  // Calcula disponibilidad del usuario
  getAvailability: function(usuario_id, fecha_inicio, fecha_fin) {
    // Retorna: {horas_libres, horas_ocupadas, horas_bloqueadas, capacidad_pct}
    return Promise.resolve({});
  }
};
```

### Implementaciones (Solo por Mencionarlas, No Implementar Aún)

**Phase 1 (Hoy):**
```javascript
var SesionesRegistroProvider = {
  getEvents: function(...) { /* Lee CLIENTS + sesiones_registro */ },
  createEvent: function(...) { /* Guarda en sesiones_registro */ },
  // ... resto
};
```

**Phase 2 (Sprint 5.2.3):**
```javascript
var AgendaProvider = {
  getEvents: function(...) { /* Consulta tabla agendas + RLS */ },
  createEvent: function(...) { /* INSERT en tabla agendas */ },
  // ... resto
};
```

**Futuro:**
```javascript
var GoogleCalendarProvider = { /* sincroniza con Google */ };
var OutlookProvider = { /* sincroniza con Outlook */ };
var CalendlyProvider = { /* sincroniza con Calendly */ };
```

### Cambio en initScheduler()
```javascript
function initScheduler(config){
  var dataProvider = config.dataProvider;  // INYECTADO
  // Ahora: dataProvider.getEvents(...) en lugar de lógica hardcodeada
}
```

**El Scheduler nunca cambia.** Solo cambia la implementación del provider.

---

## Regla 2: Contexto Agnóstico de Aplicación

### Principio
El Scheduler **NUNCA sabe si está en panel-v2, multicoach o cliente.html**. Solo recibe contexto genérico.

### Props del Scheduler (Contexto Único)
```javascript
var context = {
  // Identidad del usuario actual
  currentUser: {
    id: "usuario_...",
    name: "Ana",
    email: "ana@...",
    // NUNCA "rol" hardcodeado (coach/owner/cliente)
  },

  // Contexto organizacional
  organization: {
    id: "org_...",
    name: "Pathway"
  },

  // Contexto del equipo (opcional)
  team: {
    id: "team_...",
    name: "Fitness Squad"
  },

  // Permisos del usuario (array de strings)
  permissions: [
    "agenda.read.self",
    "agenda.read.team",
    "agenda.create",
    "agenda.edit",
    "agenda.cancel"
  ],

  // Filtro activo (self/team/global/participant)
  scope: "self",

  // Proveedor de datos (inyectado)
  dataProvider: SesionesRegistroProvider  // o AgendaProvider, o GoogleCalendarProvider

  // Callbacks
  callbacks: {
    onCreate: function(evento) {},
    onEdit: function(evento_id, cambios) {},
    onCancel: function(evento_id) {},
    onConfirmAttendance: function(evento_id, status) {}
  }
};

var scheduler = initScheduler(context);
```

### Cambio en initScheduler()
```javascript
function initScheduler(context) {
  var usuario_id = context.currentUser.id;
  var org_id = context.organization.id;
  var team_id = context.team ? context.team.id : null;
  var permisos = context.permissions;
  var scope = context.scope;
  var dataProvider = context.dataProvider;

  // El resto es agnóstico: sin if(panel-v2), sin if(multicoach), sin if(cliente)
}
```

### Aplicación: Mismo Código en 3 Contextos

**panel-v2.html (Coach Independiente):**
```javascript
var scheduler = initScheduler({
  currentUser: {id: ME.id, name: ME.nombre, email: ME.email},
  organization: {id: ME.org_id, name: "Mi Coaching"},
  team: ME.team_id ? {id: ME.team_id, name: ME.team_nombre} : null,
  permissions: ME.permisos,
  scope: "self",
  dataProvider: SesionesRegistroProvider
});
```

**multicoach.html (Owner/Senior):**
```javascript
var scheduler = initScheduler({
  currentUser: {id: ME.id, name: ME.nombre, email: ME.email},
  organization: {id: ME.org_id, name: ME.org_nombre},
  team: {id: ME.team_id, name: "Mi Equipo"},
  permissions: ME.permisos,  // incluye agenda.read.team, agenda.read.global
  scope: "team",  // puede cambiar dinámicamente a "global"
  dataProvider: SesionesRegistroProvider
});
```

**cliente.html (Cliente):**
```javascript
var scheduler = initScheduler({
  currentUser: {id: C.id, name: C.nombre, email: C.email},
  organization: {id: ORG.id, name: ORG.nombre},
  team: null,  // Cliente no tiene team
  permissions: ["agenda.read.self"],  // Solo lectura de propios
  scope: "participant",  // Solo eventos donde participa
  dataProvider: SesionesRegistroProvider
});
```

**¿El código del Scheduler cambió?** NO. Solo las props.

---

## Regla 3: Feature Flag Obligatorio

### Constante Global
```javascript
var USE_NEW_SCHEDULER = false;  // CONGELADO: solo cambiar cuando QA valide
```

### En viewDashboard() (panel-v2.html)
```javascript
if(USE_NEW_SCHEDULER) {
  // Nuevo Scheduler
  var scheduler = initScheduler({...context...});
  var html = renderScheduler(scheduler);
} else {
  // Agenda legacy (actual)
  var sess = [];
  // ... código actual ...
}
```

### Flujo QA Obligatorio
1. `USE_NEW_SCHEDULER = false` → Agenda legacy visible
2. `USE_NEW_SCHEDULER = true` → Scheduler nuevo visible
3. Comparar lado a lado: ¿funcionan igual?
4. Validar en 3 contextos: panel-v2, multicoach, cliente
5. SOLO cuando todo funcione → eliminar rama else

---

## Regla 4: Reutilización Obligatoria

### Validación Antes de Cierre del Sprint

El Scheduler DEBE renderizarse idénticamente en 3 contextos:

#### ✓ Panel-v2 (coach independiente)
- [ ] Visualiza sesiones próximas
- [ ] Botón "Crear evento" funciona
- [ ] Permisos respetados

#### ✓ Multicoach (owner/senior)
- [ ] Visualiza agenda del equipo
- [ ] Selector de scope (self → team → global)
- [ ] Reasignación visible si tiene permiso

#### ✓ Portal Cliente (mock/futuro)
- [ ] Visualiza SOLO eventos donde participa
- [ ] Botón "Confirmar asistencia" funciona
- [ ] No ve agenda de otros clientes

**Criterio de cierre:** Exactamente el MISMO código `initScheduler()` + `renderScheduler()` en los 3 contextos.

---

## Regla 5: Objetivo del Sprint (No es Reemplazar Una Pantalla)

### Lo Que NO Es
❌ Una agenda para el coach  
❌ Un calendario bonito para multicoach  
❌ Una lista de sesiones para el cliente

### Lo Que SÍ Es
✅ **Agenda Engine de Pathway** — motor transversal de planificación  
✅ **Agnóstico de datos** — puede conectarse a cualquier proveedor  
✅ **Agnóstico de aplicación** — funciona en cualquier contexto  
✅ **Extensible** — hoy sesiones_registro, mañana tabla agendas, después Google Calendar  
✅ **Reutilizable** — mismo código en panel-v2, multicoach, cliente, recursos, programas

### Visión a Largo Plazo (5+ años)
Pathway tendrá:
- Coaches con agendas personales (scope=self)
- Equipos con agendas compartidas (scope=team)
- Owner viendo operaciones globales (scope=global)
- Clientes viendo sus sesiones (scope=participant)
- Recursos (salas, documentos) con disponibilidad (scope=participant)
- Programas mostrando sesiones en calendario (scope=participant)
- Integraciones con Google Calendar, Outlook, Calendly, Zoom, Meet (dataProvider)

**Un motor.** **Múltiples implementaciones.** **Cero duplicación.**

---

## Adición: Campo `visibility` en Evento

### Propósito
Preparar el modelo para cuando lleguen reuniones internas, formaciones, workshops y eventos privados.

### Estructura
```javascript
var evento = {
  id: "evt_...",
  type: "sesion_individual",
  title: "Career Review",
  start: "2026-08-10T14:00:00Z",
  end: "2026-08-10T15:00:00Z",
  
  // ... otros campos ...
  
  visibility: "private" | "team" | "organization" | "participants",
  
  // Significado:
  // - private: solo organizador puede verlo
  // - team: solo equipo del organizador lo ve
  // - organization: toda la org lo ve (solo Owner)
  // - participants: solo participantes + organizador lo ven
};
```

### Casos de Uso Futuros
- **Reunión interna**: visibility = "team" (solo coaches del equipo)
- **Formación**: visibility = "organization" (todos los coaches)
- **Sesión cliente**: visibility = "participants" (coach + cliente)
- **Evento privado**: visibility = "private" (solo coach)

### Implementación
- **Phase 1 (Hoy)**: Agregar campo, defaultear a "private"
- **Phase 2 (5.2.3)**: Aplicar en RLS de Supabase
- **Phase 3+**: Usar en lógica de filtrado según scope

---

## Checklist Congelado

- [x] SchedulerDataProvider como interfaz única
- [x] Contexto agnóstico de aplicación (currentUser, organization, team, permissions, scope, dataProvider)
- [x] Feature flag USE_NEW_SCHEDULER
- [x] Reutilización obligatoria en 3 contextos
- [x] Objetivo claro: Agenda Engine de Pathway (no agenda del coach)
- [x] Campo `visibility` en evento para future-proofing

---

## Próximo Paso

Una vez que estas 5 reglas estén aprobadas, comenzar refactorización:

1. Actualizar contrato del Scheduler
2. Agregar campo `visibility` al modelo de evento
3. Refactorizar `initScheduler()` para aceptar `context` inyectado
4. Crear `SesionesRegistroProvider` (implementación Phase 1)
5. Agregar feature flag `USE_NEW_SCHEDULER`
6. Integrar detrás del flag

**Estado**: LISTO PARA REFACTORIZACIÓN

---

*Reglas Congeladas del Scheduler*  
*Sprint 5.2.1*  
*Versión: 1.0*  
*Aprobadas: 2026-08-03*
