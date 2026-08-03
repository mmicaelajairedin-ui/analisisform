# Sprint 5.2.0 — Arquitectura del Agenda Engine

**Estado**: CONGELADO (decisiones inmutables sin revisión arquitectónica)  
**Fecha**: 2026-08-02  
**Responsable**: Micaela + Equipo técnico

---

## Principio Rector

**Un único concepto de Agenda.** No existen "Agenda Coach", "Agenda Owner", "Agenda Senior". Existe **Agenda**, que cambia **scope, datos y acciones** según contexto y permisos — nunca la interfaz.

---

## 1. ¿Qué es una Agenda?

**No es una pantalla.** Es una **entidad del sistema** que agrupa:

```
Agenda
├── Disponibilidad         (franjas horarias en que se puede reservar/trabajar)
├── Eventos                (sesiones, reuniones, formaciones, etc.)
├── Bloqueos               (no disponible: médico, otro trabajo, etc.)
├── Vacaciones             (bloques de días no disponible)
├── Reuniones internas     (sincronización equipo, retrospectivas, etc.)
└── Sesiones con clientes  (1:1, grupales, evaluaciones, etc.)
```

**Responsabilidades de Agenda:**
- Almacenar cuándo está disponible la persona/equipo
- Almacenar qué eventos ocurren y cuándo
- Permitir visualizar conflictos (dos sesiones al mismo tiempo)
- Permitir buscar huecos (disponibilidad real)
- Auditar cambios (quién canceló, quién movió, cuándo)

---

## 2. ¿Qué es un Evento?

**No asumir que siempre es una sesión.** Un Evento es cualquier **bloque de tiempo** con propósito:

### Tipos de Evento (completos)

| Tipo | Duración | Participantes | Ejemplo | Permisos |
|------|----------|---------------|---------|----------|
| **Sesión individual** | 45-60 min | Coach + Cliente | Carrera, fitness, finanzas | `agenda.create` |
| **Sesión grupal** | 60-90 min | Coach + N Clientes | Workshop, masterclass | `agenda.create` |
| **Reunión interna** | 30-60 min | Equipo interno | Sync, retrospectiva, planning | `agenda.create` |
| **Formación** | Var | Coaches + Trainers | Onboarding, skill-building | `agenda.create` |
| **Entrevista** | 30-45 min | Coach + Candidato | Evaluación, screening | `agenda.create` |
| **Bloqueo** | Var | Persona | Médico, administrativo, otro trabajo | `agenda.block` |
| **Vacaciones** | Días | Persona | Descanso, días festivos | `agenda.block` |
| **Tiempo administrativo** | Var | Persona | Email, reportes, preparación | Automático |

**Regla arquitectónica**: El sistema NO asume que nuevos tipos no aparecerán. En 6 meses habrá más. El diseño debe **extender, nunca quebrar**.

**Estructura de un Evento** (agnóstica de tipo):

```javascript
{
  id: "evt_...",
  type: "sesion_individual" | "reunión_interna" | "formación" | ...,
  title: "Career Review Ana",
  descripción: "...",
  start: "2026-08-10T14:00:00Z",
  end: "2026-08-10T15:00:00Z",
  duracion_min: 60,
  
  // Participantes
  organizer_id: "coach_...",
  participants: [
    { user_id: "client_...", role: "client", status: "confirmed" | "pending" | "declined" },
    { user_id: "coach2_...", role: "collaborator", status: "confirmed" }
  ],
  
  // Estado
  estado: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show" | "rescheduled",
  
  // Metadatos
  location: "meet.google.com/...",
  notas: "...",
  created_at: "...",
  updated_at: "...",
  
  // Auditoría
  created_by: "coach_...",
  last_modified_by: "coach_...",
  change_reason: "Cliente pidió mover" | "Coach enfermo" | "Completada"
}
```

---

## 2.1. Participantes (CRÍTICO)

**No solo un coach.** Un evento puede tener múltiples participantes con roles distintos.

```javascript
{
  id: "evt_...",
  // ... campos anteriores ...
  
  // Participantes — el cambio crítico
  participants: [
    { user_id: "coach_...", role: "owner", status: "confirmed" },      // quién creó/es responsable
    { user_id: "coach2_...", role: "collaborator", status: "confirmed" }, // asiste
    { user_id: "recruiter_...", role: "recruiter", status: "pending" },  // participa
    { user_id: "client_...", role: "client", status: "confirmed" },      // asiste
    { user_id: "manager_...", role: "observer", status: "confirmed" }    // solo ve
  ]
}
```

**Roles de participante:**
- `owner` — responsable del evento (puede diferir de `created_by`)
- `collaborator` — coach/persona que ejecuta con el owner
- `recruiter` — recruiter/RRHH que participa
- `client` — cliente/candidato que asiste
- `observer` — observador (solo lectura)
- `invitado` — persona invitada (aún sin rol definido)

**Status de participante:**
- `pending` — invitado, espera confirmación
- `confirmed` — confirmado
- `declined` — rechazó
- `tentative` — provisional

---

## 2.2. Ownership (Creador vs Responsable)

**Cuatro conceptos distintos** que a menudo se confunden:

```
1. created_by       → quién creó el evento (puede ser admin, sistema, otro coach)
2. owner_id         → quién es responsable (ejecuta, agenda, cuenta el KPI)
3. participants     → quiénes participan/asisten
4. client_id        → para quien se crea (cuando hay un cliente específico)
```

**Ejemplo:**
```
Evento: Career Review Ana
├── created_by: admin (desde el sistema)
├── owner_id: Coach Alex (responsable de ejecutarla)
├── participants: [
│   { coach_alex: owner },
│   { coach_maria: collaborator },
│   { ana: client },
│   { recruiter_john: recruiter }
│ ]
└── client_id: ana_...
```

Si el owner cambia (reasignación), `owner_id` se actualiza pero `created_by` NO.

---

## 2.3. Workflow del Evento (Estados)

**No solo "scheduled" o "completed".** Un evento atraviesa estados más complejos.

```javascript
estado: "draft" | "proposed" | "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "rescheduled"
```

**Explicación:**
- `draft` — borrador (aún no ofrecido)
- `proposed` — propuesto (esperando confirmación)
- `pending` — confirmado pero aún pendiente de ejecutar
- `confirmed` — confirmado y en el calendario activo
- `completed` — completado (histórico)
- `cancelled` — cancelado (libre las horas)
- `no_show` — no se presentó el cliente/coach
- `rescheduled` — fue reprogramado (referencia al nuevo evento)

**Transiciones válidas:**
```
draft → proposed → pending → confirmed → completed
             ↓
           cancelled (en cualquier momento)
confirmed → rescheduled (cuando se mueve a otra fecha)
completed → no_show (si se detectó ausencia después)
```

---

## 2.4. Origen del Evento

**De dónde vino el evento.** Crítico para analytics y decisiones.

```javascript
origen: "reserva_publica" | "agenda_manual" | "calendly" | "google_calendar" | "marketplace" | "programa" | "ia" | "otro_coach" | "empresa"
```

**Ejemplos:**
- `reserva_publica` — cliente reservó desde la página pública
- `agenda_manual` — coach creó directamente en la plataforma
- `calendly` — sincronizado desde Calendly
- `google_calendar` — sincronizado desde Google Calendar
- `marketplace` — asignado desde el marketplace de coaches
- `programa` — parte de un programa de formación
- `ia` — generado automáticamente por IA
- `otro_coach` — otro coach te asignó una sesión
- `empresa` — empresa cliente reservó

**Uso:** alimenta analytics, reportes de origen de clientes, eficacia de canales.

---

## 2.5. Recursos Asociados

**Una sesión muchas veces necesita recursos.** No hoy, pero la arquitectura lo prevé.

```javascript
{
  id: "evt_...",
  // ... campos anteriores ...
  
  recursos: [
    { tipo: "zoom", url: "https://zoom.us/j/..." },
    { tipo: "meet", url: "https://meet.google.com/..." },
    { tipo: "sala", id: "sala_201" },
    { tipo: "documento", id: "doc_cv_review" },
    { tipo: "programa", id: "prog_career_path" },
    { tipo: "pdf", url: "https://..." },
    { tipo: "ejercicio", id: "ej_mock_interview" }
  ]
}
```

**Tipos extensibles:** zoom, meet, sala, documento, programa, pdf, ejercicio, plantilla, template, etc.

**Nota:** Los recursos se crean/gestionan en sus propias tablas. El evento solo los referencia.

---

## 2.6. Relación con Cobros

**No todas las sesiones generan ingresos.** La agenda relaciona, no calcula.

```javascript
{
  id: "evt_...",
  // ... campos anteriores ...
  
  facturacion: {
    movimiento_id: "mov_...",      // referencia al movimiento en tabla cobros
    tipo_tarifa: "sesion_individual" | "sesion_grupal" | "supervision" | "reunion_interna" | "bono" | "otro",
    importe: 80,                   // si aplica
    incluida_en_bono: true,        // si es parte de un bono
    estado_pago: "pendiente" | "procesado" | "pagado" | "refunded"
  }
}
```

**Ejemplos de tarifa:**
| Tipo | Precio | Descripción |
|------|--------|-------------|
| sesion_individual | 80€ | 1:1 con cliente |
| sesion_grupal | 40€ | sesión grupal (se divide entre participantes) |
| supervision | 0€ | supervisión de coach (interno) |
| reunion_interna | 0€ | reunión de equipo |
| bono | incluida | sesión pagada dentro de un bono |
| otro | variable | otro tipo de sesión |

**Nota importante:** El evento NO calcula el precio. Solo referencia qué movimiento económico lo genera (si hay). La tabla `cobros` es la fuente de verdad de dinero.

---

## 2.7. Capacidad y Disponibilidad

**Más que solo horas libres.** Agenda calcula capacidad real.

**Concepto:**
```
Ana — 40 horas/semana disponibles
├── 8 horas sesiones confirmadas (20%)
├── 4 horas supervisions (10%)
├── 2 horas reuniones internas (5%)
├── 20 horas libres (50%) ← capacidad real
├── 4 horas vacaciones (10%)
└── 2 horas bloqueada/formación (5%)
```

**Campos a agregar en `usuarios` o tabla `capacidades`:**
```javascript
{
  usuario_id: "coach_...",
  semana: "2026-08-03",           // semana ISO
  horas_disponibles: 40,           // horas contratadas
  horas_sesiones: 8,               // confirmadas
  horas_supervisiones: 4,          // confirmadas
  horas_reuniones_internas: 2,     // confirmadas
  horas_vacaciones: 4,             // días que no trabaja
  horas_formacion: 2,              // cursos, training
  horas_libres: 20,                // el resto
  % capacidad: 50                  // horas_libres / horas_disponibles
}
```

**Uso:** alimenta el dashboard, detecta overload, muestra disponibilidad real en scope=team.

---

## 3. Scope: Quién ve Qué

**Tres scopes y SOLO tres.** No se inventan más.

### scope=self
**Contexto**: Coach viendo su propia agenda  
**Datos**: Eventos donde se es participante O creador + intersecciones de disponibilidad  
**Acciones**: crear, editar propios, cancelar propios  
**Ejemplos**:
- Coach viendo sus sesiones con clientes
- Coach viendo sus reuniones internas
- Coach viendo sus bloqueos

**Permisos requeridos**: `agenda.read.self`, `agenda.create`, etc.

### scope=team
**Contexto**: Senior/Coach viendo agenda del equipo  
**Datos**: Eventos de todos los coaches del equipo + intersecciones de disponibilidad  
**Acciones**: ver, reasignar (si `agenda.reassign`), ver conflictos  
**Ejemplos**:
- Senior viendo qué está haciendo cada coach
- Coach viendo disponibilidad de colegas para coordinar
- Detectar que dos coaches tienen sesión al mismo tiempo

**Permiso requerido**: `agenda.read.team`

### scope=global
**Contexto**: Owner viendo toda la organización (tenant-wide)  
**Datos**: Todos los eventos de todas las personas  
**Acciones**: auditoría, reportes, decisiones operacionales  
**Ejemplos**:
- Owner viendo carga de trabajo total
- Detectar cuello de botella en capacidad
- Reportes de utilización

**Permiso requerido**: `agenda.read.global` (solo Owner)

**Regla de congelación**: No existen scopes como `scope=team_except_me` o `scope=team_fitness_only`. Si aparece una necesidad, se diseña un **NUEVO scope**, pero no más de 3 simultáneos.

---

## 4. Permisos: Capacidades que Afectan Agenda

**Estos permisos controlan QUÉ SE PUEDE HACER**, no qué se puede ver (eso lo controla `scope`).

### Permisos de Lectura

```
agenda.read.self        → Ver propias sesiones (scope=self)
agenda.read.team        → Ver agenda del equipo (scope=team)
agenda.read.global      → Ver toda la org (scope=global, solo Owner)
```

### Permisos de Escritura

```
agenda.create           → Crear eventos (sesión, reunión, etc.)
agenda.edit             → Editar eventos propios
agenda.edit.others      → Editar eventos de otros (senior puede mover sesiones)
agenda.cancel           → Cancelar eventos propios
agenda.cancel.others    → Cancelar eventos de otros
agenda.reassign         → Reasignar sesión a otro coach
```

### Permisos de Configuración

```
agenda.availability     → Configurar disponibilidad (horarios de trabajo)
agenda.block            → Bloquear días (vacaciones, médico)
agenda.audit            → Ver historial de cambios
```

**Matriz de permisos por rol** (ejemplo, será definida en Sprint 5.1 finalmente):

| Permiso | Coach | Senior | Owner |
|---------|-------|--------|-------|
| `agenda.read.self` | ✓ | ✓ | ✓ |
| `agenda.read.team` | ✓ (si capacidad) | ✓ | ✓ |
| `agenda.read.global` | ✗ | ✗ | ✓ |
| `agenda.create` | ✓ | ✓ | ✓ |
| `agenda.edit` | ✓ | ✓ | ✓ |
| `agenda.edit.others` | ✗ | ✓ | ✓ |
| `agenda.cancel` | ✓ | ✓ | ✓ |
| `agenda.cancel.others` | ✗ | ✓ | ✓ |
| `agenda.reassign` | ✗ | ✓ | ✓ |
| `agenda.availability` | ✓ | ✓ | ✓ |
| `agenda.block` | ✓ | ✓ | ✓ |
| `agenda.audit` | ✗ | Limitado | ✓ |

---

## 5. Fuente de Verdad

**Existe UNA SOLA tabla `agendas` en Supabase.**

No existen:
- `coach_agendas` (❌ prohibido)
- `team_agendas` (❌ prohibido)
- `owner_agendas` (❌ prohibido)

Existe:
- `agendas` (✅ con columnas: `organizer_id`, `owner_id`, `scope`, `estado`, etc.)

**RLS (Row-Level Security) filtra por scope + permiso:**

```sql
-- Coach ve scope=self
SELECT * FROM agendas 
WHERE organizer_id = auth.uid() 
   OR user_id IN (SELECT FROM participants WHERE user_id = auth.uid())

-- Senior ve scope=team
SELECT * FROM agendas 
WHERE team_id IN (SELECT team_id FROM usuarios WHERE id = auth.uid())
  AND has_permission(auth.uid(), 'agenda.read.team')

-- Owner ve scope=global
SELECT * FROM agendas 
WHERE org_id = (SELECT org_id FROM usuarios WHERE id = auth.uid())
  AND has_permission(auth.uid(), 'agenda.read.global')
```

**Una única fuente de verdad = una tabla, múltiples filtros RLS.**

---

## 6. ¿Qué Cambia por Rol?

**NUNCA cambia la interfaz.**

### Interfaz: SIEMPRE igual
- Calendario (días, horas)
- Eventos (bloques con título, hora, participantes)
- Disponibilidad (franjas verdes)
- Bloqueos (franjas rojas)

### Datos: SÍ cambian
- Coach ve solo sus eventos (scope=self)
- Senior ve equipo (scope=team)
- Owner ve todo (scope=organization)

### Acciones (botones): SÍ cambian
- Coach puede crear/editar/cancelar propios
- Senior puede ver + reasignar
- Owner puede auditar + forzar cambios

### Ejemplo concreto

**Coach Alex ve:**
```
┌─ Mi agenda ─┐
│ 14:00 Carlos (1:1)
│ 15:30 Ana (1:1)
│ 17:00 [Disponible]
│
│ [Crear sesión] [+ Disponibilidad]
└───────────────┘
```

**Senior Javier ve (si `agenda.read.team`):**
```
┌─ ● Mi agenda | ○ Equipo ─┐  ← SELECTOR (aparece si tiene permiso)
│ 14:00 Carlos (1:1)
│ 15:30 Ana (1:1)
│
│ [Crear sesión]
└────────────────────────┘
```

Al hacer click en "Equipo":
```
┌─ ● Mi agenda | ○ Equipo ─┐
│
│ Coach Alex:
│   14:00 Carlos
│   15:30 Ana
│
│ Coach María:
│   14:00 David
│   16:00 [Disponible]
│
│ [Crear sesión] [Reasignar]
└────────────────────────┘
```

**Owner en multicoach ve (scope=global):**
```
┌─ Agenda global ─┐
│
│ Coach Alex:
│   14:00 Carlos (capacidad: 75%)
│   15:30 Ana (capacidad: 75%)
│
│ Coach María:
│   14:00 David (capacidad: 50%)
│   16:00 [Disponible]
│
│ ⚠️ 2 Conflictos detectados
│ [Auditar] [Reportes]
└──────────────────────┘
```

**Regla arquitectónica**: Los botones cambian (crear, reasignar, auditar). El calendario NO.

---

## 7. Componente: Scheduler / AgendaEngine

**NO se llama "Agenda".**

Se llama **`Scheduler`** o **`AgendaEngine`** porque es un **motor** que resuelve:
- Visualizar calendario
- Calcular disponibilidad
- Detectar conflictos
- Gestar eventos

### Responsabilidades del Scheduler

```javascript
<Scheduler
  scope="self" | "team" | "organization"
  usuario_id="..."
  team_id="..."         // si scope=team
  org_id="..."          // si scope=organization
  permisos={[...]}      // array de capacidades
  onEventCreate={...}
  onEventEdit={...}
  onEventCancel={...}
/>
```

### Output del Scheduler

El componente se **reutiliza en**:
1. **panel-v2**: `<Scheduler scope="self" />`
2. **multicoach**: `<Scheduler scope="team" />` (Owner)
3. **reservar.html** (futura): `<Scheduler scope="self" disponibilidad_coach_id="..." />`
4. **recursos.html** (futura): `<Scheduler scope="team" recurso_id="..." />`
5. **reuniones.html** (futura): `<Scheduler scope="team" type="reunión_interna" />`

**Sin duplicar código.**

---

## 8. Relación con Sprint 5.4 (Colaboración)

Cuando llegue Sprint 5.4, los eventos tendrán múltiples participantes:

```
Evento: Career Review Ana
├── Organizer: Coach Alex
├── Participants:
│   ├── Ana (cliente)
│   ├── Coach María (collaborator)
│   └── Manager (observer)
└── Reunión: Video call con Ana + Coach María
```

El Scheduler **ya soporta esto** porque `participants` es un array, no `coach_id` solo.

Cuando llegue Sprint 5.3 (Cobros), los eventos tendrán data de facturación:

```
Evento: Sesión Ana
├── ...
└── Facturación:
    ├── cliente_id: ana_...
    ├── importe: $150
    ├── estado: "pagado"
    └── factura_id: inv_...
```

El Scheduler **ya lo soporta** porque no asume estructura.

---

## 9. Decisiones Congeladas

### ✅ Congelado: Un único concepto Agenda
No se crean "Agenda Coach", "Agenda Senior", "Agenda Owner". Una sola tabla, scope-based.

### ✅ Congelado: Scope limitado a 3
`self`, `team`, `global`. Punto final. (Antes era `organization`, ahora `global` para evitar confusión con datos de organización.)

### ✅ Congelado: Tipos de evento extensibles
Se definen tipos hoy (sesión, reunión, etc.), pero el sistema soporta nuevos tipos sin recodificación. Mañana: Assessment, Workshop, Webinar, Demo, Follow-up.

### ✅ Congelado: Interfaz agnóstica de rol
La interfaz es igual. Los datos, acciones y botones cambian.

### ✅ Congelado: Componente se llama Scheduler/AgendaEngine
No "Agenda" (eso es la pantalla, no el motor).

### ✅ Congelado: Fuente única (tabla `agendas`)
Una sola tabla, múltiples filtros RLS. Nunca tablas separadas por rol.

### ✅ Congelado: Participantes (array) vs Ownership (creador + responsable)
Un evento tiene múltiples participantes con roles (owner, collaborator, recruiter, client, observer). El ownership distingue creador (`created_by`), responsable (`owner_id`), y quién participa (`participants`).

### ✅ Congelado: Workflow (Estados extendidos)
Los eventos usan estados: draft, proposed, pending, confirmed, completed, cancelled, no_show, rescheduled (no solo scheduled/completed).

### ✅ Congelado: Origen del evento
Cada evento registra su origen (reserva_publica, agenda_manual, calendly, google_calendar, marketplace, programa, ia, otro_coach, empresa) para analytics.

### ✅ Congelado: Relación opcional con Cobros
Los eventos pueden linkear a movimientos económicos en la tabla `cobros`. La agenda NO calcula precios; solo referencia.

### ✅ Congelado: Recursos asociados (Zoom, Meet, Salas, Documentos, etc.)
Los eventos pueden tener recursos: zoom, meet, sala, documento, programa, pdf, ejercicio. Se crean en sus propias tablas y se referencian.

### ✅ Congelado: Capacidad como concepto del motor
La agenda calcula capacidad real (horas libres / horas disponibles), no solo horas ocupadas. Alimenta dashboard y detecta overload.

---

## 10. Cambios esperados en Sprints Posteriores

### Sprint 5.2.1 (Componente Scheduler)
- Implementar `<Scheduler>` reutilizable con scope/permisos dinámicos
- Soportar participantes (array con roles)
- Soportar ownership (created_by, owner_id, responsable)
- Soportar workflow (estados extendidos)
- Integrar origen del evento
- **El Scheduler NO cambia en sprints posteriores**, solo sus inputs.

### Sprint 5.2.2 (Visual v4)
- Diseño v4 para el Scheduler
- Mostrar participantes (avatares, roles)
- Indicador de estado del evento
- Mostrar origen (pequeño badge)

### Sprint 5.2.3 (Backend)
- Crear tabla `agendas` + `asistencias` en Supabase
- RLS strict (scope-based)
- Migración de `sesiones_registro` (legacy) a `agendas` (nueva)

### Sprint 5.3 (Cobros)
- Agregar `facturacion` a eventos (relaciona con tabla `cobros`)
- Dashboard: ingresos por tipo de sesión
- El Scheduler **NO cambia**, solo la estructura de `facturacion`

### Sprint 5.4 (Colaboración)
- Participantes múltiples (ya soportados en arquitectura)
- Workflow completo (draft, proposed, pending, etc.)
- Notificaciones para cada rol de participante
- El Scheduler **NO cambia**, estructura ya lo soportaba

### Sprint 5.5+ (Programas, Recursos, Marketplace)
- El Scheduler se reutiliza para calendarios de programas
- El Scheduler se reutiliza para disponibilidad de recursos
- El Scheduler se reutiliza en marketplace (reserva de coaches)
- El Scheduler integra capacidad real (% ocupación)

---

## Resumen

| Aspecto | Decisión |
|---------|----------|
| **Concepto** | Un Agenda, tres scopes (self, team, global) |
| **Componente** | Scheduler/AgendaEngine (reutilizable) |
| **Datos** | Una tabla (agendas) + RLS |
| **Interfaz** | Igual siempre, datos/acciones/botones varían por scope |
| **Participantes** | Array con múltiples roles (owner, collaborator, recruiter, client, observer) |
| **Ownership** | Cuatro conceptos: creador, responsable, participantes, cliente |
| **Workflow** | Estados: draft, proposed, pending, confirmed, completed, cancelled, no_show, rescheduled |
| **Origen** | Registra fuente del evento (reserva, agenda manual, calendly, google, marketplace, programa, IA, otro coach, empresa) |
| **Tipos evento** | Extensibles (sesión individual, grupal, reunión interna, formación, entrevista, bloqueo, vacaciones, administrativo) |
| **Recursos** | Zoom, Meet, Salas, Documentos, Programas, PDFs, Ejercicios (referenciados, no almacenados) |
| **Cobros** | Relación opcional a tabla `cobros` (sin cálculo de precios en agenda) |
| **Capacidad** | Métrica calculada (horas libres / disponibles) para dashboard y detección de overload |
| **Futuro** | Escala a Sprint 5.3 (Cobros), Sprint 5.4 (Colaboración multi-participantes), Sprint 5.5+ (Programas, Recursos) |

---

**ESTADO: CONGELADO**

Para cambiar esta arquitectura se requiere revisión del PO + rediseño de Sprint 5.3+ posteriores.

Próximo: Sprint 5.2.1 — Implementación del Scheduler.

