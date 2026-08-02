# Sprint 5.2 — Arquitectura de Agenda (sin código)

**Estado**: Especificación arquitectónica  
**Versión**: 0.1 (draft, sin implementación)  
**Fecha**: 2026-08-02  
**Restricción**: Solo responder preguntas. No escribir una línea de código.

---

## ADVERTENCIA

**NO escribáis un calendario aún.**

Este documento define *cómo funcionará* la agenda. Implementación = Sprint 5.2 CÓDIGO (posterior).

Objetivos de este documento:
1. Responder 10 preguntas arquitectónicas clave
2. Definir el modelo de datos (sin migrations)
3. Identificar integraciones (sin APIs)
4. Documentar conflictos y resoluciones

---

## PREGUNTA 1: ¿Una agenda por coach o una agenda organizacional?

### Contexto

Hay dos modelos:

**Modelo A: Agenda por Coach (separada)**
```
Coach A          Coach B
├─ Sesión 1      ├─ Sesión X
├─ Sesión 2      └─ Sesión Y
└─ Sesión 3

Owner ve:
├─ Dashboard agregado (KPIs)
└─ Puede VER agendas individuales (si tiene capacidad agenda.view_team)
```

**Modelo B: Agenda Organizacional (unificada)**
```
Organizacion
├─ Coach A → Sesión 1, 2, 3
├─ Coach B → Sesión X, Y
└─ Salas/Espacios → Disponibilidad compartida
```

### Decisión Propuesta

**HÍBRIDO**: Agenda organizacional con vistas por rol

```
DB schema:
  └─ agendas (tabla única)
      ├─ id UUID
      ├─ organization_id UUID
      ├─ coach_id UUID (el responsable)
      ├─ cliente_id UUID
      ├─ fecha_hora TIMESTAMPTZ
      ├─ tipo ('sesión', 'reunión_interna', 'bloqueo')
      ├─ estado ('confirmada', 'cancelada', 'tentativa')
      └─ ...

Vistas:
  ├─ Coach: VE solo sus sesiones (coach_id = suyo)
  ├─ Coach Senior: VE su equipo (coach_id IN [su equipo])
  ├─ Owner: VE toda la org (sin filtro)
  └─ Admin: VE según capacidades (agenda.view_own/team/organization)
```

**Ventajas**:
- Una fuente de verdad
- Escalable (100+ coaches, 1000+ sesiones)
- Evita duplicados y conflictos
- Permite compartición (Colaboración Sprint 5.4)

**Desventajas**:
- Más complejo en queries
- RLS debe ser cuidadoso
- Sincronización con Google Calendar es más complicada

### Aceptado: ✅ Modelo HÍBRIDO (tabla única, vistas por rol)

---

## PREGUNTA 2: ¿Cómo se gestionan reuniones entre miembros del equipo?

### Contexto

"Reunión interna" ≠ "Sesión con cliente"

Ejemplo:
```
Coach A y Coach B coordinan un cliente

Coach A:  Lunes 14:00 - Sesión con Cliente X
Coach B:  Lunes 14:30 - Reunión interna (síncrono)
Cliente X: Lunes 14:00 - Sesión

¿Cómo evitar que ambos creen "sesión" al mismo cliente a la vez?
```

### Decisión Propuesta

**Tipos de Sesión**:

```sql
CREATE TABLE agendas (
  ...
  tipo ENUM ('sesion', 'reunion_interna', 'bloqueo'),
  participantes_internos UUID[],  -- Coaches/Colaboradores internos
  cliente_id UUID,                 -- NULL si es interna
  ...
);

-- SESIÓN: Coach + Cliente
-- Tipo: 'sesion'
-- cliente_id: NO NULL
-- participantes_internos: [] (vacío)
-- Coach A ve: "Sesión con Cliente X"

-- REUNIÓN INTERNA: Coach A + Coach B
-- Tipo: 'reunion_interna'
-- cliente_id: NULL
-- participantes_internos: [coach_a_id, coach_b_id]
-- Ambos ven: "Reunión con Coach B"

-- BLOQUEO: Coach no disponible
-- Tipo: 'bloqueo'
-- cliente_id: NULL
-- participantes_internos: []
-- Solo el coach lo ve
```

**Lógica de Conflictos**:

```
Al crear "Sesión con Cliente X" (Coach A, Lunes 14:00):
  1. Verificar: Coach A no tiene otra sesión Lunes 13:30-14:30
  2. Verificar: Cliente X no tiene otra sesión Lunes 13:30-14:30
  3. Si OK → Crear
  4. Si conflicto → Mostrar alternativas

Al crear "Reunión interna" (Coach A + Coach B, Lunes 14:00):
  1. Verificar: Coach A libre 13:30-14:30
  2. Verificar: Coach B libre 13:30-14:30
  3. Si OK → Crear
  4. Si conflicto → Mostrar quién está ocupado
```

### Aceptado: ✅ Tres tipos (sesión, reunión_interna, bloqueo)

---

## PREGUNTA 3: ¿Cómo evitar conflictos de horario?

### Contexto

Problema clásico:
```
Coach A crea: Sesión con Cliente X, Lunes 14:00-15:00
Coach B crea: Sesión con Cliente X, Lunes 14:30-15:30

¿Resultado? Cliente X en dos sesiones a la vez.
```

### Decisión Propuesta

**Reglas de Validación** (en DB + Backend):

```
Rule 1: Coach no puede tener 2+ sesiones al mismo tiempo
  ├─ Check: SELECT COUNT(*) FROM agendas 
  │           WHERE coach_id = ? 
  │           AND fecha_inicio < ?_end 
  │           AND fecha_fin > ?_start
  └─ Si COUNT ≥ 1 → Error: "Coach ocupado"

Rule 2: Cliente no puede tener 2+ sesiones al mismo tiempo
  ├─ Check: SELECT COUNT(*) FROM agendas 
  │           WHERE cliente_id = ? 
  │           AND fecha_inicio < ?_end 
  │           AND fecha_fin > ?_start
  └─ Si COUNT ≥ 1 → Error: "Cliente ocupado"

Rule 3: Avisar si hay SOLAPAMIENTO (pero permitir)
  ├─ 14:00-15:00 (sesión)
  ├─ 14:45-15:15 (reservación inicial)
  └─ "⚠️ Solapamiento de 15 min. ¿Confirmar?"

Rule 4: Bloqueos tienen prioridad
  ├─ Si Coach A tiene "bloqueo Lunes 14:00-16:00"
  └─ No se puede crear sesión en esa franja
```

**Nivel de Validación**:

```
FRONTEND:
  ├─ Calendario visual: muestra conflictos (rojo)
  ├─ Al crear: "¿Quieres 14:00? Estás ocupado 13:45-15:00"
  └─ Sugerencias: "Próximos slots libres: 15:30, 16:00, 17:00"

BACKEND:
  ├─ Validación OBLIGATORIA en DB (constraints)
  ├─ Trigger: BEFORE INSERT / UPDATE
  └─ Si falla: 409 Conflict

API:
  ├─ GET /agendas?coach_id=&libres_desde=&duracion=
  └─ Devuelve slots disponibles de N minutos
```

### Aceptado: ✅ Validación en 3 niveles (FE, BE, DB)

---

## PREGUNTA 4: ¿Qué ocurre cuando se reasigna un cliente?

### Contexto

```
Cliente X estaba con Coach A (Sesión cada lunes 14:00)
Owner reasigna: Cliente X → Coach B

¿Qué pasa con:
  - Sesión Lunes 14:00 (la de Coach A)?
  - Próximas sesiones?
  - Historial?
```

### Decisión Propuesta

**Escenarios**:

```
ESCENARIO 1: Reasignar cliente FUTURO
  ├─ Cliente X tiene sesión: Lunes 14:00 (Coach A)
  ├─ Owner: "Reasignar Cliente X a Coach B"
  ├─ Acción:
  │   ├─ Cancelar sesión Lunes 14:00 (Coach A)
  │   ├─ Crear sesión Lunes 14:00 (Coach B) si disponible
  │   │   ├─ Si Coach B libre: Crear con estado 'tentativa' (confirmar luego)
  │   │   └─ Si Coach B ocupado: Mostrar alternativas
  │   └─ Auditoría: "Cliente X reasignado de Coach A a Coach B"
  │
  └─ Notificaciones:
      ├─ Coach A: "Sesión cancelada: Cliente X"
      ├─ Coach B: "Nueva sesión: Cliente X (confirmar)"
      └─ Cliente X: "Tu sesión ha sido reprogramada"

ESCENARIO 2: Reasignar cliente CON historial
  ├─ Cliente X tiene sesiones pasadas (Coach A)
  ├─ Acción:
  │   ├─ Historial: MANTENER (fue con Coach A)
  │   ├─ Futuro: CAMBIAR a Coach B
  │   └─ Auditoría: Marca de reasignación
  │
  └─ Vista Coach B:
      ├─ Historial: VE sesiones de Coach A (contexto)
      └─ Futuro: SU sesión programada

ESCENARIO 3: Compartir cliente (Colaboración Sprint 5.4)
  ├─ Cliente X asignado a Coach A
  ├─ Coach B puede trabajar puntuales (reuniones, tareas)
  └─ Sesiones:
      ├─ Sesión A: "Coach A + Cliente X"
      ├─ Sesión B: "Coach B + Cliente X" (sesión puntual)
      └─ Ambas en mismo cliente, coaches distintos
```

### Modelo de Datos

```sql
ALTER TABLE agendas ADD (
  coach_principal_id UUID,     -- El responsable
  coach_secundario_id UUID,    -- Si es colaboración
  evento_original_id UUID,     -- Si fue reasignado
  razon_cambio TEXT            -- 'reasignacion', 'colaboracion', 'cancelacion'
);

ALTER TABLE agendas ADD (
  fecha_reasignacion TIMESTAMPTZ,  -- Cuándo se reasignó
  quien_reasigno UUID              -- Quién lo hizo (owner_id)
);
```

### Aceptado: ✅ Modelo con coach_principal, coach_secundario, auditoría

---

## PREGUNTA 5: ¿Quién puede crear, mover o cancelar sesiones?

### Permisos (basado en Sprint 5.1)

```
CREAR SESIÓN:
  ├─ Necesita: agenda.create
  ├─ Puede crear para:
  │   ├─ Sí mismo (siempre)
  │   ├─ Otro coach si tiene agenda.view_team (equipo)
  │   ├─ Cliente: solo coaches del cliente

EDITAR SESIÓN:
  ├─ Necesita: agenda.edit
  ├─ Puede editar:
  │   ├─ Propias sesiones (siempre)
  │   ├─ Sesiones del equipo si agenda.view_team
  │   └─ Coach Senior puede editar sesiones de su equipo

CANCELAR SESIÓN:
  ├─ Necesita: agenda.cancel
  ├─ Puede cancelar:
  │   ├─ Propias sesiones (siempre)
  │   ├─ Sesiones de su equipo si agenda.view_team
  │   └─ Owner puede cancelar cualquiera
```

**Escenarios Complejos**:

```
CASO 1: Coach A crea sesión para Coach B
  └─ Necesita: agenda.create + agenda.view_team

CASO 2: Coach A intenta editar sesión de Coach B
  └─ Tiene agenda.edit pero NO agenda.view_team
  └─ Resultado: ✗ Acceso denegado

CASO 3: Coach Senior edita sesión de Coach Junior
  └─ Coach Senior tiene agenda.view_team
  └─ Resultado: ✓ Permitido (supervisión)

CASO 4: Cliente cancela su sesión
  └─ Clientes NO tienen permisos de agenda
  └─ Deben hacerlo vía link de cancelación (automático)
  └─ O Coach lo cancela en su nombre
```

### Aceptado: ✅ Permisos según capacidades de Sprint 5.1

---

## PREGUNTA 6: ¿Cómo se integra con Google Calendar, Outlook, Calendly?

### Integraciones Posibles

```
GOOGLE CALENDAR:
  ├─ Sincronización bidireccional
  ├─ Se crea evento en Pathway → Se crea en Google
  ├─ Se crea evento en Google → Se sincroniza a Pathway
  └─ Conflictos: Si hay evento en ambos, ¿cuál gana?

OUTLOOK:
  ├─ Similar a Google
  ├─ Sincronización via Microsoft Graph API
  └─ Menos prioritario (iniciar con Google)

CALENDLY:
  ├─ Diferente modelo: Calendly ES el calendario
  ├─ Pathway muestra disponibilidad desde Calendly
  ├─ No es bidireccional (es solo lectura de Calendly)
  └─ Pathway puede "marcar" slots en Calendly como ocupados
```

### Decisión Propuesta

**FASE 1 (Sprint 5.2 inicial)**:
- ❌ No integrar (dejar para Sprint 5.3+)
- ✅ Guardar `google_calendar_event_id` en DB (para futuro)
- ✅ Reservar campos: `external_calendar_sync`, `external_event_id`

**FASE 2 (Sprint 5.3+)**:
- ✅ Google Calendar: crear evento cuando se crea sesión en Pathway
- ✅ Sincronizar cambios (editar fecha/hora en Pathway → actualizar Google)
- ⚠️ Resolver conflictos (¿cuál fuente de verdad?)

**Conflictos a Resolver**:

```
User crea sesión en Google Calendar (no en Pathway):
  A) Sincronizar: Se crea automáticamente en Pathway (complejo)
  B) Ignorar: Solo lo que cree en Pathway (menos flexible)
  C) Advertencia: "Detección evento externo, ¿añadir?" (manual)

→ Propuesta: OPCIÓN C (manual, más seguro)
```

### Aceptado: ✅ Fase 1 sin integración (preparar campos)

---

## PREGUNTA 7: ¿Qué pasa con Zoom/Meet/Teams?

### Contexto

Cada sesión puede necesitar:
```
Sesión Lunes 14:00 (Coach A + Cliente X):
  ├─ Duración: 50 minutos
  ├─ Link de videollamada: https://zoom.us/...
  ├─ Contraseña: 123456
  └─ Recordatorio: Enviar 15 min antes
```

### Decisión Propuesta

**Campos de Integración**:

```sql
ALTER TABLE agendas ADD (
  video_platform ENUM ('zoom', 'meet', 'teams', 'ninguno'),
  video_link TEXT,
  video_meeting_id TEXT,
  video_password TEXT,
  video_auto_create BOOLEAN DEFAULT false
);
```

**Lógica**:

```
OPCIÓN 1: Manual (Sprint 5.2)
  ├─ Coach crea sesión
  ├─ Coach copia link de Zoom manualmente
  ├─ Guarda el link en Pathway
  ├─ Sistema envía link al cliente

OPCIÓN 2: Automático (Sprint 5.3+)
  ├─ Coach conecta su cuenta Zoom (OAuth)
  ├─ Al crear sesión: "¿Crear reunión Zoom?"
  ├─ Sistema llama Zoom API → Crea reunión
  ├─ Guarda link automáticamente
  └─ Envía al cliente
```

**Email/Notificación**:

```
Plantilla de invitación:

"Sesión con Coach A
Lunes, 2026-08-10 a las 14:00 UTC
Duración: 50 minutos

Link de videollamada: https://zoom.us/...
Contraseña: 123456 (si aplica)

¿Preguntas? Responde este email."
```

### Aceptado: ✅ Campos + Opción 1 (manual, Sprint 5.2)

---

## PREGUNTA 8: ¿Cómo se gestionan vacaciones, bloqueos y disponibilidad?

### Conceptos

```
VACACIONES (Coach A: 15-22 Agosto)
  ├─ Tipo: Bloqueo
  ├─ Duración: Múltiples días
  ├─ Visible para: Owner, Coach A
  └─ Efecto: No se pueden crear sesiones

BLOQUEOS DE HORA (Coach A: Lunes 18:00-19:00 = hora de comer)
  ├─ Tipo: Bloqueo
  ├─ Duración: Recurrente (cada lunes)
  ├─ Visible para: Coach A (privado)
  └─ Efecto: No se pueden crear sesiones

DISPONIBILIDAD (Coach A: Disponible Lunes-Viernes 10:00-18:00)
  ├─ Modelo de datos: slots de disponibilidad
  ├─ Visible para: Owner (si quiere asignar clientes)
  └─ Efecto: Sugerencias de horarios
```

### Modelo de Datos

```sql
CREATE TABLE agendas_bloqueos (
  id UUID PRIMARY KEY,
  organization_id UUID,
  coach_id UUID,
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  tipo ENUM ('vacacion', 'comida', 'mantenimiento', 'otro'),
  recurrencia ENUM ('ninguno', 'diario', 'semanal', 'mensual'),
  razon TEXT,
  visible_para TEXT  -- 'privado', 'equipo', 'publico'
);

CREATE TABLE agendas_disponibilidad (
  id UUID PRIMARY KEY,
  organization_id UUID,
  coach_id UUID,
  dia_semana INT (0=domingo, 1=lunes...),
  hora_inicio TIME,
  hora_fin TIME,
  zona_horaria TEXT,
  notas TEXT
);
```

**Lógica de Validación**:

```
Al crear sesión (Lunes 14:00):
  1. ¿Coach tiene bloqueo (Lunes 14:00)? → Error
  2. ¿Sesión dentro de disponibilidad del coach? → OK
     └─ Si NO: ⚠️ Aviso "Fuera de disponibilidad del coach"
  3. ¿Cliente tiene disponibilidad? → OK (si existe)
  4. Crear sesión
```

### Aceptado: ✅ Dos tablas (bloqueos + disponibilidad)

---

## PREGUNTA 9: ¿Cómo manejar la recurrencia?

### Contexto

```
Coach A tiene sesión cada Lunes 14:00 con Cliente X

¿Cómo representar esto sin crear 52 filas en BD?
```

### Decisión Propuesta

**Modelo: Evento Recurrente + Instancias**

```sql
CREATE TABLE agendas_recurrentes (
  id UUID PRIMARY KEY,
  organization_id UUID,
  coach_id UUID,
  cliente_id UUID,
  titulo TEXT,
  descripcion TEXT,
  hora_inicio TIME,
  zona_horaria TEXT,
  recurrencia ENUM ('semanal', 'quincenal', 'mensual'),
  dias_semana INT[],  -- [1,3,5] = lunes, miércoles, viernes
  fecha_inicio DATE,
  fecha_fin DATE,     -- Hasta cuándo
  cancelado BOOLEAN DEFAULT false
);

CREATE TABLE agendas (
  -- Campos existentes...
  agendas_recurrente_id UUID,  -- Referencias al recurrente
  numero_instancia INT          -- Sesión 1 de 52, sesión 2 de 52, etc.
);
```

**Lógica de Generación**:

```
Al crear recurrente "Lunes 14:00, Lunes-Miércoles-Viernes, hasta 31 Dic 2026":
  1. Calcular todas las fechas (300+ días)
  2. Crear 52+ filas en agendas (una por instancia)
  3. Marcar con agendas_recurrente_id
  
Si Coach A edita UNA instancia (Lunes 15 Aug → martes):
  - Esa instancia se convierte en "excepción"
  - Las otras 51 instancias no cambian
  - Campo: agendas.excepcion_de_recurrente = true

Si Coach A cancela TODO el recurrente:
  - Marcar agendas_recurrentes.cancelado = true
  - Las instancias futuro-sin-cambios se marcan como canceladas
  - Las instancias ya pasadas se dejan como registro histórico
```

### Aceptado: ✅ Modelo recurrente + instancias generadas

---

## PREGUNTA 10: ¿Cómo se registra el historial?

### Contexto

```
Auditoría completa de cada cambio:
  - Quién creó sesión
  - Quién la movió de hora
  - Quién la canceló
  - Por qué
```

### Decisión Propuesta

**Auditoría integrada en agendas**:

```sql
ALTER TABLE agendas ADD (
  created_by UUID,           -- Quién creó
  created_at TIMESTAMPTZ,    -- Cuándo
  updated_by UUID,           -- Quién editó
  updated_at TIMESTAMPTZ,    -- Cuándo
  canceled_by UUID,          -- Quién canceló
  canceled_at TIMESTAMPTZ,   -- Cuándo
  cancel_reason TEXT         -- Por qué
);

-- Tabla de cambios (historial):
CREATE TABLE agendas_historial (
  id BIGSERIAL PRIMARY KEY,
  agenda_id UUID,
  changed_by UUID,
  changed_at TIMESTAMPTZ,
  campo TEXT,                 -- 'fecha', 'coach', 'cliente', 'titulo'
  valor_anterior TEXT,        -- "14:00"
  valor_nuevo TEXT,           -- "15:00"
  razon TEXT                  -- "Coach solicitó cambio"
);
```

**Eventos Auditables**:

```
✓ agenda.created
✓ agenda.updated (cada campo)
✓ agenda.moved (cambio de fecha/hora)
✓ agenda.canceled
✓ agenda.reasigned (cliente reasignado)
✓ agenda.shared (colaboración)
✓ agenda.reminder_sent
```

### Aceptado: ✅ Campos audit + tabla historial

---

## RESUMEN ARQUITECTÓNICO (SIN CÓDIGO)

| Pregunta | Decisión | Estado |
|----------|----------|--------|
| 1. Agenda tipo | Híbrido (tabla única, vistas por rol) | ✅ |
| 2. Reuniones internas | 3 tipos (sesión, reunión, bloqueo) | ✅ |
| 3. Conflictos | Validación FE+BE+DB | ✅ |
| 4. Reasignación | coach_principal + auditoría | ✅ |
| 5. Permisos | Según capacidades Sprint 5.1 | ✅ |
| 6. Google/Outlook | Fase 1 sin integración (preparar campos) | ✅ |
| 7. Zoom/Meet/Teams | Manual Sprint 5.2, automático Sprint 5.3+ | ✅ |
| 8. Vacaciones/Bloqueos | Dos tablas (bloqueos + disponibilidad) | ✅ |
| 9. Recurrencia | Recurrente + instancias generadas | ✅ |
| 10. Auditoría | Campos audit + tabla historial | ✅ |

---

## MODELO DE DATOS CONSOLIDADO (sin SQL)

### Tabla Principal: agendas

```
id UUID
organization_id UUID
coach_principal_id UUID
coach_secundario_id UUID (null si solo principal)
cliente_id UUID (null si reunión interna o bloqueo)
tipo ENUM ('sesion', 'reunion_interna', 'bloqueo')
titulo TEXT
descripcion TEXT
fecha_inicio TIMESTAMPTZ
fecha_fin TIMESTAMPTZ
duracion_minutos INT
estado ENUM ('confirmada', 'tentativa', 'cancelada', 'no_asistio')
video_platform ENUM ('zoom', 'meet', 'teams', 'ninguno')
video_link TEXT
video_meeting_id TEXT
participantes_internos UUID[] (coaches si reunion interna)
agendas_recurrente_id UUID (null si no recurrente)
numero_instancia INT (null si no recurrente)
excepcion_de_recurrente BOOLEAN
evento_original_id UUID (null si no fue reasignado)
razon_cambio TEXT ('reasignacion', 'colaboracion', 'cancelacion')
created_by UUID
created_at TIMESTAMPTZ
updated_by UUID
updated_at TIMESTAMPTZ
canceled_by UUID
canceled_at TIMESTAMPTZ
cancel_reason TEXT
```

### Tabla: agendas_recurrentes

```
id UUID
organization_id UUID
coach_id UUID
cliente_id UUID
titulo TEXT
descripcion TEXT
hora_inicio TIME
zona_horaria TEXT
recurrencia ENUM ('semanal', 'quincenal', 'mensual')
dias_semana INT[] (0-6)
fecha_inicio DATE
fecha_fin DATE
cancelado BOOLEAN
created_by UUID
created_at TIMESTAMPTZ
```

### Tabla: agendas_bloqueos

```
id UUID
organization_id UUID
coach_id UUID
fecha_inicio TIMESTAMPTZ
fecha_fin TIMESTAMPTZ
tipo ENUM ('vacacion', 'comida', 'mantenimiento', 'otro')
recurrencia ENUM ('ninguno', 'diario', 'semanal', 'mensual')
razon TEXT
visible_para TEXT ('privado', 'equipo', 'publico')
```

### Tabla: agendas_disponibilidad

```
id UUID
organization_id UUID
coach_id UUID
dia_semana INT (0-6)
hora_inicio TIME
hora_fin TIME
zona_horaria TEXT
notas TEXT
```

### Tabla: agendas_historial

```
id BIGSERIAL
agenda_id UUID
changed_by UUID
changed_at TIMESTAMPTZ
campo TEXT
valor_anterior TEXT
valor_nuevo TEXT
razon TEXT
```

---

## PERMISOS APLICABLES (Sprint 5.1)

```
agenda.view_own         → VER propias sesiones
agenda.view_team        → VER sesiones del equipo
agenda.view_organization → VER todas las sesiones org
agenda.create           → CREAR sesión
agenda.edit             → EDITAR sesiones
agenda.cancel           → CANCELAR sesiones
```

**Mapeo a UI/API**:

```
GET /agendas?coach_id=&mes=
  └─ Necesita: agenda.view_own (propias) o agenda.view_team (equipo) o agenda.view_organization (todas)

POST /agendas
  └─ Necesita: agenda.create

PATCH /agendas/:id
  └─ Necesita: agenda.edit (+ validación: ¿es tuya o tienes view_team?)

DELETE /agendas/:id
  └─ Necesita: agenda.cancel
```

---

## PRÓXIMOS PASOS

**Sprint 5.2 CODE** (cuando comience):
1. Crear migrations SQL (tablas)
2. Crear API endpoints (CRUD)
3. Crear UI (calendario visual)
4. Implementar validaciones
5. Añadir auditoría
6. Testing completo

**Sprint 5.3** (posterior):
- Integración Google Calendar
- Integración Zoom
- Webhooks

**Sprint 5.4** (posterior):
- Compartición de clientes (collab.compartir_cliente)
- Delegación de sesiones (collab.delegar)

---

**FIN DE ARQUITECTURA DE SPRINT 5.2**

✅ 10 preguntas respondidas  
✅ Modelo de datos definido (sin SQL)  
✅ Permisos mapeados (desde Sprint 5.1)  
✅ Integraciones identificadas  
✅ Listo para pasar a Sprint 5.2 CODE

---

**Recordatorio**: Este documento NO tiene una línea de código.  
**Próximo**: Sprint 5.2 CODE = SQL + API + UI (basado en este documento)
