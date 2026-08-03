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

## 3. Scope: Quién ve Qué

**Tres scopes y SOLO tres.** No se inventan más.

### scope=self
**Contexto**: Coach viendo su propia agenda  
**Datos**: Eventos donde `organizer_id = usuario.id` OR `user_id IN participants`  
**Acciones**: crear, editar propias, cancelar propias  
**Ejemplos**:
- Coach viendo sus sesiones con clientes
- Coach viendo sus reuniones internas
- Coach viendo sus bloqueosPermisos requeridos: `agenda.read.self`, `agenda.create`, etc.

### scope=team
**Contexto**: Senior/Coach viendo agenda del equipo  
**Datos**: Eventos de todos los coaches del equipo + intersecciones de disponibilidad  
**Acciones**: ver, reasignar (si `agenda.reassign`), ver conflictos  
**Ejemplos**:
- Senior viendo qué está haciendo cada coach
- Coach viendo disponibilidad de colegas para coordinar
- Detectar que dos coaches tienen sesión al mismo tiempo

**Permiso requerido**: `agenda.read.team`

### scope=organization
**Contexto**: Owner viendo toda la organización  
**Datos**: Todos los eventos de todas las personas  
**Acciones**: auditoría, reportes, decisiones operacionales  
**Ejemplos**:
- Owner viendo carga de trabajo total
- Detectar cuello de botella en capacidad
- Reportes de utilización

**Permiso requerido**: `agenda.read.organization` (solo Owner)

**Regla de congelación**: No existen scopes como `scope=team_except_me` o `scope=team_fitness_only`. Si aparece una necesidad, se diseña un **NUEVO scope**, pero no más de 3 simultáneos.

---

## 4. Permisos: Capacidades que Afectan Agenda

**Estos permisos controlan QUÉ SE PUEDE HACER**, no qué se puede ver (eso lo controla `scope`).

### Permisos de Lectura

```
agenda.read.self        → Ver propias sesiones (scope=self)
agenda.read.team        → Ver agenda del equipo (scope=team)
agenda.read.organization → Ver toda la org (scope=organization, solo Owner)
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
| `agenda.read.organization` | ✗ | ✗ | ✓ |
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

-- Owner ve scope=organization
SELECT * FROM agendas 
WHERE org_id = (SELECT org_id FROM usuarios WHERE id = auth.uid())
  AND has_permission(auth.uid(), 'agenda.read.organization')
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

**Owner en multicoach ve:**
```
┌─ Agenda del equipo ─┐
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
No se crean "Agenda Coach", "Agenda Senior", "Agenda Owner".

### ✅ Congelado: Scope limitado a 3
`self`, `team`, `organization`. Punto final.

### ✅ Congelado: Tipos de evento extensibles
Se definen tipos hoy (sesión, reunión, etc.), pero el sistema soporta nuevos tipos sin recodificación.

### ✅ Congelado: Interfaz agnóstica de rol
La interfaz es igual. Los botones y datos cambian.

### ✅ Congelado: Componente se llama Scheduler/AgendaEngine
No "Agenda" (eso es la pantalla, no el motor).

### ✅ Congelado: Fuente única (tabla `agendas`)
Un RLS múltiple, nunca múltiples tablas.

---

## 10. Cambios esperados en Sprints Posteriores

### Sprint 5.2.1 (Componente)
- Implementar `<Scheduler>` reutilizable
- Soportar scope/permisos dinámicos

### Sprint 5.2.2 (Visual)
- Diseño v4 para el Scheduler
- Estilos según scope (Coach/Senior/Owner)

### Sprint 5.3 (Cobros)
- Agregar `facturación` a eventos
- El Scheduler **NO cambia**, solo `<Evento>` interno

### Sprint 5.4 (Colaboración)
- Múltiples participantes
- El Scheduler **NO cambia**, solo estructura de `participants`

### Sprint 5.5+ (Programas, Recursos, etc.)
- El Scheduler se reutiliza para calendarios de programas
- El Scheduler se reutiliza para disponibilidad de recursos

---

## Resumen

| Aspecto | Decisión |
|---------|----------|
| **Concepto** | Un Agenda, tres scopes |
| **Componente** | Scheduler (reutilizable) |
| **Datos** | Una tabla (agendas) + RLS |
| **Interfaz** | Igual siempre, botones varían |
| **Tipos evento** | Extensibles (sesión, reunión, formación, ...) |
| **Futuro** | Escala a colaboración, cobros, recursos |

---

**ESTADO: CONGELADO**

Para cambiar esta arquitectura se requiere revisión del PO + rediseño de Sprint 5.3+ posteriores.

Próximo: Sprint 5.2.1 — Implementación del Scheduler.

