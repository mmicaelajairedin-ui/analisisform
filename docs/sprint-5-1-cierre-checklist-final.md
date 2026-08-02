# Sprint 5.1 — Cierre: Checklist Final de Arquitectura de Permisos

**Estado**: Congelado  
**Fecha**: 2026-08-02  
**Responsable**: Product Owner

---

## CHECKLIST FINAL — 5 VERIFICACIONES

### ✅ 1. CAPACIDAD ≠ VISIBILIDAD

**Diferencia crítica** que debe quedar clara en el sistema:

```
CAPACIDAD (permiso):           VISIBILIDAD (scope):
├─ Poder HACER algo            ├─ Qué VEMOS
├─ agenda.edit                 ├─ agenda.view_own
├─ clientes.create             ├─ clientes.read.organization
└─ billing.receive_payment     └─ analytics.view_team
```

**Ejemplo: Agenda**

```
Coach puede:
  ✓ Ver su propia agenda        (capacidad: agenda.view_own)
  ✓ Editar sus sesiones         (capacidad: agenda.edit)
  ✓ Crear sesiones              (capacidad: agenda.create)
  ✗ Ver agenda del equipo       (FALTA capacidad: agenda.view_team)
  ✗ Ver agenda organización     (FALTA capacidad: agenda.view_organization)

Resultado visual:
  - Sidebar: VE su calendario (agenda.view_own)
  - Sidebar: NO VE botón "Ver equipo" (faltan capacidades)
  - Botón editar: ACTIVO (tiene agenda.edit)
  - Botón crear: ACTIVO (tiene agenda.create)
```

**Validación**: El documento matriz-permisos-oficial.md diferencia en cada capacidad:
- ✅ `Incluye`: QUÉ acciones permite (capacidad)
- ✅ `Depende de`: QUÉ capacidades necesita (capacidad)

**Status**: ✅ VERIFICADO

---

### ✅ 2. SCOPES EXPLÍCITOS

**Scopes permitidos por módulo**:

```
OWN           — Acceso solo a lo propio
TEAM          — Acceso al equipo inmediato
ORGANIZATION  — Acceso a toda la org
GLOBAL        — Acceso sin restricción (admin/owner)
```

**Aplicados por módulo**:

```
AGENDA:
  ├─ agenda.view_own              → VER propias sesiones
  ├─ agenda.view_team             → VER agenda del equipo
  ├─ agenda.view_organization     → VER agenda org
  ├─ agenda.create (no scope)     → CREAR sesión (anywhere)
  ├─ agenda.edit (implícito own)  → EDITAR propias sesiones
  └─ agenda.cancel (implícito own)→ CANCELAR propias sesiones

ANALYTICS:
  ├─ analytics.view_personal      → VER propias métricas
  ├─ analytics.view_organization  → VER métricas org
  └─ analytics.export (no scope)  → EXPORTAR datos

BILLING:
  ├─ billing.view_personal        → VER ingresos propios
  ├─ billing.view_organization    → VER ingresos org
  └─ billing.receive_payment      → COBRAR (owner level)

CLIENTES:
  ├─ clientes.read (implícito own) → VER clientes asignados a ti
  ├─ clientes.edit (implícito own) → EDITAR tus clientes
  └─ clientes.assign              → REASIGNAR (capacidad, no scope)
```

**Regla de Visibilidad Implícita**:

```
Si usuario tiene capacidad X.read:
  → Solo VE los items en su scope
  
Si usuario tiene capacidad X.edit:
  → Solo EDITA items en su scope (implícitamente OWN)
  
Si usuario tiene capacidad X.view_organization:
  → VE TODOS los items en la org (sin filtro)
```

**Ejemplo: Coach Estándar**

```
Tiene:
  ✓ clientes.read
  ✓ clientes.edit
  ✗ clientes.view_team (no la tiene)

Resultado:
  - VE: Sus propios clientes (OWN scope)
  - EDITA: Sus propios clientes (OWN scope)
  - NO VE: Clientes de otros coaches
  - Panel "Todos los clientes" está OCULTO
```

**Validación**: La implementación debe validar:
- Cada READ tiene un scope asociado
- Cada EDIT hereda el scope de su READ correspondiente
- El UI oculta opciones que no tienen capacidad de scope mínimo

**Status**: ✅ VERIFICADO en especificación

---

### ✅ 3. DESACTIVACIÓN: QUÉ OCURRE

**No es solo bloquear acceso: es ocultar interfaz.**

Cuando se **DESACTIVA** una capacidad:

```
PASO 1: Bloquear acceso
  └─ Si usuario trata de acceder via URL/API → 403 Forbidden

PASO 2: Ocultar en UI
  └─ El botón/menú/sección desaparece del sidebar
  └─ Los formularios relacionados se ocultan
  └─ Los inputs se deshabilitan con razón

PASO 3: Vaciar caché
  └─ Si la capacidad estaba en caché local → invalidar
  └─ Recargar la página o vista afectada
```

**Ejemplo: billing.receive_payment OFF**

```
ANTES (habilitada):
  Sidebar:
    └─ 💳 Cobros (activo)
  Dentro de Cobros:
    ├─ [Ver ingresos personales]
    ├─ [Ver ingresos org]
    ├─ [Gestionar facturas]
    ├─ [Recibir pago] ← VISIBLE
    └─ [Exportar]

DESPUÉS (deshabilitada):
  Sidebar:
    └─ 💳 Cobros (gris/deshabilitado si es única capacidad)
  Dentro de Cobros:
    ├─ [Ver ingresos personales]
    ├─ [Ver ingresos org]
    ├─ [Gestionar facturas]
    ├─ [Recibir pago] ← OCULTO / NO DISPONIBLE
    └─ [Exportar]
```

**Implementación de UI Binding**:

```html
<!-- HTML: usa atributo data-cap para visibilidad -->
<button data-cap="billing.receive_payment" onclick="receivepayment()">
  Recibir pago
</button>

<!-- JavaScript: al cargar capacidades -->
<script>
  // Ocultar elementos sin capacidad
  document.querySelectorAll('[data-cap]').forEach(el => {
    const cap = el.getAttribute('data-cap');
    if (!hasCapability(cap)) {
      el.style.display = 'none';
      el.disabled = true;
      // Opcional: mostrar tooltip "No tienes permiso"
    }
  });
</script>
```

**Desactivación en Tiempo Real**:

```
Si Owner desactiva "billing.receive_payment" a Coach A:
  1. Backend: Actualiza user_capacidades
  2. Auditoría: Registra quién, cuándo, qué
  3. Coach A: Recibe notificación en tiempo real (WebSocket/polling)
  4. Coach A: Su UI se recarga y oculta el botón
  5. Si Coach A intenta acceder via URL: 403
```

**Validación**: La implementación debe:
- ✅ Bloquear API (REST 403, GraphQL error)
- ✅ Ocultar UI (display:none, disabled)
- ✅ Limpiar caché local
- ✅ Validar en cada endpoint

**Status**: ✅ REGLA DOCUMENTADA

---

### ✅ 4. RESERVED = NO VISIBLES EN UI

**Las capacidades reserved NO aparecen en la interfaz de gestión de permisos.**

**¿Cuáles son Reserved?**

```
community.post                  ← Sprint ??
community.moderate              ← Sprint ??
community.view                  ← Sprint ??

marketplace.profile             ← Sprint ??
marketplace.receive_leads       ← Sprint ??
marketplace.reviews             ← Sprint ??

branding.edit_org               ← Sprint ??
branding.edit_profile           ← Sprint ??

automation.create               ← Sprint ??
automation.manage               ← Sprint ??

api.read                        ← Sprint ??
api.write                       ← Sprint ??

collab.compartir_cliente        ← Sprint 5.4
collab.delegar                  ← Sprint 5.4
```

**Implementación: UI de Capacidades (MultiCoach)**

```javascript
// capacidades-ui.js: FILTRAR reserved

const CAPACIDADES_GRUPOS = {
  'Clientes': [...],      // ✓ Mostrar todos
  'Agenda': [...],        // ✓ Mostrar todos
  'Programas': [...],     // ✓ Mostrar todos
  // ...
  'Comunidad': [...],     // ✗ OCULTAR (reserved)
  'Marketplace': [...],   // ✗ OCULTAR (reserved)
  'API': [...]            // ✗ OCULTAR (reserved)
};

// Al renderizar checkboxes:
for (const [grupo, caps] of Object.entries(CAPACIDADES_GRUPOS)) {
  if (isReserved(grupo)) continue;  // ← SALTAR reserved
  // Renderizar grupo...
}
```

**En la tabla `user_capacidades`**:

```sql
-- Las capacidades reserved se CAN guardar en la tabla
INSERT INTO user_capacidades 
  (user_id, capacidad, enabled) 
VALUES 
  ('coach-123', 'community.post', false);  ← OK, pero nunca se usa

-- Son "fantasma": existen en la tabla pero nunca en UI
-- Cuando se implemente Comunidad, cambiamos el flag RESERVED
```

**Validación**: 
- ✅ UI oculta grupos reserved (no aparecen checkboxes)
- ✅ DB permite guardar capacidades reserved (para futuro)
- ✅ Definición clara en código: `const RESERVED = ['community.*', 'marketplace.*', ...]`

**Status**: ✅ ARQUITECTURA DEFINIDA

---

### ✅ 5. PRINCIPIO DE MÍNIMO PRIVILEGIO

**Los presets NUNCA conceden permisos "por si acaso".**

Cada capacidad en un preset tiene justificación clara:

```
COACH ESTÁNDAR: 23 capacidades

✓ clientes.read       — Necesita VER sus clientes
✓ clientes.edit       — Necesita EDITAR datos del cliente
✓ clientes.notes      — Necesita TOMAR NOTAS

✓ agenda.view_own     — Necesita VER su calendario
✓ agenda.create       — Necesita CREAR sesiones
✓ agenda.edit         — Necesita EDITAR sus sesiones

✓ programas.create    — Necesita CREAR sus programas
✓ programas.edit      — Necesita EDITAR sus programas

✓ recursos.create     — Necesita CREAR recursos
✓ recursos.share      — Necesita COMPARTIR con clientes

✓ ia.use              — Necesita USAR IA para análisis
✓ ia.crear_prompts    — Necesita PERSONALIZAR prompts

✓ analytics.view_personal — Necesita VER sus métricas
✓ mensajes.send       — Necesita COMUNICARSE con clientes
✓ mensajes.view       — Necesita VER historial

✗ clientes.create     — ¿Por qué? → Owner asigna clientes (integridad)
✗ clientes.assign     — ¿Por qué? → Solo Senior (escalada controlada)
✗ agenda.view_team    — ¿Por qué? → No coordina otros coaches
✗ equipo.permissions  — ¿Por qué? → Solo Owner/Admin (seguridad)
✗ config.*            — ¿Por qué? → Solo Owner (seguridad crítica)
```

**Justificación de Cada Exclusión**:

```
¿Por qué Coach Estándar NO tiene clientes.create?

Razón 1: INTEGRIDAD de datos
  - Si cada coach crea clientes, pueden crear duplicados
  - Owner controla el intake y asigna clientes de forma centralizada

Razón 2: ESCALABILIDAD
  - Coach Senior SÍ lo tiene (ha demostrado responsabilidad)
  - Permite flujo graduado: Coach → Senior → Owner

Razón 3: AUDITORÍA
  - Es más fácil rastrear "Owner asignó cliente X a Coach Y"
  - Que "Coach Z se auto-asignó cliente X"

Razón 4: COSTO
  - Clientes tienen límites de carga por coach
  - Owner modera la distribución
```

**Regla de Diseño**:

```
Para CADA capacidad en un preset:
  □ ¿Cuál es el objetivo operacional?
  □ ¿Quién más necesita esta capacidad?
  □ ¿Hay riesgo de abuso?
  □ ¿Hay alternativa más segura?

Si contesta "no" a la primera pregunta:
  → NO incluir en preset
```

**Validación**:
- ✅ Cada preset tiene SOLO capacidades necesarias
- ✅ Cada exclusión está documentada y justificada
- ✅ No hay capacidades "por conveniencia"

**Status**: ✅ TODOS LOS PRESETS AUDITADOS

---

## RESUMEN: MATRIZ OFICIAL CIERRE

| Aspecto | Estado | Documento |
|---------|--------|-----------|
| **Capacidades (57)** | ✅ Completo | matriz-permisos-oficial.md |
| **Presets (7)** | ✅ Validado | matriz-permisos-oficial.md §3 |
| **Dependencias (25)** | ✅ Documentado | matriz-permisos-oficial.md §4 |
| **Reserved (15)** | ✅ Identificado | matriz-permisos-oficial.md §1.12-1.17 |
| **Org-level Perms** | ✅ Especificado | matriz-permisos-oficial.md §5 |
| **Herencia (4 pasos)** | ✅ Definido | matriz-permisos-oficial.md §6 |
| **Auditoría (5 eventos)** | ✅ Schema | matriz-permisos-oficial.md §7 |
| **Capacidad ≠ Visibilidad** | ✅ **ESTE DOCUMENTO** | sprint-5-1-cierre-checklist-final.md §1 |
| **Scopes (own/team/org)** | ✅ **ESTE DOCUMENTO** | sprint-5-1-cierre-checklist-final.md §2 |
| **Desactivación (UI hide)** | ✅ **ESTE DOCUMENTO** | sprint-5-1-cierre-checklist-final.md §3 |
| **Reserved no visibles** | ✅ **ESTE DOCUMENTO** | sprint-5-1-cierre-checklist-final.md §4 |
| **Mínimo privilegio** | ✅ **ESTE DOCUMENTO** | sprint-5-1-cierre-checklist-final.md §5 |

---

## SPRINT 5.1 — ESTADO FINAL

### ✅ ENTREGABLES

1. **sprint-5-architecture.md** (arquitectura general)
2. **sprint-5-1-capacidades-especificacion.md** (especificación funcional)
3. **sprint-5-1-matriz-permisos-oficial.md** (matriz oficial + presets + dependencias)
4. **sprint-5-1-cierre-checklist-final.md** (este documento)
5. **Código**:
   - `supabase/migrations/user_capacidades.sql` (DB schema)
   - `scripts/capacidades.js` (backend helpers)
   - `scripts/capacidades-init.js` (initialization)
   - `scripts/capacidades-ui.js` (UI component)
   - `multicoach.html` (integración en Equipo)

### 🔒 CONGELADO

**Cambios permitidos**: Agregar reserved capabilities  
**Cambios prohibidos**: Eliminar, renombrar, cambiar dependencias  
**Próxima revisión**: Sprint 5.5 o Fase 2

---

## PRÓXIMO: SPRINT 5.2 — ARQUITECTURA DE AGENDA

**NO implementar aún. Solo arquitectura.**

Responder:
- ¿Una agenda por coach o organizacional?
- ¿Cómo evitar conflictos de horario?
- ¿Qué ocurre al reasignar cliente?
- ¿Cómo integrar Google Calendar, Calendly, Zoom?
- ¿Vacaciones, bloqueos, disponibilidad?

Documento: `sprint-5-2-agenda-arquitectura.md` (próximo)

---

**FIN DE SPRINT 5.1**

✅ Arquitectura de permisos 100% definida y congelada.  
✅ Todos los 5 puntos del checklist verificados.  
✅ Listo para pasar a Sprint 5.2.
