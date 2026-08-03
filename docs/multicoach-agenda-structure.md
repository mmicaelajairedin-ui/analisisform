# MultiCoach — Estructura de Agendas (Operativa vs Personal)

**Documento de arquitectura para Sprint 5.2.3**  
**Estado**: 🟢 Arquitectura congelada (Sprint 5.2.A), operaciones pendientes de diseño  
**Fecha**: 2026-08-03

---

## El modelo: Dos niveles de Agenda

MultiCoach tiene **dos vistas de agenda completamente distintas**, accesibles mediante navegación jerárquica:

### 1. Agenda Operativa (Owner)

**Qué es**: Vista centralizada de la empresa. El Owner ve **toda la operación**.

**Acceso**: MultiCoach → Agenda (directa desde sidebar)

**Datos que muestra**:
- Todas las sesiones de TODOS los coaches
- Todos los clientes asignados
- Bloques de disponibilidad del equipo
- Conflictos y alertas operativas
- Analytics: sesiones semana, confirmadas, etc.

**Quién la usa**:
- Owner (empresa)
- Probablemente Senior Coach si existe en futuro

**Operaciones esperadas**:
- Filtrar por coach
- Ver conflictos
- Analytics en tiempo real
- Posiblemente: reasignar sesiones entre coaches

### 2. Agenda Personal del Coach

**Qué es**: Vista específica de **un coach**. El Owner entra a "la agenda de María" como si fuera María, pero como Owner.

**Acceso**: MultiCoach → Equipo → [Clickear Coach] → "Ver agenda" → Agenda Personal

**Datos que muestra**:
- Solo las sesiones de ese coach
- Solo los clientes del coach
- Disponibilidad del coach
- Bloqueos del coach
- Estado de sesiones confirmadas/pendientes

**Quién la usa**:
- Owner (para gestionar/supervisa a ese coach)
- El mismo Coach (en su panel-v2.html)

**Reutilización**: **Usa el mismo componente que panel-v2.html**. El Owner entra "como coach" pero sin perder su rol Owner.

---

## Relaciones y Flujos

```
┌─────────────────────────────────────────────────────────┐
│ MULTICOACH (Owner)                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐         ┌──────────────────────┐  │
│  │ Agenda Operativa │         │ Equipo (tabla)       │  │
│  │ (Org-wide)       │         ├──────────────────────┤  │
│  │                  │         │ • Coach BG           │  │
│  │ • Filtrar coach  │◄────┬───┤ • Coach BC           │  │
│  │ • Ver todo       │     │   │                      │  │
│  │ • Analytics      │     │   │ [Clickear Coach] ────┐  │
│  └──────────────────┘     │   └──────────────────────┘  │
│                           │                             │
│                           └───────────────────────────┐  │
│                                                       │  │
│                     ┌─────────────────────────────┐   │  │
│                     │ Agenda Personal del Coach   │◄──┘  │
│                     │ (Coach-specific)            │      │
│                     │                             │      │
│                     │ • Solo sesiones de BG       │      │
│                     │ • Solo clientes de BG       │      │
│                     │ • Disponibilidad de BG      │      │
│                     │ • [Operaciones a definir]   │      │
│                     └─────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

## Operaciones por Vista

### Agenda Operativa (Owner)

**Ya implementado (Sprint 5.2)**:
- ✅ Ver todas las sesiones del equipo
- ✅ Filtrar por coach
- ✅ Ver KPIs (sesiones semana, confirmadas, etc.)
- ✅ Crear sesión para cualquier coach
- ✅ Editar sesión
- ✅ Cancelar sesión
- ✅ Validar conflictos (backend)

**Futuro (Sprint 5.3+)**:
- ? Reasignar sesión a otro coach
- ? Ver alertas de coach (sin disponibilidad)
- ? Masivo: crear sesiones recurrentes

### Agenda Personal del Coach

**A definir en Sprint 5.2.3**:

**Probable** (basado en patrones B2B):
- ? Editar sesión (fecha, hora, tipo)
- ? Cancelar sesión
- ? Ver disponibilidad personal
- ? Crear bloqueo de disponibilidad
- ? Reasignar cliente (si la lógica lo permite)

**Permiso del Owner**:
- ✓ Entra como "supervisa a María"
- ? Puede hacer cambios en su agenda
- ? O solo visualiza (read-only)

**Nota**: Esto dependerá de:
1. Capacidades del rol Owner (Sprint 5.1)
2. Lógica de negocio (¿puede el Owner tocar la agenda del coach?)

---

## Datos y RLS

### Agenda Operativa

```sql
-- Owner ve TODAS las sesiones de su org
SELECT * FROM citas 
WHERE org_id = $1  -- la org del Owner
ORDER BY inicio;
```

**RLS Policy**: `owner_org_read` — owner puede leer todo de su org

### Agenda Personal

```sql
-- Owner ve las sesiones de UN coach específico
SELECT * FROM citas 
WHERE org_id = $1      -- su org
  AND coach_id = $2    -- el coach elegido
ORDER BY inicio;
```

**RLS Policy**: `owner_coach_read` — owner puede leer sesiones de coaches en su org

---

## Componente: Reutilización

**Un solo componente**: `Agenda del Coach` (actualmente en `panel-v2.html`)

**Se reutiliza en dos contextos**:

1. **panel-v2.html** (hoy)
   ```
   Rol del usuario: Coach
   Contexto: coach_id = $user.id (el coach ve su propia agenda)
   ```

2. **multicoach.html** (futuro, 5.2.3)
   ```
   Rol del usuario: Owner
   Contexto: coach_id = $params.coach_id (elegido de la tabla de Equipo)
   Navegación: MultiCoach → Equipo → Coach → Agenda
   ```

**Cambios necesarios**:
- Parametrizar el contexto (`coach_id` como parámetro, no `user.id`)
- Ajustar permisos según el rol (Owner vs Coach)
- Breadcrumb: mostrar "Agenda de María" + botón Volver

---

## Matriz de Decisiones Pendientes (Sprint 5.2.3)

| Pregunta | Opción A | Opción B | Decisión |
|----------|----------|----------|----------|
| **¿Puede el Owner editar sesión en Agenda Personal?** | Sí (full) | No (read-only) | ⏳ A definir |
| **¿Puede el Owner cancelar sesión?** | Sí | No | ⏳ A definir |
| **¿Puede el Owner crear sesión en Agenda Personal?** | Sí (en nombre del coach) | No | ⏳ A definir |
| **¿Puede el Owner bloquear disponibilidad del coach?** | Sí | No | ⏳ A definir |
| **¿Quién define disponibilidad del coach?** | Coach + Owner | Solo Coach | ⏳ A definir |
| **¿Puede el Owner reasignar cliente de sesión?** | Sí | No | ⏳ A definir |

---

## Línea de tiempo

- **Sprint 5.2.1**: Especificación (este documento es parte)
- **Sprint 5.2.2**: Mockups (dos vistas distintas visualmente)
- **Sprint 5.2.3**: Implementación
  - Parametrizar Agenda Coach
  - Definir permisos en matriz arriba
  - Mapear a capacidades de Sprint 5.1
  - Extender RLS
  - Implementar operaciones decididas
- **Sprint 5.2.4**: QA (ambas vistas)

---

## Notas para el Desarrollo

### Arquitectura de código

- **No duplicar HTML/CSS/JS**: Reutilizar el componente de `panel-v2.html`
- **Parametrizar contexto**: Pasar `coach_id` como parámetro, no asumirlo de `user.id`
- **Permisos granulares**: Usar capacidades de Sprint 5.1 para decidir qué operaciones permite

### Componente compartido

```javascript
// Hoy (panel-v2.html)
renderAgendaCoach(user.id);  // ← Usa el ID del usuario logueado

// Mañana (multicoach.html + panel-v2.html)
renderAgendaCoach(coach_id);  // ← Parametrizado
// Si coach_id == user.id → Coach viendo su propia agenda
// Si coach_id != user.id → Owner viendo agenda de otro coach
```

### Navegación

- Breadcrumb: `MultiCoach > Equipo > [Nombre Coach] > Agenda`
- Botón "Volver": regresa a la tabla de Equipo
- Contexto visual claro: "Agenda de María" no "Filtro por Coach"

---

## Relación con Sprint 5.1 (Permisos)

Las **capacidades de Owner** (Sprint 5.1) definirán qué operaciones puede hacer:

- `agenda.edit` → editar sesión en Agenda Personal ✓/✗
- `agenda.cancel` → cancelar sesión ✓/✗
- `agenda.create` → crear sesión ✓/✗
- `availability.manage` → bloquear disponibilidad ✓/✗
- `agenda.reassign` → reasignar cliente ✓/✗

Esto se mapea en Sprint 5.2.3 cuando se implementa.

---

**Documento congelado en Sprint 5.2.A**  
**Operaciones finales a definir en Sprint 5.2.3 Design**
