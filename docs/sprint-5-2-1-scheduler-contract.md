# Sprint 5.2.1 — Contrato del Scheduler Reutilizable

**Estado**: Definición técnica (Fase 0: antes de implementación)  
**Fecha**: 2026-08-03

---

## Principio

Una única **Agenda de la Organización**. El Scheduler es el motor que filtra qué ve cada usuario según:
- Relación con el evento (¿participo?)
- Rol (coach/owner/cliente/colaborador)
- Permisos explícitos
- Scope de visualización (self/team/global)

---

## 1. Modelo de Datos Interno

### Evento (estructura mínima)
```javascript
{
  id: "evt_...",
  type: "sesion_individual" | "sesion_grupal" | "reunion_interna" | "formacion" | "workshop" | ...,
  title: "Career Review Ana",
  start: "2026-08-10T14:00:00Z",
  end: "2026-08-10T15:00:00Z",
  timezone: "Europe/Madrid",
  
  // Participantes
  organizer_id: "coach_...",
  participants: [
    { user_id: "client_...", role: "client", status: "confirmed" },
    { user_id: "coach2_...", role: "collaborator", status: "confirmed" }
  ],
  
  // Estado
  estado: "draft" | "proposed" | "pending" | "confirmed" | "completed" | "cancelled" | "no_show",
  
  // Origen (quién lo creó)
  origen: "agenda_manual" | "reserva_publica" | "programa" | ...,
  
  // Auditoría
  created_by: "coach_...",
  created_at: "2026-08-01T10:00:00Z",
  
  // Confirmaciones (nueva estructura)
  confirmaciones: {
    "coach_id": { status: "confirmed", confirmed_at: "..." },
    "client_id": { status: "pending", requested_reschedule: false },
    "collaborator_id": { status: "declined", reason: "..." }
  }
}
```

### Participante (dentro del evento)
```javascript
{
  user_id: "...",
  role: "owner" | "collaborator" | "recruiter" | "client" | "observer" | "invitado",
  status: "pending" | "confirmed" | "declined" | "tentative",
  // Confirmación de asistencia
  attendance_status: "not_responded" | "will_attend" | "declined_attend" | "requested_reschedule"
}
```

---

## 2. Resolución de Filtros

El Scheduler recibe un **filtro activo** (uno solo) que determina qué eventos se muestran:

### Filtro: `self`
**Quién ve:** Coach/Usuario viendo su propia agenda  
**Condición:** 
```
organizer_id == usuario.id 
OR user_id IN participants (con cualquier role)
```
**Ejemplo:** Coach Alex ve sus sesiones + reuniones donde participa.

### Filtro: `team`
**Quién ve:** Senior/Coach viendo equipo  
**Condición:**
```
team_id IN (SELECT team_id FROM usuarios WHERE id = usuario.id)
AND has_permission(usuario.id, 'agenda.read.team')
```
**Ejemplo:** Senior Javier ve todos los eventos de sus coaches.

### Filtro: `global`
**Quién ve:** Owner viendo toda la org  
**Condición:**
```
org_id == usuario.org_id
AND has_permission(usuario.id, 'agenda.read.global')
```
**Ejemplo:** Owner ve todo (coaches, clientes, equipos).

### Filtro: `participant` (NUEVO — crítico para cliente)
**Quién ve:** Cliente/Usuario viendo solo eventos donde participa  
**Condición:**
```
participants.user_id == usuario.id
```
**Ejemplo:** Cliente Ana ve solo las sesiones donde está en participants (1:1 con coach, workshop grupal, webinar, programa, etc.).

---

## 3. Resolución de Permisos

El Scheduler recibe un array de permisos:
```javascript
permisos: [
  "agenda.read.self",
  "agenda.read.team",  // opcional
  "agenda.create",
  "agenda.edit",
  "agenda.cancel",
  // ... más si aplica
]
```

**Qué botones muestra según permisos:**
- `agenda.create` → botón "Crear evento"
- `agenda.edit` → botón "Editar" (solo propios o si `agenda.edit.others`)
- `agenda.cancel` → botón "Cancelar"
- `agenda.read.team` → selector scope team/self (si no existe, solo self)
- `agenda.read.global` → selector scope global/team/self

---

## 4. Props del Scheduler

```javascript
<Scheduler
  // Identidad del usuario
  usuario_id: "coach_...",
  usuario_rol: "coach" | "owner" | "cliente" | "colaborador",
  
  // Contexto organizacional
  org_id: "org_...",
  team_id: "team_...",  // opcional, si existe equipo
  
  // Filtro activo
  filtro: "self" | "team" | "global" | "participant",
  
  // Permisos del usuario
  permisos: ["agenda.read.self", "agenda.create", ...],
  
  // Callbacks
  onEventCreate: (data) => {...},
  onEventEdit: (evento_id, data) => {...},
  onEventCancel: (evento_id) => {...},
  onEventReschedule: (evento_id, new_date) => {...},
  onConfirmAssistance: (evento_id, status) => {...},  // nuevo
  
  // Opciones
  view: "dia" | "semana" | "mes",  // estado inicial
  locale: "es" | "en",
/>
```

---

## 5. Return Value (Estado Interno)

El Scheduler mantiene internamente:
```javascript
{
  // Eventos filtrados (según filtro + permisos)
  eventos: [evento, evento, ...],
  
  // Estado de UI
  vista_actual: "dia" | "semana" | "mes",
  fecha_seleccionada: "2026-08-10",
  eventos_filtrados: [...],  // búsqueda/filtro aplicado
  
  // Acciones disponibles (calculadas según permisos)
  acciones_disponibles: {
    crear: true,
    editar: true,
    cancelar: true,
    reasignar: false,  // solo senior/owner
    confirmar_asistencia: true  // si es participante
  }
}
```

---

## 6. Casos de Uso de Reutilización

### Portal del Coach (panel-v2.html)
```javascript
<Scheduler
  usuario_id={ME.id}
  usuario_rol="coach"
  org_id={ME.org_id}
  team_id={ME.team_id}
  filtro="self"  // ve solo sus eventos
  permisos={["agenda.read.self", "agenda.create", "agenda.edit", ...]}
  onEventCreate={guardarSesion}
  onEventReschedule={moverSesion}
/>
```
**Qué ve:** Solo sus sesiones + sesiones donde participa como collaborator.

### MultiCoach (multicoach.html)
```javascript
<Scheduler
  usuario_id={ME.id}
  usuario_rol="owner"
  org_id={ME.org_id}
  team_id={ME.team_id}
  filtro="team"  // por defecto team, puede cambiar a global
  permisos={["agenda.read.self", "agenda.read.team", "agenda.read.global", "agenda.create", "agenda.edit.others", ...]}
  onEventCreate={crearSesion}
  onEventReschedule={reasignarSesion}
/>
```
**Qué ve:** Agenda de todo el equipo (todos los coaches). Puede filtrar por coach o ver global.

### Portal del Cliente (cliente.html)
```javascript
<Scheduler
  usuario_id={CLIENTE.id}
  usuario_rol="cliente"
  org_id={CLIENTE.org_id}
  filtro="participant"  // SOLO eventos donde participa
  permisos={["agenda.read.self"]}  // cliente nunca modifica
  onConfirmAssistance={confirmarAsistencia}
  view="mes"  // vista inicial mensual
/>
```
**Qué ve:** Solo sesiones individuales + sesiones grupales/workshops/webinars/programas donde está en participants.

### Portal de Recursos (future: recursos.html)
```javascript
<Scheduler
  usuario_id={null}  // recurso, no usuario
  recurso_id="sala_201"
  filtro="participant"  // eventos donde recurso_id está en recursos[]
  permisos={[]}  // solo lectura
/>
```
**Qué ve:** Ocupación de la sala (todos los eventos que la usan).

---

## 7. Diferencias Clave vs Arquitectura Anterior

| Aspecto | Viejo | Nuevo |
|--------|-------|-------|
| **Agendas** | Coach, Owner, Cliente (3 tablas) | Una sola Agenda org (1 tabla) |
| **Filtros** | Por rol | Por filtro activo (self/team/global/participant) |
| **Componentes** | 3 agendas diferentes | 1 Scheduler reutilizable |
| **Cliente** | Tabla separada `cliente_agenda` | Filtra por participants en Agenda org |
| **Confirmación** | No existe | participants[].attendance_status |
| **Reasignación** | Manual en admin | Senior/Owner con `agenda.reassign` |

---

## 8. Próximos Pasos

Una vez **aprobado este contrato:**

1. **Sprint 5.2.1** → Implementar Scheduler con este interfaz
2. **Sprint 5.2.2** → Integrar en panel-v2 + multicoach + cliente
3. **Sprint 5.2.3** → Conectar a tabla `agendas` en Supabase

**No hay cambios arquitectónicos después de esto.** El contrato es el puente entre arquitectura e implementación.

---

*Contrato técnico del Scheduler*  
*Versión: 1.0*  
*Listo para aprobación*
