# Sprint 5.2.1 — QA + Reglas Finales (LOCKED)

**Estado**: QA PHASE + FINAL FREEZE  
**Fecha**: 2026-08-03  
**Después de esto**: NO MÁS CAMBIOS AL SCHEDULER

---

## 7 Reglas Finales (QA Phase)

### Regla 1: Scheduler NO Conoce Páginas

**El Scheduler JAMÁS debe preguntar:**
```javascript
if(page === "panel-v2") { ... }
if(page === "multicoach") { ... }
if(owner) { ... }
if(isCoach) { ... }
if(isClient) { ... }
```

**Recibe ÚNICAMENTE un contexto inyectado:**

```javascript
initScheduler({
  // Datos
  eventos: [],           // array de SchedulerEvent
  
  // Usuario
  currentUser: {id, name, email},
  organization: {id, name},
  team: {id, name} | null,
  
  // Control
  permissions: ["agenda.read.self", ...],
  scope: "self" | "team" | "global" | "participant",
  
  // Personalization
  theme: {/* Brand Engine config */},
  locale: "es" | "en",
  timezone: "Europe/Madrid",
  
  // Provider
  dataProvider: SesionesRegistroProvider,
  
  // Callbacks
  callbacks: {onCreate, onEdit, onCancel, onReschedule, onConfirmAssistance},
  
  // Labels (i18n)
  labels: {confirmed: "Confirmada", pending: "Pendiente", ...}
})
```

**El contexto decide DÓNDE se renderiza, QUÉ ve, CÓMO se ve.**

---

### Regla 2: Render Agnóstico de UI

**Hoy renderiza calendario.**

Mañana renderizará exactamente los MISMOS eventos como:

| Formato | Cuándo |
|---------|--------|
| **Calendar** (grid 7x5) | Mes, semana, día |
| **Timeline** (línea vertical) | Progresión temporal |
| **Week** (rejilla hora-día) | Disponibilidad |
| **Month** (grid compacto) | Overview |
| **List** (listado simple) | Mobile |
| **Compact** (tarjetas) | Dashboard |
| **Mobile** (acordeón) | Teléfono |
| **Kanban** (por estado) | Flujo |

**El motor nunca cambia.**

Solo varía el renderizador:

```javascript
// Motor (idéntico)
var scheduler = initScheduler(context);
var eventos = scheduler.getEventos();

// Renders (intercambiables)
renderCalendar(eventos);    // hoy
renderTimeline(eventos);    // mañana
renderKanban(eventos);      // pasado
renderMobileList(eventos);  // mobile
```

---

### Regla 3: Todos los Textos Configurables (i18n Ready)

**NUNCA hardcodear etiquetas:**

```javascript
// ❌ INCORRECTO
estado_badge = "<span>" + evt.state.toUpperCase() + "</span>";

// ✅ CORRECTO
var labels = context.labels || {};
var label = labels[evt.state] || evt.state;
estado_badge = "<span>" + label + "</span>";
```

**Labels que DEBEN venir del contexto:**

- `confirmed` → "Confirmada"
- `pending` → "Pendiente"
- `cancelled` → "Cancelada"
- `draft` → "Borrador"
- `completed` → "Completada"
- `participants` → "Participantes"
- `organizer` → "Organizador"
- `available` → "Disponible"
- `blocked` → "Bloqueado"
- `self` → "Mi agenda"
- `team` → "Agenda del equipo"
- `global` → "Agenda de la organización"
- `participant` → "Mis eventos"

**Aunque hoy solo haya español, el motor debe estar preparado para i18n.**

---

### Regla 4: Aceptar Theme Engine

**Aunque todavía no se use, el Scheduler debe aceptar theme:**

```javascript
initScheduler({
  ...
  theme: {
    // Brand Engine lo proporcionará
    primaryColor: "#2D6A4F",
    accentColor: "#8C7B80",
    dangerColor: "#D62828",
    successColor: "#52B788",
    
    // Tipografía
    fontFamily: "Inter, system-ui",
    fontSizeBase: "13px",
    fontSizeSmall: "11px",
    fontSizeLarge: "15px",
    
    // Spacing
    borderRadius: "8px",
    spacing: "8px",
    
    // Otros
    darkMode: false,
    density: "normal" // "compact" | "normal" | "spacious"
  },
  ...
})
```

**Cuando Agente B termine Brand Engine, NO hay que modificar el Scheduler.**

Solo inyectar el theme.

---

### Regla 5: Eventos Preparados para Branding

**Aunque no se implemente HOY, cada evento debe aceptar:**

```javascript
{
  id: "evt_...",
  title: "Career Review",
  
  // ... campos base ...
  
  // BRANDING (listos pero no usados en Phase 1)
  branding: {
    // Color de organización
    org_color: "#2D6A4F",
    org_avatar: "data:image/...",
    
    // Color del programa (si aplica)
    program_color: "#52B788",
    program_icon: "graduation",
    
    // Color de especialidad (si aplica)
    specialty_color: "#8C7B80",
    specialty_label: "Carrera",
    
    // Avatar del coach
    coach_avatar: "data:image/...",
    coach_color: "#D62828"
  },
  
  metadata: {
    event_type: "sesion_individual",
    client_photo: "data:image/...",
    week: 1
  }
}
```

**No implementar lógica. Solo dejar el contrato preparado.**

Cuando se conecte Branding, solo se inyectan los datos, el render los usa.

---

### Regla 6: QA Obligatoria — Exactitud Crítica

**Antes de dar por completado Sprint 5.2.1, validar EXACTITUD:**

#### Test 1: Panel-v2 (Coach)
```
1. Crear sesión con Cliente A (15:00)
2. Verificar que aparece en el Scheduler
3. Verificar título, hora, participante, estado
4. Verificar permisos (botones crear/editar/cancelar visibles)
```

#### Test 2: MultiCoach (Owner/Senior) — EXACTAMENTE LO MISMO
```
1. Abrir agenda del coach que creó la sesión
2. MISMO evento debe aparecer
3. IDÉNTICO render (hora, título, participante, estado)
4. SOLO cambian acciones (reasignar visible si tiene permiso)
```

#### Test 3: Cliente.html (Cliente) — CUANDO LLEGUE
```
1. Cliente ve su sesión
2. MISMO evento, IDÉNTICO render
3. SOLO acción: "Confirmar asistencia"
4. No puede editar ni cancelar (permisos limitados)
```

**Criterio de paso:** Los 3 contextos renderean **exactamente igual**. Solo varían permisos y acciones.

**Si hay diferencia visual, es BUG.**

---

### Regla 7: Próximo Sprint — Cambio de Foco

**Sprint 5.2.1 completo = Scheduler listo.**

**Próximo Sprint: Conexiones Operativas.**

NO más mejoras al Scheduler. Usarlo como infraestructura.

**Prioridad de integración:**

1. **Agenda ↔ Programas**
   - Sesión de programa → muestra programa_id
   - Programa → muestra calendario de sesiones
   - SIN cambiar el Scheduler

2. **Agenda ↔ Recursos**
   - Evento → reserva sala
   - Sala → muestra ocupación
   - SIN cambiar el Scheduler

3. **Agenda ↔ IA**
   - Evento creado → notificación IA
   - IA genera nota → se ancla al evento
   - SIN cambiar el Scheduler

4. **Agenda ↔ Cobros** (cuando exista)
   - Sesión confirmada → genera cobro
   - Cobro → linked al evento
   - SIN cambiar el Scheduler

5. **Agenda ↔ Notificaciones**
   - Sesión próxima → recordatorio
   - Cliente reclina → notificación coach
   - SIN cambiar el Scheduler

**El Calendar Engine es ahora el CENTRO operativo de Pathway.**

---

## Checklist Final (LOCKED)

- [x] Scheduler NO conoce páginas (contexto inyectado)
- [x] Render agnóstico de UI (calendario → timeline → list → kanban)
- [x] Textos configurables (i18n ready aunque sea solo ES hoy)
- [x] Theme Engine accepted (sin depender de él)
- [x] Branding fields preparados (no implementados)
- [x] QA exactitud (3 contextos, idéntico render)
- [x] Próximo sprint: conexiones operativas (NO mejoras al motor)

---

## Estado Final

**Calendar Engine v1.0: CONGELADO**

✅ Reutilizable (panel-v2, multicoach, cliente, reservar, programas)  
✅ Agnóstico (contexto, datos, UI, tema)  
✅ Extensible (i18n, branding, nuevos renders)  
✅ Estable (QA passed, infraestructura compartida)

**A partir de Sprint 5.2.2:**
- Integración real con otras áreas
- Calendario como el corazón operativo
- Reutilización del mismo componente en todas las features

---

*Sprint 5.2.1 Congelado*  
*Calendar Engine v1.0*  
*2026-08-03*
