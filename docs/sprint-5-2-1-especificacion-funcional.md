# Sprint 5.2.1 — Especificación Funcional: Agenda

**Fecha**: 2026-08-02  
**Basada en**: sprint-5-2-technical-design-review.md v2.1 (Aprobado)  
**Estado**: 🔍 ESPECIFICACIÓN (SIN CÓDIGO, SIN DISEÑO)  
**Entrega**: PRD mini que describe qué hace el módulo de Agenda

---

## 0. PROPÓSITO

El módulo de Agenda permite a coaches y organizaciones:
- **Crear sesiones** con clientes, otros coaches, o talleres grupales
- **Gestionar disponibilidad** (horarios de trabajo, vacaciones, bloqueos)
- **Coordinar equipos** (ver calendario del equipo, reasignar clientes)
- **Registrar asistencia** (qué ocurrió real, no solo qué fue programado)
- **Auditar todo** (quién cambió qué, cuándo, por qué)

**No es solo un calendario bonito.** Es el **núcleo operativo de MultiCoach**.

---

## 1. ACTORES Y PERMISOS

### 1.1 Coach Estándar

**¿Quién es?** Profesional que atiende clientes directamente.

**Permisos**:
- ✅ `agenda.read` (scope=own) — Ver sus propias sesiones
- ✅ `agenda.create` — Crear sesiones con clientes
- ✅ `agenda.edit` (scope=own) — Editar sus sesiones
- ✅ `agenda.cancel` (scope=own) — Cancelar sus sesiones
- ✅ `agenda.internal` — Crear/ver reuniones con otros coaches
- ❌ `agenda.read.team` — No ver calendario de otros coaches
- ❌ `equipo.assign_clients` — No reasignar clientes

**Vista de calendario**:
```
Lunes 10 agosto 2026

09:00 — 10:00   Juan Pérez (sesión_individual)
11:00 — 12:00   Ana García (sesión_individual)
14:00 — 15:30   Taller grupal: 5 participantes
```

---

### 1.2 Coach Senior

**¿Quién es?** Coach experimentado que coordina un equipo pequeño.

**Permisos**:
- ✅ `agenda.read` (scope=team) — Ver calendario de su equipo
- ✅ `agenda.create` — Crear sesiones
- ✅ `agenda.edit` (scope=team) — Editar sesiones de su equipo
- ✅ `agenda.cancel` (scope=team) — Cancelar sesiones del equipo
- ✅ `agenda.internal` — Crear reuniones internas
- ✅ `equipo.assign_clients` (scope=team) — Reasignar clientes dentro del equipo
- ❌ `equipo.assign_clients` (scope=organization) — No reasignar fuera del equipo
- ❌ `analytics.view_organization` — No ver métricas globales

**Vista de calendario**:
```
Lunes 10 agosto 2026

Ana
  09:00 — 10:00   Juan Pérez (sesión)
  14:00 — 15:30   Taller (5 clientes)

Carlos
  11:00 — 12:00   Pedro López (sesión)
  15:00 — 16:00   Reunión interna: Ana, Laura

Laura
  10:00 — 11:00   María García (sesión)
```

---

### 1.3 Owner / Admin

**¿Quién es?** Dueño de la organización, responsable de toda la operación.

**Permisos**:
- ✅ `agenda.read` (scope=organization) — Ver TODO
- ✅ `agenda.create` (scope=organization) — Crear cualquier sesión
- ✅ `agenda.edit` (scope=organization) — Editar cualquier sesión
- ✅ `agenda.cancel` (scope=organization) — Cancelar cualquier sesión
- ✅ `agenda.internal` — Crear reuniones
- ✅ `equipo.assign_clients` (scope=organization) — Reasignar clientes entre coaches
- ✅ `analytics.view_organization` — Ver auditoría + métricas
- ✅ Configurar disponibilidad de coaches
- ✅ Crear bloqueos (vacaciones) de coaches

**Vista de calendario**:
```
Semana del 10 al 16 agosto 2026

Lunes                          Martes                       Miércoles

ANA                            ANA                          ANA
09:00 Juan Pérez              11:00 Workshop (6 clientes)  —
14:00 Workshop (5)            

CARLOS                         CARLOS                       CARLOS
11:00 Pedro López             09:00 María García           10:00 Laura Gómez
15:00 [VACACIONES]            14:00 [VACACIONES]           [VACACIONES TERMINA]

LAURA                          LAURA                        LAURA
10:00 María                    10:00 Ana (reunión interna)  15:00 Sessión
```

---

### 1.4 Colaborador

**¿Quién es?** Asistente que apoya a coaches (administrativo, scheduling, etc.).

**Permisos**: Según capacidades asignadas
- Típicamente: `agenda.read` (scope=team), sin permisos de crear/editar
- O: solo lectura completa si tiene `config.usuarios`

**Vista**: Igual que Coach Senior (si lo asignan a un equipo).

---

### 1.5 Cliente (Futuro — Sprint 5.3+)

**¿Quién es?** Persona que recibe coaching.

**Permisos**:
- ✅ Ver sus propias sesiones (scope=own)
- ✅ Confirmar/declinar sesión
- ✅ Request cancelación (pero no bloquea)
- ❌ Crear sesiones
- ❌ Ver otras sesiones

**Vista**: Solo sus sesiones confirmadas.

---

## 2. FLUJOS PRINCIPALES

### 2.1 Crear Sesión Individual

**Actor**: Coach o Owner  
**Capacidad requerida**: `agenda.create`  
**Trigger**: Coach clickea "Crear sesión" en modal o dashboard

**Pasos**:
1. Coach abre modal "Nueva sesión"
2. Completa:
   - Tipo: `sesion_individual`
   - Cliente: dropdown de clientes asignados
   - Fecha: date picker
   - Hora: time picker (respeta disponibilidad del coach)
   - Duración: dropdown (15, 30, 45, 60, 90, 120 minutos)
   - Descripción: texto libre (opcional)
   - Zoom URL: paste (opcional)
3. Backend valida:
   - ✓ Coach existe y está activo
   - ✓ Cliente existe y está asignado a este coach
   - ✓ Fecha/hora en el futuro
   - ✓ Coach NO tiene bloqueo en ese horario
   - ✓ Coach disponible (horario de trabajo)
   - ✓ Sin conflicto horario (mismo coach, misma hora)
4. Inserta en `agendas` con status=`scheduled`
5. Crea registro en `agenda_participantes` (si aplica) — NO para sesión individual
6. Audita en `agendas_historial`: evento=`created`
7. Respuesta: "Sesión creada con Juan Pérez el 10/08 a las 14:00"
8. UI se recarga → sesión aparece en calendario

**Errores posibles**:
```
❌ "Cliente no está asignado a tu cartera"
❌ "Tienes un bloqueo programado 14-16h"
❌ "No disponible fuera de tu horario 9-17h"
❌ "Conflicto: ya tienes sesión a las 14:00"
❌ "No tienes capacidad agenda.create"
```

---

### 2.2 Crear Sesión Grupal (Taller)

**Actor**: Coach o Owner  
**Capacidad requerida**: `agenda.create`  
**Diferencia**: Múltiples clientes participantes

**Pasos**:
1. Coach abre modal "Nueva sesión grupal"
2. Completa:
   - Tipo: `sesion_grupal`
   - Coach principal: auto-completado (el que crea)
   - Título: "Taller de presentaciones"
   - Fecha, hora, duración: igual que individual
   - Descripción: opcional
3. Coach selecciona **participantes** (clientes):
   - Búsqueda/multi-select
   - Mínimo 2, máximo 20 (configurable)
4. Backend valida:
   - ✓ Coach tiene `agenda.create`
   - ✓ Todos los clientes existen (validación de IDs)
   - ✓ Los clientes NO están asignados exclusivamente a otro coach (pueden ser "shared")
5. Inserta en `agendas` (type=`sesion_grupal`, client_id=NULL, coach_id=coach principal)
6. Inserta N filas en `agenda_participantes` (una por cliente, role=`participant`)
7. Audita: evento=`created`, participantes=lista
8. Respuesta: "Taller creado: 5 participantes confirmados"

**Restricciones**:
- No pueden participar clientes de OTRA organización
- Coach principal SIEMPRE debe ser válido (nunca null)
- Máximo 1 taller por coach por día (configurable)

---

### 2.3 Crear Reunión Interna

**Actor**: Coach o Owner  
**Capacidad requerida**: `agenda.internal`  
**Diferencia**: Participantes son coaches/staff, NO clientes

**Pasos**:
1. Coach abre modal "Nueva reunión"
2. Completa:
   - Tipo: `reunion_interna`
   - Título: "Planificación semanal"
   - Participantes: multi-select de coaches
   - Fecha, hora, duración
3. Backend valida:
   - ✓ Todos los participantes son coaches activos
   - ✓ Sin conflictos (cada coach disponible)
4. Inserta en `agendas` (coach_id=NULL, client_id=NULL, type=`reunion_interna`)
5. Inserta N filas en `agenda_participantes` (role=`organizer` para creador, `attendee` para otros)
6. Envía RSVP request a participantes
7. Respuesta: "Reunión creada, invitaciones enviadas"

**RSVP**:
- Cada participante recibe notificación + puede confirmar/declinar
- Si alguien declina: notificación al organizador
- Status de reunión depende de quiénes confirmaron

---

### 2.4 Editar Sesión

**Actor**: Coach propietario, Coach Senior (si scope=team), Owner  
**Capacidad requerida**: `agenda.edit` (scope correspondiente)

**Campos editables**:
- ✅ Hora/fecha (si está en futuro, sin conflictos nuevos)
- ✅ Duración
- ✅ Descripción
- ✅ Zoom URL
- ✅ Participantes (para sesión grupal: agregar/quitar)

**Campos NO editables**:
- ❌ Tipo de sesión (sesion_individual → grupal = crear nueva)
- ❌ Coach principal (reasignar = flujo separado)
- ❌ Cliente (reasignar = flujo separado)

**Si sesión está COMPLETADA**:
- ✅ Editar descripción (correcciones)
- ✅ Editar notas
- ✅ Agregar zoom URL (si faltó)
- ❌ Editar fecha/hora/coach/participantes
- ⚠️ Auditar: "corrección administrativa" + quién + cuándo

**Pasos**:
1. Coach clickea sesión → abre drawer de detalle
2. Coach clickea "Editar"
3. Modal abre con campos editables
4. Coach modifica
5. Backend valida (igual que crear, + sin conflictos nuevos)
6. Actualiza `agendas`
7. Si hubo cambios grandes (fecha, coach): auditar con `data_before`/`data_after`
8. Respuesta: "Sesión actualizada" + cambios mostrados

**Errores posibles**:
```
❌ "No puedes editar una sesión de otro coach"
❌ "Conflicto: otro evento a esa hora"
❌ "Coach no disponible en nuevo horario"
❌ "No puedes editar una sesión completada"
```

---

### 2.5 Cancelar Sesión

**Actor**: Coach propietario (scope=own), Coach Senior (scope=team), Owner  
**Capacidad requerida**: `agenda.cancel` (o `agenda.edit` con scope)

**Restricciones**:
- ✅ Cancelar si status=`scheduled` o `confirmed`
- ❌ NO cancelar si status=`completed` o `cancelled` (ya histórico)
- ✅ Cancelar si start_at > NOW (evento futuro)

**Pasos**:
1. Coach clickea sesión
2. Clickea "Cancelar"
3. Modal de confirmación pide: "¿Razón?" (dropdown: Disponibilidad, Cliente no confirmó, Otra)
4. Coach clickea "Confirmar"
5. Backend:
   - ✓ Actualiza agendas: status=`cancelled`, cancelled_by=coach, cancel_reason=razón
   - ✓ Inserta en agendas_historial: evento=`cancelled`, cambios={status: scheduled→cancelled}
   - ✓ Si hay clientes: envía notificación "La sesión fue cancelada"
   - ✓ Si hay participantes internos: notifica
6. UI: sesión desaparece del calendario
7. Response: "Sesión cancelada" + notificaciones enviadas

**Auditoría registra**:
- Quién canceló
- Cuándo
- Motivo
- Clientes/coaches afectados
- IP + session_id

---

### 2.6 Reasignar Cliente (Cambiar de Coach)

**Actor**: Owner, Coach Senior (scope=team)  
**Capacidad requerida**: `equipo.assign_clients`  
**Scope**: team (dentro equipo) o organization (cualquiera)

**Caso**: Owner mueve "Cliente X" de "Coach A" a "Coach B"

**Pasos**:
1. Owner abre "Equipo" en MultiCoach
2. Selecciona Coach A → drawer abre
3. Clickea "Reasignar clientes"
4. Vista de drag-drop:
   - Izquierda: Clientes de Coach A
   - Derecha: Coaches disponibles
5. Owner arrastra Cliente X a Coach B
6. Confirmación: "¿Reasignar Cliente X a Coach B? Afectará N sesiones futuras"
7. Backend (TRANSACCIÓN):
   - ✓ Actualiza `candidatos`: coach_id = B
   - ✓ Busca sesiones futuras de Cliente X con Coach A
   - ✓ Actualiza `agendas`: coach_id = B (status != completed/cancelled)
   - ✓ Inserta en agendas_historial N registros: evento=`reassigned`, coach_from=A, coach_to=B
   - ✓ Audita en auditoria_capacidades: evento=`agenda.reassigned`, sesiones_afectadas=N
8. Notificaciones:
   - Coach A: "Cliente X reasignado a Coach B (N sesiones)"
   - Coach B: "Cliente X asignado a tu cartera (N sesiones)"
   - Cliente X: "Tu coach cambió a Coach B"
9. Response: "Cliente reasignado, N sesiones actualizadas"

**Rutas alternas**:
- Reasignar todo un equipo a otro coach
- Reasignar solo sesiones futuras (cliente sigue en cartera antigua)

---

### 2.7 Registrar Asistencia (Post-Sesión)

**Actor**: Coach que realizó la sesión  
**Capacidad requerida**: `attendance.register` (prepara para futuro)  
**Trigger**: Coach termina sesión, marca asistencia

**Pasos**:
1. Sesión comenzó hace 1h, ahora son las 16:05
2. Coach clickea sesión completada
3. Drawer de sesión muestra: "¿Cómo fue la sesión?"
4. Coach marca:
   - ✅ Realizada correctamente
   - ✅ Realizada con retrasos (Coach llegó 15 min tarde)
   - ✅ Cliente no se presentó (no_show)
   - ✅ Cancelada última hora (canceled_by_client)
   - Agregar notas: "Cliente llegó enfermo, sesión reducida a 30 min"
5. Backend:
   - ✓ Crea registro en `asistencias`:
     - agenda_id=sesión
     - participant_id=coach
     - status=`completed` (o lo que haya seleccionado)
     - notas=texto
     - marked_by=coach
     - marked_at=NOW
   - ✓ Actualiza `agendas`: status=`completed` (si fue realizada)
   - ✓ Audita: evento=`attendance.registered`
6. Impacto downstream:
   - **Métricas**: +1 sesión completada (solo si status=completed)
   - **Retención**: Si cliente no_show, marcar como "En riesgo"
   - **Cobros**: Si coach cobra por sesión, marcar como `pending` (Sprint 5.3)
7. Response: "Asistencia registrada" + impactos mostrados (futuro)

**Si cliente no registra asistencia**:
- Owner puede hacerlo post-fecha (auditoría marca como "corrección")
- Sistema puede inferir si hay Zoom/Google Meet record

---

### 2.8 Gestionar Disponibilidad

**Actor**: Coach (su propia), Owner (cualquiera)  
**Capacidad requerida**: Implícita (todo coach puede ver su disponibilidad)

**Pasos**:
1. Coach abre "Mi disponibilidad"
2. Grid por día de semana:
   - Lunes: 09:00 - 17:00 ✏️ Editar
   - Martes: 09:00 - 17:00 ✏️ Editar
   - Miércoles: OFF (no trabaja)
   - Etc.
3. Coach clickea día → modal:
   - Toggle "Trabajo este día: ON/OFF"
   - Horario inicio: time picker (09:00)
   - Horario fin: time picker (17:00)
   - Timezone: dropdown (America/Argentina/Buenos_Aires)
4. Backend inserta en `agendas_disponibilidad`:
   - coach_id, day_of_week, hour_start, hour_end, timezone
5. Cuando Coach A crea sesión:
   - Sistema valida contra disponibilidad
   - "No puedes crear sesión fuera de tu disponibilidad"

**Usar para**:
- ✅ Prevenir crear sesiones fuera de horario
- ✅ Mostrar "horas libres" en calendario
- ✅ Sugerir slots disponibles

**NO afecta bloqueos** (eso es diferente).

---

### 2.9 Crear Bloqueo (Vacaciones, No Disponible)

**Actor**: Coach (su propio), Owner (cualquiera)  
**Capacidad requerida**: Implícita

**Tipos de bloqueo**:
- `vacaciones` — Fuera de la ciudad/país
- `no_disponible` — Enfermo, evento personal, etc.
- `otro` — (para futuro)

**Pasos**:
1. Coach abre "Mis bloqueos"
2. Clickea "Agregar bloqueo"
3. Modal:
   - Tipo: dropdown (Vacaciones, No disponible)
   - Desde: date picker (15/08)
   - Hasta: date picker (22/08)
   - Descripción: "Viaje a Argentina"
4. Backend inserta en `agendas_bloqueos`:
   - coach_id, type, start_at, end_at, timezone
5. Validación:
   - ✓ No hay sesiones confirmadas en ese período
   - O: Warning "2 sesiones futuras en ese período, será necesario reasignar"
6. Response: "Bloqueo creado, Coach A no disponible 15-22/08"

**Efecto**:
- Si Coach A intenta crear sesión durante bloqueo:
  - "❌ Tienes un bloqueo (Vacaciones) 15-22/08"
- El bloqueo NO aparece en el calendario del Coach (es invisib), pero el sistema lo ve

---

## 3. ESTADOS Y TRANSICIONES

### 3.1 Estados de Sesión

```
                      ┌─ scheduled (creada, pendiente confirmación)
                      │
                      ├─→ confirmed (coach confirmó con cliente)
                      │
                      ├─→ completed (ocurrió, coach registró asistencia)
                      │
                      ├─→ no_show (alguien no se presentó)
                      │
                      ├─→ cancelled (cancelada)
                      │
                      └─→ rescheduled (temporalmente, vuelve a scheduled)
```

**Transiciones permitidas**:

| Desde | Hacia | Quién | Condición |
|-------|-------|-------|-----------|
| `scheduled` | `confirmed` | Coach/Owner | Manual o automático (si cliente confirmó) |
| `scheduled` | `cancelled` | Coach/Owner | Cualquier momento |
| `scheduled` | `rescheduled` | Coach/Owner | Mover a otra fecha |
| `confirmed` | `completed` | Coach | Post-sesión, registrar asistencia |
| `confirmed` | `no_show` | Coach | Si no se presentaron |
| `confirmed` | `cancelled` | Coach/Owner | Hasta último momento |
| `completed` | (ninguno) | — | HISTÓRICO: inmutable |
| `cancelled` | (ninguno) | — | HISTÓRICO: inmutable |

**Regla**: Una vez `completed` o `cancelled`, no hay marcha atrás.

---

### 3.2 Estados de Asistencia

```
┌─ confirmed (se confirmó que ocurrió)
├─ no_show (alguien no vino)
├─ completed (ocurrió completamente)
├─ canceled_by_coach (coach canceló)
└─ canceled_by_client (cliente canceló)
```

**Impacto**:
| Estado | Cuenta como sesión | Impacta retención | Impacta cobros |
|--------|-------------------|------------------|----------------|
| `confirmed` | ✅ | ✅ | ✅ (si billing=pending) |
| `no_show` | ❌ | ⚠️ (riesgo) | ❌ (sin cobrar) |
| `completed` | ✅ | ✅ | ✅ (si billing=pending) |
| `canceled_by_coach` | ❌ | ⚠️ (leve) | ❌ |
| `canceled_by_client` | ❌ | ⚠️ (riesgo) | ❌ |

---

## 4. VISTAS Y LAYOUTS

### 4.1 Vista del Coach

**Ubicación**: `panel-v2.html` → Tab "Agenda"  
**Datos**: Sus propias sesiones (scope=own)

**Componentes**:
```
┌─ HEADER
│  ├─ "Mi Agenda"
│  ├─ [← Semana anterior] [Semana actual] [Semana siguiente →]
│  └─ [Crear sesión]
│
├─ CALENDARIO (vista mes o semana)
│  ├─ Lunes 10: 09:00-10:00 Juan Pérez [sesion]
│  ├─ Lunes 10: 14:00-15:30 Taller (5 clientes) [grupal]
│  ├─ Martes 11: [sin eventos]
│  └─ Miércoles 12: 15:00-16:00 Reunión (Ana, Carlos) [interna]
│
├─ SIDEBAR (proximamente)
│  ├─ Próximas 5 sesiones
│  ├─ Bloqueos/Vacaciones
│  └─ Mi disponibilidad
│
└─ DRAWER (al clickear sesión)
   ├─ Foto cliente | Nombre | Tipo de sesión
   ├─ Fecha/Hora | Duración | Zoom URL
   ├─ Descripción | Notas
   ├─ Estado: scheduled/confirmed/completed
   ├─ [Editar] [Cancelar] [Registrar asistencia]
   └─ Historial de cambios
```

---

### 4.2 Vista del Coach Senior

**Ubicación**: `multicoach.html` → "Agenda del Equipo"  
**Datos**: Calendario de su equipo (scope=team)

**Componentes**:
```
┌─ HEADER
│  ├─ "Agenda del Equipo"
│  ├─ [Filtrar por: Todos / Solo mi equipo / Por especialidad]
│  ├─ [Semana/Mes/Día]
│  └─ [Crear sesión]
│
├─ VISTA GRUPAL
│  ├─ Ana
│  │  ├─ Lunes: 09:00-10:00 Juan [sesion]
│  │  └─ Martes: [sin eventos]
│  ├─ Carlos
│  │  ├─ Lunes: 11:00-12:00 Pedro [sesion]
│  │  └─ Martes: 14:00-15:00 Reunión [interna]
│  └─ Laura
│     └─ [vacaciones 15-22/08]
│
├─ INDICADORES
│  ├─ Carga de Ana: 8h/semana (50% capacidad)
│  ├─ Carga de Carlos: 12h/semana (75%)
│  └─ Carga de Laura: 0h (bloqueada)
│
└─ ACCIONES
   ├─ Reasignar cliente (drag-drop)
   ├─ Ver detalles de sesión
   └─ Crear sesión del equipo
```

---

### 4.3 Vista del Owner

**Ubicación**: `multicoach.html` → "Agenda Organizacional"  
**Datos**: Todos los coaches y especialidades (scope=organization)

**Componentes**:
```
┌─ HEADER
│  ├─ "Agenda de la Organización"
│  ├─ [Filtrar: Todos / Por especialidad / Por estado]
│  ├─ [Semana/Mes/Día]
│  ├─ [Mostrar métricas: Carga / Asistencia / Retención]
│  └─ [Crear sesión]
│
├─ VISTA SEMANAL (lunes a viernes)
│  ├─ CAREER (especialidad)
│  │  ├─ Ana: 09:00 Juan, 14:00 Taller
│  │  ├─ Carlos: 11:00 Pedro
│  │  └─ [Carga team: 15h/40h = 37.5%]
│  ├─ FITNESS (especialidad)
│  │  ├─ Laura: 10:00 Clase (8), 15:00 Clase (6)
│  │  └─ [Carga team: 10h/30h = 33%]
│  └─ FINANCE (especialidad)
│     └─ [sin coaches activos]
│
├─ INDICATORS
│  ├─ Sesiones esta semana: 47
│  ├─ No-shows: 2 (4.2%)
│  ├─ Retención: 94%
│  └─ Tasa de ocupación: 35% (meta: 80%)
│
└─ QUICK ACTIONS
   ├─ Reasignar cliente
   ├─ Crear bloqueo de coach
   ├─ Buscar sesión
   └─ Ver auditoría
```

---

## 5. EMPTY STATES Y ERRORES

### 5.1 Empty States

**Sin sesiones próximas**:
```
┌─────────────────────────────┐
│  📅                         │
│                             │
│  Sin sesiones próximas      │
│  en los próximos 7 días     │
│                             │
│  [Crear sesión]  [Importar] │
└─────────────────────────────┘
```

**Sin disponibilidad configurada**:
```
┌─────────────────────────────┐
│  ⏰                         │
│                             │
│  No has configurado tu      │
│  disponibilidad            │
│                             │
│  El sistema no puede       │
│  prevenir conflictos       │
│                             │
│  [Configurar ahora]         │
└─────────────────────────────┘
```

**Sin bloqueos**:
```
✓ Disponible toda la semana (sin bloqueos)
```

---

### 5.2 Errores (HTTP + Mensajes)

**400 Bad Request**:
```
"Fecha debe ser en el futuro"
"Duración debe estar entre 15 minutos y 4 horas"
"start_at debe ser menor que end_at"
```

**403 Forbidden**:
```
"No tienes capacidad agenda.create"
"No tienes capacidad agenda.edit.team (es de otro coach)"
"No tienes capacidad equipo.assign_clients"
```

**404 Not Found**:
```
"Sesión no encontrada"
"Coach no existe en tu organización"
"Cliente no está asignado a tu cartera"
```

**422 Unprocessable Entity**:
```
"Conflicto: ya tienes sesión 14:00-14:30 con otro cliente"
"No disponible: tienes bloqueo (Vacaciones) 15-22/08"
"No disponible fuera de tu horario: trabajas 9-17, sesión sería 18:00"
"No puedes editar una sesión completada (solo correcciones administrativas)"
"Coach en bloqueo durante ese período"
"Cliente no puede tener 2 sesiones con el mismo coach en el mismo día"
```

---

## 6. CASOS EDGE

### 6.1 Coach abandona la organización

**Sesiones FUTURAS**:
- Status: `pending_reassignment`
- Owner recibe notificación: "2 sesiones sin asignar (Coach X se fue)"
- Owner puede: Reasignar a otro coach O Cancelar

**Sesiones COMPLETADAS**: Histórico intacto (auditoría).

---

### 6.2 Cliente se elimina (soft delete)

**Sesiones de ese cliente**: SE MANTIENEN.

**Problema**: `candidatos.id` se elimina → `agendas.client_id` queda roto.

**Solución**: Guardar snapshot en agendas:
```javascript
agendas {
  client_id: "cli-789",
  client_name_snapshot: "Juan Pérez",
  client_email_snapshot: "juan@email.com"
}
```

Así el histórico queda legible aunque se borre al cliente.

---

### 6.3 Coach cambia de zona horaria

**Problema**: Coach en Argentina (UTC-3) crea sesión "09:00". ¿09:00 en qué zona?

**Solución**:
```javascript
agendas {
  start_at: "2026-08-10T12:00:00Z",  // UTC siempre en DB
  timezone: "America/Argentina/Buenos_Aires"  // Local del coach
}
```

Cuando se muestra:
- 12:00 UTC → 09:00 en Argentina

Si Coach se muda a España:
- Campo `timezone` ahora: "Europe/Madrid"
- Histórico: conserva zona original
- Nuevas sesiones: zona nueva

---

### 6.4 Sesión grupal con participante que se va

**Si cliente X en taller se elimina**:
- Taller se mantiene (otros 4 siguen)
- Cliente X se marca como "removido" en `agenda_participantes`
- Asistencia del cliente: se borra o marca como "cancelled"

---

### 6.5 Conflictos de zona horaria (reunión interna)

**Ana (Argentina) + Carlos (España) en reunión a las 10:00**

¿Cuál zona?

**Solución**: Guardar ambas zonas en `agenda_participantes`:
```javascript
agenda_participantes {
  participant_id: "coach-ana",
  time_in_timezone: "09:00 ART (UTC-3)"  // Hora local de Ana
}

agenda_participantes {
  participant_id: "coach-carlos",
  time_in_timezone: "14:00 CET (UTC+2)"  // Hora local de Carlos
}
```

Al mostrar la reunión: cada coach ve su propia zona.

---

## 7. RELACIÓN CON CAPACIDADES SPRINT 5.1

### 7.1 Mapeo Directo

| Acción de Agenda | Capacidad Sprint 5.1 | Scope |
|------------------|---------------------|-------|
| Ver sesiones propias | `agenda.read` | own |
| Ver sesiones del equipo | `agenda.read` | team |
| Ver todas las sesiones | `agenda.read` | organization |
| Crear sesión | `agenda.create` | — |
| Editar sesión propia | `agenda.edit` | own |
| Editar sesión del equipo | `agenda.edit` | team |
| Editar sesión de org | `agenda.edit` | organization |
| Cancelar sesión propia | `agenda.cancel` | own |
| Cancelar sesión del equipo | `agenda.cancel` | team |
| Cancelar sesión de org | `agenda.cancel` | organization |
| Crear reunión interna | `agenda.internal` | — |
| Reasignar cliente | `equipo.assign_clients` | team/organization |
| Ver auditoría | `analytics.view_organization` | — |

### 7.2 Capacidades NO nuevas

**Todas las capacidades de Agenda ya están definidas en Sprint 5.1.**

Solo se agregó `agenda.internal` (ya fue aprobada como nuevo en Sprint 5.2.0).

---

## 8. PREPARACIÓN PARA INTEGRACIONES FUTURAS

### 8.1 Google Calendar, Outlook, Calendly

**Campos preparados en Sprint 5.2.1 (sin lógica)**:
```javascript
agendas {
  external_calendar_id: "google-calendar",  // O "outlook", "calendly"
  external_event_id: "abc123def456",        // ID en sistema externo
  external_sync_status: "synced",           // O "pending", "conflict", "failed"
  external_sync_at: "2026-08-02T15:30:00Z",
  external_sync_error: null
}
```

**Lógica de sync**: Sprint 5.3+ (cuando se implemente integración).

---

### 8.2 Recordatorios

**Campos preparados** (ya en schema):
```javascript
agendas {
  reminder_at_1h: true,
  reminder_at_24h: true,
  reminder_sent_1h_at: null,  // Se llena cuando se envía
  reminder_sent_1h_status: "pending",  // pending → sent/failed
  reminder_sent_24h_at: null,
  reminder_sent_24h_status: "pending"
}
```

**Lógica de envío**: Sprint 5.3+ (Edge Function que corre cada hora).

---

## 9. CRITERIOS DE ACEPTACIÓN (QA)

### ✅ Funcionalidad Básica
- [ ] Coach puede crear sesión individual
- [ ] Coach puede ver sus sesiones en calendario
- [ ] Coach puede editar hora/duración de sesión propia
- [ ] Coach puede cancelar sesión propia
- [ ] Coach no puede editar sesión de otro coach
- [ ] Coach no puede ver sesiones de otros coaches
- [ ] Owner puede ver todas las sesiones
- [ ] Owner puede editar/cancelar cualquier sesión

### ✅ Sesiones Grupales
- [ ] Coach puede crear taller con múltiples clientes
- [ ] Tabla agenda_participantes se llena correctamente
- [ ] Eliminar cliente del taller funciona
- [ ] Reasignar taller a otro coach funciona

### ✅ Reuniones Internas
- [ ] Coach puede crear reunión con otros coaches
- [ ] Participantes reciben notificación
- [ ] RSVP funciona
- [ ] No aparecen clientes en participantes

### ✅ Validaciones
- [ ] No crear sesión en el pasado
- [ ] No crear sesión fuera de disponibilidad
- [ ] No crear sesión en bloqueo (vacaciones)
- [ ] Detectar conflicto horario (mismo coach, misma hora)
- [ ] Validar cliente existe y está asignado
- [ ] Validar coach existe y está activo

### ✅ Asistencia
- [ ] Coach puede marcar sesión como completada
- [ ] Coach puede marcar como no_show
- [ ] Auditoría registra marcación
- [ ] Impactos (retención) se calculan

### ✅ Permisos
- [ ] Coach sin `agenda.create` no puede crear
- [ ] Coach sin `agenda.edit.team` no puede editar equipo
- [ ] Owner sin `equipo.assign_clients` no puede reasignar
- [ ] RLS filtra sesiones correctamente

### ✅ Reasignaciones
- [ ] Reasignar cliente actualiza todas las sesiones futuras
- [ ] Auditoría registra reasignación
- [ ] Notificaciones se envían a ambos coaches + cliente

### ✅ Disponibilidad
- [ ] Coach puede configurar disponibilidad
- [ ] Sistema valida sesiones contra disponibilidad
- [ ] Cambiar disponibilidad no afecta sesiones anteriores

### ✅ Bloqueos
- [ ] Coach puede crear bloqueo (vacaciones)
- [ ] Sistema previene crear sesión en bloqueo
- [ ] Bloqueo no aparece en calendario (invisible)

### ✅ UI/UX
- [ ] Calendario renderiza correctamente
- [ ] Drag-drop de reasignación funciona
- [ ] Modal de crear/editar se abre/cierra
- [ ] Estados visuales son claros
- [ ] Responsive (desktop/tablet/mobile)

### ✅ Auditoría
- [ ] Cada acción se registra en agendas_historial
- [ ] Cambios muestran before/after
- [ ] Owner puede ver auditoría completa

---

## 10. ESTADO FINAL

**Especificación Funcional** de Agenda completa.

**Próximos pasos**:
1. ⏳ Sprint 5.2.2 — Mockup UX (diseño sin código)
2. ⏳ Sprint 5.2.3 — Implementación
3. ⏳ Sprint 5.2.4 — QA

---

**ENTREGADO**: PRD mini funcional.  
**LISTO PARA**: Aprobación del Product Owner y diseño visual (Sprint 5.2.2).

