# Sprint 5.2.1 — Contrato SchedulerEvent (CONGELADO)

**Estado**: CONGELADO (inmutable sin revisión arquitectónica)  
**Fecha**: 2026-08-03  
**Crítica**: Regla fundamental. Todos los providers devuelven EXACTAMENTE esta estructura.

---

## Principio

El Scheduler **NUNCA conoce el origen de los datos**. No sabe si un evento viene de:
- `sesiones_registro` (localStorage Phase 1)
- `agendas` (tabla Supabase Phase 2)
- Google Calendar
- Outlook
- Calendly
- Microsoft Teams
- Zoom
- Cualquier futuro source

**Todos los providers transforman sus datos al mismo contrato: `SchedulerEvent`.**

El Scheduler **SOLO renderiza y filtra `SchedulerEvent`**. Jamás contiene lógica específica de ningún proveedor.

---

## SchedulerEvent — Contrato Único

```javascript
{
  // Identidad única del evento
  id: "evt_...",

  // Contenido básico
  title: "Career Review con Ana",
  description: "Revisión trimestral de carrera",

  // Temporalidad
  start: "2026-08-10T14:00:00Z",  // ISO 8601, UTC
  end: "2026-08-10T15:00:00Z",    // ISO 8601, UTC
  timezone: "Europe/Madrid",      // IANA timezone (puede diferir del UTC start/end)
  recurring: null,                // future: null | {rule: "RRULE:...", until: "..."}

  // Propiedad y participación
  organizer_id: "coach_...",      // Usuario que crea/posee el evento
  participants: [
    {
      user_id: "client_...",
      role: "client",
      status: "confirmed",        // "pending" | "confirmed" | "declined" | "tentative"
      attendance: "not_responded"  // "not_responded" | "will_attend" | "declined_attend" | "requested_reschedule"
    }
  ],

  // Estado y ciclo de vida
  state: "confirmed",             // "draft" | "proposed" | "pending" | "confirmed" | "completed" | "cancelled" | "no_show"
  visibility: "participants",     // "private" | "team" | "organization" | "participants"

  // Origen y trazabilidad
  source: "sesiones_registro",    // "sesiones_registro" | "agendas" | "google_calendar" | "outlook" | "calendly" | "teams" | "zoom"
  source_id: "sch_123abc",        // ID en el sistema de origen (Google event ID, Zoom meeting ID, etc.)
  created_at: "2026-08-01T10:00:00Z",
  created_by: "coach_...",
  updated_at: "2026-08-01T10:00:00Z",
  updated_by: "coach_...",

  // Recursos (salas, herramientas)
  resources: [
    { type: "meeting_room", id: "sala_201", name: "Sala 201" },
    { type: "video_call", id: "meet_xyz", url: "https://meet.google.com/..." }
  ],

  // Capacidad y disponibilidad (derivado, NO persistido)
  capacity: {
    min: 1,
    max: 2,
    current: 2  // solo participantes
  },

  // Metadatos específicos del contexto (extensible, nunca rompe el contrato)
  metadata: {
    client_photo: "data:image/...",
    event_type_icon: "🎯",
    week: 1,
    custom_field: "valor"  // permitido para extensiones específicas
  }
}
```

---

## Transformación por Provider

### Phase 1: SesionesRegistroProvider

Lee de `sesiones_registro` (array en cliente):

```javascript
// Input (sesiones_registro):
{
  fecha: "2026-08-10",
  hora: "14:00",
  tipo: "sesion_individual",
  // ... otros campos
}

// Output (SchedulerEvent):
{
  id: "evt_temp_...",
  title: "Sesión con Ana",
  description: "",
  start: "2026-08-10T14:00:00Z",
  end: "2026-08-10T15:00:00Z",
  timezone: "Europe/Madrid",
  recurring: null,
  organizer_id: "coach_1",
  participants: [{user_id: "ana", role: "client", status: "confirmed", attendance: "not_responded"}],
  state: "confirmed",
  visibility: "participants",
  source: "sesiones_registro",
  source_id: "evt_temp_...",
  created_at: new Date().toISOString(),
  created_by: "coach_1",
  updated_at: new Date().toISOString(),
  updated_by: "coach_1",
  resources: [],
  capacity: {min: 1, max: 2, current: 2},
  metadata: {client_photo: "...", week: 1}
}
```

### Phase 2: AgendaProvider (Supabase tabla `agendas`)

Lee de `SELECT * FROM agendas WHERE ...`:

```javascript
// Input (tabla agendas):
{
  id: "evt_db_123",
  title: "Career Review",
  start_time: "2026-08-10 14:00:00+02",
  end_time: "2026-08-10 15:00:00+02",
  // ... fields de base de datos
}

// Output (SchedulerEvent):
{
  id: "evt_db_123",
  title: "Career Review",
  description: "...",
  start: "2026-08-10T14:00:00+02:00",
  end: "2026-08-10T15:00:00+02:00",
  timezone: "Europe/Madrid",
  recurring: null,
  organizer_id: "coach_1",
  participants: [... transformados de JSON],
  state: "confirmed",
  visibility: "participants",
  source: "agendas",
  source_id: "evt_db_123",
  // ... resto idéntico
}
```

### Phase 3: GoogleCalendarProvider

Lee de Google Calendar API:

```javascript
// Input (Google Calendar event):
{
  id: "google_event_xyz",
  summary: "Career Review",
  start: {dateTime: "2026-08-10T14:00:00+02:00", timeZone: "Europe/Madrid"},
  end: {dateTime: "2026-08-10T15:00:00+02:00", timeZone: "Europe/Madrid"},
  // ... Google fields
}

// Output (SchedulerEvent):
{
  id: "google_event_xyz",
  title: "Career Review",
  description: "...",
  start: "2026-08-10T14:00:00+02:00",
  end: "2026-08-10T15:00:00+02:00",
  timezone: "Europe/Madrid",
  recurring: null,  // future: mapear recurringEventId a RRULE
  organizer_id: "coach_1",
  participants: [... mapeados de attendees],
  state: "confirmed",
  visibility: "participants",
  source: "google_calendar",
  source_id: "google_event_xyz",
  // ... resto idéntico
}
```

### OutlookProvider, CalendlyProvider, TeamsProvider, ZoomProvider

**Exacto mismo patrón.**

Cada provider:
1. Lee del origen (API REST, base de datos, SDK)
2. Mapea al contrato `SchedulerEvent`
3. Devuelve array de `SchedulerEvent`

El Scheduler **jamás cambia**.

---

## Campos Obligatorios vs Opcionales

| Campo | Obligatorio | Tipo | Notas |
|-------|-------------|------|-------|
| `id` | ✅ | string | Único dentro del source |
| `title` | ✅ | string | Nunca vacío |
| `start` | ✅ | ISO 8601 | UTC o con timezone |
| `end` | ✅ | ISO 8601 | Debe ser > start |
| `organizer_id` | ✅ | string | Usuario dueño |
| `participants` | ✅ | array | Mínimo el organizer (si aplica) |
| `state` | ✅ | enum | Ciclo de vida |
| `visibility` | ✅ | enum | Quién ve |
| `source` | ✅ | string | Origen de datos |
| `timezone` | ✅ | IANA | Para renderizar hora local |
| `description` | ❌ | string | Puede ser "" |
| `recurring` | ❌ | object | null si no recurrente |
| `resources` | ❌ | array | [] si no hay |
| `metadata` | ✅ | object | {} mínimo, extensible |
| `created_at` | ✅ | ISO 8601 | Auditoría |
| `updated_at` | ✅ | ISO 8601 | Auditoría |

---

## Extensibilidad Segura

El campo `metadata` permite extensiones SIN romper el contrato:

```javascript
// OK - Coach quiere guardar foto del cliente
metadata: {
  client_photo: "data:image/...",
  custom_badge: "vip"
}

// OK - Calendly quiere guardar URL de su evento
metadata: {
  calendly_event_url: "https://calendly.com/...",
  calendly_invitee_id: "..."
}

// OK - Zoom quiere guardar ID de meeting
metadata: {
  zoom_meeting_id: "...",
  zoom_meeting_url: "https://zoom.us/..."
}
```

El Scheduler renderiza sin tocarlo. Si necesita algún metadato (ej: foto), lo busca en `metadata.client_photo`.

---

## Regla de Oro

**Si un provider NO puede devolver `SchedulerEvent` con estos campos, el provider es INCORRECTO.**

No adaptes el Scheduler. Adapta el provider.

```javascript
// ❌ INCORRECTO
if(source === "google_calendar") {
  // lógica especial para Google
}

// ✅ CORRECTO
// Todos los providers transforman → SchedulerEvent
// El Scheduler jamás distingue el source
```

---

## Próximos Pasos

1. ✅ Congelar este contrato (`SchedulerEvent`)
2. ✅ Actualizar `SesionesRegistroProvider` para devolver SIEMPRE este contrato
3. ✅ Integrar en MultiCoach (reutilizar exactamente el mismo Scheduler)
4. ⏳ Cerrar el motor v1 (stabilize, no nuevas features)
5. ⏳ Phase 2: Implementar `AgendaProvider` (Supabase)
6. ⏳ Phase 3+: Implementar `GoogleCalendarProvider`, `OutlookProvider`, etc.

**El Scheduler no cambia en ninguno de estos pasos.**

---

## Checklist Congelado

- [x] SchedulerEvent — contrato único
- [x] Todos los providers transforman a SchedulerEvent
- [x] Scheduler renderiza SOLO SchedulerEvent
- [x] Sin lógica específica de provider en Scheduler
- [x] Extensibilidad via metadata (sin romper contrato)
- [x] Regla de oro: adapta el provider, no el Scheduler

---

*Contrato SchedulerEvent*  
*Sprint 5.2.1*  
*Versión: 1.0*  
*Congelado: 2026-08-03*
