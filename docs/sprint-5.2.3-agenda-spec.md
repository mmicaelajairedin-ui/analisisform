# Sprint 5.2.3 — Especificación Funcional de Agenda (Completa)

**Documento**: Requisitos funcionales para implementación  
**Etapa**: PRD (Pre-Release Specification)  
**Fecha**: 2026-08-03  
**Estado**: 🟡 **PENDIENTE APROBACIÓN** — No implementar hasta validar

---

## Resumen Ejecutivo

Sprint 5.2.3 implementa el **producto Agenda terminado** para MultiCoach:
- **Vista Operativa**: Owner ve/gestiona todo el equipo en un calendario
- **Vista Personal**: Owner entra a la agenda de un coach específico (reutiliza Agenda Coach)
- **Permiso por operación**: Define exactamente qué puede hacer el Owner en cada vista
- **Navegación jerárquica**: Flujo claro Dashboard → Equipo → Coach → Agenda → Volver

**Entregable**: Ambas vistas funcionan, el Owner puede supervisar/gestionar toda la red.

---

## Parte 1: Vista Operativa (Owner)

### Descripción

El Owner ve el **calendario central de la empresa**. Una vista operativa que responde: *"¿Qué está pasando en mi red esta semana?"*

**Usuarios**: Owner, posiblemente Senior Coach (futuro)

**Datos mostrados**:
- Todas las sesiones de todos los coaches (últimos 120 días + futuro)
- Clientes asignados a cada sesión
- Estado de cada sesión (confirmada, pendiente, completada, cancelada)
- Disponibilidad/bloques del equipo
- Google Calendar (si está conectado)
- Conflictos detectados
- KPIs: sesiones hoy, atenciones semana, confirmadas, eventos totales

### Operaciones en Vista Operativa

| Operación | Descripción | Permitido |
|-----------|-------------|-----------|
| **VER agenda** | Ver calendario semanal/mes de toda la org | ✅ Sí |
| **VER KPIs** | Sesiones hoy, atenciones semana, etc. | ✅ Sí |
| **VER estado sesión** | Confirmada, pendiente, completada, cancelada | ✅ Sí |
| **VER Google Calendar** | Si está conectado, sesiones del coach en Google | ✅ Sí |
| **FILTRAR por coach** | Ver solo las sesiones de un coach | ✅ Sí |
| **BUSCAR sesión** | Por cliente, fecha, tipo, coach | ✅ Sí |
| **VER conflictos** | Alertas de coach con overlap ±59 min | ✅ Sí |
| **VER disponibilidad** | Horas/días que cada coach acepta sesiones | ✅ Sí |
| **CREAR sesión** | Nueva sesión para cualquier coach (en esta vista) | ✅ Sí |
| **EDITAR sesión** | Cambiar fecha/hora/tipo/modalidad/lugar | ✅ Sí |
| **CANCELAR sesión** | Marcar como cancelada (persiste en Supabase) | ✅ Sí |
| **REASIGNAR coach** | Mover sesión de un coach a otro | ✅ Sí (ver nota) |
| **BLOQUEAR agenda** | Crear bloque "no disponible" en calendario del coach | ❓ TBD |
| **VER notas coach** | Notas especiales del coach | ✅ Sí (read-only) |
| **AGREGAR nota a sesión** | Notas sobre la sesión | ❓ TBD |

**Nota sobre REASIGNAR**: 
- Si el Owner cambia `coach_id` en una sesión, ¿automáticamente se notifica al nuevo coach?
- ¿Hay validación de conflictos del nuevo coach?
- ¿Se cancela en Google Calendar del coach anterior?
- **Decisión pendiente**: Implementar reasignación completa o solo cambio de coach_id.

### Búsqueda y Filtros

**Búsqueda**:
- Por nombre de cliente
- Por nombre de coach
- Por tipo de sesión
- Por fecha (rango)
- Por estado (confirmada, pendiente, etc.)

**Filtros**:
- Coach (dropdown)
- Estado (multi-select: confirmada, pendiente, completada, cancelada)
- Tipo de sesión
- Rango de fechas

### Estados de Sesión (Mostrados en Operativa)

```
confirmada    → sesión agendada, cliente confirmó
programada    → sesión creada, pendiente confirmación
completada    → sesión ocurrió
cancelada     → sesión cancelada
bloqueado     → bloque de no disponibilidad (no es sesión)
```

**Visualización**: Colores distintos por estado, tooltip al pasar mouse.

---

## Parte 2: Vista Agenda Personal del Coach

### Descripción

El Owner entra a la **agenda personal de un coach específico** mediante navegación jerárquica:

```
MultiCoach Dashboard
    ↓ clickear "Equipo"
Tabla de Coaches
    ↓ clickear coach o "Ver agenda"
Agenda Personal del Coach (Reutilizada)
    ↓ botón "Volver"
Tabla de Coaches
    ↓ (de vuelta al Equipo)
Dashboard
```

**Dato crítico**: No es un filtro de la Vista Operativa. Es el **componente Agenda del Coach** (hoy en panel-v2.html) reutilizado en un nuevo contexto.

**Usuarios**: Owner (supervisando a un coach)

**Datos mostrados**:
- Solo sesiones del coach seleccionado
- Solo clientes del coach
- Disponibilidad del coach
- Bloqueos del coach
- Estado de cada sesión
- Google Calendar del coach (si aplica)

### Matriz de Permisos: ¿Qué puede hacer el Owner?

**ACLARACIÓN IMPORTANTE**: Estos permisos están ABIERTOS. Define qué tiene sentido para el negocio.

| Acción | Owner (en Agenda Personal) | Justificación / Nota |
|--------|---------------------------|---------------------|
| **VER agenda completa** | ✅ Sí | Supervisión básica |
| **VER sesión (detalles)** | ✅ Sí | Información cliente, notas |
| **CREAR sesión en nombre del coach** | ❓ TBD | ¿Puede agendar sin que el coach lo haga? |
| **EDITAR sesión** | ❓ TBD | ¿Puede cambiar hora/tipo/modalidad? |
| **CANCELAR sesión** | ❓ TBD | ¿Puede cancelar sesiones del coach? |
| **REASIGNAR cliente** | ❓ TBD | ¿Puede cambiar cliente de sesión? |
| **BLOQUEAR disponibilidad** | ❓ TBD | ¿Puede crear bloques "no disponible"? |
| **VER notas privadas** | ❓ TBD | ¿Puede ver notas internas del coach? |
| **AGREGAR notas a sesión** | ❓ TBD | ¿Puede documentar observaciones? |
| **ABRIR ficha del cliente** | ❓ TBD | ¿Acceso a datos del cliente desde sesión? |
| **VER Google Calendar coach** | ✅ Sí | Conflictos con calendario personal |
| **CAMBIAR disponibilidad coach** | ❌ No | El coach define su horario |
| **ELIMINAR sesión** | ❌ No | Usar CANCELAR, no eliminar |

### Decisiones Críticas a Tomar

**¿Qué tipo de Owner queremos?**

**Opción A: Owner Supervisor (read-mostly)**
- Ver todo, editar solo en emergencias
- Notas, no cambios
- Acción: ver, reportar, no ejecutar

**Opción B: Owner Operador (full control)**
- Puede hacer todo lo que hace el coach
- Crear, editar, cancelar, bloquear
- Maneja la agenda del coach cuando está fuera

**Opción C: Owner Selective (mixto)**
- Editar ✅ (cambiar hora si hay conflicto)
- Cancelar ✅ (si hay causa válida)
- Crear ❌ (que lo haga el coach)
- Bloquear ❌ (solo el coach)

**Recomendación**: Opción B es más probable en B2B (el Owner necesita operar la red). Pero define el negocio, no yo.

### Cambios Visuales en Agenda Personal

**Breadcrumb**: 
```
Dashboard > Equipo > Agenda de María
```

**Encabezado**:
```
Agenda de María (Coach)
[Volver al Equipo] [Contactar Maria] [Más opciones]
```

**Avisos visuales**:
- Badge "Supervisado por Owner" (si relevante)
- Permisos limitados indicator (si es read-only)
- Botones deshabilitados si no tiene permiso

---

## Parte 3: Flujos de Navegación

### Flujo 1: Ver Agenda Operativa y Crear Sesión

```
Dashboard
  ↓ click "Agenda" (sidebar)
Vista Operativa (calendario)
  ├─ Ver todas las sesiones
  ├─ Ver KPIs (0 sesiones hoy, 2 atenciones semana, etc.)
  ├─ Ver Google Calendar conectado
  ├─ Filtrar por coach (dropdown)
  │   ↓
  │  Calendario actualizado (solo sesiones del coach)
  │   ↑
  ├─ O clickear botón "Nueva sesión"
  │   ↓
  │  Modal de crear sesión
  │   ├─ Coach (required)
  │   ├─ Cliente (email, o seleccionar de lista)
  │   ├─ Fecha/Hora
  │   ├─ Tipo (Sesión, Evaluación, etc.)
  │   ├─ Modalidad (online/presencial)
  │   ├─ Lugar (si presencial)
  │   ├─ Grupal (sí/no)
  │   ├─ [Validación conflicto backend]
  │   └─ Click "Agendar" → POST crear-cita-red → OK, aparece en calendario
  │       O Error "coach_conflict" → Toast con mensaje
  │
  └─ O clickear sesión existente
      ↓
     Drawer/Modal "Detalles de sesión"
      ├─ Info: cliente, coach, fecha, tipo, estado
      ├─ Botón "Editar"
      │   ↓
      │  Modal editar (mismos campos)
      │   └─ Click "Guardar" → PATCH editar-cita-red → OK
      │
      └─ Botón "Cancelar"
          ↓
         Confirmación "¿Cancelar?"
          └─ Click "Sí" → DELETE/PATCH → cancelada, desaparece del calendario
```

### Flujo 2: Ir a Agenda Personal del Coach

```
Dashboard
  ↓ click "Equipo" (sidebar)
Tabla de Coaches
  ├─ Filtro, búsqueda
  ├─ Columnas: Nombre, Estado, Clientes, Sesiones, Acciones
  └─ Click en coach O click botón "Ver agenda" en fila
      ↓
     Agenda Personal del Coach (reutilizada)
      ├─ Breadcrumb: Dashboard > Equipo > Agenda de María
      ├─ Encabezado: "Agenda de María"
      ├─ Calendario (solo sesiones de María)
      ├─ Operaciones según permisos (TBD)
      │   ├─ VER sesión
      │   ├─ EDITAR (si permitido)
      │   ├─ CANCELAR (si permitido)
      │   └─ etc.
      │
      └─ Botón "Volver al Equipo"
          ↓
         Tabla de Coaches (de vuelta)
          └─ El Owner sigue en la tabla, puede ver otro coach
```

### Flujo 3: Reasignar Sesión (Operativa)

```
Vista Operativa
  ↓ click sesión
Drawer "Detalles"
  ├─ Coach: Coach BG
  ├─ Botón "Cambiar coach"
  │   ↓
  │  Modal "Reasignar a..."
  │   ├─ Dropdown con otros coaches
  │   ├─ [Validación backend: ¿Coach destino tiene conflicto?]
  │   └─ Click "Aceptar"
  │       ↓
  │      PATCH → Sesión ahora es de Coach BC
  │      Calendario actualizado
  │       ↓
  │      ¿Notificar coaches? (TBD)
  │
  └─ Volver a Vista Operativa
```

### Flujo 4: Bloquear Disponibilidad del Coach (Operativa)

**Estado**: Este flujo es PROBABLE pero NO CONFIRMADO.

```
Vista Operativa
  ├─ Ver bloques "no disponible" en gris en el calendario
  ├─ Clickear en horario vacío
  │   ↓
  │  Modal "Bloquear disponibilidad"
  │   ├─ Coach (pre-rellenado si filtraste)
  │   ├─ Fecha
  │   ├─ Duración (1h, 2h, todo el día)
  │   ├─ Motivo (reunión, almuerzo, enfermo, etc.)
  │   └─ Click "Bloquear"
  │       ↓
  │      POST crear bloque → Aparece en calendario
  │
  └─ Desbloquear: click bloque → "¿Desbloquearlo?" → Sí
```

---

## Parte 4: Consideraciones de UX

### Diferenciación Visual

**Calendarios**:
- Vista Operativa: ícono de calendario en sidebar diferente a Agenda Personal
- Breadcrumb claro en ambas vistas
- Encabezado diferenciado ("Agenda" vs "Agenda de María")

**Colores/Estados**:
```
confirmada    → Verde
programada    → Amarillo
completada    → Gris
cancelada     → Rojo tachado
bloqueado     → Gris oscuro (no es sesión)
```

### Responsividad

- Desktop (1200px+): Calendario + sidebar + detalles lado a lado
- Tablet (768-1199px): Calendario full-width, detalles en drawer
- Mobile (< 768px): Tabla de sesiones (no calendario), modal para detalles

### Empty States

**Vista Operativa sin sesiones**:
```
"Sin sesiones esta semana."
[+ Nueva sesión]
```

**Agenda Personal de coach sin sesiones**:
```
"María no tiene sesiones agendadas."
[Crear sesión para María]
```

### Gestos/Acciones Rápidas

**Teclado**:
- `N` → Nueva sesión (modal)
- `E` → Editar seleccionada
- `C` → Cancelar seleccionada
- `ESC` → Cerrar modal/drawer

**Drag & Drop** (futuro, no v1):
- Mover sesión a otro día/hora en calendario
- Reasignar a otro coach

---

## Parte 5: Estados y Transiciones

### Estados de Sesión

```
           ┌──────────┐
           │PROGRAMADA│
           └──────┬───┘
                  │
        [Confirmar cliente]
                  ↓
           ┌──────────┐
           │CONFIRMADA│ ←── [Cambiar hora/fecha]
           └──────┬───┘     (editar, permiso Owner TBD)
                  │
        [Llegó la fecha]
                  ↓
           ┌──────────┐
           │COMPLETADA│
           └──────────┘
           
           CUALQUIER ESTADO
                  │
        [Owner/Coach cancela]
                  ↓
           ┌──────────┐
           │CANCELADA │
           └──────────┘ (no se puede "descancel")
```

### Transiciones Permitidas por Owner

| De → A | Vista Operativa | Vista Personal | Nota |
|--------|-----------------|----------------|------|
| programada → confirmada | ❓ TBD | ❓ TBD | ¿Owner confirma? |
| confirmada → cancelada | ✅ Sí | ❓ TBD | |
| completada → cancelada | ❌ No | ❌ No | No reescribir historia |
| confirmada → programada | ❌ No | ❌ No | No es transición válida |

---

## Parte 6: Casos de Error

### Error: Conflicto de Coach

**Scenario**: Owner intenta crear sesión a las 10:00, coach ya tiene a las 10:15

**Respuesta backend**: HTTP 409, `{error: "coach_conflict"}`

**Respuesta frontend**:
```
Toast: "Ese coach ya tiene una cita en ese horario."
[Crear igual] [Cancelar]
```

¿Qué hace "Crear igual"? ¿Ignora validación o avisa al Owner?

**Decision pending**: Bloquear o permitir con confirmación.

### Error: Coach Limitado

**Scenario**: Plan "Boutique" máx 3 coaches, Owner intenta crear 4to

**Respuesta backend**: HTTP 429, `{error: "max_coaches_exceeded"}`

**Respuesta frontend**:
```
Modal: "Alcanzaste el límite de 3 coaches. Upgradea a Studio."
[Ver planes] [Cerrar]
```

### Error: Sesión Expirada

**Scenario**: Owner intenta editar sesión de hace 6 meses

**Respuesta**: ¿Permitir cambios antiguos? ¿Bloqueado?

**Decision pending**: Política de edición histórica (solo futuro o también pasado).

---

## Parte 7: Integraciones Existentes

### Google Calendar

- Owner puede conectar Google Calendar (setup una sola vez)
- En Vista Operativa, aparecen las sesiones personales del Owner en gris (read-only)
- No double-booking: si Owner tiene reunión a las 15:00, Owner puede ver que esa hora está ocupada

**¿Sincronizar sesiones a Google del coach?** 
- Hoy: crear-cita-red hace best-effort sync
- Mantener igual

### Edge Functions

**Ya existentes, funcionales**:
- `crear-cita-red` → POST nueva sesión
- `editar-cita-red` → PATCH/DELETE sesión
- `mi-red` → GET todas las sesiones (sync)

**Nuevas para 5.2.3**:
- ❓ `reasignar-sesion` (si se implementa reasignación)
- ❓ `bloquear-disponibilidad` (si se implementa bloqueos)

---

## Parte 8: Permisos Finales (Matriz Consolidada)

### Vista Operativa

| Rol | Ver | Crear | Editar | Cancelar | Reasignar | Bloquear |
|-----|-----|--------|--------|----------|-----------|----------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ | ❓ |
| Senior Coach* | ? | ? | ? | ? | ? | ? |
| Coach | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*Si existe en futuro

### Vista Agenda Personal

| Rol | Ver | Crear | Editar | Cancelar | Bloquear | Ficha |
|-----|-----|--------|--------|----------|----------|-------|
| Owner | ✅ | ❓ | ❓ | ❓ | ❓ | ❓ |
| Coach (propia) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Parte 9: Checklist de Implementación (Sprint 5.2.3)

**Antes de escribir código**, validar:

- [ ] Matriz de permisos aprobada (qué puede hacer Owner en cada vista)
- [ ] Flujo de navegación confirmado (breadcrumbs, botones Volver)
- [ ] Estados y transiciones definidas
- [ ] Casos de error especificados
- [ ] Reasignación: ¿implementar o dejar para 5.3?
- [ ] Bloqueos: ¿implementar o dejar para 5.3?
- [ ] Cambios visuales especificados (colores, badges, layouts)
- [ ] Componente Agenda Coach: parametrizado y listo para reutilizar
- [ ] RLS actualizado: Owner puede leer/escribir sesiones de su org
- [ ] Edge functions nuevas (si aplica): desarrolladas y testeadas

---

## Decisiones Pendientes (Marca claramente)

```
❓ REASIGNAR SESIÓN
   - ¿Implementar en 5.2.3 o en 5.3?
   - ¿Validar conflictos del coach destino?
   - ¿Notificar coaches?

❓ BLOQUEAR DISPONIBILIDAD
   - ¿Implementar en 5.2.3 o en 5.3?
   - ¿Quién puede bloquear: Owner, Coach, o ambos?

❓ PERMISOS OWNER EN AGENDA PERSONAL
   - ¿Read-only o full control?
   - ¿Crear sesión en nombre del coach?
   - ¿Editar sesión existente?
   - ¿Cancelar sesión?

❓ NOTAS Y DOCUMENTACIÓN
   - ¿Owner puede agregar notas a sesiones?
   - ¿Ver notas privadas del coach?

❓ POLÍTICA DE EDICIÓN HISTÓRICA
   - ¿Editar sesiones completadas?
   - ¿Editar sesiones de hace 6+ meses?

❓ NOTIFICACIONES
   - ¿Notificar coach cuando Owner reasigna?
   - ¿Notificar cliente cuando Owner cancela?
```

---

## Próximos Pasos

1. **Aprobación de esta especificación** (tú)
2. **Decisiones sobre ❓ items arriba**
3. **Validación de permisos** vs Sprint 5.1 (capacidades)
4. **Mockup UX** (si necesario) para navegación
5. **Implementación Sprint 5.2.3** (código)
6. **QA Sprint 5.2.4** (testing)

---

**Este documento es PRE-implementación.**  
**No desarrollar hasta que todas las ❓ estén respondidas.**  
**No es un dump de ideas: es la especificación oficial de Agenda terminada.**
