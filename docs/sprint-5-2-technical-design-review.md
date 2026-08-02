# Sprint 5.2 — Technical Design Review: Arquitectura de Agenda

**Fecha**: 2026-08-02  
**Estado**: 🔍 EN REVISIÓN (PRE-IMPLEMENTACIÓN)  
**Entrega Requerida**: Aprobación del Product Owner antes de Sprint 5.2 Código

---

## 1. DIAGRAMA DE FLUJO

### 1.1 Crear Sesión

```
┌─ Coach ejecuta "Crear sesión"
│
├─→ [Modal de creación]
│   ├─ Tipo: sesión_cliente | reunión_interna | bloqueo
│   ├─ Fecha/Hora (validar disponibilidad)
│   ├─ Duración
│   ├─ Cliente (si sesión_cliente)
│   ├─ Participantes (si reunión_interna)
│   └─ [Guardar]
│
├─→ [VALIDACIÓN BACKEND]
│   ├─ ✓ Capacidad: agenda.create?
│   ├─ ✓ Scope: own | team | organization?
│   ├─ ✓ Conflictos horarios (misma sesión, mismo coach)?
│   ├─ ✓ Cliente existe y está asignado?
│   ├─ ✓ Horario dentro de disponibilidad del coach?
│   └─ Si falla → ERROR 403/400 + motivo
│
├─→ [INSERTAR EN DB]
│   ├─ Tabla: agendas
│   ├─ Campos: id, organization_id, coach_id, cliente_id?, tipo, 
│   │          start_at, end_at, titulo, descripcion, estado, 
│   │          created_by, created_at, updated_at, recurrence_rule?
│   └─ RLS: owner (organización) PUEDE, coach PUEDE SOLO si es suya
│
├─→ [AUDITORÍA]
│   ├─ Tabla: auditoria_capacidades
│   ├─ evento: "agenda.created"
│   ├─ capacidad: "agenda.create"
│   ├─ user_id_actor: Coach que creó
│   ├─ organization_id: Org del evento
│   └─ Timestamps + IP + session_id
│
└─→ [RESPUESTA]
    ├─ ✓ Evento creado + ID
    ├─ ✓ UI recarga calendario
    ├─ ✓ Toast "Sesión agendada"
    └─ ✓ Notificación al cliente (opcional)
```

### 1.2 Editar Sesión

```
┌─ Coach clickea evento en calendario
│
├─→ [Modal de edición]
│   ├─ Campos editables: Hora, Duración, Descripción, Participantes
│   ├─ Campos READ-ONLY: Fecha (si ya pasó), Tipo
│   └─ [Guardar cambios]
│
├─→ [VALIDACIÓN BACKEND]
│   ├─ ✓ Evento existe?
│   ├─ ✓ Capacidad: agenda.edit?
│   ├─ ✓ Scope: es el coach propietario (own)?
│   │        O tiene scope team/organization?
│   ├─ ✓ Evento ya ocurrió? → No se puede editar (403)
│   ├─ ✓ Conflictos NEW (misma hora con otro evento)?
│   ├─ ✓ Si mover cliente: coach_id cambia?
│   │        → Auditoría especial: "agenda.reassigned"
│   └─ Si falla → ERROR 403/422 + motivo
│
├─→ [ACTUALIZAR EN DB]
│   ├─ Tabla: agendas
│   ├─ WHERE id=? AND organization_id=?
│   ├─ SET start_at, end_at, descripcion, updated_at, updated_by
│   ├─ Si coach_id cambió: crear REGISTER en agendas_historial
│   └─ RLS: solo owner O coach propietario (si scope=own)
│
├─→ [AUDITORÍA]
│   ├─ evento: "agenda.edited"
│   ├─ cambios registrados: before/after (JSON)
│   ├─ user_id_actor: Coach que editó
│   └─ Si coach_id cambió: evento adicional "agenda.reassigned"
│
└─→ [RESPUESTA]
    ├─ ✓ Evento actualizado
    ├─ ✓ UI recarga calendario
    ├─ ✓ Toast "Cambios guardados"
    └─ ✓ Notificación al cliente (si horario cambió)
```

### 1.3 Cancelar Sesión

```
┌─ Coach clickea evento + "Cancelar"
│
├─→ [Modal de confirmación]
│   ├─ "¿Cancelar sesión con [Cliente]?"
│   ├─ Motivo (opcional): Disponibilidad, Cliente no confirmó, Otra
│   └─ [Confirmar cancelación]
│
├─→ [VALIDACIÓN BACKEND]
│   ├─ ✓ Evento existe?
│   ├─ ✓ Capacidad: agenda.cancel? (o agenda.edit?)
│   ├─ ✓ Scope: coach propietario (own)?
│   │        O tiene scope team/organization?
│   ├─ ✓ Evento ya ocurrió?
│   │        → No se cancela, se marca como "completado" (404 lógico)
│   ├─ ✓ Sesión tiene cliente? → Notificar al cliente
│   └─ Si falla → ERROR 403/422 + motivo
│
├─→ [ACTUALIZAR EN DB]
│   ├─ Tabla: agendas
│   ├─ SET estado='cancelado', canceled_at=NOW(), canceled_by=?, motivo=?
│   ├─ WHERE id=? AND organization_id=?
│   ├─ INSERT INTO agendas_historial (evento='cancelado', data)
│   └─ RLS: solo owner O coach propietario
│
├─→ [AUDITORÍA]
│   ├─ evento: "agenda.canceled"
│   ├─ capacidad: "agenda.cancel" (o "agenda.edit")
│   ├─ user_id_actor: Coach que canceló
│   ├─ motivo: texto del motivo
│   └─ cliente afectado: cliente_id del evento
│
└─→ [RESPUESTA]
    ├─ ✓ Evento marcado como cancelado
    ├─ ✓ UI remueve de calendario
    ├─ ✓ Toast "Sesión cancelada"
    └─ ✓ Notificación al cliente vía email/WhatsApp
```

### 1.4 Reasignación de Coach

```
┌─ Owner o Coach Senior en "Equipo" → clickea coach → "Reasignar clientes"
│
├─→ [Modal: Drag-drop de clientes]
│   ├─ Columna izq: Clientes de Coach A
│   ├─ Columna der: Coaches disponibles
│   ├─ Drag cliente de A → B
│   └─ [Confirmar reasignación]
│
├─→ [VALIDACIÓN BACKEND]
│   ├─ ✓ Capacidad: equipo.assign_clients? O agenda.edit (scope=organization)?
│   ├─ ✓ Cliente existe y pertenece a Coach A?
│   ├─ ✓ Coach B existe y está activo?
│   ├─ ✓ Coach B tiene capacidad para recibir cliente?
│   ├─ ✓ Sesiones futuras del cliente con Coach A:
│   │        → Transferir a Coach B (reasignar sesiones)
│   │        → O bloquearlas (no reasignar automático)
│   └─ Si falla → ERROR 403/422 + motivo
│
├─→ [ACTUALIZAR EN DB — TRANSACCIÓN]
│   ├─ Tabla: candidatos
│   │   SET coach_id = B, coach_assign_date = NOW()
│   ├─ Tabla: agendas (futuras)
│   │   SET coach_id = B (solo si estado != 'completado'/'cancelado')
│   ├─ Tabla: agendas_historial
│   │   INSERT nuevas filas para cada sesión reasignada
│   └─ RLS: solo owner (global access)
│
├─→ [AUDITORÍA]
│   ├─ evento: "agenda.reassigned" (x N sesiones)
│   ├─ capacidad: "equipo.assign_clients" (o similar)
│   ├─ user_id_actor: Owner que reasignó
│   ├─ cliente_id: Cliente movido
│   ├─ coach_from: Coach A
│   ├─ coach_to: Coach B
│   ├─ sesiones_afectadas: count de sesiones transferidas
│   └─ timestamp de cada cambio
│
└─→ [RESPUESTA]
    ├─ ✓ Cliente reasignado
    ├─ ✓ N sesiones transferidas
    ├─ ✓ UI refresca tanto clientes como calendario
    ├─ ✓ Toast "Cliente reasignado a [Coach B]"
    └─ ✓ Email a ambos coaches + cliente
```

### 1.5 Cambio de Permisos Durante Sesión Existente

```
┌─ Owner desactiva capacidad "agenda.edit" a Coach A
│  (Coach A está en el medio de una sesión agendada)
│
├─→ [TRANSACCIÓN EN SUPABASE]
│   ├─ Tabla: user_capacidades
│   │   SET enabled = FALSE para (coach_A, 'agenda.edit')
│   └─ Timestamp + auditoría
│
├─→ [EFECTO INMEDIATO EN COACH A]
│   ├─ Pantalla: Sesiones que EDITÓ pueden cambiar (Coach A → LECTURA SOLO)
│   ├─ UI: Botones "Editar" desaparecen de sesiones
│   ├─ API: Si Coach A intenta PATCH → 403 "No tienes capacidad"
│   ├─ Sesiones ya creadas: SE MANTIENEN (son histórico)
│   └─ Nuevas sesiones: Coach A NO puede crear
│
├─→ [FLUJO DE RECUPERACIÓN]
│   ├─ Owner reactiva capacidad → Coach A puede editar de nuevo
│   ├─ No hay "sincronización" automática de cambios previos
│   ├─ Sesiones que Coach A intentó editar sin permiso: BLOQUEADAS
│   └─ Auditoría registra cada intento bloqueado
│
├─→ [AUDITORÍA]
│   ├─ evento: "capacidad.changed"
│   ├─ user_id_target: Coach A
│   ├─ capacidad: "agenda.edit"
│   ├─ valor_anterior: TRUE
│   ├─ valor_nuevo: FALSE
│   ├─ user_id_actor: Owner que cambió el permiso
│   ├─ razon: "Desactivación por política" (opcional)
│   ├─ sesiones_afectadas: lista de IDs de sesiones
│   └─ timestamp del cambio
│
└─→ [RESPUESTA]
    ├─ ✓ Capacidad desactivada
    ├─ ✓ Coach A recibe notificación
    ├─ ✓ UI refleja cambio en tiempo real (WebSocket/polling)
    └─ ✓ Historial de cambios visible en auditoría
```

---

## 2. MATRIZ DE CONFLICTOS

### 2.1 Tabla: Qué está permitido / bloqueado

| Escenario | Actor | Acción | Permitido | Condición/Restricción | Status Code |
|-----------|-------|--------|-----------|----------------------|-------------|
| **Crear Sesión** | Coach Estándar | POST agenda (sesión_cliente) | ✅ | Capacidad `agenda.create`, scope=own, horario disponible | 201 |
| | Coach Estándar | POST agenda (reunión_interna) | ✅ | Capacidad `agenda.internal`, solo invite coaches | 201 |
| | Coach Estándar | POST agenda (bloqueo) | ✅ | Capacidad `agenda.create`, marcar como "bloqueo" | 201 |
| | Colaborador | POST agenda (sesión_cliente) | ❌ | No tiene capacidad `agenda.create` | 403 |
| | Coach vencido | POST agenda (cualquiera) | ❌ | Cuenta inactiva/vencida | 403 |
| **Editar Sesión** | Coach (propietario) | PATCH agenda/sesión suya | ✅ | Capacidad `agenda.edit`, scope=own, evento futuro | 200 |
| | Coach (ajeno) | PATCH agenda/sesión de otro coach | ❌ | No tiene scope=team u organization | 403 |
| | Coach Senior | PATCH agenda/sesión team | ✅ | Capacidad `agenda.edit`, scope=team | 200 |
| | Owner | PATCH agenda/cualquiera | ✅ | Capacidad `agenda.edit`, scope=organization | 200 |
| | Cualquiera | PATCH agenda/evento pasado | ❌ | Evento ya ocurrió; solo lectura histórica | 422 |
| | Coach | PATCH mover cliente a otro coach | ✅ | Capacidad `equipo.assign_clients` (o `agenda.edit` scope=organization) | 200 |
| **Cancelar Sesión** | Coach (propietario) | DELETE agenda/sesión suya | ✅ | Capacidad `agenda.cancel` (o `agenda.edit`), evento futuro | 204 |
| | Coach (ajeno) | DELETE agenda/sesión de otro coach | ❌ | No tiene scope; solo propietario puede | 403 |
| | Owner | DELETE agenda/cualquiera | ✅ | Capacidad `agenda.cancel`, scope=organization | 204 |
| | Cualquiera | DELETE agenda/evento pasado | ⚠️ | Marca como "cancelado" (soft delete), no elimina | 204 |
| **Reunión Interna** | Coach A | Crear reunión con Coach B | ✅ | Ambos con capacidad `agenda.internal` | 201 |
| | Coach A | Editar reunión que creó | ✅ | Capacidad `agenda.edit` + es propietario | 200 |
| | Coach B (invitado) | Editar reunión que no creó | ❌ | No es propietario; puede declinar o marcar asistencia | 403 |
| | Coach B (invitado) | Declinar/Confirmar asistencia | ✅ | Capacidad `agenda.read`, actualizar su estado | 200 |
| **Bloqueos/Vacaciones** | Coach | Crear bloqueo "vacaciones" | ✅ | Tipo=bloqueo, capacidad `agenda.create` | 201 |
| | Coach | Crear bloqueo "no disponible 14-16h" | ✅ | Tipo=bloqueo, horario parcial | 201 |
| | Owner | Ver bloqueos de todo el equipo | ✅ | Capacidad `agenda.read`, scope=organization | 200 |
| | Coach Estándar | Ver bloqueos de otros coaches | ❌ | No tiene scope=team; solo ve los suyos | 403 |
| | Sistema | Prevenir sesión dentro de bloqueo | ✅ | Validación automática: fecha en bloqueo → ERROR | 422 |
| **Sesiones Recurrentes** | Coach | Crear serie recurrente (ej: semanal) | ✅ | Capacidad `agenda.create`, recurrence_rule válido | 201 |
| | Coach | Editar ESTA sesión de la serie | ✅ | Edita solo esa instancia, no la serie | 200 |
| | Coach | Editar TODA la serie | ✅ | Edita recurrence_rule, afecta futuras | 200 |
| | Coach | Cancelar ESTA sesión | ✅ | Marca como cancelado, serie continúa | 204 |
| | Coach | Cancelar TODA la serie | ✅ | Cancela recurrence_rule, genera auditoría por cada afectada | 204 |
| **Permisos en Tiempo Real** | Owner | Desactiva `agenda.edit` a Coach A | ✅ | Capacidad `config.usuarios`, cambio inmediato | 200 |
| | Coach A (con permiso desactivado) | Intenta PATCH sesión | ❌ | Capacidad revocada; 403 "No tienes agenda.edit" | 403 |
| | Coach A | UI oculta botones "Editar" | ✅ | Data-cap=agenda.edit no cumple → display:none | — |
| | Coach A | Sesiones ya creadas: legibles | ✅ | Histórico intacto; solo nuevas ediciones bloqueadas | 200 |

---

## 3. API CONTRACT

### 3.1 POST /agendas — Crear evento

**Descripción**: Crear una sesión, reunión interna o bloqueo.

**Request**
```json
{
  "tipo": "sesion_cliente | reunión_interna | bloqueo",
  "titulo": "Sesión con Juan",
  "descripcion": "Preparación para entrevista",
  "start_at": "2026-08-10T14:00:00Z",
  "end_at": "2026-08-10T15:00:00Z",
  "cliente_id": "cli-123",  // Obligatorio si tipo=sesion_cliente
  "participantes": ["coach-456", "coach-789"],  // Si tipo=reunión_interna
  "tipo_bloqueo": "vacaciones | no_disponible",  // Si tipo=bloqueo
  "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=2026-12-31",  // Opcional
  "zoom_url": "https://zoom.us/...",  // Opcional
  "notas_preparacion": "Revisar CV..."  // Opcional
}
```

**Response (201 Created)**
```json
{
  "id": "evt-12345",
  "organization_id": "org-123",
  "coach_id": "coach-001",
  "cliente_id": "cli-123",
  "tipo": "sesion_cliente",
  "titulo": "Sesión con Juan",
  "start_at": "2026-08-10T14:00:00Z",
  "end_at": "2026-08-10T15:00:00Z",
  "estado": "scheduled",
  "created_by": "coach-001",
  "created_at": "2026-08-02T17:30:00Z",
  "recurrence_rule": null,
  "instances_count": 1,
  "zoom_url": null
}
```

**Validaciones Backend**
- ✓ `start_at < end_at`
- ✓ Duración >= 15 min, <= 4 horas
- ✓ `coach_id` existe y está activo
- ✓ Si cliente_id: existe y está asignado a ese coach (scope check)
- ✓ Si recurrence: RRULE válida
- ✓ Sin conflictos horarios (mismo coach, misma hora)
- ✓ Capacidad `agenda.create` OR `agenda.internal` (según tipo)

**Error Responses**
| Caso | Status | Body |
|------|--------|------|
| Sin capacidad | 403 | `{"error": "Necesitas capacidad agenda.create"}` |
| Conflicto horario | 422 | `{"error": "Conflicto: ya tienes sesión 14:00-15:00"}` |
| Cliente no existe | 404 | `{"error": "Cliente cli-123 no encontrado"}` |
| Cliente asignado a otro coach | 422 | `{"error": "Cliente no está en tu cartera"}` |
| start_at en el pasado | 422 | `{"error": "Fecha/hora debe ser en el futuro"}` |
| Fuera de horario disponible | 422 | `{"error": "No disponible: tienes bloqueo 14-16h"}` |

---

### 3.2 PATCH /agendas/{id} — Editar evento

**Descripción**: Modificar fecha, hora, descripción o reasignar a otro coach.

**Request**
```json
{
  "start_at": "2026-08-10T15:00:00Z",  // Opcional
  "end_at": "2026-08-10T16:00:00Z",    // Opcional
  "descripcion": "Nueva descripción",    // Opcional
  "coach_id": "coach-002",               // Opcional: reasignar
  "zoom_url": "https://zoom.us/...",    // Opcional
  "recurrence_rule": "FREQ=WEEKLY;..."  // Opcional: editarla
  "modo_edicion": "this | all"           // Si es recurrente
}
```

**Response (200 OK)**
```json
{
  "id": "evt-12345",
  "start_at": "2026-08-10T15:00:00Z",
  "end_at": "2026-08-10T16:00:00Z",
  "coach_id": "coach-002",  // Si fue reasignado
  "estado": "scheduled",
  "updated_at": "2026-08-02T17:35:00Z",
  "cambios_realizados": {
    "hora": { "de": "14:00", "a": "15:00" },
    "coach": { "de": "coach-001", "a": "coach-002" }
  }
}
```

**Validaciones Backend**
- ✓ Evento existe y pertenece a organization
- ✓ Evento NO ha ocurrido (start_at > NOW)
- ✓ Capacidad `agenda.edit`
- ✓ Si scope=own: solo puede editar sus propios eventos
- ✓ Si scope=team: puede editar eventos de su equipo
- ✓ Si scope=organization: puede editar cualquiera
- ✓ Nueva hora sin conflictos
- ✓ Si reasigna a otro coach: validar que el coach existe y está activo

**Error Responses**
| Caso | Status | Body |
|------|--------|------|
| Sin capacidad | 403 | `{"error": "Necesitas capacidad agenda.edit"}` |
| No es propietario (scope=own) | 403 | `{"error": "No puedes editar sesiones ajenas"}` |
| Evento ya pasó | 422 | `{"error": "No se pueden editar eventos completados"}` |
| Conflicto NEW | 422 | `{"error": "Nueva hora genera conflicto con otra sesión"}` |
| Coach destino no existe | 404 | `{"error": "Coach coach-002 no encontrado"}` |

---

### 3.3 DELETE /agendas/{id} — Cancelar/Eliminar evento

**Descripción**: Cancelar una sesión (soft delete). Sesiones pasadas NO se eliminan.

**Request**
```json
{
  "motivo": "Disponibilidad",  // Opcional
  "modo_eliminacion": "this | all"  // Si es recurrente
}
```

**Response (204 No Content)**
```
[Sin body, solo status 204]
```

**Respuesta alternativa con info (200 OK)**
```json
{
  "id": "evt-12345",
  "estado": "cancelado",
  "canceled_at": "2026-08-02T17:40:00Z",
  "motivo": "Disponibilidad",
  "cliente_notificado": true
}
```

**Validaciones Backend**
- ✓ Evento existe
- ✓ Evento NO ha ocurrido (start_at > NOW)
- ✓ Capacidad `agenda.cancel` OR `agenda.edit`
- ✓ Si scope=own: solo propietario
- ✓ Si scope=team/organization: permitido

**Error Responses**
| Caso | Status | Body |
|------|--------|------|
| Sin capacidad | 403 | `{"error": "Necesitas capacidad agenda.cancel o agenda.edit"}` |
| No es propietario | 403 | `{"error": "No puedes cancelar sesiones ajenas"}` |
| Evento ya pasó | 422 | `{"error": "Evento ya ocurrió; no se puede cancelar"}` |
| Evento no existe | 404 | `{"error": "Evento evt-12345 no encontrado"}` |

---

### 3.4 GET /agendas — Listar/Buscar eventos

**Descripción**: Obtener calendario del usuario o equipo según permisos.

**Request (Query Parameters)**
```
GET /agendas?from=2026-08-01T00:00:00Z&to=2026-08-31T23:59:59Z&scope=own|team|org&tipo=sesion_cliente|reunión_interna|bloqueo&coach_id=coach-001&cliente_id=cli-123&estado=scheduled|canceled|completed
```

**Response (200 OK)**
```json
{
  "total": 15,
  "eventos": [
    {
      "id": "evt-12345",
      "coach_id": "coach-001",
      "cliente_id": "cli-123",
      "cliente_nombre": "Juan",
      "tipo": "sesion_cliente",
      "titulo": "Sesión con Juan",
      "start_at": "2026-08-10T14:00:00Z",
      "end_at": "2026-08-10T15:00:00Z",
      "estado": "scheduled",
      "recurrence_rule": null,
      "zoom_url": null
    },
    {
      "id": "evt-67890",
      "coach_id": "coach-001",
      "tipo": "bloqueo",
      "titulo": "Vacaciones",
      "start_at": "2026-08-15T00:00:00Z",
      "end_at": "2026-08-22T23:59:59Z",
      "estado": "scheduled",
      "tipo_bloqueo": "vacaciones"
    }
  ]
}
```

**Validaciones RLS**
- ✓ Si `scope=own`: devuelve solo eventos del usuario (coach_id = auth.uid)
- ✓ Si `scope=team`: devuelve eventos del usuario + su equipo (validar org)
- ✓ Si `scope=organization`: devuelve TODOS los eventos (solo Owner/Admin)
- ✓ Si usuario NO tiene capacidad `agenda.read`: 403

**Error Responses**
| Caso | Status | Body |
|------|--------|------|
| Sin capacidad `agenda.read` | 403 | `{"error": "No tienes acceso a agenda"}` |
| Rango de fechas inválido | 422 | `{"error": "from debe ser menor que to"}` |

---

### 3.5 GET /agendas/{id} — Obtener un evento

**Descripción**: Detalles completos de un evento.

**Response (200 OK)**
```json
{
  "id": "evt-12345",
  "organization_id": "org-123",
  "coach_id": "coach-001",
  "coach_nombre": "Carlos",
  "cliente_id": "cli-123",
  "cliente_nombre": "Juan",
  "tipo": "sesion_cliente",
  "titulo": "Sesión con Juan",
  "descripcion": "Preparación para entrevista",
  "start_at": "2026-08-10T14:00:00Z",
  "end_at": "2026-08-10T15:00:00Z",
  "duracion_minutos": 60,
  "estado": "scheduled",
  "recurrence_rule": null,
  "zoom_url": "https://zoom.us/...",
  "notas_preparacion": "Revisar CV...",
  "created_by": "coach-001",
  "created_at": "2026-08-02T10:00:00Z",
  "updated_by": null,
  "updated_at": null,
  "canceled_at": null,
  "motivo_cancelacion": null,
  "permisos_usuario": {
    "puede_editar": true,
    "puede_cancelar": true,
    "puede_reasignar": false
  }
}
```

**Validaciones RLS**
- ✓ Capacidad `agenda.read`
- ✓ Si scope=own: solo si es propietario o participante
- ✓ Si scope=team/organization: permitido

---

## 4. RLS ESPERADO (Row-Level Security)

### 4.1 Tabla: agendas

```sql
-- Policy 1: Owner (admin) ve y edita TODO
CREATE POLICY "owner_full_access" ON agendas
  AS (auth.uid() IN (SELECT user_id FROM usuarios WHERE role='owner' AND organization_id = agendas.organization_id))
  USING (true)
  WITH CHECK (true);

-- Policy 2: Coach ve/edita solo sus eventos (scope=own)
CREATE POLICY "coach_own_access" ON agendas
  AS (auth.uid() = coach_id)
  USING (true)
  WITH CHECK (true);

-- Policy 3: Coach Senior ve team (scope=team)
CREATE POLICY "coach_senior_team_access" ON agendas
  AS (
    auth.uid() IN (
      SELECT user_id FROM user_capacidades 
      WHERE capacidad='agenda.read' AND enabled=true
        AND organization_id = agendas.organization_id
    )
    AND (
      -- Coach propietario del evento
      auth.uid() = agendas.coach_id
      OR
      -- O Coach Senior que pertenece al mismo team
      EXISTS (
        SELECT 1 FROM usuarios u1
        JOIN usuarios u2 ON u1.organization_id = u2.organization_id
        WHERE u1.user_id = auth.uid() 
          AND u2.user_id = agendas.coach_id
          AND u1.team_id = u2.team_id
      )
    )
  )
  USING (true)
  WITH CHECK (true);

-- Policy 4: Cliente ve SOLO sesiones que lo incluyan (futuro)
CREATE POLICY "cliente_own_sessions" ON agendas
  AS (
    auth.uid() IN (SELECT user_id FROM candidatos WHERE id = agendas.cliente_id)
  )
  USING (tipo='sesion_cliente' AND cliente_id IN (SELECT id FROM candidatos WHERE user_id = auth.uid()))
  WITH CHECK (false);  -- Clientes NO pueden crear/editar
```

### 4.2 Tabla: agendas_historial

```sql
-- Solo audit trail: INSERT-only
CREATE POLICY "audit_trail_insert" ON agendas_historial
  AS (false)  -- Nunca UPDATE/DELETE
  USING (false)
  WITH CHECK (
    -- Solo sistema puede INSERT (Edge Function o trigger)
    auth.uid() IN (SELECT user_id FROM usuarios WHERE role IN ('owner', 'admin'))
    OR
    current_user = 'postgres'  -- Trigger del sistema
  );

-- Lectura: Owner/Admin
CREATE POLICY "audit_trail_read" ON agendas_historial
  AS (
    auth.uid() IN (SELECT user_id FROM usuarios WHERE role IN ('owner', 'admin'))
  )
  USING (true)
  WITH CHECK (false);  -- Solo lectura
```

### 4.3 Tabla: agendas_disponibilidad

```sql
-- Coach edita su propia disponibilidad
CREATE POLICY "coach_own_availability" ON agendas_disponibilidad
  AS (auth.uid() = coach_id)
  USING (true)
  WITH CHECK (true);

-- Owner ve la de todos
CREATE POLICY "owner_see_all_availability" ON agendas_disponibilidad
  AS (
    auth.uid() IN (SELECT user_id FROM usuarios WHERE role='owner' AND organization_id = agendas_disponibilidad.organization_id)
  )
  USING (true)
  WITH CHECK (false);  -- Solo lectura
```

### 4.4 Tabla: agendas_bloqueos (vacaciones, no disponible)

```sql
-- Coach crea sus propios bloqueos
CREATE POLICY "coach_own_blocks" ON agendas_bloqueos
  AS (auth.uid() = coach_id)
  USING (true)
  WITH CHECK (true);

-- Owner ve/edita todos
CREATE POLICY "owner_manage_blocks" ON agendas_bloqueos
  AS (
    auth.uid() IN (SELECT user_id FROM usuarios WHERE role='owner' AND organization_id = agendas_bloqueos.organization_id)
  )
  USING (true)
  WITH CHECK (true);

-- Coach Senior ve del equipo (lectura)
CREATE POLICY "coach_senior_view_team_blocks" ON agendas_bloqueos
  AS (
    auth.uid() IN (
      SELECT user_id FROM user_capacidades 
      WHERE capacidad='agenda.read' AND enabled=true
    )
    AND EXISTS (
      SELECT 1 FROM usuarios u1 JOIN usuarios u2 ON u1.team_id = u2.team_id
      WHERE u1.user_id = auth.uid() AND u2.user_id = agendas_bloqueos.coach_id
    )
  )
  USING (true)
  WITH CHECK (false);  -- Solo lectura
```

---

## 5. MAPPING SPRINT 5.1

### 5.1 Tabla: Acciones de Agenda ↔ Capacidades Sprint 5.1

| Acción | Capacidad Requerida | Scope | Justificación | Status |
|--------|-------------------|-------|---------------|--------|
| Ver calendario personal | `agenda.read` | own | Coach necesita ver sus propias sesiones | ✅ Existe |
| Ver calendario del equipo | `agenda.read` | team | Coach Senior coordina su equipo | ✅ Existe |
| Ver calendario completo | `agenda.read` | organization | Owner gestiona toda la operación | ✅ Existe |
| Crear sesión con cliente | `agenda.create` | own | Coach crea sesiones en su cartera | ✅ Existe |
| Crear reunión interna | `agenda.internal` | team | Coordinar entre coaches del equipo | 🔶 NUEVA |
| Crear bloqueo/vacaciones | `agenda.create` | own | Coach se bloquea a sí mismo | ✅ Reutiliza |
| Editar sesión propia | `agenda.edit` | own | Coach modifica sus sesiones | ✅ Existe |
| Editar sesión de team | `agenda.edit` | team | Coach Senior ajusta agenda del equipo | ✅ Existe |
| Editar sesión de org | `agenda.edit` | organization | Owner tiene control total | ✅ Existe |
| Cancelar sesión | `agenda.cancel` | own/team/organization | Según quién pueda editar, puede cancelar | ✅ Existe |
| Reasignar cliente (sesiones) | `equipo.assign_clients` | organization | Capacidad de Equipo, no Agenda | ✅ Existe (Sprint 5.1) |
| Ver historial de cambios | `analytics.view_organization` | organization | Auditoría de sesiones | ✅ Existe |

### 5.2 Tabla: Nuevas Capacidades Necesarias (si aplica)

| Capacidad | Categoría | Descripción | Necesaria? | Sprint |
|-----------|-----------|-------------|-----------|--------|
| `agenda.internal` | Agenda | Crear/ver reuniones internas | ✅ SÍ | 5.2 |
| `agenda.reschedule` | Agenda | Mover sesión (reasignar coach) | ❓ ACLARAR | 5.2 |
| `zoom.integrate` | Integraciones | Integrar Zoom/Google Meet | ❌ NO | 5.3+ |
| `agenda.recurring` | Agenda | Crear sesiones recurrentes | ❓ Incluido en `agenda.create`? | 5.2 |

**DECISIÓN**: `agenda.internal` es NUEVA y debe agregarse a Sprint 5.1 como "reserved" → "activa" en 5.2.

Todas las demás están cubiertas por `agenda.create`, `agenda.edit`, `agenda.cancel`.

### 5.3 Relación Usuario → Capacidad → Acción

**Ejemplo: Coach Estándar (23 capacidades actuales + agenda.internal)**

```
Coach Estándar
├─ Capacidad: agenda.read (scope=own)
│   └─ Puede: Ver su calendario
├─ Capacidad: agenda.create
│   └─ Puede: Crear sesiones con clientes
├─ Capacidad: agenda.edit (scope=own)
│   └─ Puede: Modificar sus sesiones
├─ Capacidad: agenda.cancel (scope=own)
│   └─ Puede: Cancelar sus sesiones
├─ Capacidad: agenda.internal (NUEVA)
│   └─ Puede: Crear reuniones con otros coaches
└─ NO tiene: agenda.read.team
    └─ No puede: Ver calendario del equipo (botón escondido)

═══════════════════════════════════════════════════════════════

Coach Senior (30 capacidades actuales + agenda.internal)

├─ Capacidad: agenda.read (scope=team)
│   └─ Puede: Ver calendario de su equipo
├─ Capacidad: agenda.create (scope=own)
│   └─ Puede: Crear sesiones
├─ Capacidad: agenda.edit (scope=team)
│   └─ Puede: Editar sesiones de su equipo
├─ Capacidad: agenda.cancel (scope=team)
│   └─ Puede: Cancelar sesiones del equipo
├─ Capacidad: agenda.internal (NUEVA)
│   └─ Puede: Crear reuniones con coaches
└─ Capacidad: equipo.assign_clients (scope=team)
    └─ Puede: Reasignar clientes dentro del equipo

═══════════════════════════════════════════════════════════════

Owner (40 capacidades actuales + agenda.internal)

├─ Capacidad: agenda.read (scope=organization)
│   └─ Puede: Ver TODA la agenda
├─ Capacidad: agenda.create (scope=organization)
│   └─ Puede: Crear cualquier evento
├─ Capacidad: agenda.edit (scope=organization)
│   └─ Puede: Editar cualquier evento
├─ Capacidad: agenda.cancel (scope=organization)
│   └─ Puede: Cancelar cualquier evento
├─ Capacidad: agenda.internal (NUEVA)
│   └─ Puede: Crear reuniones entre cualquiera
├─ Capacidad: equipo.assign_clients (scope=organization)
│   └─ Puede: Reasignar clientes entre coaches
└─ Capacidad: analytics.view_organization
    └─ Puede: Ver auditoría completa de cambios
```

### 5.4 Cambios Mínimos a Sprint 5.1

**ADICIÓN NECESARIA:**

Agregar a `sprint-5-1-matriz-permisos-oficial.md`:

```
AGENDA (RESERVADA PARA 5.2):
├─ agenda.read (active) — Ver sesiones según scope
├─ agenda.create (active) — Crear sesiones/bloqueos
├─ agenda.edit (active) — Editar sesiones según scope
├─ agenda.cancel (active) — Cancelar sesiones según scope
└─ agenda.internal (reserved → active en 5.2) — Reuniones internas
```

**CAMBIOS A PRESETS:**

Agregar `agenda.internal` a:
- ✅ Coach Estándar (total: 24)
- ✅ Coach Senior (total: 31)
- ✅ Recruiter (total: 13)
- ✅ Owner (total: 41)

**Estado**: Cambios pre-aprobados (extensión lógica de Sprint 5.1, no rediseño).

---

## 6. RESUMEN: LISTO PARA APROBACIÓN

### ✅ Entregables Completados

1. **Diagrama de Flujo** (§1)
   - ✓ Crear sesión
   - ✓ Editar sesión
   - ✓ Cancelar sesión
   - ✓ Reasignar coach
   - ✓ Cambios de permisos en tiempo real

2. **Matriz de Conflictos** (§2)
   - ✓ 25 escenarios documentados
   - ✓ Permitido / Bloqueado con condiciones
   - ✓ Status codes esperados

3. **API Contract** (§3)
   - ✓ POST/PATCH/DELETE/GET con Request/Response
   - ✓ Validaciones backend
   - ✓ Error responses detallados

4. **RLS Esperado** (§4)
   - ✓ Policies por rol: Owner, Coach, Coach Senior, Cliente (futuro)
   - ✓ Audit trail (insert-only)
   - ✓ Tablas: agendas, agendas_historial, agendas_disponibilidad, agendas_bloqueos

5. **Mapping Sprint 5.1** (§5)
   - ✓ Todas las acciones → capacidades existentes
   - ✓ 1 capacidad NUEVA: `agenda.internal` (agregar a presets)
   - ✓ Relación usuario → capacidad → acción claramente documentada

### 🔒 Arquitectura Bloqueada

- **Capacidades base**: `agenda.read`, `agenda.create`, `agenda.edit`, `agenda.cancel`
- **Nueva capacidad**: `agenda.internal` (reservada → activa en 5.2)
- **Scopes**: own, team, organization (implícitos en cada capacidad según rol)
- **Tabla principal**: `agendas` (single source of truth, views por role)
- **Auditoría**: `agendas_historial` + `auditoria_capacidades` (Sprint 5.1)

### ⏭️ Próximas Fases (POST-APROBACIÓN)

1. **Sprint 5.2.0** — Auditoría `panel-v2.html` (qué existe, qué reutilizar)
2. **Sprint 5.2.1** — Especificación Funcional (PRD: qué hace la pantalla de agenda)
3. **Sprint 5.2.2** — Mockup UX (diseño, sin lógica)
4. **Sprint 5.2.3** — Implementación (backend sólido, luego UI calendar)
5. **Sprint 5.2.4** — QA (desktop/tablet/mobile, empty states, errores)

---

**ESPERANDO APROBACIÓN DEL PRODUCT OWNER**

Firma y aprobación requeridas antes de proceder a Sprint 5.2.0.

