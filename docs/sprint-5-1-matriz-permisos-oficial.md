# Sprint 5.1 — Matriz Oficial de Permisos y Capacidades

**Estado**: Arquitectura congelada  
**Versión**: 1.0  
**Fecha**: 2026-08-02  
**Restricción**: No cambiar sin revisión arquitectónica completa

---

## 0. Principios de la Matriz

1. **Una única fuente de verdad**: Este documento + tabla `user_capacidades` + tabla `capacidades_presets`
2. **Capacidades, no roles**: Los permisos se asignan por capacidad, no por "rol duro"
3. **Organización como contenedor**: Las org settings habilitan/deshabilitan módulos enteros
4. **Herencia clara**: Preset → Personalización → Resultado final (nunca al revés)
5. **Dependencias explícitas**: Si `billing.organization` necesita `analytics.organization`, está documentado
6. **Reservadas para futuro**: Namespaces como `community.*`, `marketplace.*` nacen definidos aunque no tengan UI
7. **Auditoría completa**: Cada cambio registra quién, cuándo, qué, antes, después

---

## 1. MATRIZ OFICIAL DE CAPACIDADES

### 1.1 CLIENTES (6 capacidades)

```
clientes.read
  Descripción: Ver lista de clientes, detalles, historial, notas
  Incluye: Buscar, filtrar, exportar lista
  Depende de: (ninguno)
  Tipo: Base

clientes.create
  Descripción: Crear cliente nuevo en el sistema
  Incluye: Llenar formulario intake, validar email
  Depende de: (ninguno)
  Tipo: Base

clientes.edit
  Descripción: Editar datos del cliente (nombre, email, especialidad, etc.)
  Incluye: Cambiar estado, teléfono, zona horaria, notas internas
  Depende de: clientes.read (implícito)
  Tipo: Acción

clientes.assign
  Descripción: Reasignar cliente a otro coach/colaborador
  Incluye: Cambiar coach asignado, cargar en otra especialidad
  Depende de: clientes.read (implícito)
  Tipo: Acción

clientes.archive
  Descripción: Archivar/desactivar cliente (marcar inactivo)
  Incluye: Marcar como completado, suspendido, trasladado
  Depende de: clientes.read (implícito)
  Tipo: Peligrosa

clientes.notes
  Descripción: Ver y crear notas privadas en cliente
  Incluye: Historial de notas, editar propias notas
  Depende de: clientes.read (implícito)
  Tipo: Base
```

### 1.2 EQUIPO (4 capacidades)

```
equipo.read
  Descripción: Ver lista de coaches y colaboradores
  Incluye: Ver perfiles, especialidades, estado
  Depende de: (ninguno)
  Tipo: Base

equipo.invite
  Descripción: Invitar nuevas personas al equipo
  Incluye: Enviar invitación por email, crear cuenta
  Depende de: (ninguno)
  Tipo: Acción

equipo.edit
  Descripción: Editar datos de personas (nombre, email, especialidad)
  Incluye: Cambiar estado, desactivar, actualizar información
  Depende de: equipo.read (implícito)
  Tipo: Acción

equipo.permissions
  Descripción: Gestionar capacidades de otras personas
  Incluye: Aplicar presets, activar/desactivar capacidades individuales
  Depende de: equipo.read (implícito)
  Tipo: Peligrosa
```

### 1.3 AGENDA (5 capacidades)

```
agenda.view_own
  Descripción: Ver propias sesiones (creadas por o asignadas a)
  Incluye: Ver calendario personal, próximas sesiones
  Depende de: (ninguno)
  Tipo: Base

agenda.view_team
  Descripción: Ver agenda completa del equipo
  Incluye: Ver sesiones de todos los coaches
  Depende de: (ninguno)
  Tipo: Base

agenda.create
  Descripción: Crear sesión/reunión
  Incluye: Reservar slot, invitar participantes
  Depende de: (ninguno)
  Tipo: Acción

agenda.edit
  Descripción: Editar sesiones (cambiar hora, descripción, participantes)
  Incluye: Mover reunión, cambiar cliente, agregar notas
  Depende de: agenda.view_own (implícito)
  Tipo: Acción

agenda.cancel
  Descripción: Cancelar sesión
  Incluye: Dar de baja, notificar participante, registrar cambio
  Depende de: agenda.view_own (implícito)
  Tipo: Peligrosa
```

### 1.4 PROGRAMAS (4 capacidades)

```
programas.create
  Descripción: Crear programa nuevo
  Incluye: Definir módulos, recursos, duración
  Depende de: (ninguno)
  Tipo: Acción

programas.edit
  Descripción: Editar programa existente
  Incluye: Cambiar contenido, módulos, duración, especialidad
  Depende de: programas.read (implícito)
  Tipo: Acción

programas.publish
  Descripción: Publicar programa (hacerlo disponible para asignar)
  Incluye: Marcar como "listo", cambiar estado a activo
  Depende de: programas.edit (implícito)
  Tipo: Acción

programas.delete
  Descripción: Eliminar/archivar programa
  Incluye: Dar de baja, ocultar de lista
  Depende de: programas.read (implícito)
  Tipo: Peligrosa
```

### 1.5 BIBLIOTECA (2 capacidades)

```
biblioteca.read
  Descripción: Ver biblioteca de especialidad
  Incluye: Buscar recursos por especialidad, ver plantillas
  Depende de: (ninguno)
  Tipo: Base

biblioteca.manage
  Descripción: Gestionar contenido de biblioteca (crear, editar, publicar)
  Incluye: Subir recursos, crear plantillas, organizar por especialidad
  Depende de: biblioteca.read (implícito)
  Tipo: Acción
```

### 1.6 RECURSOS (4 capacidades)

```
recursos.create
  Descripción: Crear recurso nuevo (PDF, video, ejercicio, formulario)
  Incluye: Subir archivo, completar metadatos
  Depende de: (ninguno)
  Tipo: Acción

recursos.share
  Descripción: Compartir recurso con clientes o coaches
  Incluye: Dar acceso, enviar link, crear carpeta compartida
  Depende de: recursos.read (implícito)
  Tipo: Acción

recursos.edit
  Descripción: Editar recurso existente
  Incluye: Cambiar contenido, actualizar archivo, modificar descripción
  Depende de: recursos.read (implícito)
  Tipo: Acción

recursos.delete
  Descripción: Eliminar recurso
  Incluye: Dar de baja, archivar
  Depende de: recursos.read (implícito)
  Tipo: Peligrosa
```

### 1.7 MENSAJES (3 capacidades)

```
mensajes.send
  Descripción: Enviar mensajes a clientes/equipo
  Incluye: Chat, email, SMS (según canal)
  Depende de: (ninguno)
  Tipo: Acción

mensajes.view
  Descripción: Ver historial de mensajes
  Incluye: Leer conversaciones, descargar transcripción
  Depende de: (ninguno)
  Tipo: Base

mensajes.archive
  Descripción: Archivar conversaciones
  Incluye: Ocultar de lista, pero no eliminar
  Depende de: mensajes.view (implícito)
  Tipo: Acción
```

### 1.8 IA (2 capacidades)

```
ia.use
  Descripción: Usar Claude IA (análisis, informes, sugerencias)
  Incluye: Generar informes, analizar datos, pedir recomendaciones
  Depende de: (ninguno)
  Tipo: Acción

ia.crear_prompts
  Descripción: Crear/editar prompts personalizados para IA
  Incluye: Definir plantillas, guardar prompts, compartir con equipo
  Depende de: ia.use (implícito)
  Tipo: Acción
```

### 1.9 ANALYTICS (3 capacidades)

```
analytics.view_personal
  Descripción: Ver métricas propias (sesiones, clientes, retención)
  Incluye: Dashboard personal, gráficos propios
  Depende de: (ninguno)
  Tipo: Base

analytics.view_organization
  Descripción: Ver métricas globales de organización
  Incluye: Dashboard org, KPIs, comparativa de coaches
  Depende de: (ninguno)
  Tipo: Base

analytics.export
  Descripción: Exportar reportes a CSV/Excel
  Incluye: Descargar datos, crear reportes personalizados
  Depende de: analytics.view_* (una de las dos)
  Tipo: Acción
```

### 1.10 COBROS (5 capacidades)

```
billing.view_personal
  Descripción: Ver ingresos propios
  Incluye: Ver comisiones, historial de pagos, facturación personal
  Depende de: (ninguno)
  Tipo: Base

billing.view_organization
  Descripción: Ver ingresos globales de organización
  Incluye: Facturación total, comisiones, reportes de cobros
  Depende de: (ninguno)
  Tipo: Base

billing.manage_invoice
  Descripción: Gestionar facturas y pagos
  Incluye: Crear factura, marcar como pagado, enviar comprobante
  Depende de: billing.view_* (una de las dos)
  Tipo: Acción

billing.receive_payment
  Descripción: Cobrar pagos directamente (Stripe, etc.)
  Incluye: Procesar cobro, recibir en cuenta
  Depende de: (ninguno)
  Tipo: Peligrosa

billing.export
  Descripción: Exportar reportes de cobros
  Incluye: Descargar datos de facturación
  Depende de: billing.view_* (una de las dos)
  Tipo: Acción
```

### 1.11 CONFIGURACIÓN (3 capacidades)

```
config.branding
  Descripción: Editar branding de organización
  Incluye: Logo, colores, nombre, dominio
  Depende de: (ninguno)
  Tipo: Peligrosa

config.especialidades
  Descripción: Habilitar/deshabilitar especialidades
  Incluye: Activar Career, Fitness, etc. para la org
  Depende de: (ninguno)
  Tipo: Peligrosa

config.organization
  Descripción: Configurar organización (nombre, plan, datos)
  Incluye: Cambiar plan, cerrar org, datos legales
  Depende de: (ninguno)
  Tipo: Peligrosa
```

### 1.12 COMUNIDAD — RESERVED (3 capacidades)

```
community.post
  Descripción: [RESERVED — Sprint ?] Publicar en comunidad
  Incluye: Crear post, compartir experiencias
  Depende de: (ninguno)
  Tipo: Acción

community.moderate
  Descripción: [RESERVED — Sprint ?] Moderar comunidad
  Incluye: Aprobar posts, eliminar, gestionar reportes
  Depende de: (ninguno)
  Tipo: Peligrosa

community.view
  Descripción: [RESERVED — Sprint ?] Ver comunidad
  Incluye: Leer posts, comentarios, participar (con limitaciones)
  Depende de: (ninguno)
  Tipo: Base
```

### 1.13 MARKETPLACE — RESERVED (3 capacidades)

```
marketplace.profile
  Descripción: [RESERVED — Sprint ?] Tener perfil público en marketplace
  Incluye: Aparecer en listado, recibir reseñas
  Depende de: (ninguno)
  Tipo: Acción

marketplace.receive_leads
  Descripción: [RESERVED — Sprint ?] Recibir clientes desde marketplace
  Incluye: Aceptar leads, gestionar solicitudes
  Depende de: marketplace.profile (implícito)
  Tipo: Acción

marketplace.reviews
  Descripción: [RESERVED — Sprint ?] Gestionar reseñas
  Incluye: Responder a reseña, pedir feedback
  Depende de: marketplace.profile (implícito)
  Tipo: Acción
```

### 1.14 BRANDING — RESERVED (2 capacidades)

```
branding.edit_org
  Descripción: [RESERVED — Sprint ?] Editar branding de organización
  Incluye: Logo, colores, fuente, paleta
  Depende de: (ninguno)
  Tipo: Peligrosa

branding.edit_profile
  Descripción: [RESERVED — Sprint ?] Editar branding personal
  Incluye: Avatar, colores personales, descripción
  Depende de: (ninguno)
  Tipo: Acción
```

### 1.15 COLABORACIÓN — RESERVED (2 capacidades)

```
collab.compartir_cliente
  Descripción: [RESERVED — Sprint 5.4] Compartir acceso a cliente
  Incluye: Dar lectura, edición, seguimiento a otro coach
  Depende de: clientes.read (implícito)
  Tipo: Acción

collab.delegar
  Descripción: [RESERVED — Sprint 5.4] Delegar sesión/tarea
  Incluye: Transferir a otro coach, mantener seguimiento
  Depende de: agenda.view_own (implícito)
  Tipo: Acción
```

### 1.16 AUTOMATIZACIÓN — RESERVED (2 capacidades)

```
automation.create
  Descripción: [RESERVED — Sprint ?] Crear automatizaciones
  Incluye: Workflows, triggers, acciones automáticas
  Depende de: (ninguno)
  Tipo: Acción

automation.manage
  Descripción: [RESERVED — Sprint ?] Gestionar automatizaciones
  Incluye: Editar, pausar, eliminar workflows
  Depende de: automation.create (implícito)
  Tipo: Acción
```

### 1.17 API — RESERVED (2 capacidades)

```
api.read
  Descripción: [RESERVED — Sprint ?] Leer datos via API
  Incluye: Acceso a endpoints READ
  Depende de: (ninguno)
  Tipo: Base

api.write
  Descripción: [RESERVED — Sprint ?] Escribir datos via API
  Incluye: Acceso a endpoints POST/PATCH/DELETE
  Depende de: api.read (implícito)
  Tipo: Peligrosa
```

---

## 2. TOTAL DE CAPACIDADES

```
Clientes:       6
Equipo:         4
Agenda:         5
Programas:      4
Biblioteca:     2
Recursos:       4
Mensajes:       3
IA:             2
Analytics:      3
Cobros:         5
Configuración:  3
Comunidad:      3 (reserved)
Marketplace:    3 (reserved)
Branding:       2 (reserved)
Colaboración:   2 (reserved)
Automatización: 2 (reserved)
API:            2 (reserved)

TOTAL:          57 capacidades (40 activas, 17 reserved)
```

---

## 3. PRESETS POR DEFECTO

### 3.1 Owner

**Total**: 40 capacidades (todas las activas)

```
Clientes (6):         clientes.read, create, edit, assign, archive, notes
Equipo (4):           equipo.read, invite, edit, permissions
Agenda (5):           agenda.view_own, view_team, create, edit, cancel
Programas (4):        programas.create, edit, publish, delete
Biblioteca (2):       biblioteca.read, manage
Recursos (4):         recursos.create, share, edit, delete
Mensajes (3):         mensajes.send, view, archive
IA (2):               ia.use, crear_prompts
Analytics (3):        analytics.view_personal, view_organization, export
Cobros (5):           billing.view_personal, view_organization, manage_invoice, receive_payment, export
Configuración (3):    config.branding, especialidades, organization
```

### 3.2 Coach Estándar

**Total**: 23 capacidades

```
Clientes (3):         clientes.read, edit, notes
Equipo (1):           equipo.read
Agenda (3):           agenda.view_own, create, edit
Programas (2):        programas.create, edit
Biblioteca (1):       biblioteca.read
Recursos (2):         recursos.create, share
Mensajes (2):         mensajes.send, view
IA (2):               ia.use, crear_prompts
Analytics (1):        analytics.view_personal
Cobros (1):           billing.view_personal
Configuración (0):    (ninguno)
```

### 3.3 Coach Senior

**Total**: 30 capacidades (Coach Estándar + permisos elevados)

```
Clientes (5):         clientes.read, create, edit, assign, notes
Equipo (2):           equipo.read, edit
Agenda (4):           agenda.view_own, view_team, create, edit
Programas (2):        programas.create, edit
Biblioteca (2):       biblioteca.read, manage
Recursos (2):         recursos.create, share
Mensajes (2):         mensajes.send, view
IA (2):               ia.use, crear_prompts
Analytics (2):        analytics.view_personal, view_organization
Cobros (2):           billing.view_personal, view_organization
Configuración (0):    (ninguno)
```

### 3.4 Recruiter (Colaborador)

**Total**: 12 capacidades

```
Clientes (3):         clientes.read, create, assign
Equipo (0):           (ninguno)
Agenda (1):           agenda.view_own
Programas (0):        (ninguno)
Biblioteca (0):       (ninguno)
Recursos (0):         (ninguno)
Mensajes (2):         mensajes.send, view
IA (1):               ia.use
Analytics (1):        analytics.view_personal
Cobros (0):           (ninguno)
Configuración (0):    (ninguno)
```

### 3.5 Asistente (Colaborador)

**Total**: 9 capacidades

```
Clientes (1):         clientes.read
Equipo (0):           (ninguno)
Agenda (3):           agenda.view_own, create, edit
Programas (0):        (ninguno)
Biblioteca (0):       (ninguno)
Recursos (0):         (ninguno)
Mensajes (2):         mensajes.send, view
IA (0):               (ninguno)
Analytics (1):        analytics.view_personal
Cobros (0):           (ninguno)
Configuración (0):    (ninguno)
```

### 3.6 Admin Recursos (Colaborador)

**Total**: 11 capacidades

```
Clientes (0):         (ninguno)
Equipo (0):           (ninguno)
Agenda (0):           (ninguno)
Programas (0):        (ninguno)
Biblioteca (2):       biblioteca.read, manage
Recursos (4):         recursos.create, share, edit, delete
Mensajes (0):         (ninguno)
IA (0):               (ninguno)
Analytics (1):        analytics.view_organization
Cobros (0):           (ninguno)
Configuración (0):    (ninguno)
```

### 3.7 RRHH (Colaborador)

**Total**: 5 capacidades

```
Clientes (1):         clientes.read
Equipo (1):           equipo.read
Agenda (0):           (ninguno)
Programas (0):        (ninguno)
Biblioteca (0):       (ninguno)
Recursos (0):         (ninguno)
Mensajes (0):         (ninguno)
IA (0):               (ninguno)
Analytics (2):        analytics.view_organization, export
Cobros (0):           (ninguno)
Configuración (0):    (ninguno)
```

---

## 4. DEPENDENCIAS EXPLÍCITAS

```
clientes.edit
  requiere: clientes.read (implícito, siempre incluir si tiene edit)

clientes.assign
  requiere: clientes.read (implícito)

clientes.archive
  requiere: clientes.read (implícito)

clientes.notes
  requiere: clientes.read (implícito)

equipo.edit
  requiere: equipo.read (implícito)

equipo.permissions
  requiere: equipo.read (implícito)

agenda.edit
  requiere: agenda.view_own (implícito)

agenda.cancel
  requiere: agenda.view_own (implícito)

programas.edit
  requiere: programas.read (implícito)

programas.publish
  requiere: programas.edit (directo: no puede publicar sin poder editar)

programas.delete
  requiere: programas.read (implícito)

biblioteca.manage
  requiere: biblioteca.read (implícito)

recursos.share
  requiere: recursos.read (implícito)

recursos.edit
  requiere: recursos.read (implícito)

recursos.delete
  requiere: recursos.read (implícito)

mensajes.archive
  requiere: mensajes.view (implícito)

ia.crear_prompts
  requiere: ia.use (implícito)

analytics.export
  requiere: analytics.view_personal o analytics.view_organization (una de las dos)

billing.manage_invoice
  requiere: billing.view_personal o billing.view_organization (una de las dos)

billing.export
  requiere: billing.view_personal o billing.view_organization (una de las dos)

marketplace.receive_leads
  requiere: marketplace.profile (directo)

marketplace.reviews
  requiere: marketplace.profile (directo)

collab.compartir_cliente
  requiere: clientes.read (implícito)

collab.delegar
  requiere: agenda.view_own (implícito)

automation.manage
  requiere: automation.create (directo)

api.write
  requiere: api.read (implícito)
```

---

## 5. PERMISOS A NIVEL DE ORGANIZACIÓN

### 5.1 Especialidades Habilitadas

```
Org.especialidades_activas: {
  'Career': boolean,
  'Executive': boolean,
  'Fitness': boolean,
  'Nutrition': boolean,
  'Wellness': boolean,
  'Business': boolean,
  'Finance': boolean,
  'Psychology': boolean,
  'Leadership': boolean,
  'Recruiter': boolean,
  'HR': boolean
}
```

**Efecto**:
- Si `Org.especialidades_activas['Fitness'] = false`, NUNCA aparecen:
  - `Programas` de Fitness
  - `Recursos` de Fitness
  - `Clientes` con especialidad Fitness
  - Ninguna opción en UI relacionada con Fitness

- Capacidades **NO** son afectadas por esto:
  - Un coach con `clientes.read` sigue teniéndola
  - Pero el UI filtra qué ve según especialidades habilitadas

### 5.2 Módulos Habilitados

```
Org.modulos_activos: {
  'Clientes': boolean (siempre true),
  'Agenda': boolean,
  'Programas': boolean,
  'Biblioteca': boolean,
  'Recursos': boolean,
  'Comunidad': boolean (reserved),
  'Marketplace': boolean (reserved),
  'Analytics': boolean,
  'Cobros': boolean,
  'IA': boolean
}
```

**Efecto**:
- Si `Org.modulos_activos['Agenda'] = false`, NO aparece el módulo
- Ningún usuario puede ver "Agenda" en el sidebar
- Capacidades tipo `agenda.*` siguen existiendo pero UI las oculta

### 5.3 Plan de Organización

```
Org.plan: 'Basic' | 'Professional' | 'Enterprise'

Basic:       Max 3 coaches, sin Marketplace, sin Comunidad
Professional: Max 20 coaches, con Marketplace, sin API
Enterprise:  Unlimited, todo, API incluido
```

**Efecto**:
- Si `plan = Basic`, NO aparecen capacidades de:
  - `marketplace.*`
  - `api.*`
  - `branding.edit_org` (solo basic colors)

---

## 6. HERENCIA DE PERMISOS (REGLA INMUTABLE)

### 6.1 Flujo

```
PASO 1: Preset Base
  └─ Aplicar preset (ej: "Coach Estándar")
     └─ Cargar todas las capacidades del preset en user_capacidades

PASO 2: Personalización
  └─ Owner/Admin personaliza capacidades individuales
     └─ Puede habilitar capacidades no en el preset
     └─ Puede deshabilitar capacidades del preset

PASO 3: Validación de Dependencias
  └─ Sistema valida que si X está habilitado, Y también esté
     └─ Si usuario trata de desactivar clientes.read pero clientes.edit=true, error

PASO 4: Resultado Final
  └─ Union(Preset, Personalizaciones)
     └─ Guardar en user_capacidades
     └─ Registrar auditoría
     └─ Notificar usuario

NUNCA AL REVÉS:
  ✗ No cargar personalización y luego aplicar preset (perdería cambios)
  ✗ No tomar resultado final y recalcular preset (rompe historial)
```

### 6.2 Pseudo-código

```javascript
async function applyCapacidades(userId, preset, personalizations) {
  // PASO 1: Cargar preset
  let capacidades = new Set(PRESETS[preset]);
  
  // PASO 2: Aplicar personalizaciones
  for (const [cap, enabled] of Object.entries(personalizations)) {
    if (enabled) capacidades.add(cap);
    else capacidades.delete(cap);
  }
  
  // PASO 3: Validar dependencias
  if (!validateDependencies(capacidades)) {
    throw new Error('Faltan dependencias requeridas');
  }
  
  // PASO 4: Guardar
  await saveUserCapacidades(userId, capacidades);
  await logAudit(userId, 'preset_applied', {
    preset,
    personalizations,
    final: capacidades
  });
}
```

---

## 7. AUDITORÍA DE PERMISOS

### 7.1 Schema de Auditoría

```sql
CREATE TABLE auditoria_capacidades (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id_target UUID NOT NULL,        -- Usuario cuyas capacidades cambiaron
  user_id_actor UUID NOT NULL,         -- Quién hizo el cambio
  timestamp TIMESTAMPTZ DEFAULT now(),
  evento TEXT,                          -- 'preset_applied', 'capability_toggled', 'bulk_update'
  preset_name TEXT,                     -- Si aplicó preset, cuál
  capacidad TEXT,                       -- Si cambio individual, cuál
  valor_anterior BOOLEAN,               -- Estaba activa?
  valor_nuevo BOOLEAN,                  -- Ahora está activa?
  cambios_cantidad INT,                 -- Si bulk, cuántas capacidades cambiaron
  motivo TEXT,                          -- Opcional: por qué se hizo el cambio
  ip_address TEXT,                      -- Desde dónde se ejecutó
  session_id TEXT                       -- Sesión que lo hizo
);
```

### 7.2 Eventos Auditables

```
preset_applied
  Quién:  Owner/Admin
  Cuándo: Al aplicar un preset a un usuario
  Qué:   preset_name, capacidades_agregadas, capacidades_removidas
  Registro: {preset, before_set, after_set}

capability_toggled
  Quién:  Owner/Admin
  Cuándo: Al habilitar/deshabilitar una capacidad individual
  Qué:   capacidad, valor_anterior, valor_nuevo
  Registro: {capacidad, enabled}

bulk_update
  Quién:  Sistema (migración, script)
  Cuándo: Al actualizar múltiples usuarios
  Qué:   cantidad, cambios
  Registro: {total_users, changes_per_user}

dependency_error
  Quién:  Sistema
  Cuándo: Si alguien trata de hacer algo que viola dependencias
  Qué:   capacidad, missing_dependency
  Registro: {attempted_cap, required_cap}

org_speciality_disabled
  Quién:  Owner
  Cuándo: Al deshabilitar una especialidad
  Qué:   especialidad, usuarios_afectados
  Registro: {specialty, affected_count, users_list}
```

### 7.3 Ejemplo de Registro

```json
{
  "id": 1234,
  "organization_id": "org-123",
  "user_id_target": "coach-456",
  "user_id_actor": "owner-789",
  "timestamp": "2026-08-02T15:30:00Z",
  "evento": "preset_applied",
  "preset_name": "Coach Senior",
  "valor_anterior": null,
  "valor_nuevo": null,
  "cambios_cantidad": 30,
  "motivo": "Ascenso a coach senior",
  "ip_address": "192.168.1.100",
  "session_id": "sess-xyz",
  "capacidades_agregadas": [
    "clientes.create",
    "clientes.assign",
    "agenda.view_team",
    "collab.compartir_cliente"
  ],
  "capacidades_removidas": [],
  "cambios_set": {
    "before": ["clientes.read", "clientes.edit", "clientes.notes", ...],
    "after": ["clientes.read", "clientes.create", "clientes.edit", ...]
  }
}
```

---

## 8. MATRIZ DE COMPATIBILIDAD

### 8.1 ¿Qué tipo puede tener qué?

```
OWNER
├─ Tipo: Owner (solo 1 por org)
├─ Capacidades: Todas las activas (40)
├─ No puede: Ser removido (require transfer primero)
└─ Creado: Al crear org (automático)

COACH
├─ Tipo: Coach
├─ Capacidades: 0-40 (cualquier subset)
├─ No puede: equipo.permissions (si no es owner)
├─ Casos: Coach Estándar, Coach Senior, custom

COLABORADOR
├─ Tipo: Colaborador
├─ Capacidades: 0-40 (cualquier subset)
├─ No puede: config.* (solo owner)
├─ Casos: Recruiter, Asistente, Admin Recursos, RRHH, custom
```

### 8.2 Excepciones Codificadas

```javascript
// Owner siempre tiene acceso a:
const OWNER_ALWAYS_HAS = [
  'equipo.permissions',
  'config.organization',
  'config.branding',
  'config.especialidades',
  'billing.receive_payment',
  'analytics.view_organization'
];

// Coach nunca tiene:
const COACH_NEVER_HAS = [
  'config.*'
];

// Colaborador nunca tiene:
const COLABORADOR_NEVER_HAS = [
  'config.*',
  'billing.receive_payment'  // Solo owner cobra
];
```

---

## 9. VALIDACIONES EN EL SISTEMA

### 9.1 Al Crear Usuario

```
if (tipo === 'Owner') {
  capacidades = PRESETS['Owner'];  // No personalizable
} else if (tipo === 'Coach') {
  capacidades = PRESETS['Coach Estándar'];  // Default, personalizable
} else if (tipo === 'Colaborador') {
  capacidades = PRESETS['Asistente'];  // Default, personalizable
}

// Validar que no tenga capacidades prohibidas
for (cap in capacidades) {
  if (COACH_NEVER_HAS.includes(cap) && tipo === 'Coach') {
    throw Error('Coach no puede tener ' + cap);
  }
}

// Validar dependencias
if (!validateDependencies(capacidades)) {
  throw Error('Faltan dependencias');
}
```

### 9.2 Al Cambiar Capacidad

```
if (user.tipo === 'Owner' && OWNER_ALWAYS_HAS.includes(cap)) {
  throw Error('Owner no puede perder esta capacidad: ' + cap);
}

if (cap_to_disable === 'clientes.read' && user_has('clientes.edit')) {
  throw Error('Primero debe desactivar clientes.edit');
}

if (cap_to_enable === 'billing.receive_payment' && user.tipo !== 'Owner') {
  throw Error('Solo Owner puede recibir pagos');
}
```

---

## 10. CASOS DE USO REALES

### Caso 1: Recruiter prepara candidato, Coach continúa

```
RECRUITER:
  - clientes.read ✓ (ver lista)
  - clientes.create ✓ (crear candidato)
  - clientes.assign ✓ (asignar a coach)
  - clientes.edit ✗ (no puede editar, crea la ficha el sistema)

COACH (recibe cliente):
  - clientes.read ✓ (ve candidato)
  - clientes.edit ✓ (edita datos)
  - clientes.notes ✓ (agrega notas)
```

### Caso 2: Coach Senior supervisa Coach Juniors

```
COACH SENIOR:
  - equipo.read ✓ (ve equipo)
  - equipo.edit ✓ (puede editar datos de otros coaches)
  - clientes.assign ✓ (reasigna clientes)
  - agenda.view_team ✓ (ve agenda de todos)

COACH JUNIOR:
  - equipo.read ✓ (ve equipo)
  - equipo.edit ✗ (no puede editar otros coaches)
  - clientes.assign ✗ (no puede reasignar)
  - agenda.view_team ✗ (solo ve su propia agenda)
```

### Caso 3: Organización deshabilita Fitness

```
ORG.especialidades_activas['Fitness'] = false

RESULTADO:
- Programas de Fitness NO se muestran
- Clientes con especialidad Fitness NO aparecen en UI
- Pero capacidades type `programas.edit` sigue siendo válida
- Coach Senior todavía tiene `programas.edit` habilitada (pero sin usar)
- Si re-habilitan Fitness, todo sigue igual
```

---

## 11. CONGELACIÓN DE LA MATRIZ

**Esta matriz es INMUTABLE hasta Sprint 5.4.**

Cambios permitidos:
- ✅ Agregar capacidades **reserved** (no activas)
- ✅ Cambiar descripciones (no cambia la ID)
- ❌ Eliminar o renombrar capacidades existentes
- ❌ Cambiar dependencias
- ❌ Cambiar presets existentes

Si necesita cambio: Crear issue, discutir, crear Sprint 5.X para rediseño completo.

---

## 12. CHECKPOINTS DE IMPLEMENTACIÓN

**Sprint 5.1 (ahora)**:
- [x] Matriz oficial completa (este documento)
- [x] Presets en SQL + código (capacidades-init.js)
- [x] UI en MultiCoach Equipo drawer
- [ ] Validaciones de dependencias
- [ ] Auditoría básica (logging)

**Sprint 5.2 (Agenda)**:
- [ ] Guardrails con hasCapability() en agenda.html
- [ ] Agenda respeta `agenda.view_team`, `agenda.edit`, etc.

**Sprint 5.3 (Cobros)**:
- [ ] Guardrails en billing (respeta `billing.receive_payment`, etc.)

**Sprint 5.4 (Colaboración)**:
- [ ] Guardrails en collab (requiere capacidades de compartir)

---

**FIN DE MATRIZ OFICIAL**

*Documento congelado. Próxima revisión: Sprint 5.5 o Fase 2*
