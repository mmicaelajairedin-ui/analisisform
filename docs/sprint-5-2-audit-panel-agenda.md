# Sprint 5.2 — Auditoría: Agenda y Calendario en panel-v2.html

**Fecha**: 2026-08-02  
**Objetivo**: Identificar qué existe, qué se reutiliza, qué falta para Sprint 5.2

---

## 1. ESTADO ACTUAL: DOS FUENTES DE DATOS

### 1.1 Sesiones de Clientes (`c.ses`)

**Estructura**:
```javascript
CLIENTS[i].ses = [
  {
    fecha: "2026-08-10",      // YYYY-MM-DD
    hora: "14:00",             // HH:MM (opcional)
    tipo: "Sesión",            // Label (sesión, reunión, bloqueo, etc.)
    // (más campos según nicho: tareas, avance, etc.)
  },
  // ... más sesiones
]
```

**Origen**: 
- Vienen del formulario del cliente (`formulario.html`) → columna `sesiones_registro` (JSON)
- Se sincroniza en `panel-v2.html` línea 1509: `snap.raw.sesiones_registro=JSON.stringify(ex.ses||[])`
- Representan sesiones INTERNAS coordinadas entre coach y cliente

**Dónde se usan**:
1. **Dashboard "Tu agenda"** (línea 2923-2946)
   - Próximas 6 sesiones (filtro: fecha >= hoy - 1h)
   - Renderiza: hora + foto cliente + nombre + tipo + semana
   - Click: abre ficha del cliente

2. **Ficha de cliente → Tab "Sesiones"** (línea 2180-2181)
   - Mostrará las sesiones registradas (lectura del portal del cliente)

3. **Cálculos de objetivos** (línea 2961-2966)
   - "Sesión agendada" = logro completado (si `c.ses.length > 0`)

4. **Próxima sesión** en fila de cliente (línea 3008-3009)
   - Calcula próxima sesión y mostrala: "Hoy 14:00", "Mañana 15:30", etc.

5. **KPIs del dashboard** (línea 2804-2805)
   - Cuenta sesiones este mes y próximas (sesMes, prox)
   - Input: `c.ses` array

**Validaciones ACTUALES**: NINGUNA
- No hay validación de conflictos horarios
- No hay bloqueos de coach/disponibilidad
- No hay límite de duración
- No hay integración con calendario externo

**Base de datos ACTUAL**: Supabase `candidatos.sesiones_registro` (JSON stringified)
- Se guarda cada vez que se modifica: `_sbw('candidatos', cid, {..., sesiones_registro: JSON.stringify(ses)})`

---

### 1.2 Calendario Externo (`_AG_DATA`)

**Integración**:
```javascript
_AG_DATA = {
  events: [
    {
      id: "...",
      title: "Sesión con Juan",
      start: "2026-08-10T14:00:00Z",  // ISO 8601
      end: "2026-08-10T15:00:00Z",
      location: "https://zoom.us/...",
      description: "...",
      attendees: [...]  // Calendly/Google API
    }
  ]
}
```

**Origen**:
- Leer desde Calendly o Google Calendar (línea 4058: `_agendaLoad()`)
- Request vía API (probablemente POST a `/rest/v1/calendario` o similar)
- Se carga en `_agAfterCalBody()` (línea 3716)

**Dónde se usa**:
1. **Resumen → Embed de calendario** (línea 2933-2939)
   - Si existe `_emb` (calendar_embed_url): muestra iframe de Calendly
   - Si existe `_calU` (calendly_url): botón para abrir agenda
   - Si no: mensaje "Conecta tu calendario"

2. **Tab "Calendario"** en panel (línea 1796, 2185)
   - Renderiza mes completo con eventos
   - Funciones: `_agMonthRender()`, `_agBodyRender()`, `_agProxRender()`
   - Colores por tipo (línea 3645: `typ.color`)
   - Iconos por tipo (línea 3645: `typ.icon`)

3. **Próximas sesiones DESDE calendario externo** (línea 3779)
   - Filtra eventos futuros de `_AG_DATA`
   - Mostrala en el dashboard si no hay sesiones internas

**Validaciones ACTUALES**: NINGUNA
- Solo lectura de datos externos
- No hay conflicto check
- No hay sincronización bidireccional

---

## 2. FUNCIONES DE AGENDA QUE YA EXISTEN

### Funciones de Lectura

| Función | Línea | Propósito | Reutilizable |
|---------|-------|----------|--------------|
| `_sdt()` | 2923 | Parse fecha+hora a timestamp | ✅ SÍ |
| `_dayHead()` | 2928 | Formato "Hoy · 2 agosto" | ✅ SÍ |
| `_nextSesTxt()` | 3008 | Próxima sesión (formato compacto) | ✅ SÍ |
| `_agendaLoad()` | 4058 | Cargar datos de Calendly/Google | ⚠️ MIGRAR |
| `_agBodyRender()` | 3716 | Renderizar vista de calendario | ⚠️ REFACTOR |
| `_agMonthRender()` | 3721 | Renderizar mes | ⚠️ REFACTOR |
| `_agProxRender()` | 3779 | Próximas sesiones | ✅ REUTILIZAR |
| `_agTypeForEvent()` | 3645 | Mapear tipo de evento a color/icono | ✅ SÍ |
| `_agMoKey()` | 3547 | Key para mes/año | ✅ SÍ |

### Funciones de Escritura

| Función | Línea | Propósito | Status |
|---------|-------|----------|--------|
| `_demoSesSave()` | 1521 | Guardar sesión de ejemplo | ❌ DEMO ONLY |
| (ninguna para eventos reales) | — | Crear/editar/cancelar sesión | ❌ NO EXISTE |

---

## 3. COMPONENTES CSS REUTILIZABLES

```css
/* Clases existentes para agenda */
.cp-todo-row           /* Fila de sesión (fecha + foto + nombre + tipo) */
.cp-todo-body          /* Body de fila (nombre + meta) */
.cp-eyebrow            /* Badge "Sem 2" o "Próxima sesión" */
.cp-card               /* Card contenedor (Tu agenda, Próximas sesiones) */
.cp-card-hd            /* Header de card */
.cp-card-title         /* Título con icono */
.cp-card-pad           /* Padding standard */
```

**Disponibles en**: `pathway-panel.css`  
**Reutilización**: ✅ COMPLETA

---

## 4. QUÉ FALTA PARA SPRINT 5.2

### 4.1 Validaciones Backend

```javascript
// FALTA implementar en API/Edge Functions:
- Detectar conflictos horarios (misma hora, mismo coach)
- Validar disponibilidad del coach (bloqueos/vacaciones)
- Validar que cliente exista y esté asignado
- Validar capacidades (agenda.create, agenda.edit, etc.)
- Validar que evento no sea en el pasado
```

### 4.2 Crear Sesión

```javascript
// FALTA: Modal/formulario para:
- Tipo de sesión (sesión_cliente, reunión_interna, bloqueo)
- Fecha y hora
- Duración
- Cliente (si sesión_cliente)
- Participantes (si reunión_interna)
- [Guardar]

// Actualmente solo se pueden "editar" en localStorage/ejemplo
```

### 4.3 Editar Sesión

```javascript
// FALTA:
- Formulario para cambiar hora/fecha/descripción
- Validación de conflictos ANTES de guardar
- Si es recurrente: opción "esta sesión" vs "toda la serie"
- Auditoría de cambios (quién, cuándo, qué cambió)
```

### 4.4 Cancelar Sesión

```javascript
// FALTA:
- Botón "Cancelar" en cada sesión
- Modal de confirmación
- Marca como "cancelado" (no elimina)
- Notifica al cliente
```

### 4.5 Reasignación de Coach

```javascript
// FALTA:
- Vista "Equipo" en MultiCoach con drag-drop de clientes
- Al mover cliente A → Coach B:
  - Buscar sesiones futuras de Cliente A con Coach A
  - Reasignarlas a Coach B
  - Auditar cada cambio
```

### 4.6 Bloqueos/Disponibilidad

```javascript
// FALTA:
- UI para marcar "No disponible" o "Vacaciones"
- Prevención: si hay bloqueo 14-16h, no permitir crear sesión 14:30
- Validación en backend
```

### 4.7 Recurrencia

```javascript
// FALTA:
- RRULE parsing (FREQ=WEEKLY, BYDAY=MO,WE, etc.)
- Generar instancias de sesión recurrente
- Editar "esta" vs "toda la serie"
- Cancelar "esta" vs "toda la serie"
```

### 4.8 Auditoría

```javascript
// FALTA:
- Tabla auditoria_capacidades (YA definida en Sprint 5.1)
- Registrar:
  - agenda.created
  - agenda.edited
  - agenda.canceled
  - agenda.reassigned
  - capacidad.changed (si afecta sesiones)
```

---

## 5. ARQUITECTURA PROPUESTA PARA SPRINT 5.2

### 5.1 Flujo de Datos

```
┌─ Coach en panel-v2.html
│
├─→ Click "Crear sesión" (NUEVO BOTÓN)
│   ├─ Modal con form (NUEVO COMPONENTE)
│   └─ POST /rest/v1/agendas (NUEVA API)
│
├─→ Backend valida + persiste
│   ├─ Supabase tabla agendas (NUEVA TABLA)
│   ├─ Auditoría en auditoria_capacidades (Sprint 5.1)
│   └─ RLS por organization + capacidades
│
├─→ UI se recarga
│   ├─ Dashboard muestra sesión nueva
│   ├─ Tab Calendario renderiza evento nuevo
│   └─ Sincroniza con c.ses (localStorage) para portabilidad
│
└─→ Cliente ve sesión en su portal
    ├─ Portal lee agendas (nueva API)
    ├─ Tab "Sesiones" muestra evento
    └─ Notificación enviada vía EmailJS
```

### 5.2 Almacenamiento

**Decisión**: Migrar de `c.ses` (JSON en candidatos.sesiones_registro) → tabla `agendas` (Supabase)

**Por qué**:
- ✅ Escalable a múltiples coaches
- ✅ Auditoría nativa
- ✅ RLS por capacidad
- ✅ Sincronización en tiempo real
- ✅ Queries complejas (conflictos, recurrencia)

**Backward compatibility**:
- Leer sesiones viejas de `c.ses` para mostrar en dashboard (transición)
- Nuevas sesiones → tabla agendas
- Migración de datos históricos (post-Sprint 5.2)

---

## 6. CHECKLIST DE REUTILIZACIÓN

### ✅ Reutilizar

- [x] Funciones `_sdt()`, `_dayHead()`, `_nextSesTxt()`
- [x] Clase CSS `.cp-todo-row`, `.cp-card`, `.cp-eyebrow`
- [x] Patrón de listeners `data-act="..."`
- [x] Sistema de capabilidades (Sprint 5.1)
- [x] Estructura de datos `event = {id, title, start, end, ...}`
- [x] Iconos Lucide para tipos de sesión

### ⚠️ Refactor

- [ ] `_agendaLoad()` → migrar a traer desde tabla `agendas`
- [ ] `_agBodyRender()` → separar lógica de render de lógica de datos
- [ ] `_agMonthRender()` → reutilizar en MultiCoach para "Equipo"

### ❌ No Reutilizar (Nuevas implementaciones)

- [ ] Modal de crear sesión (NUEVA)
- [ ] Modal de editar sesión (NUEVA)
- [ ] Drag-drop de clientes en Equipo (NUEVA)
- [ ] Tabla `agendas` (NUEVA)
- [ ] RLS policies para agenda (NUEVA)
- [ ] Edge functions para validación (NUEVA)

---

## 7. IMPACTO EN TABLAS SUPABASE

### Nuevas Tablas Necesarias

```sql
-- Sesiones de coaching (reemplaza c.ses)
CREATE TABLE agendas (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizaciones(id),
  coach_id UUID REFERENCES usuarios(id),
  cliente_id UUID REFERENCES candidatos(id),  -- Nullable para reuniones internas
  tipo TEXT CHECK (tipo IN ('sesion_cliente', 'reunion_interna', 'bloqueo')),
  titulo TEXT,
  descripcion TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  estado TEXT CHECK (estado IN ('scheduled', 'completed', 'canceled')),
  recurrence_rule TEXT,  -- RRULE string (FREQ=WEEKLY;...)
  zoom_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  canceled_by UUID,
  canceled_at TIMESTAMPTZ,
  motivo_cancelacion TEXT,
  CONSTRAINT owner_org CHECK (organization_id IS NOT NULL)
);

-- Historial de cambios en sesiones
CREATE TABLE agendas_historial (
  id UUID PRIMARY KEY,
  agenda_id UUID REFERENCES agendas(id) ON DELETE CASCADE,
  evento TEXT,  -- 'created', 'edited', 'canceled', 'reassigned'
  cambios JSONB,  -- {before: {...}, after: {...}}
  user_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Disponibilidad del coach (horarios de trabajo)
CREATE TABLE agendas_disponibilidad (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizaciones(id),
  coach_id UUID REFERENCES usuarios(id),
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=lunes, 6=domingo
  hora_inicio TIME,
  hora_fin TIME,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bloqueos: vacaciones, no disponible, etc.
CREATE TABLE agendas_bloqueos (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizaciones(id),
  coach_id UUID REFERENCES usuarios(id),
  tipo TEXT CHECK (tipo IN ('vacaciones', 'no_disponible', 'otro')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  titulo TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 8. PRÓXIMOS PASOS

### Sprint 5.2.0 — Completar esta auditoría

- [ ] Verificar si `_AG_DATA` viene de Calendly/Google o es hardcoded
- [ ] Identificar qué migración SQL ya existe para agendas
- [ ] Listar todas las funciones de fechas que ya existen
- [ ] Revisar si hay validación de conflictos en algún lado

### Sprint 5.2.1 — Especificación Funcional

Basada en esta auditoría:
- PRD: qué hace la pantalla de Agenda en panel + MultiCoach
- Mockup: cómo se ve sin código
- User stories: crear, editar, cancelar, reasignar

### Sprint 5.2.2 → 5.2.4 — Implementación

Orden:
1. Backend sólido (validaciones, auditoría, RLS)
2. API contract funcional
3. UI calendar bonito

---

## 9. DEUDA TÉCNICA IDENTIFICADA

1. ⚠️ Sesiones en JSON dentro de candidatos (desnormalizado)
2. ⚠️ Sin validación de conflictos horarios
3. ⚠️ Sin auditoría de cambios de sesiones
4. ⚠️ Calendly/Google no sincronizado bidireccionalemente
5. ⚠️ Sin bloqueos/disponibilidad documentada

**Resolución**: Sprint 5.2 cierra TODOS estos gaps con tabla `agendas` + RLS + auditoría.

---

**ESTADO**: Auditoría completada. Listo para especificación funcional.

