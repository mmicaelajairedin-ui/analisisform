# Decisiones Congeladas — Sprint 5.1 y 5.2

**Fecha**: 2026-08-02  
**Estado**: 🟢 **TODAS CONGELADAS**  
**Aprobador**: Product Owner (Micaela Jairedin)

---

## Sprint 5.1 — Permisos (CONGELADO)

### Qué está congelado

| Elemento | Decisión | Cambios permitidos | Cambios prohibidos |
|----------|----------|-------------------|-------------------|
| **57 capacidades** | Matriz oficial definida | Agregar reserved | Eliminar, renombrar, cambiar ID |
| **7 presets** | Owner, Coach Estándar, Senior, Recruiter, Asistente, Admin Recursos, RRHH | Agregar capacidades nuevas | Cambiar composición existente |
| **25 dependencias** | Clientes.edit → clientes.read | Extender dependencias | Eliminar reglas |
| **15 reserved** | Preparadas para futuro (community, marketplace, api, automation, branding) | Activar reserved a futuro | Cambiar namespace |
| **Scopes** | own, team, organization, global | Aplicar a nuevos módulos | Crear nuevos scopes |
| **Auditoría** | Schema + 5 eventos definidos | Agregar nuevos eventos | Cambiar estructura |

### Por qué está congelado

- Agenda (5.2), Cobros (5.3) y Colaboración (5.4) dependen directamente de este modelo
- Cambiar ahora = rehacer esas tres sprints
- Es la "fuente de verdad" de permisos para TODO el sistema

### Próxima revisión

- Sprint 5.5 o Fase 2 (si empresa requiere cambios)
- Bajo demanda expresa del Product Owner

---

## Sprint 5.2 — Arquitectura de Agenda (CONGELADO)

### Qué está congelado

| Elemento | Decisión | Status |
|----------|----------|--------|
| **Single Source of Truth** | UNA tabla `agendas`, múltiples vistas por rol | 🟢 Congelado |
| **Tres tipos de eventos** | Sesión individual, grupal, reunión interna | 🟢 Congelado |
| **Separación de conceptos** | Evento ≠ Asistencia ≠ Disponibilidad ≠ Bloqueos | 🟢 Congelado |
| **Modelo de asistencia** | Tabla separada, estados (confirmed, no_show, completed, cancelled) | 🟢 Congelado |
| **Ciclo de vida** | scheduled → confirmed → completed/cancelled/no_show/rescheduled | 🟢 Congelado |
| **Vistas por rol** | Coach (own), Senior (team), Owner (org), Cliente (futuro) | 🟢 Congelado |
| **6 tablas** | agendas, agenda_participantes, asistencias, disponibilidad, bloqueos, historial | 🟢 Congelado |
| **Permisos de cancelación** | Owner (org), Coach (own), Senior (team) | 🟢 Congelado |
| **Edición post-completada** | Solo correcciones administrativas con auditoría | 🟢 Congelado |
| **Coach principal obligatorio** | Sesión grupal siempre tiene coach_id | 🟢 Congelado |
| **Recordatorios** | Campos preparados, lógica en Sprint 5.3+ | 🟢 Congelado |
| **Migración c.ses** | Fase 1 (dual read) → Fase 2 (histórico) → Fase 3 (deprecated) | 🟢 Congelado |
| **Arquitectura: dos niveles de agenda** | Operativa (Owner org-wide) + Personal (Coach specific) | 🟢 Congelado (5.2.A) |
| **Navegación a Agenda Personal** | Jerárquica (MultiCoach → Equipo → Coach → Agenda), no filtro | 🟢 Congelado (5.2.A) |

### Cambios permitidos

```
✅ Agregar validaciones más estrictas
✅ Extender RLS (más restrictivo)
✅ Agregar campos opcionales preparados
✅ Mejorar índices de BD
✅ Refinar mensajes de error
```

### Cambios PROHIBIDOS

```
❌ Cambiar tabla agendas (estructura, campos clave)
❌ Cambiar modelo de asistencia
❌ Cambiar vistas por rol
❌ Cambiar permisos de cancelación
❌ Agregar nuevos tipos de eventos
❌ Cambiar cycle de vida de estados
❌ Usar c.ses como source of truth
```

### Por qué está congelado

- Clientes (Sprint 6) se apoyará sobre agenda
- Cobros (Sprint 5.3) depende de asistencia
- Analytics (futuro) depende de auditoría
- Colaboración (Sprint 5.4) depende de sesiones grupales

**Cambiar ahora = rehacer 3+ sprints.**

### Próxima revisión

- Sprint 5.3 o posterior
- Bajo demanda expresa del Product Owner

---

## Sprint 5.2.A — Arquitectura de Dos Niveles de Agenda (CONGELADO)

### Qué está congelado

**Decisión: MultiCoach tiene dos niveles de Agenda, navegación jerárquica**

| Elemento | Decisión | Status |
|----------|----------|--------|
| **Dos niveles de agenda** | Operativa (Owner, org-wide) + Personal (Coach, coach-specific) | 🟢 Congelado |
| **Navegación** | Jerárquica (MultiCoach → Equipo → Coach → Agenda Personal), NO filtro | 🟢 Congelado |
| **Reutilización** | Agenda del Coach (panel-v2.html) se reutiliza en MultiCoach sin duplicar | 🟢 Congelado |
| **Motor único** | Un solo motor de agenda, dos contextos de uso (Owner operativo + Owner gestión coach) | 🟢 Congelado |

### Flujo de navegación (congelado)

```
MultiCoach (Owner)
   ↓ Equipo
   ├─ Lista de coaches
   ├─ Clickear coach / "Ver agenda"
   │   ↓
   └─ Agenda Personal del Coach
       ├─ Reutiliza componente de panel-v2.html
       ├─ Contexto: coach_id = <elegido>
       ├─ Navegación clara: "Agenda de María" (no "agenda filtrada")
       └─ Operaciones: a definir en Sprint 5.2.3 según permisos funcionales
```

### Detalles técnicos (congelados)

- **NO es filtro:** Agenda Operativa (org-wide) ≠ Agenda Personal (coach-specific). Acceso jerárquico, no búsqueda.
- **Un componente:** Misma lógica de `panel-v2.html` (Agenda del Coach), reutilizada en MultiCoach.
- **Solo cambia:** Contexto (`coach_id`), navegación (ruta jerárquica), datos que se cargan.
- **No duplica:** Ni motor, ni UI, ni lógica. Un solo lugar de verdad.

### Lo que NO está congelado

**Permisos y operaciones del Owner en Agenda Personal:**
- ❓ ¿Puede editar sesiones del coach? → A definir en Sprint 5.2.3
- ❓ ¿Puede crear eventos en la agenda del coach? → A definir en Sprint 5.2.3
- ❓ ¿Puede cancelar sesiones? → A definir en Sprint 5.2.3
- ❓ ¿Puede crear bloqueos de disponibilidad? → A definir en Sprint 5.2.3
- ❓ ¿Puede reasignar clientes? → A definir en Sprint 5.2.3

**Nota:** Es probable que el Owner necesite **operaciones completas** en la Agenda Personal (mover sesión, cancelar, bloquear, reasignar). Eso dependerá de los permisos funcionales del rol Owner (Sprint 5.1) y se diseñará durante la implementación.

### Por qué se congela solo la navegación

- **MultiCoach (Sprint 5.2)** NECESITA estructura clara: dos niveles de agenda, acceso jerárquico.
- **Cambiar la navegación ahora = rediseñar toda la gestión de equipo en multicoach.**
- **Permisos y operaciones = dependen de Sprint 5.1 (capacidades) y se definen en 5.2.3 (diseño detallado).**
- Congelar todo ahora sería artificial; lo natural es que el Owner pueda hacer cambios en la red.

### Cambios permitidos

```
✅ Definir operaciones específicas en Sprint 5.2.3
✅ Extender permisos basados en capacidades (Sprint 5.1)
✅ Ajustar RLS según operaciones decididas
✅ Mejorar claridad visual de contexto (breadcrumbs, encabezados)
```

### Cambios PROHIBIDOS

```
❌ Convertir acceso a filtro (buscar/filtrar coach en agenda operativa)
❌ Crear componente duplicado de agenda
❌ Mezclar vistas operativa y personal en un solo lugar
```

### Próxima revisión

- **Sprint 5.2.3:** Definir operaciones permitidas (editar, cancelar, bloquear, etc.)
- **Sprint 5.2.3:** Mapear a capacidades (Sprint 5.1)
- **Sprint 5.3+:** Operaciones avanzadas si se requieren

---

## Por Qué Congelamos Ahora

### El patrón que evitamos

```
❌ Mala arquitectura temprana
  ↓
Implementación rápida de bugs
  ↓
Cambios en Sprint 5.3 rompen Sprint 5.2
  ↓
Cambios en Sprint 5.4 rompen Sprint 5.3
  ↓
Deuda técnica exponencial
```

### El patrón que seguimos

```
✅ Arquitectura sólida primero
  ↓
Aprobación formal del PO
  ↓
Congelación de decisiones
  ↓
Implementación sin segundas dudas
  ↓
Sprints posteriores construyen sobre base firme
```

---

## Qué Sigue (POST-CONGELACIÓN)

### Sprint 5.2.1 — Especificación Funcional (PRD mini)

**Entrega**: Documento describiendo qué hace Agenda
- Actores y permisos
- Flujos completos (crear, editar, cancelar, reasignar)
- Estados y transiciones
- Acciones disponibles por rol
- Empty states
- Errores y edge cases
- Relación con capacidades Sprint 5.1

**Status**: ⏳ A iniciar

---

### Sprint 5.2.2 — Mockup UX

**Entrega**: Diseño visual sin lógica
- Vistas para Coach, Senior, Owner
- Calendario (mes, semana)
- Modal de crear sesión
- Drawer de detalles
- Estados visuales
- Responsive (desktop/tablet/mobile)

**Status**: ⏳ A iniciar post-5.2.1 aprobado

---

### Sprint 5.2.3 — Implementación

**Entrega**: Código funcional
- Backend sólido (validaciones, RLS, auditoría)
- API endpoints (POST/PATCH/DELETE/GET)
- UI calendar
- Integración con MultiCoach y panel-v2

**Status**: ⏳ A iniciar post-5.2.2 aprobado

---

### Sprint 5.2.4 — QA

**Entrega**: Testing completo
- Desktop, tablet, mobile
- Empty states
- Errores (conflictos, permisos, validación)
- Performance
- Accesibilidad

**Status**: ⏳ A iniciar post-5.2.3

---

## Matriz de Cambios Permitidos (Referencia Rápida)

### Sprint 5.1 (Permisos)

| Cambio | Permitido | Razón |
|--------|-----------|-------|
| Agregar capacidad reserved | ✅ | No activa, no afecta |
| Cambiar descripción de capacidad | ✅ | Metadato, no lógica |
| Cambiar ID de capacidad | ❌ | Rompería todo el sistema |
| Cambiar dependencia | ❌ | Afecta Sprint 5.2+ |
| Cambiar preset | ❌ | Afecta usuarios existentes |

### Sprint 5.2 (Agenda)

| Cambio | Permitido | Razón |
|--------|-----------|-------|
| Agregar validación | ✅ | Más restrictivo es bien |
| Cambiar tabla `agendas` | ❌ | Rompería modelo |
| Cambiar estados | ❌ | Afecta lifecycle |
| Cambiar scope de vistas | ❌ | Afecta seguridad |
| Agregar campo nuevo (opcional) | ✅ | No rompe existente |

---

## REGLA DE ORO

```
Si una decisión arquitectónica afecta:
  - Permisos
  - Datos críticos
  - Otro Sprint
  
ESTÁ CONGELADA.

Solo puede cambiar bajo:
  1. Rediseño arquitectónico formal
  2. Aprobación expresa del Product Owner
  3. Justificación de impacto en otros sprints
```

---

**DOCUMENTO OFICIAL**: Estas decisiones están congeladas a partir del 2026-08-02.

**Próxima Revisión Permitida**: Sprint 5.5 o Fase 2.

