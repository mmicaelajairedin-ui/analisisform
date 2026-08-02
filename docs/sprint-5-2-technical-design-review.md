# Sprint 5.2 — Technical Design Review v2: Arquitectura de Agenda

**Fecha**: 2026-08-02  
**Versión**: 2.1 (Final — Aprobado)  
**Estado**: 🟢 **APROBADO Y CONGELADO**  
**Aprobador**: Product Owner (Micaela Jairedin)  
**Cambios respecto a v1**: Énfasis en single source of truth, asistencia, agenda grupal, ciclo de vida completo
**Cambios respecto a v2.0**: Incorpora 5 decisiones finales (ver §11)

---

## 0. PRINCIPIO ARQUITECTÓNICO — SINGLE SOURCE OF TRUTH

### ❌ NO HACER

```
panel-v2.html              MultiCoach.html
    ↓                           ↓
  c.ses                     agendas
    ↓                           ↓
  [coach ve]            [owner ve]
    
⚠️ Riesgo: desincronización, datos contradictorios
```

### ✅ HACER

```
                 UNA TABLA: agendas
                   (SOURCE OF TRUTH)
                         ↓
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
    Coach ve       Owner ve         Equipo ve
  (scope=own)   (scope=org)      (scope=team)
  
  Sus sesiones | Toda la org  | Equipo inmediato
  Sus bloques  | Todos coaches| Calendario grupal
  Su disponibl | Métricas    | Carga semanal
```

**Regla**: La tabla `agendas` es la fuente única. Las vistas se filtran por capacidad + scope, NO duplican datos.

---

## 1. CONCEPTOS FUNDAMENTALES

### 1.1 Tres Tipos de Eventos (Distintos)

#### A) SESIÓN INDIVIDUAL (Coach + 1 Cliente)

```javascript
agendas {
  id: "evt-123",
  type: "sesion_individual",
  coach_id: "coach-001",
  client_id: "cli-789",
  start_at: "2026-08-10T14:00:00Z",
  end_at: "2026-08-10T15:00:00Z",
  status: "scheduled"  // → confirmed → completed
}
```

**Acciones permitidas**:
- Crear: Coach + Owner (capacidad `agenda.create`)
- Editar: Coach propietario + Owner (capacidad `agenda.edit`)
- Cancelar: Coach propietario + Owner (capacidad `agenda.cancel`)
- Reasignar: Owner (mover a otro coach)

**Datos derivados**:
- Asistencia del coach: `asistencias.where(coach_id).status`
- Asistencia del cliente: `asistencias.where(client_id).status`

---

#### B) SESIÓN GRUPAL (Coach + N Clientes)

```javascript
agendas {
  id: "evt-456",
  type: "sesion_grupal",
  coach_id: "coach-001",
  client_id: null,  // ❌ NO: nunca un solo cliente
  titulo: "Taller: Presentaciones efectivas",
  start_at: "2026-08-10T18:00:00Z",
  end_at: "2026-08-10T19:30:00Z",
  status: "scheduled"
}

agenda_participantes {
  id: "part-001",
  agenda_id: "evt-456",
  participant_id: "cli-789",    // Cliente
  role: "participant",
  status: "confirmed"  // confirmed | declined | no_show
}

agenda_participantes {
  id: "part-002",
  agenda_id: "evt-456",
  participant_id: "cli-901",    // Otro cliente
  role: "participant",
  status: "confirmed"
}
```

**Por qué tabla separada**:
- N participantes por sesión
- Cada uno tiene su propio estado de asistencia
- Owner necesita saber quién vino a qué taller

**Acciones permitidas**:
- Crear: Coach + Owner
- Editar: Coach propietario + Owner
- Agregar participante: Coach + Owner
- Quitar participante: Coach + Owner + participante (decline)

---

#### C) REUNIÓN INTERNA (Coaches/Staff)

```javascript
agendas {
  id: "evt-789",
  type: "reunion_interna",
  coach_id: null,  // ❌ NO: no es de un coach específico
  client_id: null,
  titulo: "Planificación semanal",
  start_at: "2026-08-10T10:00:00Z",
  end_at: "2026-08-10T11:00:00Z",
  status: "scheduled"
}

agenda_participantes {
  id: "part-003",
  agenda_id: "evt-789",
  participant_id: "coach-001",
  role: "organizer",
  status: "confirmed"
}

agenda_participantes {
  id: "part-004",
  agenda_id: "evt-789",
  participant_id: "coach-002",
  role: "attendee",
  status: "confirmed"
}

agenda_participantes {
  id: "part-005",
  agenda_id: "evt-789",
  participant_id: "coach-003",
  role: "attendee",
  status: "no_show"
}
```

**Diferencia clave**: No hay `client_id`, los participantes son `users` (coaches, admins, staff).

---

### 1.2 Disponibilidad vs Bloqueos vs Eventos (Tres Cosas Distintas)

#### DISPONIBILIDAD (Horarios de Trabajo)

```javascript
agendas_disponibilidad {
  id: "disp-001",
  coach_id: "coach-001",
  organization_id: "org-123",
  day_of_week: 1,      // 0=lunes, 1=martes, ..., 6=domingo
  hour_start: "09:00",
  hour_end: "17:00",
  timezone: "America/Argentina/Buenos_Aires"
}
```

**Qué es**: Horario normal de trabajo del coach.  
**Usar para**: Prevenir crear sesiones fuera del horario (validación).

---

#### BLOQUEOS (Vacaciones, No Disponible)

```javascript
agendas_bloqueos {
  id: "blk-001",
  coach_id: "coach-001",
  organization_id: "org-123",
  type: "vacaciones",        // vacaciones | no_disponible | otra_razon
  start_at: "2026-08-15T00:00:00Z",
  end_at: "2026-08-22T23:59:59Z",
  titulo: "Vacaciones",
  descripcion: "Vuelta a Argentina",
  created_by: "coach-001",
  created_at: "2026-08-02T10:00:00Z"
}
```

**Qué es**: Período en el que el coach NO está disponible.  
**Usar para**: Prevenir crear sesiones durante bloqueo.  
**Diferencia con disponibilidad**: Es una excepción temporal, no la regla.

---

#### EVENTO (Sesión, Reunión, etc.)

```javascript
agendas {
  id: "evt-123",
  type: "sesion_individual",
  coach_id: "coach-001",
  client_id: "cli-789",
  start_at: "2026-08-10T14:00:00Z",
  end_at: "2026-08-10T15:00:00Z"
}
```

**Qué es**: Una sesión real con clientes o una reunión con staff.  
**Usar para**: Mostrar en calendario, calcular métricas, registrar asistencia.

---

### 1.3 CICLO DE VIDA: Estados y Transiciones

```
                        created
                           ↓
┌─────────────────────────────────────────────┐
│                                             │
│  scheduled ← rescheduled                    │
│     ↓           ↓                           │
│  confirmed      (cambio de fecha/hora)     │
│     ↓                                       │
│  completed                                  │
│     ↓                                       │
│  (asistencia registrada)                   │
│                                             │
│  ALTERNATIVAS:                             │
│  scheduled → cancelled                     │
│  confirmed → cancelled                     │
│  scheduled → no_show (no asistió)         │
│                                             │
└─────────────────────────────────────────────┘
```

**Estados posibles**:

| Estado | Significado | Quién lo puede cambiar | Próximos estados |
|--------|-------------|----------------------|------------------|
| `scheduled` | Programado | Coach/Owner | confirmed, cancelled, rescheduled |
| `confirmed` | Confirmado por cliente/coach | Coach/Owner | completed, cancelled, no_show |
| `completed` | Ocurrió (con asistencia) | Coach (post-sesión) | — (histórico) |
| `cancelled` | Cancelado | Coach/Owner | — (histórico) |
| `no_show` | No se presentaron | Coach (post-sesión) | — (histórico) |
| `rescheduled` | Movido a otra fecha | Coach/Owner | scheduled |

---

## 2. ASISTENCIA (Critical — afecta Métricas, Retención, Cobros)

### 2.1 Estructura

```javascript
asistencias {
  id: "att-001",
  agenda_id: "evt-123",           // La sesión
  participant_id: "coach-001",    // O "cli-789"
  role: "coach" | "client",       // Quién es
  status: "confirmed" | "no_show" | "completed",
  notas: "Coach llegó tarde",
  created_at: "2026-08-10T15:05:00Z",
  updated_at: "2026-08-10T15:15:00Z"
}
```

### 2.2 Estados de Asistencia

| Estado | Cuando | Quién lo marca | Impacto |
|--------|--------|---------------|---------|
| `confirmed` | Coach confirmó con cliente antes | Coach | Sesión "va a ocurrir" |
| `completed` | Coach marca como realizada POST-sesión | Coach | Cuenta como sesión completada |
| `no_show` | Nadie se presentó | Coach | Brecha en retención |
| `canceled_by_coach` | Coach canceló última hora | Coach | Sesión no ocurrió |
| `canceled_by_client` | Cliente canceló | Coach (registra) | Brecha en retención |

### 2.3 Impactos Downstream (MUY IMPORTANTE)

```
┌─ Asistencia (completada)
│
├─→ Métricas
│   ├─ "Sesiones completadas": +1
│   ├─ "Tasa de asistencia": X%
│   └─ "Consistencia del cliente": tracking
│
├─→ Retención
│   ├─ Cliente no_show 2+ veces → "En riesgo"
│   └─ Impacta scoring en dashboard
│
├─→ Cobros
│   ├─ Si coach cobra por sesión realizada: solo si "completed"
│   ├─ Si cobra por sesión agendada: aunque sea "no_show"
│   └─ Prepara campos: billing_status (billed/pending/refund)
│
└─→ Reportes
    └─ "Sesiones completas vs sesiones programadas"
```

---

## 3. MODELO DE DATOS (PROPUESTA FINAL)

### 3.1 Tabla: `agendas` (SOURCE OF TRUTH)

```sql
CREATE TABLE agendas (
  -- Identidad
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  
  -- Tipo de evento
  type TEXT CHECK (type IN ('sesion_individual', 'sesion_grupal', 'reunion_interna', 'bloqueo')) NOT NULL,
  
  -- Participantes
  coach_id UUID REFERENCES usuarios(id),  -- Null para reunion_interna
  client_id UUID REFERENCES candidatos(id),  -- Null para reunion_interna y sesion_grupal
  
  -- Datos temporales
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',  -- Importante para SaaS global
  
  -- Información
  titulo TEXT,
  descripcion TEXT,
  
  -- Integraciones (preparadas para futuro)
  zoom_url TEXT,
  google_meet_url TEXT,
  external_calendar_id TEXT,  -- Para Google Calendar, Outlook sync
  external_event_id TEXT,
  
  -- Estado del evento
  status TEXT CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled')) DEFAULT 'scheduled',
  
  -- Auditoría
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES usuarios(id),
  updated_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES usuarios(id),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  
  -- Recurrencia
  recurrence_rule TEXT,  -- RRULE string (FREQ=WEEKLY;BYDAY=MO,WE...)
  recurrence_parent_id UUID REFERENCES agendas(id),  -- Si es instancia de recurrente
  
  -- Validaciones
  CONSTRAINT coach_or_internal CHECK (
    (type = 'reunion_interna' AND coach_id IS NULL AND client_id IS NULL) OR
    (type != 'reunion_interna' AND coach_id IS NOT NULL)
  ),
  CONSTRAINT individual_vs_grupal CHECK (
    (type = 'sesion_individual' AND client_id IS NOT NULL) OR
    (type = 'sesion_grupal' AND client_id IS NULL) OR
    (type = 'reunion_interna' AND client_id IS NULL) OR
    (type = 'bloqueo' AND client_id IS NULL)
  ),
  CONSTRAINT start_before_end CHECK (start_at < end_at)
);

-- Índices críticos
CREATE INDEX idx_agendas_org_coach ON agendas(organization_id, coach_id);
CREATE INDEX idx_agendas_org_client ON agendas(organization_id, client_id);
CREATE INDEX idx_agendas_start ON agendas(start_at);
CREATE INDEX idx_agendas_status ON agendas(status);
```

---

### 3.2 Tabla: `agenda_participantes` (Para Sesiones Grupales y Reuniones)

```sql
CREATE TABLE agenda_participantes (
  id UUID PRIMARY KEY,
  agenda_id UUID NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES usuarios(id),  -- Usuario (coach o staff)
  role TEXT CHECK (role IN ('organizer', 'facilitator', 'attendee', 'participant')) DEFAULT 'attendee',
  
  -- Estado del participante
  rsvp_status TEXT CHECK (rsvp_status IN ('pending', 'confirmed', 'declined')) DEFAULT 'pending',
  rsvp_at TIMESTAMPTZ,
  
  -- Asistencia (post-sesión)
  attendance_status TEXT CHECK (attendance_status IN ('confirmed', 'no_show', 'completed')) DEFAULT 'confirmed',
  attendance_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT organizer_single CHECK (
    -- Solo un organizador por sesión
    NOT (role = 'organizer' AND EXISTS (
      SELECT 1 FROM agenda_participantes ap2
      WHERE ap2.agenda_id = agenda_participantes.agenda_id
        AND ap2.role = 'organizer'
        AND ap2.id != agenda_participantes.id
    ))
  )
);

CREATE INDEX idx_agenda_participants_agenda ON agenda_participantes(agenda_id);
CREATE INDEX idx_agenda_participants_user ON agenda_participantes(participant_id);
```

---

### 3.3 Tabla: `asistencias` (Registro de Asistencia — SEPARADA)

```sql
CREATE TABLE asistencias (
  id UUID PRIMARY KEY,
  agenda_id UUID NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES usuarios(id),  -- Coach o cliente
  participant_type TEXT CHECK (participant_type IN ('coach', 'client')),
  
  -- Estado de asistencia
  status TEXT CHECK (status IN ('confirmed', 'no_show', 'completed', 'canceled_by_coach', 'canceled_by_client')) NOT NULL,
  notas TEXT,
  
  -- Timestamp
  marked_by UUID REFERENCES usuarios(id),  -- Quién registró la asistencia
  marked_at TIMESTAMPTZ DEFAULT now(),
  
  -- Para cobros (futuro Sprint 5.3)
  billing_status TEXT CHECK (billing_status IN ('pending', 'billed', 'refund')) DEFAULT 'pending',
  billing_amount DECIMAL(10,2),
  billing_at TIMESTAMPTZ,
  
  CONSTRAINT unique_attendance CHECK (
    -- No hay dos registros de asistencia para el mismo (agenda, participant)
    NOT EXISTS (
      SELECT 1 FROM asistencias a2
      WHERE a2.agenda_id = asistencias.agenda_id
        AND a2.participant_id = asistencias.participant_id
        AND a2.id != asistencias.id
    )
  )
);

CREATE INDEX idx_asistencias_agenda ON asistencias(agenda_id);
CREATE INDEX idx_asistencias_participant ON asistencias(participant_id);
CREATE INDEX idx_asistencias_status ON asistencias(status);
```

---

### 3.4 Tabla: `agendas_disponibilidad` (Horarios de Trabajo)

```sql
CREATE TABLE agendas_disponibilidad (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  coach_id UUID NOT NULL REFERENCES usuarios(id),
  
  -- Día de la semana
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=lunes, 6=domingo
  
  -- Horario
  hour_start TIME NOT NULL,
  hour_end TIME NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT start_before_end CHECK (hour_start < hour_end),
  CONSTRAINT unique_availability CHECK (
    -- No hay dos reglas para (coach, day_of_week)
    NOT EXISTS (
      SELECT 1 FROM agendas_disponibilidad ad2
      WHERE ad2.coach_id = agendas_disponibilidad.coach_id
        AND ad2.day_of_week = agendas_disponibilidad.day_of_week
        AND ad2.id != agendas_disponibilidad.id
    )
  )
);

CREATE INDEX idx_disp_coach ON agendas_disponibilidad(coach_id);
```

---

### 3.5 Tabla: `agendas_bloqueos` (Vacaciones, No Disponible)

```sql
CREATE TABLE agendas_bloqueos (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizaciones(id),
  coach_id UUID NOT NULL REFERENCES usuarios(id),
  
  -- Tipo de bloqueo
  type TEXT CHECK (type IN ('vacaciones', 'no_disponible', 'otro')) NOT NULL,
  
  -- Período
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  
  -- Información
  titulo TEXT,
  descripcion TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT start_before_end CHECK (start_at < end_at)
);

CREATE INDEX idx_bloqueos_coach ON agendas_bloqueos(coach_id);
CREATE INDEX idx_bloqueos_dates ON agendas_bloqueos(start_at, end_at);
```

---

### 3.6 Tabla: `agendas_historial` (Audit Trail)

```sql
CREATE TABLE agendas_historial (
  id UUID PRIMARY KEY,
  agenda_id UUID NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
  
  -- Qué cambió
  action TEXT CHECK (action IN ('created', 'edited', 'cancelled', 'reassigned', 'rescheduled')) NOT NULL,
  
  -- Antes/Después
  data_before JSONB,  -- Estado previo (o null si created)
  data_after JSONB,   -- Estado nuevo
  
  -- Quién y cuándo
  changed_by UUID NOT NULL REFERENCES usuarios(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  
  -- Contexto (para auditoría B2B)
  ip_address INET,
  user_agent TEXT,
  reason TEXT  -- Opcional: por qué se hizo el cambio
);

CREATE INDEX idx_historial_agenda ON agendas_historial(agenda_id);
CREATE INDEX idx_historial_user ON agendas_historial(changed_by);
```

---

## 4. VISTAS Y PERMISOS POR ROL

### 4.1 Coach Estándar (scope=own)

**Puede ver**:
```sql
SELECT * FROM agendas
WHERE coach_id = auth.uid()  -- Sus propias sesiones
  AND status IN ('scheduled', 'confirmed', 'completed', 'cancelled')
```

**Tableau**:
```
Lunes

09:00 Juan Pérez (Cliente) — sesion_individual
11:00 Reunión planificación (Coaches: Ana, Carlos)
14:00 Taller grupal (5 clientes)
```

**Qué puede hacer**:
- ✅ Crear sesión con sus clientes (capacidad `agenda.create`)
- ✅ Editar sus sesiones (capacidad `agenda.edit`)
- ✅ Cancelar (capacidad `agenda.cancel`)
- ✅ Marcar asistencia POST-sesión (capacidad `attendance.register`)
- ❌ Reasignar a otro coach
- ❌ Ver sesiones de otros coaches
- ❌ Editar disponibilidad de otros

---

### 4.2 Coach Senior (scope=team)

**Puede ver**:
```sql
SELECT * FROM agendas
WHERE organization_id = org_id
  AND (
    coach_id = auth.uid()  -- Sus propias sesiones
    OR coach_id IN (SELECT user_id FROM usuarios WHERE team_id = senior.team_id)  -- De su equipo
  )
```

**Tableau**:
```
Lunes

Ana
  09:00 Juan Pérez (sesion_individual)
  14:00 Taller grupal (5 clientes)

Carlos
  11:00 Ana García (sesion_individual)
  15:00 Reunión con Laura

Laura
  10:00 Pedro López (sesion_individual)
```

**Qué puede hacer**:
- ✅ Ver calendario de su equipo
- ✅ Editar sesiones de su equipo (si capacidad `agenda.edit` scope=team)
- ✅ Reasignar clientes dentro del equipo
- ❌ Reasignar a coaches fuera de su equipo
- ❌ Ver sesiones de otros equipos

---

### 4.3 Owner (scope=organization)

**Puede ver**:
```sql
SELECT * FROM agendas
WHERE organization_id = org_id
-- SIN filtro: ve TODO
```

**Tableau**:
```
Calendario organizacional (todas las áreas)

Equipo Career
Ana
  09:00 Juan Pérez

Equipo Fitness
Carlos
  10:00 Gimnasio intenso (8 clientes)

Laura
  15:00 Pilates (4 clientes)
```

**Qué puede hacer**:
- ✅ Ver TODO
- ✅ Crear/editar/cancelar cualquier sesión
- ✅ Reasignar clientes entre coaches
- ✅ Ver asistencia completa
- ✅ Acceder a auditoría (`agendas_historial`)
- ✅ Configurar disponibilidad de coaches
- ✅ Ver bloqueos de coaches

---

### 4.4 Cliente (scope=own, futuro Sprint 5.3)

**Puede ver** (preparado pero NO implementado en Sprint 5.2):
```sql
SELECT * FROM agendas
WHERE client_id = (SELECT id FROM candidatos WHERE user_id = auth.uid())
  AND status IN ('scheduled', 'confirmed', 'completed')
```

**Solo lectura**: Ver sus sesiones, pero no crear ni editar.

---

## 5. REGLAS DE NEGOCIO Y EDGE CASES

### 5.1 Reasignación de Coach

**Caso**: Owner mueve cliente de Coach A → Coach B

```
ANTES:
  Sesión 1: 2026-08-10 14:00, Coach A, Cliente X
  Sesión 2: 2026-08-12 10:00, Coach A, Cliente X

ACCIÓN: Owner reasigna Cliente X a Coach B

DESPUÉS:
  Sesión 1: 2026-08-10 14:00, Coach B, Cliente X ← cambió
  Sesión 2: 2026-08-12 10:00, Coach B, Cliente X ← cambió

AUDITORÍA:
  - evento: "agenda.reassigned"
  - coach_from: "Coach A"
  - coach_to: "Coach B"
  - client_id: "Cliente X"
  - sesiones_afectadas: 2
  - timestamp: 2026-08-02 15:30
  - user_id_actor: "Owner"
```

---

### 5.2 Coach Abandona la Organización

**Opción A** (Recomendado): Sesiones bloqueadas → Owner reasigna o cancela

```
Coach abandona
  ↓
Sus sesiones FUTURAS cambian a status='pending_reassignment'
  ↓
Owner recibe notificación: "2 sesiones de Coach A sin asignar"
  ↓
Owner: reasigna a Coach B O cancela
```

**Opción B** (No recomendado): Auto-reasignar a Owner

```
Coach abandona
  ↓
Sus sesiones se reasignan automáticamente a Owner
  
⚠️ Riesgo: Owner puede quedar sobrecargado
```

**Decisión**: Ir con **Opción A** (más segura).

---

### 5.3 Cliente Se Elimina (Soft Delete)

**Regla**: No se borran sesiones históricas.

```
Cliente X tiene:
  - Sesión completada: 2026-07-10
  - Sesión completada: 2026-07-20
  - Sesión cancelada: 2026-08-01

Cliente X se elimina (soft delete)
  ↓
Sus sesiones PERMANECEN en agendas
  ↓
client_id sigue apuntando a candidatos.id (null en cascada = MAL)
  ↓
⚠️ MEJOR: agendas.client_id REFERENCES candidatos(id) ON DELETE RESTRICT
          O guardar client_name snapshot en agendas

SOLUCIÓN:
  Agregar a agendas:
  - client_snapshot_name TEXT  -- "Juan Pérez"
  - client_snapshot_email TEXT -- "juan@email.com"
  
  Así el histórico queda legible aunque se borre el cliente
```

---

### 5.4 Cambio de Zona Horaria (SaaS Global)

**Problema**: Coach en Argentina (UTC-3) crea sesión "09:00". ¿09:00 en qué zona?

**Solución**: Guardar `timezone` en cada evento

```javascript
agendas {
  id: "evt-123",
  start_at: "2026-08-10T12:00:00Z",  // UTC siempre en DB
  timezone: "America/Argentina/Buenos_Aires",  // Local del coach
  // Cuando se muestra:
  // 12:00 UTC → 09:00 Argentina (UTC-3)
}
```

**Validación**:
- Si Coach A (Argentina) y Coach B (España) en reunión interna
- Mostrar en ambas zonas:
  - 10:00 CET (Hora Central Europea)
  - 06:00 ART (Hora Argentina)

---

### 5.5 Recordatorios (Preparar para Futuro)

**Sprint 5.2**: Preparar campos.  
**Sprint 5.3+**: Implementar envío.

```javascript
agendas {
  // ... campos existentes
  
  // Preparado para recordatorios
  reminder_at_1h BOOLEAN DEFAULT true,      // 1 hora antes
  reminder_at_24h BOOLEAN DEFAULT true,     // 1 día antes
  reminder_sent_1h_at TIMESTAMPTZ,
  reminder_sent_24h_at TIMESTAMPTZ,
  reminder_last_error TEXT  // Si falló envío
}
```

---

## 6. VALIDACIONES BACKEND (CRITICAL PATH)

### 6.1 Crear Sesión

```javascript
// Validaciones ANTES de insertar
1. ✓ start_at > NOW() (evento en el futuro)
2. ✓ start_at < end_at
3. ✓ duration 15min-4h
4. ✓ coach_id existe y está activo
5. ✓ client_id existe (si sesion_individual)
6. ✓ client_id está asignado a coach (scope check)
7. ✓ NO hay conflicto horario (mismo coach, misma hora)
8. ✓ Coach disponible (dentro de agendas_disponibilidad)
9. ✓ Coach NO tiene bloqueo en esa hora (agendas_bloqueos)
10. ✓ Capacidad: agenda.create (Sprint 5.1)
```

---

### 6.2 Editar Sesión

```javascript
1. ✓ Evento existe
2. ✓ status != 'completed' Y != 'cancelled' (no editar histórico)
3. ✓ start_at > NOW() (solo futuro)
4. ✓ Capacidad: agenda.edit (Sprint 5.1)
5. ✓ Si scope=own: solo si coach_id == auth.uid()
6. ✓ Si scope=team: coach_id en mismo equipo
7. ✓ Nueva hora SIN conflictos
8. ✓ Si cambiar coach: validar el nuevo coach está activo
```

---

## 7. INTEGRACIÓN CON PANEL-V2 ACTUAL

### 7.1 Auditoría: Dónde Está Hoy (Líneas de Referencia)

| Función | Línea | Actualmente Usa | Cambio Sprint 5.2 |
|---------|-------|-----------------|------------------|
| Dashboard "Tu agenda" | 2923-2946 | c.ses | Leer de agendas WHERE coach_id=uid |
| Próxima sesión (fila cliente) | 3008-3009 | c.ses | Leer de agendas WHERE client_id |
| Tab "Calendario" | 1796, 2185 | _AG_DATA (externo) | Combinar con agendas (tabla local) |
| Contador "Sesiones este mes" | 2804-2805 | c.ses + RCITAS | Leer de agendas + histórico |
| Asistencia | ❌ NO EXISTE | — | NUEVA: tabla asistencias |

---

### 7.2 Migración de Datos

**Fase 1** (Sprint 5.2): Lectura dual
```javascript
// Leer de ambas fuentes (compatibilidad)
agendas.read() 
  .then(nuevas => {
    // + datos viejos de c.ses para transición
    return [...nuevas, ...convertirLegacySes()];
  })
```

**Fase 2** (Sprint 5.3+): Migración de histórico
```sql
-- Script de migración (post-Sprint 5.2)
INSERT INTO agendas 
  SELECT * FROM LEGACY_SES_CONVERTED
  WHERE migraded_at IS NULL
```

---

## 8. PREPARACIÓN PARA INTEGRACIONES FUTURAS

### Google Calendar, Outlook, Calendly (Sprint 5.3+)

```javascript
agendas {
  // Campos preparados
  external_calendar_id TEXT,        // "google-calendar", "outlook", "calendly"
  external_event_id TEXT,           // ID del evento en sistema externo
  external_sync_status TEXT,        // 'pending', 'synced', 'conflict'
  external_sync_at TIMESTAMPTZ,
  external_sync_error TEXT
}
```

---

## 9. ESTADO FINAL — ENTREGABLES SPRINT 5.2 PRE-CÓDIGO

### ✅ Completados

1. **Diagrama de Flujo** — Crear, editar, cancelar, reasignar, cambios de permisos
2. **Matriz de Conflictos** — 25+ escenarios con permitido/bloqueado
3. **API Contract** — POST/PATCH/DELETE/GET con validaciones
4. **RLS Esperado** — Policies por capacidad + scope
5. **Modelo de Datos** — 6 tablas (agendas, participantes, asistencias, disponibilidad, bloqueos, historial)
6. **Vistas por Rol** — Coach, Coach Senior, Owner, Cliente
7. **Reglas de Negocio** — Reasignación, abandonos, eliminaciones, timezones, recordatorios
8. **Integración con panel-v2** — Auditoría de líneas, plan de migración
9. **Preparación Futuro** — Campos para Google/Outlook, recordatorios, etc.

### 🔒 Single Source of Truth

**Una tabla `agendas`**, múltiples vistas filtradas por capacidad + scope.

---

## 10. CHECKLIST FINAL ANTES DE SPRINT 5.2.1

**Product Owner valida**:

- [ ] ¿Tres tipos de eventos están bien definidos? (individual, grupal, interna)
- [ ] ¿Modelo de asistencia es completo? (estados, impacto en métricas/retención/cobros)
- [ ] ¿Reglas de reasignación son claras?
- [ ] ¿Diferenciación entre disponibilidad/bloqueos/eventos es correcta?
- [ ] ¿Single source of truth (una tabla agendas) es el enfoque correcto?
- [ ] ¿RLS por capacidad + scope es suficiente?
- [ ] ¿Preparación para Google/Outlook/Calendly es adecuada?

**Agente entrega**:

- [ ] Sprint 5.2.1 — Especificación Funcional (basada en este modelo)
- [ ] Sprint 5.2.2 — Mockup UX (diseño sin código)
- [ ] Sprint 5.2.3 — Implementación (backend + API)
- [ ] Sprint 5.2.4 — QA (desktop/tablet/mobile)

---

## 11. CINCO DECISIONES FINALES (APROBADAS Y CONGELADAS)

### 11.1 Permisos de Cancelación

**Regla definida**:

| Actor | Puede cancelar | Ámbito |
|-------|----------------|--------|
| **Owner** | Cualquier sesión | scope=organization |
| **Coach** | Solo sus sesiones | scope=own |
| **Coach Senior** | Sesiones de su equipo | scope=team |
| **Colaborador** | Según capacidad `agenda.cancel` | — |
| **Cliente** (futuro) | Request cancelación | solo su sesión, no bloquea |

**Capacidad requerida**:
- Owner: `agenda.cancel` (scope=organization)
- Coach: `agenda.cancel` (scope=own)
- Coach Senior: `agenda.cancel` (scope=team) [si tiene capacidad]

**En Sprint 5.2**: Implementar solo Owner + Coach.

---

### 11.2 Edición Después de Completada

**Regla**: Una sesión con status=`completed` NO puede editarse libremente.

**Permitido**:
```
✅ Correcciones administrativas
   - Cambiar descripción (typo)
   - Cambiar zoom_url
   - Agregar notas
   
   REQUISITO: Auditoría detallada (qué cambió exactamente)
```

**Prohibido**:
```
❌ Editar fecha
❌ Editar coach
❌ Editar participantes
❌ Cambiar tipo de sesión
```

**Implementación**:
```javascript
// En backend, al PATCH /agendas/{id}
if (status === 'completed') {
  const editableFields = ['descripcion', 'zoom_url', 'notas'];
  const attemptedChanges = Object.keys(update);
  const invalidChanges = attemptedChanges.filter(f => !editableFields.includes(f));
  
  if (invalidChanges.length > 0) {
    return 403 "No puedes editar una sesión completada";
  }
}
```

---

### 11.3 Sesión Grupal: Coach Principal Obligatorio

**Regla**: Una sesión grupal SIEMPRE tiene un coach principal.

```javascript
agendas {
  type: "sesion_grupal",
  coach_id: "coach-001",  // ✅ OBLIGATORIO (never null)
  client_id: null,        // Null para sesión grupal
  titulo: "Taller: Presentaciones"
}

agenda_participantes [
  { participant_id: "cli-001", role: "participant" },
  { participant_id: "cli-002", role: "participant" },
  { participant_id: "cli-003", role: "participant" }
]
```

**Por qué**:
- Necesarias preguntas operacionales:
  - ¿Quién reporta si hay conflicto horario?
  - ¿Quién marca asistencia?
  - ¿Quién reasigna si el coach se va?
- Respuesta: siempre el `coach_id` (coach principal)

**Constraint SQL**:
```sql
ALTER TABLE agendas
ADD CONSTRAINT coach_required_for_sesion_grupal
CHECK (
  (type = 'sesion_grupal' AND coach_id IS NOT NULL) OR
  (type != 'sesion_grupal')
);
```

---

### 11.4 Recordatorios: Estados Preparados

**Campos preparados** (Sprint 5.2):
```javascript
agendas {
  reminder_at_1h: BOOLEAN DEFAULT true,
  reminder_at_24h: BOOLEAN DEFAULT true,
  reminder_sent_1h_at: TIMESTAMPTZ,
  reminder_sent_24h_at: TIMESTAMPTZ,
  reminder_sent_1h_status: TEXT,  // 'pending' | 'sent' | 'failed' | 'cancelled'
  reminder_sent_24h_status: TEXT,
  reminder_last_error: TEXT
}
```

**Estados para Sprint 5.3+ (cuando se implemente)**:
```
pending   → Recordatorio pendiente de envío
sent      → Recordatorio enviado exitosamente
failed    → Intento de envío falló (retry)
cancelled → Usuario desactivó recordatorio
```

**Implementación**: Campo se deja en place pero sin lógica de envío (Sprint 5.3+).

---

### 11.5 Migración de c.ses (Fase Multi-Step)

**Fase 1** (Sprint 5.2): Dual Read + Legacy Compatibility
```javascript
// Durante Sprint 5.2, leer de AMBAS fuentes
async function getUpcomingSessionsForCoach(coachId) {
  const new_agendas = await sb.from('agendas')
    .select('*')
    .eq('coach_id', coachId);
  
  // Legacy: convertir c.ses a formato agendas
  const legacy = convertLegacySes(CLIENTS[].ses);
  
  // Devolver merged (agendas toman precedencia)
  return [...new_agendas, ...legacy.filter(l => !new_agendas.find(a => a.id === l.id))];
}
```

**Fase 2** (Post-Sprint 5.2): Migración Histórica
```sql
-- Script ejecutado DESPUÉS que agendas esté estable
INSERT INTO agendas (...)
SELECT ... FROM candidatos c, json_to_recordset(c.sesiones_registro) AS ses(fecha, hora, tipo)
WHERE sesiones_registro IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM agendas WHERE client_id = c.id AND date(start_at) = date(ses.fecha));
```

**Fase 3** (Sprint 5.3+): Deprecación de c.ses
```javascript
// Marcar c.ses como deprecated
// No eliminar hasta que histórico sea 100% migrado
// Auditoría: si alguien escribe en c.ses post-Sprint 5.2, alertar
```

**Regla de oro**: Nunca eliminar c.ses sin confirmación de que TODO el histórico fue migrado.

---

## 12. ESTADO FINAL — CONGELADO

### ✅ Decisiones Congeladas

1. **Single Source of Truth**: UNA tabla `agendas`, múltiples vistas
2. **Tres conceptos separados**: Sesión, participantes, asistencia, disponibilidad, bloqueos, auditoría
3. **Permisos de cancelación**: Owner (org), Coach (own), Senior (team)
4. **Edición post-completada**: Solo correcciones administrativas con auditoría
5. **Sesión grupal**: Coach principal SIEMPRE obligatorio
6. **Recordatorios**: Campos preparados, lógica en Sprint 5.3+
7. **Migración c.ses**: Dual read → Histórico → Deprecated (3 fases)

### 🔒 CONGELADO HASTA

- Sprint 5.2.1 aprobado (PRD funcional)
- Sprint 5.2.2 aprobado (Mockup UX)
- Sprint 5.2.3 iniciado (implementación)

**NO vuelven a tocarse estas decisiones sin rediseño arquitectónico expreso del Product Owner.**

---

**ESTADO**: 🟢 Aprobado y Congelado.  
**Próximo**: Sprint 5.2.1 — Especificación Funcional (PRD mini).

