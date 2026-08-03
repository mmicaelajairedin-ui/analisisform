# Sprint 5.2.1 — Arquitectura del Calendar Engine (LOCKED)

**Estado**: LOCKED (no se cambia sin revisión arquitectónica)  
**Fecha**: 2026-08-03  
**Después de esto**: SOLO CÓDIGO, QA, DESPLIEGUE

---

## 7 Reglas Congeladas

### Regla 1: Scheduler es un Único Componente Reutilizable

**NO existen:**
- Agenda Coach
- Agenda Cliente
- Agenda Owner
- Agenda Equipo
- Variantes por módulo

**EXISTE:**
- Un único `Calendar Engine` reutilizable

**Se usa en:**
- `panel-v2.html` (coach independiente)
- `multicoach.html` (owner/senior)
- `cliente.html` (cliente/participante)
- `reservar.html` (público, sin login)
- `programas.html` (programa calendario)
- `reuniones.html` (reuniones grupales)
- Futuras automatizaciones

**Nunca crear variantes. Un solo componente, múltiples contextos.**

---

### Regla 2: Eventos Son Entidades Independientes

**El evento NO pertenece a una persona.**

Un evento puede involucrar:
- 1 owner (coach creador)
- N coaches (colaboradores)
- 1 recruiter (reclutador)
- N clientes (participantes)
- N observadores
- N recursos (salas, herramientas)

**Siempre mediante `participants[]`:**

```javascript
{
  id: "evt_...",
  title: "Career Review Panel",
  organizer_id: "coach_1",  // creador
  participants: [
    {user_id: "coach_1", role: "organizer", status: "confirmed"},
    {user_id: "coach_2", role: "collaborator", status: "confirmed"},
    {user_id: "recruiter_1", role: "recruiter", status: "pending"},
    {user_id: "client_1", role: "client", status: "confirmed"},
    {user_id: "client_2", role: "client", status: "tentative"},
    {user_id: "observer_1", role: "observer", status: "confirmed"}
  ]
}
```

**Nunca asumir un único participante. Siempre array.**

---

### Regla 3: Scheduler Nunca Interpreta Negocio

**El Scheduler NO SABE QUÉ ES:**
- Una sesión 1:1
- Una entrevista
- Una llamada de seguimiento
- Un onboarding
- Una formación grupal
- Un workshop
- Una reunión interna
- Una llamada con cliente

**El Scheduler SOLO:**
- Renderiza eventos
- Filtra por scope/permisos
- Llama callbacks (onCreate, onEdit, onCancel, etc.)

**Cada módulo interpreta esos eventos:**
- `panel-v2`: "esto es una sesión con Ana"
- `multicoach`: "esto es un seguimiento del equipo"
- `cliente`: "esto es mi sesión programada"
- `programas`: "esto es una clase del programa"

El negocio está FUERA del Scheduler. Eso lo decide el contexto (metadata, módulo que llama, permisos).

---

### Regla 4: Las Vistas Son Únicamente Filtros

**NO existen calendarios diferentes.**

Solo filtros (scope):

| Scope | Quién ve | Condición |
|-------|----------|-----------|
| `self` | Coach su agenda | organizer_id == usuario.id OR user_id IN participants |
| `team` | Senior su equipo | coach.team_id == usuario.team_id |
| `global` | Owner toda org | org_id == usuario.org_id |
| `participant` | Cliente sus sesiones | user_id IN participants |
| `resource` | Sala su ocupación | resource_id IN resources[] |
| `room` | Sala disponible | resource.type == "room" |
| `program` | Programa sus clases | program_id == programa.id |

**Sin modificar el Scheduler.**

Mañana: `scope=resource`, `scope=room`, `scope=program`. El Scheduler no cambia. Solo se pasa otro scope.

---

### Regla 5: Todo Evento Acepta Relaciones

Aunque todavía no existan en Phase 1, cada evento debe estar preparado para conectar:

```javascript
{
  id: "evt_...",
  // ... campos base ...
  
  // Relaciones (IDs, no lógica)
  related_to: {
    program_id: "prog_123",      // sesión de un programa
    resource_ids: ["sala_201", "meet_xyz"],  // sala + videollamada
    form_id: "form_intake",      // formulario asociado
    charge_id: "charge_...",     // cobro facturado
    doc_ids: ["doc_cv", "doc_cert"],  // documentos
    conversation_id: "conv_ia_...",   // conversación con IA
    community_id: "comm_...",    // comunidad donde se anuncia
    contract_id: "contract_..."  // contrato firmado
  }
}
```

**Solo referencias (IDs). No lógica de negocio.**

Cuando sea hora de implementar "Sesiones de Programa", solo añades `program_id` y lo interpretas en el módulo `programas.html`. El Scheduler no cambia.

---

### Regla 6: No Asumir Interfaz de Calendario

**Hoy renderizamos calendario.**

Mañana podría ser:

- **Timeline** (línea de tiempo vertical)
- **Lista** (listado de próximos eventos)
- **Kanban** (por estado: draft → pending → confirmed)
- **Agenda diaria** (cada hora de hoy)
- **Dashboard** (resumen + próximos 3)
- **Gantt** (duración de eventos)
- **Tabla** (eventos tabulares)
- **Grid** (matriz equipo × tiempo)

**El motor NUNCA conoce la UI.**

Solo devuelve `SchedulerEvent[]` filtrado. El renderizador (sea calendario, timeline, lista, lo que sea) interpreta esos eventos.

```javascript
// Motor (agnóstico)
var scheduler = initScheduler(context);
var eventos = scheduler.getEventos();  // array de SchedulerEvent

// UI (intercambiable)
renderCalendar(eventos);    // hoy
renderTimeline(eventos);    // mañana
renderKanban(eventos);      // pasado
```

---

### Regla 7: Fin de Arquitectura — Comienzo de Implementación

**NO MÁS DOCUMENTOS.**

Prioridad de implementación:

1. **Panel-v2** (coach)
   - Integrar nuevo Scheduler detrás del feature flag
   - Validar completamente (USE_NEW_SCHEDULER=false vs true)
   - Asegurar que ambas rutas funcionan
   - QA: lado a lado

2. **MultiCoach** (owner/senior)
   - Usar EXACTAMENTE el mismo componente
   - No copies código
   - Solo otro contexto (scope=team)
   - QA: validar que es idéntico en funcionamiento

3. **Cliente.html** (cliente)
   - Usar EXACTAMENTE el mismo componente
   - Scope=participant
   - QA completa

**Después:**
- Despliegue incremental
- Monitoreo de errores
- Feedback de usuarios
- Refinamiento

**Entonces sí:** Nuevas features (Google Calendar, Outlook, recurrencias, drag & drop).

---

## Checklist Congelado

- [x] Scheduler es UN componente reutilizable
- [x] Eventos son entidades independientes (participants[])
- [x] Scheduler no interpreta negocio
- [x] Vistas son filtros (scope)
- [x] Eventos aceptan relaciones futuras (no lógica)
- [x] UI agnóstica (calendario, timeline, lista, etc.)
- [x] FIN DE ARQUITECTURA — COMIENZO DE IMPLEMENTACIÓN

---

## Próximos Pasos (CÓDIGO ÚNICAMENTE)

1. QA: panel-v2 con USE_NEW_SCHEDULER=false y true
2. Integración: MultiCoach (mismo Scheduler, scope=team)
3. Integración: cliente.html (mismo Scheduler, scope=participant)
4. Despliegue incremental
5. Monitoreo
6. Iteración based on feedback

**Sin más documentos.**

---

*Architecture LOCKED*  
*Calendar Engine v1.0*  
*2026-08-03*
