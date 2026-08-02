# Sprint 5.1 — Especificación Funcional: Capacidades, Permisos y Organización

**Estado**: Especificación  
**Objetivo**: Diseñar el modelo de capacidades y permisos. NO implementar aún.  
**Deadline**: Antes de empezar a programar Sprint 5.1

---

## 0. Principios Arquitectónicos

### 0.1 Capacidades, no Roles Rígidos
**NUNCA** se programa así:
```javascript
if(user.role === 'coach') { /* hacer algo */ }
if(user.role === 'admin') { /* hacer algo */ }
```

**SIEMPRE** se programa así:
```javascript
if(hasCapability(user, 'clientes.edit')) { /* hacer algo */ }
if(hasCapability(user, 'analytics.view')) { /* hacer algo */ }
```

### 0.2 Especialidad ≠ Permisos
Dos dimensiones **completamente independientes**:
- **Especialidad**: `Career`, `Executive`, `Fitness`, `Nutrition`, etc. (QUÉ enseña)
- **Capacidades**: `clientes.read`, `agenda.edit`, `analytics.view`, etc. (QUÉ puede hacer)

Un coach puede:
- Tener especialidad `Career` Y capacidades `['clientes.read', 'clientes.edit', 'agenda.view']`
- O tener especialidad `Career` Y capacidades `['clientes.read']` (solo lectura)
- O tener especialidad `Executive` Y capacidades `['agenda.edit', 'mensajes.send']` (no ve clientes completos)

**Nunca se filtran capacidades por especialidad.**

### 0.3 Una Sola Fuente de Verdad (Permisos)
Los permisos se almacenan en **una única tabla**: `user_capacidades` (user_id, capacidad, enabled).

- No duplicar permisos en código
- No almacenarlos en roles duros
- Una query centralizada: `getCapabilities(user_id)` devuelve el set completo

---

## 1. Tipos de Personas del Equipo

**Exactamente 3 tipos. No agregar más.**

| Tipo | Descripción | Casos de Uso |
|------|-------------|--------------|
| **Owner** | Propietario/a de la organización | Micaela, co-fundador, gerente general |
| **Coach** | Profesional que hace mentorías/coaching | Todos los coaches, especialistas |
| **Colaborador** | Asistentes, recruiters, RRHH, administrativos | Recruiters, asistentes, analytics, etc. |

**Nota**: `tipo` es metadatos; los permisos reales vienen de `capacidades`.

---

## 2. Modelo de Capacidades Completo

### 2.1 Estructura
Cada capacidad tiene forma: `entidad.acción`

Ejemplos:
- `clientes.read`, `clientes.edit`, `clientes.delete`
- `agenda.view`, `agenda.edit`, `agenda.cancel`
- `analytics.view_own`, `analytics.view_org`

### 2.2 Catálogo Completo

#### **CLIENTES** (6)
```
clientes.read           # Ver lista, detalles, foto, historial
clientes.create         # Crear nuevo cliente
clientes.edit           # Editar datos del cliente
clientes.assign         # Reasignar cliente a otro coach/colaborador
clientes.archive        # Archivar/desactivar
clientes.notes          # Agregar/editar notas internas
```

#### **AGENDA** (5)
```
agenda.view_own         # Ver propias sesiones
agenda.view_team        # Ver agenda del equipo
agenda.create           # Crear sesión/reunión
agenda.edit             # Editar sesiones propias
agenda.cancel           # Cancelar sesiones
```

#### **PROGRAMAS** (4)
```
programas.create        # Crear programa nuevo
programas.edit          # Editar programa existente
programas.publish       # Publicar programa (hacerlo disponible)
programas.delete        # Eliminar/archivar programa
```

#### **RECURSOS** (4)
```
recursos.create         # Crear recurso (PDF, video, ejercicio, formulario)
recursos.share          # Compartir recurso con clientes/coaches
recursos.edit           # Editar recurso
recursos.delete         # Eliminar recurso
```

#### **BIBLIOTECA** (2)
```
biblioteca.manage       # Gestionar biblioteca de especialidad
biblioteca.publish      # Publicar recursos en biblioteca
```

#### **MENSAJES** (3)
```
mensajes.send           # Enviar mensajes a clientes
mensajes.view           # Ver historial de mensajes
mensajes.archive        # Archivar conversaciones
```

#### **IA** (2)
```
ia.use                  # Usar Claude IA (análisis, informes, etc.)
ia.crear_prompts        # Crear/editar prompts personalizados
```

#### **COMUNIDAD** (3) — Reserved
```
comunidad.publicar      # Publicar posts/contenido
comunidad.moderar       # Moderar posts, comentarios
comunidad.ver           # Ver comunidad (siempre acceso, pero puede ser read-only)
```

#### **MARKETPLACE** (3) — Reserved
```
marketplace.perfil      # Tener perfil público
marketplace.recibir     # Recibir clientes del marketplace
marketplace.reviews     # Gestionar reseñas
```

#### **ANALYTICS** (3)
```
analytics.view_own      # Ver métricas propias (sesiones, clientes, retención)
analytics.view_org      # Ver métricas organizacionales (todos los coaches)
analytics.export        # Exportar datos a CSV/Excel
```

#### **COBROS** (5) — Reserved (relación con Sprint 5.3)
```
billing.view_own        # Ver ingresos propios
billing.view_org        # Ver ingresos organizacionales
billing.manage_invoice  # Gestionar facturas, pagos
billing.receive_payment # Cobrar pagos (Stripe, etc.)
billing.export          # Exportar reportes de cobros
```

#### **CONFIGURACIÓN** (3)
```
config.usuarios         # Gestionar usuarios, invitaciones, capacidades
config.branding         # Editar branding de la org (colores, logo, etc.)
config.especialidades   # Habilitar/deshabilitar especialidades
```

#### **COLABORACIÓN** (2) — Reserved (relación con Sprint 5.4)
```
collab.compartir_cliente # Compartir cliente con otro coach/colaborador
collab.delegar          # Delegar sesiones/tareas a otros
```

### 2.3 Totales por Tipo
```
Owner:       ~45 capacidades (casi todas excepto restricciones de seguridad)
Coach:       ~20-25 capacidades (variable según especialidad y modelo)
Colaborador: ~5-15 capacidades (altamente variable)
Futuras:     ~15 capacidades reserved (marketplace, community, IA, billing, collab)
```

---

## 3. Matriz de Permisos Base

### 3.1 Owner

**Tiene todas las capacidades EXCEPTO:**
- No puede `collab.delegar` a sí mismo
- No puede editar su propia contraseña desde permisos (va a settings)

**Ejemplos de lo que SÍ puede:**
- Ver/editar/eliminar cualquier cliente
- Ver/editar cualquier programa
- Ver analytics de toda la org
- Invitar/gestionar equipo
- Configurar branding, especialidades
- Ver/autorizar pagos

### 3.2 Coach Estándar

**Capacidades básicas** (preset):
```
clientes.read
clientes.edit           # Solo propios
clientes.notes
agenda.view_own
agenda.create
agenda.edit             # Solo propias
programas.create
programas.edit          # Solo propios
recursos.create
recursos.share
mensajes.send
ia.use
analytics.view_own
```

**Capacidades que NO tiene por defecto:**
- `clientes.create` (owner asigna clientes)
- `clientes.archive` (solo owner)
- `clientes.assign` (solo owner)
- `agenda.view_team` (no ve agenda del equipo)
- `config.*` (no acceso a configuración)
- `billing.view_org` (no ve ingresos globales)

### 3.3 Coach Senior

**Extiende Coach Estándar con:**
```
+ clientes.create       # Puede aceptar clientes nuevos
+ clientes.assign       # Puede reasignar a colegas
+ agenda.view_team      # Ve agenda del equipo para coordinación
+ analytics.view_own
+ collab.compartir_cliente  # Puede derivar/colaborar
```

### 3.4 Recruiter (Colaborador)

**Preset especializado:**
```
clientes.read           # Ve lista de candidatos
clientes.create         # Crea candidatos nuevos
clientes.assign         # Asigna a coaches
agenda.view_own         # Solo propias
mensajes.send           # Contacta candidatos
analytics.view_own      # Ve su propia actividad
```

**Capacidades que NO tiene:**
- `clientes.edit` (no edita datos del candidato)
- `programas.*` (no maneja programas)
- `config.*`

### 3.5 Asistente (Colaborador)

**Preset de apoyo:**
```
agenda.create           # Crea reuniones
agenda.edit             # Edita reuniones
agenda.view_own
mensajes.send           # Envía recordatorios, confirmaciones
clientes.read           # Lee datos para asistencia
```

**Capacidades que NO tiene:**
- `clientes.create`, `clientes.edit`
- `programas.*`
- `analytics.*`
- `config.*`

### 3.6 Administrador Recursos (Colaborador)

**Preset para gestión:**
```
recursos.create
recursos.share
recursos.edit
recursos.delete
biblioteca.manage
biblioteca.publish
analytics.view_org      # Ve uso de recursos
```

**Capacidades que NO tiene:**
- `clientes.*`
- `agenda.*` (no necesita)
- `config.*`

### 3.7 RRHH (Colaborador)

**Preset de datos:**
```
clientes.read
analytics.view_org      # Reportes de retención, progreso
analytics.export
```

**Capacidades que NO tiene:**
- Cualquier cosa de edición
- Cualquier cosa de operación
- Acceso a mensajes personales

---

## 4. Gestión de Permisos (UI)

### 4.1 Nueva Sección en Equipo (MultiCoach)

**Ubicación**: `multicoach.html` → Sección "Equipo" → Drawer persona → Tab "Capacidades"

### 4.2 Interfaz de Permisos

```
[Persona: Carlos Pérez]
Tipo: Coach
Especialidad: Career, Executive

┌─ CAPACIDADES
│
├─ 📋 CLIENTES
│  ☐ Ver
│  ☐ Crear
│  ☐ Editar
│  ☐ Reasignar
│  ☐ Archivar
│  ☐ Notas
│
├─ 📅 AGENDA
│  ☐ Ver propias
│  ☐ Ver equipo
│  ☐ Crear
│  ☐ Editar
│  ☐ Cancelar
│
├─ 📚 PROGRAMAS
│  ☐ Crear
│  ☐ Editar
│  ☐ Publicar
│  ☐ Eliminar
│
├─ 📁 RECURSOS
│  ☐ Crear
│  ☐ Compartir
│  ☐ Editar
│  ☐ Eliminar
│
├─ 💬 MENSAJES
│  ☐ Enviar
│  ☐ Ver
│  ☐ Archivar
│
├─ 🤖 IA
│  ☐ Usar
│  ☐ Crear prompts
│
├─ 📊 ANALYTICS
│  ☐ Ver propios
│  ☐ Ver organización
│  ☐ Exportar
│
└─ ⚙️ CONFIG (solo Owner)
   ☐ Usuarios
   ☐ Branding
   ☐ Especialidades
```

### 4.3 Presets (Botones Rápidos)

En la parte superior del drawer:

```
┌─────────────────────────────────────────┐
│ Presets rápidos:                        │
│ [Coach Estándar] [Coach Senior]         │
│ [Recruiter] [Asistente] [Admin Recurs.] │
│ [Personalizado]                         │
└─────────────────────────────────────────┘
```

**Cuando hace click en un preset**:
1. Se cargan todas las capacidades del preset
2. Puede hacer modificaciones manuales (no vuelve al preset)
3. Un pequeño indicador dice "Basado en: Coach Estándar (modificado)"

### 4.4 Workflow

1. **Crear nueva persona**:
   - Invitar email → Se crea con tipo `Colaborador`
   - Se le asigna preset por defecto: `Asistente`
   - Owner puede cambiar tipo y capacidades

2. **Editar permisos**:
   - Click en persona → Tab "Capacidades"
   - Elegir preset o modificar manualmente
   - Botón "Guardar"
   - Toast: "Permisos actualizados"

3. **Guardar**:
   - Inserta/actualiza en tabla `user_capacidades`
   - Audita: `{who, when, what_changed}`
   - El usuario recibe notificación (email): "Tus permisos han sido actualizados"

---

## 5. Relación con Clientes

### 5.1 Asignación

- **`clientes.assign`**: Solo quien tenga esta capacidad puede asignar.
- Al asignar, se crea registro en `auditoría`: `{evento: 'client.assigned', coach_from, coach_to, client_id}`

### 5.2 Lectura

- **`clientes.read`**: Puede ver la lista en su panel (`panel-v2.html`).
- **Filtro automático**: El panel solo muestra clientes asignados a esa persona (o todo el equipo si `agenda.view_team`).

### 5.3 Edición

- **`clientes.edit`**: Puede editar datos del cliente.
- No puede editar si el cliente NO es suyo (incluso con `clientes.edit`, es sobre los propios).
- **Exception**: Owner y quien tenga `clientes.edit` + `agenda.view_team` puede editar cualquiera.

### 5.4 Notas

- **`clientes.notes`**: Puede agregar/editar notas privadas del cliente.
- Cualquiera con esta capacidad ve TODAS las notas (compartidas).
- Audita quién escribió cada nota.

---

## 6. Relación con Agenda (Sprint 5.2)

### 6.1 Capacidades Relacionadas

```
agenda.view_own         # Ver propias sesiones
agenda.view_team        # Ver sesiones del equipo
agenda.create           # Crear sesión
agenda.edit             # Editar sesión
agenda.cancel           # Cancelar sesión
```

### 6.2 Reglas

- **Vista**: Solo puede ver si tiene `agenda.view_own` (propias) o `agenda.view_team` (todas).
- **Crear**: Necesita `agenda.create`. Coach A puede crear sesión para Coach B si tiene `agenda.view_team` (indicio de que puede ver/operar).
- **Editar**: Solo puede editar si es suya O si tiene permisos elevados (Owner, `agenda.view_team`).
- **Cancelar**: Necesita `agenda.cancel`.
- **Bloquear horas** (futuro): Nueva capacidad `agenda.block_time` (no implementar aún).

### 6.3 Ejemplos

| Situación | Necesita | Puede hacer |
|-----------|----------|-------------|
| Coach ve su propia agenda | `agenda.view_own` | ✅ |
| Coach ve agenda equipo | `agenda.view_team` | ✅ (solo si tiene capacidad) |
| Asistente crea reunión | `agenda.create` | ✅ Crear, pero no editar si no es propia |
| Coach cancela sesión propia | `agenda.cancel` | ✅ |
| Coach intenta cancelar sesión ajena | `agenda.cancel` + perms elevados | ⚠️ Depende de `agenda.view_team` |

---

## 7. Relación con Cobros (Sprint 5.3)

### 7.1 Capacidades Relacionadas

```
billing.view_own        # Ver ingresos propios
billing.view_org        # Ver ingresos totales org
billing.manage_invoice  # Gestionar facturas
billing.receive_payment # Cobrar pagos
billing.export          # Exportar reportes
```

### 7.2 Reglas

- **Ver ingresos propios**: Coach siempre ve lo suyo (si tiene `billing.view_own`).
- **Ver ingresos org**: Solo Owner y quien tenga `billing.view_org`.
- **Modelo de cobro variable**: El Coach puede:
  - Cobrar directamente (si tiene `billing.receive_payment` + modelo A/B)
  - O cobrar vía empresa (si modelo C/D)
- **Comisiones**: Configurables por coach (ej: 70% coach, 30% empresa).

### 7.3 Ejemplos

| Coach | Capacidades | Modelo | Resultado |
|-------|-------------|--------|-----------|
| Coach A | `billing.view_own`, `billing.receive_payment` | A (directo) | Cobra directamente; ve sus ingresos |
| Coach B | `billing.view_own` | C (empresa) | Solo ve ingresos procesados por empresa |
| Owner | `billing.view_org`, `billing.manage_invoice` | - | Ve todos; gestiona facturas |

---

## 8. Colaboración (Sprint 5.4)

### 8.1 Más Allá de Coach → Cliente

**Patrones permitidos** (si tienen capacidades):

```
Coach A ↔ Coach B       # Compartir cliente, derivar sesión
Coach ↔ Colaborador     # Recruiter prepara, coach toma
Colaborador ↔ Owner     # Admin reporta, owner aprueba
```

### 8.2 Capacidades Relacionadas

```
collab.compartir_cliente    # Compartir acceso a cliente
collab.delegar              # Delegar sesión/tarea a otro
```

### 8.3 Ejemplos

**Caso 1**: Recruiter prepara candidato, Coach continúa
```
1. Recruiter: clientes.create + clientes.assign
   → Crea candidato, lo asigna a Coach
2. Coach: clientes.read + clientes.edit
   → Ve candidato, continúa la mentoria
3. Auditoría: "Client created by recruiter, assigned to coach"
```

**Caso 2**: Coach A y Coach B colaboran en sesión
```
1. Coach A: clientes.read + collab.compartir_cliente
   → Comparte cliente con Coach B
2. Coach B: clientes.read + agenda.create
   → Ve cliente, crea sesión puntual
3. Auditoría: "Client shared with Coach B"
```

---

## 9. Auditoría

### 9.1 Eventos Registrados

```
capacidad.changed       # Capacidades de usuario cambiaron
client.assigned         # Cliente asignado a coach
client.shared           # Cliente compartido
client.edited           # Cliente editado
agenda.created          # Sesión creada
agenda.canceled         # Sesión cancelada
mensaje.sent            # Mensaje enviado
programa.published      # Programa publicado
recurso.shared          # Recurso compartido
```

### 9.2 Schema

```sql
CREATE TABLE auditoría (
  id SERIAL PRIMARY KEY,
  evento TEXT,               -- capacidad.changed
  usuario_id UUID,           -- Quién
  timestamp TIMESTAMPTZ,     -- Cuándo
  entidad TEXT,              -- clientes, agenda, etc.
  entidad_id UUID,           -- ID del cliente/sesión
  cambios JSONB,             -- Qué cambió {old_value, new_value}
  detalles TEXT              -- Notas adicionales
);
```

### 9.3 Ejemplo

```json
{
  "evento": "capacidad.changed",
  "usuario_id": "owner-123",
  "timestamp": "2026-08-02T15:30:00Z",
  "entidad": "usuarios",
  "entidad_id": "coach-456",
  "cambios": {
    "capacidades_added": ["clientes.assign", "agenda.view_team"],
    "capacidades_removed": ["programas.create"]
  },
  "detalles": "Coach promovido a Senior"
}
```

---

## 10. Capacidades Futuras (Reserved)

**Placeholders para funcionalidades que vienen en Sprints 5.2+.**

No tienen UI, pero los identificadores están **reservados** para que cuando se implemente no haya que rediseñar toda la matriz.

```
MARKETPLACE (Sprint ??)
├─ marketplace.perfil
├─ marketplace.recibir
└─ marketplace.reviews

COMUNIDAD (Sprint ??)
├─ comunidad.publicar
├─ comunidad.moderar
└─ comunidad.ver

IA AVANZADA (Sprint ??)
├─ ia.crear_prompts
└─ ia.use

COBROS (Sprint 5.3)
├─ billing.view_own
├─ billing.view_org
├─ billing.manage_invoice
├─ billing.receive_payment
└─ billing.export

COLABORACIÓN (Sprint 5.4)
├─ collab.compartir_cliente
└─ collab.delegar
```

---

## 11. Restricciones de Diseño

### 11.1 NO modificar estos archivos
- `panel-v2.html` — Su lógica sigue igual
- `cliente.html` — El cliente sigue viendo lo suyo
- `analytics.html` (si existe) — Lógica de agregación sin cambios
- `programas.html` (si existe) — Gestión de programas sin cambios
- `recursos.html` (si existe) — Gestión sin cambios

### 11.2 SOLO definir permisos
- La lógica de autenticación y autorización VA EN:
  - **Backend**: Migrations SQL + RLS en Supabase
  - **Frontend**: Helper `hasCapability(user, 'accion')` en JS

### 11.3 No crear nuevas entidades
- Los permisos se almacenan en tabla `user_capacidades`, punto.
- No crear `roles`, `permisos`, `grupos`, etc.

---

## 12. Tabla SQL Mínima (Especificación)

```sql
-- Tabla de capacidades por usuario
CREATE TABLE user_capacidades (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  capacidad TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, capacidad)
);

-- Índices
CREATE INDEX idx_user_capacidades_user_id ON user_capacidades(user_id);
CREATE INDEX idx_user_capacidades_capacidad ON user_capacidades(capacidad);

-- RLS (simple): Owner del org ve el suyo, usuarios ven sus propias capacidades
ALTER TABLE user_capacidades ENABLE ROW LEVEL SECURITY;
```

---

## 13. Criterios de Aceptación

- [x] Sistema basado en capacidades, no en roles rígidos
- [x] Especialidad independiente de permisos
- [x] Un único modelo válido para cualquier nicho (Career, Fitness, etc.)
- [x] Presets reutilizables de permisos (6+)
- [x] Matriz completa de permisos (45+ capacidades)
- [x] Preparado para Agenda (Sprint 5.2)
- [x] Preparado para Cobros (Sprint 5.3)
- [x] Preparado para Colaboración (Sprint 5.4)
- [x] Sin duplicar funcionalidades existentes
- [x] Compatible con la arquitectura bloqueada de MultiCoach
- [x] Capacidades futuras reservadas (marketplace, community, AI, billing, collab)

---

## 14. Próximos Pasos

1. **Revisión de la especificación**: Owner + Product Owner
2. **Validación de Sprints 5.2 y 5.3**: Verificar que agenda y cobros caben en este modelo
3. **Sprint 5.1 Implementación**: SQL + Helper JS `hasCapability()`
4. **Sprint 5.1 UI**: Drawer de Capacidades en MultiCoach
5. **Sprint 5.2+**: Aplicar permisos en cada módulo

---

**FIN DE ESPECIFICACIÓN**
