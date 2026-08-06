# Arquitectura de MultiCoach v3

**Versión:** 1.0 (Sprint Clientes congelado)  
**Fecha:** 2026-08-05  
**Estado:** ✅ Operativo y Congelado (solo bug fixes)  
**Archivo principal:** `multicoach.html` (2800+ líneas, JS inline)

---

## 📦 Estructura de Módulos

```
multicoach.html (2800 líneas)
├── <style> — CSS integrado (líneas 9–480)
│   ├── Layout base (header, tabs, main, sections)
│   ├── Components (drawer, modal, table, stat-card, badge)
│   ├── Responsive breakpoints (768px, 480px)
│   └── Animations & transitions
│
├── <script> — JavaScript inline (líneas 1080–2914)
│   ├── INIT & STATE (1080–1134)
│   ├── DATA LOADERS (1140–1235)
│   ├── RENDERERS (1241–1396)
│   ├── SEARCH & SORT (1390–1444)
│   ├── EQUIPO CRUD (1450–1801)
│   ├── CLIENTES CRUD (2000–2778)
│   ├── SHARED HELPERS (2784–2907)
│   └── UTILS (2031–2057)
│
└── <body> — HTML structure
    ├── Header (logo, agregar persona, logout)
    ├── Tabs (Equipo, Clientes)
    ├── Sections
    │   ├── #equipo (stats + table + drawer)
    │   └── #clientes (stats + table + drawer + modals)
    └── Modals & Overlays (8 modales + 8 overlays)
```

---

## 🎯 Responsabilidades de Pantallas

### Pantalla: Equipo (`<section id="equipo">`)

**¿Qué hace?**
- Muestra todos los miembros de la organización (coaches, owners, colaboradores)
- Permite crear, editar, cambiar roles, configurar permisos, desactivar y quitar miembros
- Muestra carga de clientes por miembro (capacidad visual)
- Reasigna clientes cuando se quita un miembro

**Estado local:**
```javascript
allEquipo[]          // Array completo de miembros
filteredEquipo[]     // Después de aplicar filtros
currentEquipoSelected // Miembro en el drawer
```

**Flujos principales:**
1. Load equipo → loadEquipo() con count de clientes
2. Filter/Sort → filterEquipo() + sortEquipo()
3. Click row → openEquipoDrawer()
4. Acciones: cambiar rol, permisos, desactivar, quitar, reasignar

**Validaciones críticas:**
- ✅ No desactivar/quitar si tiene clientes
- ✅ No quitar único owner
- ✅ Todos filtrados por org_id

---

### Pantalla: Clientes (`<section id="clientes">`)

**¿Qué hace?**
- Muestra todos los clientes de la organización
- Permite crear (wizard 3-step), editar, cambiar coach, reasignar, activar/desactivar
- Multi-select para reasignación masiva
- Drawer muestra contexto del cliente (coach info, capacity bar, cartera)

**Estado local:**
```javascript
allClientes[]        // Array completo
filteredClientes[]   // Después de filtros
selectedClientIds    // Set de IDs seleccionados (multi-select)
currentClienteSelected // Cliente en drawer
wizardState{}        // Estado del wizard
```

**Flujos principales:**
1. Load clientes → loadClientes() enriquecido con coach_nombre
2. Create (wizard):
   - Step 1: Email validation → check si existe
   - Step 2: Confirm (si existe en org)
   - Step 3: Coach selection (recomendación automática)
3. Click row → openClienteDrawer()
4. Acciones: cambiar coach, ver cartera, editar, activar/desactivar
5. Multi-select → reasignación masiva

**Validaciones críticas:**
- ✅ Cliente SIEMPRE debe tener coach (dropdown sin "Sin coach")
- ✅ Wizard recomendador de coach automático
- ✅ Email válido y chequeo de duplicados en org
- ✅ Todos filtrados por org_id

---

## 📊 Flujo de Datos

```
ENTRADA: localStorage (mj_user)
  ↓
  init() → parse user.org_id → currentOrgId
  ↓
CARGA INICIAL:
  ├─ loadEquipo() → SELECT usuarios WHERE org_id + COUNT(clientes) por coach
  ├─ loadCoaches() → SELECT usuarios (coach/owner) WHERE org_id
  └─ loadClientes() → SELECT candidatos WHERE org_id → enrich con coach_nombre
  ↓
MEMORIA (Global State):
  ├─ allEquipo[] (coaches, owners, colaboradores)
  ├─ allCoaches[] (subset de allEquipo, solo coach/owner)
  ├─ allClientes[] (todos los candidatos de la org)
  ├─ filteredEquipo[], filteredClientes[] (después de búsqueda/filtros)
  └─ selectedClientIds (Set, para multi-select)
  ↓
OPERACIONES (CRUD):
  ├─ CREATE → submitAddPerson(), wizardCreateCliente()
  ├─ UPDATE → updateClienteCoach(), submitChangeRole(), submitEditCliente()
  ├─ REASSIGN → _reassignClientsShared() [shared por ambos tabs]
  └─ DELETE → removeEquipoMember()
  ↓
PERSISTENCIA:
  └─ Supabase PostgREST API (todas las operaciones van a BD)
  ↓
ACTUALIZACIÓN:
  └─ loadEquipo() + loadClientes() → rerenderizado completo
```

**Pattern: Optimistic UI + Server Validation**
```javascript
// 1. Cambio en memoria
cliente.coach_id = newCoachId;
renderClientes();  // UI actualiza al instante

// 2. Envío al servidor
await sb.from('candidatos').update({ coach_id: newCoachId })
  .eq('id', clienteId)
  .eq('org_id', currentOrgId);

// 3. Si falla, revert + alert
catch (e) {
  cliente.coach_id = oldCoachId;
  renderClientes();
  alert('Error al cambiar coach');
}
```

---

## 📋 Reglas de Negocio

### 1. Aislamiento Multi-Tenant por `org_id`
**Regla:** Toda operación DEBE filtrar por `eq('org_id', currentOrgId)`

**Implementación:**
```javascript
// En todas las queries
.eq('org_id', currentOrgId)

// En todos los loads
loadEquipo()   // línea 1147
loadCoaches()  // línea 1184
loadClientes() // línea 1216
```

**Validación:** Guardrail `check-guardrails.js` verifica esto

---

### 2. Capacidad de Coaches (Clientes/Coach)
**Regla:** Cada rol tiene límite de clientes asignados

| Rol | Límite | Cálculo |
|-----|--------|---------|
| owner | 120 | `getCapacity(member).limit` |
| coach | 45 | Idem |
| colaborador | 20 | Idem |

**Visual:** Barra de capacidad 3 colores
- 🟢 Verde: <80%
- 🟡 Amarillo: 80-99%
- 🔴 Rojo: ≥100%

**Uso:** Coach selection, capacity warnings, recomendación automática

---

### 3. Regla del Owner Mínimo
**Regla:** SIEMPRE debe haber al menos 1 owner en la organización

**Validación (línea 1688):**
```javascript
if (currentRole === 'owner' && newRole !== 'owner' && ownerCount <= 1) {
  // Bloquear cambio de rol
  alert('Debe existir al menos un Owner');
  return;
}
```

---

### 4. Integridad: No Orfandad de Clientes
**Regla:** Cliente SIEMPRE tiene un coach asignado (nunca NULL)

**Enforcement:**
1. Wizard: `if (!coachId) return` (línea 2536) — bloquea crear sin coach
2. Tabla: Dropdown SIN opción vacía (línea 2127)
3. Validación: `updateClienteCoach()` (línea 1361) — bloquea si vacío

---

### 5. Integridad: No Miembro Duplicado
**Regla:** Un usuario NO puede estar en dos organizaciones a la vez

**Validación (línea 1931):**
```javascript
if (foundUser.org_id === currentOrgId) {
  // Ya está aquí
  throw new Error('Este usuario ya pertenece a esta organización');
} else if (foundUser.org_id !== null) {
  // Pertenece a otra org
  throw new Error('Este usuario ya pertenece a otra organización');
}
```

---

### 6. Bloqueo Operacional: Miembro con Clientes
**Regla:** No puedes desactivar ni quitar un miembro que tenga clientes asignados

**Lugares:**
- Desactivar (línea 1511): `if (!newState && member.client_count > 0) → alert + return`
- Quitar (línea 1541): Idem

**Razón:** Evitar huérfanos; primero hay que reasignar

---

## 🔐 Permisos

### Modelo de Roles

| Rol | Puede crear clientes | Ver clientes | Editar clientes | Cambiar coach | Ver equipo | Cambiar rol | Ver cartera |
|-----|----------------------|--------------|-----------------|---------------|-----------|-------------|------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Coach** | ✅ | ✅ (sus clientes) | ✅ (sus clientes) | ✅ (sus) | ✅ (su perfil) | ❌ | ✅ |
| **Colaborador** | ✅ (si permisos) | ✅ (si perm) | ✅ (si perm) | ✅ | ❌ | ❌ | ❌ |

### Permisos Granulares (Colaborador)
Almacenados en `usuarios.configuracion.permisos`:
```json
{
  "ver_clientes": true,
  "editar_clientes": false,
  "ver_reportes": true
}
```

**Configuración:** Modal `#config-perms-modal` (línea 1730)

**Aplicación:** TODO — aún no se filtra en el panel

---

## 🔗 Relaciones entre Entidades

### Organización (org_id)

```
organizaciones {
  id
  nombre
  marca          (color de branding)
  plan           (Basic/Pro)
  owner_id       (user.id)
  created_at
}
```

**Relación:** 1 organización = N usuarios + N candidatos

---

### Usuario (Coach/Colaborador)

```
usuarios {
  id
  email          (UNIQUE)
  nombre
  org_id         (FK → organizaciones; NULL si sin org)
  rol            ('owner' | 'coach' | 'colaborador')
  activo         (boolean)
  configuracion  {
    especialidad: string
    permisos: { ver_clientes, editar_clientes, ver_reportes }
  }
  created_at
}
```

**Relaciones:**
- 1 usuario = N candidatos (coach_id FK)
- 1 usuario = 1 organizaciones (org_id FK)

---

### Cliente (Candidato)

```
candidatos {
  id
  email          (UNIQUE per org? NO — TODO validar)
  nombre
  coach_id       (FK → usuarios; NOT NULL)
  org_id         (FK → organizaciones; NOT NULL)
  activo         (boolean)
  created_at
  [otros campos de coaching]
}
```

**Relaciones:**
- N candidatos = 1 usuario (coach)
- N candidatos = 1 organizaciones
- 1 candidato SIEMPRE tiene 1 coach (constraint: NOT NULL)

---

### Diagrama Conceptual

```
┌─────────────────────────────────────────────────────────────────┐
│ organizaciones (org_id)                                          │
│ ├─ 1 owner (usuario.rol='owner')                               │
│ ├─ N coaches (usuario.rol='coach')                             │
│ └─ N colaboradores (usuario.rol='colaborador')                 │
└─────────────────────────────────────────────────────────────────┘
           ↓
           │ (FK: org_id)
           ↓
┌─────────────────────────────────────────────────────────────────┐
│ usuarios (coach/owner/colaborador)                               │
│ ├─ id, email, nombre, activo                                   │
│ ├─ rol, org_id                                                 │
│ └─ configuracion { especialidad, permisos }                    │
└─────────────────────────────────────────────────────────────────┘
           ↓
           │ (FK: coach_id)
           ↓
┌─────────────────────────────────────────────────────────────────┐
│ candidatos (clientes)                                            │
│ ├─ id, email, nombre, activo                                   │
│ ├─ coach_id (NOT NULL — SIEMPRE tiene coach)                  │
│ ├─ org_id                                                       │
│ └─ [programa, sesiones, documentos, etc]                       │
└─────────────────────────────────────────────────────────────────┘
```

**Invariante Core:**
- `candidatos.coach_id` NUNCA es NULL
- `candidatos.org_id` NUNCA es NULL
- `usuarios.org_id` puede ser NULL (sin asignar a organización)

---

## 🎬 Flujos Principales de Usuario

### Flujo 1: Crear Cliente Nuevo

```
1. Usuario: click "+Crear primer cliente" o "Crear cliente"
2. → openCreateClienteModal()
   └─ Renderiza wizard
3. Step 1: Email input + validation
   └─ User entra email → click "Siguiente"
4. → wizardNextStep() step=1
   └─ Valida email (@)
   └─ SELECT candidatos WHERE email
5. Step 2 o 3:
   ├─ Si existe en esta org: Step 2 (confirmar)
   ├─ Si existe en otra org: Bloquea
   └─ Si no existe: Step 3 (coach selection)
6. Step 3: Coach selector con recomendación automática
   └─ Calcula coach con menor carga
   └─ Muestra recomendación (card azul)
7. User: selecciona coach (o usa recomendado) → click "Crear cliente"
8. → wizardCreateCliente()
   ├─ Si existe: UPDATE candidatos SET coach_id WHERE id + org_id
   └─ Si nuevo: INSERT candidatos (email, nombre, coach_id, org_id)
9. → loadCoaches() + loadClientes()
10. → renderCoaches() + renderClientes()
11. Cierra modal, vuelve a tabla
```

---

### Flujo 2: Cambiar Coach de Cliente

```
1. Usuario: click en cliente en tabla
2. → openClienteDrawer(clienteId)
   └─ Renderiza drawer con info del cliente
3. Drawer: muestra coach actual + botón "Cambiar coach"
4. User: click "Cambiar coach"
5. → openChangeCoachModal()
   └─ Renderiza modal con dropdown
   └─ Coach selector con recomendación
6. User: selecciona nuevo coach → click "Cambiar"
7. → submitChangeCoach()
   ├─ UPDATE candidatos SET coach_id WHERE id + org_id
   └─ Actualiza memory + refreshes
8. Cierra modal, vuelve a drawer actualizado
```

---

### Flujo 3: Reasignación Masiva

```
1. Usuario: selecciona múltiples clientes con checkboxes
2. → toggleClienteCheckbox(clienteId)
   └─ Agrega/remueve de selectedClientIds (Set)
3. Aparece barra: "N cliente(s) seleccionado(s) | Reasignar | Limpiar"
4. User: click "Reasignar"
5. → openReassignClientesMasiveModal()
   └─ Dropdown con coaches + capacidad
6. User: selecciona coach destino → click "Reasignar"
7. → submitReassignClientesMasive()
   ├─ _reassignClientsShared(Array(clientIds), coachId)
   ├─ UPDATE candidatos SET coach_id WHERE id IN (...) + org_id
   └─ selectedClientIds.clear()
8. → loadCoaches() + loadClientes()
9. Cierra modal, tabla actualizada, checkboxes limpios
```

---

### Flujo 4: Cambiar Rol de Miembro

```
1. Usuario: abre drawer de miembro
2. Click "Cambiar rol"
3. → changeEquipoRole()
   └─ Modal con dropdown de roles
4. User: selecciona nuevo rol → click "Cambiar"
5. → submitChangeRole()
   ├─ Validación: if único owner y newRole != owner → bloquea
   ├─ UPDATE usuarios SET rol WHERE id + org_id
   └─ Renderiza
6. Cierra modal, drawer actualizado
```

---

## 🛡️ Seguridad

### Defense in Depth

**Layer 1: Frontend filtering**
- `currentOrgId` filtro en todas las queries
- State filters (`filteredEquipo`, `filteredClientes`)

**Layer 2: PostgREST `.eq('org_id', currentOrgId)` en todas las operaciones
- `loadEquipo()`, `loadClientes()`
- `updateClienteCoach()`, `_reassignClientsShared()`

**Layer 3: RLS en Supabase (backend)**
- Policy `candidatos_select`: `org_id = auth.org_id()`
- Policy `usuarios_select`: `org_id = auth.org_id()`

**Layer 4: Guardrails (`check-guardrails.js`)**
- Verifica que TODAS las queries tengan `.eq('org_id')`

---

## 📈 Performance Considerations

### Optimizaciones Actuales
- ✅ Single pass render (no re-renders innecesarios)
- ✅ Batch query: COUNT en loadEquipo() es async paralelo
- ✅ Memoization: state arrays cached en memory

### Cuellos de Botella Potenciales (Post-MVP)
- ❌ Sin paginación: si org tiene 10k+ clientes, tabla lag
- ❌ Sin indexación DB: queries pueden ser lentas a escala
- ❌ Without virtual scrolling: tabla big no scrollea suave

**Soluciones para Sprint 2:**
- Agregar paginación (límite 50 por página)
- DB: índices en `org_id`, `coach_id`
- Virtual scrolling si tabla > 500 rows

---

## 🧪 Testing Strategy

### E2E Tests (Playwright)
- `tests/e2e-sprint-equipo.spec.js` — casos de Equipo
- TODO: agregar casos de Clientes

### Smoke Tests (`check-smoke.js`)
- Verifica: handlers existen, assets locales existen

### Guardrails (`check-guardrails.js`)
- Verifica: org_id isolation, owner mínimo, sin dupes, etc.

---

## 🔒 Congelación del Núcleo

**A partir de 2026-08-05, estas áreas están CONGELADAS:**

### Equipo (No cambios funcionales)
- ✅ Crear/agregar/quitar miembros
- ✅ Cambiar roles, permisos
- ✅ Desactivar, reasignar
- 🔒 **FROZEN** — solo bug fixes

### Clientes (No cambios funcionales)
- ✅ Crear/editar/cambiar coach
- ✅ Reasignación masiva
- ✅ Activar/desactivar
- 🔒 **FROZEN** — solo bug fixes

### Validaciones (No cambios)
- ✅ Aislamiento org_id
- ✅ Integridad (min owner, no orfandad)
- 🔒 **FROZEN** — no modificar

**Por qué:** La arquitectura es estable, bien validada. Futuras features (Agenda, Programas, Analytics) se construirán SOBRE esta base, no dentro de ella.

---

## 🚀 Sprints Futuros — Cómo Construir Sobre Esta Base

### Patrón a Seguir

```javascript
// Nuevo módulo: Agenda (Sprint 3)
// NO modificar Equipo/Clientes

// 1. Nueva tabla en HTML
<section id="agenda">
  <div class="stats"></div>
  <div class="card">
    <div id="agenda-container"></div>
  </div>
</section>

// 2. Estado aislado
let allCitas = [];
async function loadCitas() {
  const { data } = await sb
    .from('citas')
    .select(...)
    .eq('org_id', currentOrgId);  // ← SIEMPRE multi-tenant
  allCitas = data;
}

// 3. Seguir el pattern Equipo/Clientes
// → loadData() → renderUI() → CRUD modal → _sharedHelper()

// 4. Compartir con Equipo/Clientes solo lo necesario
// Ejemplo: getCapacity() es usado por Equipo + Agenda + Finanzas
```

---

## 📚 Referencias Rápidas

| Concept | Línea | Función |
|---------|-------|---------|
| Aislamiento org_id | 1147, 1184, 1216 | loadEquipo, loadCoaches, loadClientes |
| Capacidad visual | 1290, 2246 | getCapacity(), renderEquipo |
| Validación owner | 1688 | submitChangeRole() |
| Sin orfandad | 1361, 2536 | updateClienteCoach, wizardCreateCliente |
| Reasignación shared | 2784 | _reassignClientsShared() |
| Drawer cliente | 2213 | openClienteDrawer() |
| Wizard 3-step | 2354, 2401 | wizardState, showWizardStep() |
| Helper coach select | 2857 | _populateCoachSelect() |
| Responsive | 439, 469 | @media queries |

---

## ✅ Checklist de Arquitectura

- ✅ Multi-tenant (org_id isolation)
- ✅ No duplicados (miembros, clientes)
- ✅ Min owner enforced
- ✅ Sin orfandad de clientes
- ✅ Capacidad visual + recomendaciones
- ✅ Reasignación consolidada
- ✅ Drawer vs tabla sin duplicaciones
- ✅ Responsive (desktop/tablet/mobile)
- ✅ XSS protection (esc function)
- ✅ Auditoría + tests

---

**Última actualización:** 2026-08-05  
**Autor:** Claude Code (Sprint Clientes)  
**Congelado:** SÍ (solo bug fixes; próximas features por Sprint nuevo)
