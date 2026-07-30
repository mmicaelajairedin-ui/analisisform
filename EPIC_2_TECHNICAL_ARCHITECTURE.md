# EPIC 2: Arquitectura Técnica de Integración MultiCoach-Pathway

**Objetivo:** Definir la arquitectura técnica sin escribir código. Solo especificación de qué necesitamos, cómo se conecta, y cómo evitar duplicación con Pathway.

**Fecha:** Julio 2026  
**Estado:** Diseño de Arquitectura (Pre-Implementación)

---

## 1. API por Pantalla

Cada pantalla del frontend de MultiCoach requiere endpoints específicos. Aquí se detallan los datos que consume, modifica, y las funciones necesarias.

### 1.1 Dashboard (owner-coaches.html)

**Propósito:** Vista ejecutiva de la organización completa.

**Datos que consume:**
- KPIs agregados: total clientes, coaches activos, tasa completitud, NPS promedio
- Lista de coaches activos con métricas individuales
- Últimas actividades/eventos

**Datos que modifica:**
- Ninguno en esta pantalla (vista de solo lectura)

**Endpoints requeridos:**
```
GET /api/organization/{org_id}/dashboard/kpis
  → {
      totalClients: number,
      activeCoaches: number,
      completionRate: number,
      avgNps: number,
      totalRevenue: number,
      clientSatisfaction: number
    }

GET /api/organization/{org_id}/coaches/summary
  → [{
      id, name, avatar, specialty, status,
      clientsAssigned, capacity, nps, retentionRate,
      completionRate, lastActive, metrics
    }]

GET /api/organization/{org_id}/activity/recent
  → [{
      id, type, description, timestamp, actor
    }]
```

**Edge Functions:**
- `fetch-org-kpis` — Calcula KPIs desde tablas de usuarios, candidatos, informes
- `fetch-coaches-summary` — Agrega datos de coaches para la organización
- `track-organization-activity` — Log de eventos de la org

---

### 1.2 Coaches (owner-coaches.html)

**Propósito:** Listar y gestionar todos los coaches de la organización.

**Datos que consume:**
- Lista de coaches con filtros (estado, capacidad, disponibilidad)
- Búsqueda por nombre, email, especialidad
- Estadísticas individuales

**Datos que modifica:**
- Asignaciones de clientes (indirecto a través de drag-drop/UI)
- Estado (activar/inactivar coach)

**Endpoints requeridos:**
```
GET /api/organization/{org_id}/coaches
  ?search={term}
  &status={active|inactive|all}
  &capacity={available|full|all}
  &sort={name|nps|retention|clients}
  → [{
      id, name, email, avatar, specialty, status,
      joinedAt, clientsAssigned, capacity,
      programsActive, nps, retentionRate,
      completionRate, lastActive, totalProgramsCompleted,
      sessionCount, metrics
    }]

GET /api/organization/{org_id}/coaches/{coach_id}
  → (mismos campos + clientes asignados)

PATCH /api/organization/{org_id}/coaches/{coach_id}
  {status: "active"|"inactive"}
  → {id, status, updatedAt}
```

**Edge Functions:**
- `list-org-coaches` — Filtra coaches activos por org_id con búsqueda
- `get-coach-metrics` — Calcula NPS, retención, completitud desde sesiones
- `update-coach-status` — Cambia estado activo/inactivo

---

### 1.3 Coach Detail (owner-coach-detail.html)

**Propósito:** Ver perfil completo de un coach, sus clientes asignados, métricas detalladas.

**Datos que consume:**
- Perfil del coach (datos, especialidad, métricas)
- Clientes asignados al coach
- Actividad reciente del coach
- Métricas de performance individual

**Datos que modifica:**
- Ninguno en esta vista (solo lectura)

**Endpoints requeridos:**
```
GET /api/organization/{org_id}/coaches/{coach_id}
  → {id, name, email, avatar, specialty, status, joinedAt,
     clientsAssigned, capacity, programsActive, nps, 
     retentionRate, completionRate, lastActive,
     totalProgramsCompleted, sessionCount, metrics}

GET /api/organization/{org_id}/coaches/{coach_id}/clients
  → [{
      id, name, avatar, email, program, programWeek,
      progress, riskLevel, startDate, endDate,
      sector, role, status
    }]

GET /api/organization/{org_id}/coaches/{coach_id}/activity
  → [{
      id, type, description, timestamp
    }]

GET /api/organization/{org_id}/coaches/{coach_id}/sessions
  ?period={week|month|all}
  → [{
      id, clientId, date, duration, notes, completed
    }]
```

**Edge Functions:**
- `get-coach-profile` — Obtiene datos completos del coach
- `get-coach-clients` — Lista clientes asignados a un coach
- `calculate-coach-metrics` — Calcula NPS, retención, métricas en tiempo real
- `get-coach-activity-log` — Timeline de actividades del coach

---

### 1.4 Clientes (owner-clients.html)

**Propósito:** Listar todos los clientes de la organización con filtros avanzados.

**Datos que consume:**
- Lista de clientes con filtros (estado, riesgo, coach, programa)
- Búsqueda por nombre, email, rol, sector
- Progreso y estado de cada cliente

**Datos que modifica:**
- Filtros y vista (solo UI state, no BD)

**Endpoints requeridos:**
```
GET /api/organization/{org_id}/clients
  ?search={term}
  &status={active|completed|all}
  &risk={low|medium|high|all}
  &coachId={coach_id}
  &program={week}
  &sort={name|progress|risk|startDate}
  → [{
      id, name, avatar, email, coachId, coachName,
      program, programWeek, status, startDate, endDate,
      progress, riskLevel, sector, role
    }]

GET /api/organization/{org_id}/clients/summary
  → {
      totalClients, activeClients, completedClients,
      avgProgress, clientsAtRisk
    }
```

**Edge Functions:**
- `list-org-clients` — Obtiene clientes por org_id con búsqueda y filtros
- `calculate-client-stats` — KPIs de clientes (totales, activos, completados)
- `assess-client-risk` — Detecta clientes en riesgo basado en progreso y actividad

---

### 1.5 Client Detail (owner-client-detail.html)

**Propósito:** Ver perfil completo de cliente, progreso, coach asignado, actividad.

**Datos que consume:**
- Perfil del cliente (datos, rol, sector)
- Programa asignado y progreso
- Coach asignado
- Historial de actividad
- Evaluaciones/feedback

**Datos que modifica:**
- Asignación de coach (PATCH)
- Estado (PATCH)

**Endpoints requeridos:**
```
GET /api/organization/{org_id}/clients/{client_id}
  → {id, name, avatar, email, coachId, coachName,
     program, programWeek, status, startDate, endDate,
     progress, riskLevel, sector, role}

PATCH /api/organization/{org_id}/clients/{client_id}
  {coachId, status}
  → {id, coachId, status, updatedAt}

GET /api/organization/{org_id}/clients/{client_id}/activity
  → [{id, type, description, timestamp}]

GET /api/organization/{org_id}/clients/{client_id}/sessions
  → [{id, date, coachId, duration, notes, completed}]

GET /api/organization/{org_id}/clients/{client_id}/risk-assessment
  → {level, factors: [...], recommendations: [...]}
```

**Edge Functions:**
- `get-client-profile` — Obtiene datos completos del cliente
- `reassign-coach` — Cambia coach asignado, valida capacidad
- `assess-client-risk-detailed` — Análisis profundo de riesgo
- `get-client-progress` — Calcula progreso y timeline de programa

---

### 1.6 Programas (owner-programs.html)

**Propósito:** Ver programas activos, coaches asignados, clientes por semana.

**Datos que consume:**
- Lista de programas (semanas)
- Coaches y clientes asignados a cada programa
- Tasa de completitud y progreso

**Datos que modifica:**
- Ninguno (vista de solo lectura)

**Endpoints requeridos:**
```
GET /api/organization/{org_id}/programs
  ?status={active|completed|all}
  &sort={week|completion|clients}
  → [{
      id, name, week, status, activeClients, totalClients,
      completedClients, coaches: [coachIds],
      completionRate, avgDuration, startDate, growthRate
    }]

GET /api/organization/{org_id}/programs/{program_id}
  → {id, name, week, status, activeClients, totalClients,
     completedClients, coaches: [{id,name,avatar}],
     completionRate, avgDuration, startDate}

GET /api/organization/{org_id}/programs/{program_id}/clients
  → [{id, name, coachId, progress, status}]
```

**Edge Functions:**
- `list-org-programs` — Obtiene programas de la org
- `calculate-program-metrics` — Completitud, progreso agregado
- `get-program-coaches` — Lista coaches asignados a programa

---

### 1.7 Analytics (owner-analytics.html)

**Propósito:** Dashboard de métricas: crecimiento, retención, NPS, proyecciones.

**Datos que consume:**
- KPIs ejecutivos (clientes, coaches, completitud, revenue)
- Crecimiento mensual (clientes y revenue)
- Curva de retención por semana
- Utilización por coach
- NPS por coach
- Proyecciones (forecast)

**Datos que modifica:**
- Ninguno (vista de solo lectura)

**Endpoints requeridos:**
```
GET /api/organization/{org_id}/analytics/kpis
  → {totalClients, activeCoaches, completionRate, avgNps,
     totalRevenue, clientSatisfaction}

GET /api/organization/{org_id}/analytics/growth
  ?period={month|quarter|year}
  → [{month, clients, revenue}]

GET /api/organization/{org_id}/analytics/retention
  → [{week, retention}]

GET /api/organization/{org_id}/analytics/coach-utilization
  → [{coach, utilization}]

GET /api/organization/{org_id}/analytics/nps
  → [{coach, nps}]

GET /api/organization/{org_id}/analytics/forecast
  → [{month, projected, confidence}]

POST /api/organization/{org_id}/analytics/context
  {objective, audience, keyPages, conversions}
  → {id, org_id, ...}

GET /api/organization/{org_id}/analytics/reports
  ?period={week|month}
  → [{id, date, analysis, recommendations, actions}]
```

**Edge Functions:**
- `calculate-org-kpis` — Calcula KPIs principales
- `calculate-monthly-growth` — Tendencias mensuales
- `calculate-retention-curve` — Retención por semana
- `calculate-coach-utilization` — Capacidad vs clientes asignados
- `generate-analytics-report` — Llamada a Claude para análisis
- `forecast-growth` — Proyecciones basadas en histórico

---

### 1.8 Facturación (owner-billing.html)

**Propósito:** Gestión de plan, uso de recursos, invoices.

**Datos que consume:**
- Plan actual (precio, características, estado)
- Uso (coaches, clientes, almacenamiento, sesiones)
- Historial de invoices
- Próxima fecha de facturación
- Método de pago

**Datos que modifica:**
- Método de pago (POST a Stripe)
- Plan upgrade/downgrade (POST)

**Endpoints requeridos:**
```
GET /api/organization/{org_id}/billing/plan
  → {plan, price, currency, billingCycle, nextBillingDate,
     status, coaches, maxCoaches}

GET /api/organization/{org_id}/billing/usage
  → {coaches, maxCoaches, clients, storage, sessions,
     maxSessions, reports, maxReports, integrations,
     maxIntegrations}

GET /api/organization/{org_id}/billing/invoices
  → [{id, date, amount, status, period}]

GET /api/organization/{org_id}/billing/payment-method
  → {type, last4, expiry}

POST /api/organization/{org_id}/billing/upgrade-plan
  {newPlan}
  → {status, effectiveDate, newPrice}
```

**Edge Functions:**
- `get-plan-details` — Obtiene plan y características
- `calculate-usage` — Cuenta coaches, clientes, almacenamiento
- `list-invoices` — Historial de facturas (de Stripe)
- `track-billing-events` — Webhook de Stripe para cambios

---

### 1.9 Marca (owner-brand.html)

**Propósito:** Personalización de marca (colores, logo, descripción).

**Datos que consume:**
- Configuración de marca actual (nombre, logo, colores, descripción)

**Datos que modifica:**
- Nombre de empresa
- Logo/emoji
- Colores (primario, secundario, acentos)
- Descripción/tagline

**Endpoints requeridos:**
```
GET /api/organization/{org_id}/brand
  → {name, logo, primaryColor, secondaryColor,
     accentColor, tagline, description}

PATCH /api/organization/{org_id}/brand
  {name, logo, primaryColor, secondaryColor,
   accentColor, tagline, description}
  → {id, org_id, ...}
```

**Edge Functions:**
- `get-org-branding` — Obtiene configuración de marca
- `update-org-branding` — Actualiza y persiste colores

---

### 1.10 Configuración (owner-settings.html)

**Propósito:** Gestión de organización, usuarios, seguridad, notificaciones, integraciones.

**Datos que consume:**
- Datos de organización
- Lista de usuarios y roles
- Preferencias de seguridad y notificaciones
- Integraciones activas

**Datos que modifica:**
- Nombre, email, teléfono de org (PATCH)
- Ubicación (país, ciudad, zona horaria)
- Agregar/eliminar usuarios (POST/DELETE)
- Cambiar rol de usuario (PATCH)
- Preferencias de notificaciones (PATCH)
- Conectar/desconectar integraciones

**Endpoints requeridos:**
```
GET /api/organization/{org_id}
  → {id, name, email, phone, country, city, timezone,
     plan, status, createdAt, color, contactEmail}

PATCH /api/organization/{org_id}
  {name, email, phone, country, city, timezone}
  → {id, org_id, ...}

GET /api/organization/{org_id}/users
  → [{id, name, email, role, createdAt}]

POST /api/organization/{org_id}/users/invite
  {email, role}
  → {id, email, invitedAt}

PATCH /api/organization/{org_id}/users/{user_id}
  {role, status}
  → {id, role, status}

DELETE /api/organization/{org_id}/users/{user_id}
  → {status: "deleted"}

PATCH /api/organization/{org_id}/users/{user_id}/password
  {currentPassword, newPassword}
  → {status: "success"}

PATCH /api/organization/{org_id}/notifications
  {email: {...}, push: {...}}
  → {id, org_id, preferences}

POST /api/organization/{org_id}/integrations/{type}/connect
  {accessToken, ...}
  → {status: "connected"}

DELETE /api/organization/{org_id}/integrations/{type}
  → {status: "disconnected"}
```

**Edge Functions:**
- `get-org-details` — Obtiene datos de organización
- `update-org-details` — Actualiza info de org
- `manage-org-users` — Agregar, modificar, eliminar usuarios
- `send-user-invite` — Email de invitación
- `validate-user-invite` — Validar token de invitación
- `manage-org-integrations` — Conectar/desconectar integraciones

---

## 2. Modelo Lógico

Define entidades sin especificar aún la implementación física (tablas, esquemas SQL, estructura de datos).

### 2.1 Organización

**Concepto:** Contenedor de toda la operación. Propietario único que gestiona coaches, clientes, programas.

**Responsabilidades:**
- Contiene todos los coaches, clientes, programas de la org
- Gestiona configuración global (marca, plan, usuarios admin)
- Agrega KPIs desde datos de coaches y clientes
- Controla acceso de usuarios a recursos

**Atributos clave:**
- `id` — Identificador único
- `name` — Nombre de la organización
- `owner_id` — Referencia al usuario propietario
- `plan` — Plan actual (Basic, Pro, Enterprise)
- `status` — active, inactive, suspended
- `timezone` — Zona horaria para reportes
- `color` — Color de marca principal
- `metadata` — Branding personalizado

**Relaciones:**
- 1:N con `usuarios` (usuarios de la org)
- 1:N con `coaches` (coaches activos en la org)
- 1:N con `clientes` (candidatos registrados en la org)
- 1:N con `programas` (programas de la org)
- 1:1 con `configuracion` (settings de la org)

---

### 2.2 Usuario (Owner/Admin)

**Concepto:** Persona con acceso a MultiCoach para gestionar la org.

**Responsabilidades:**
- Login y autenticación
- Acceso a todas las pantallas de MultiCoach
- Puede crear/eliminar otros usuarios admin
- Puede cambiar plan de facturación
- Puede personalizar marca

**Atributos clave:**
- `id` — Identificador único (de Supabase Auth)
- `email` — Email único
- `nombre` — Nombre de la persona
- `role` — Owner, Admin, Manager, Viewer
- `org_id` — Organización a la que pertenece
- `status` — active, inactive, suspended
- `last_login` — Último acceso
- `preferences` — Notificaciones, idioma, tema

**Relaciones:**
- N:1 con `organizacion`
- 1:N con `sesiones` (sesiones activas)

---

### 2.3 Coach (desde Pathway, extendido para MultiCoach)

**Concepto:** Profesional que imparte coaching. En Pathway existe, en MultiCoach se extiende con datos de org.

**Responsabilidades:**
- Realiza sesiones con clientes
- Tiene capacidad máxima de clientes
- Genera KPIs individuales (NPS, retención, completitud)
- Accede a su panel (reutilizado de Pathway)

**Atributos clave:**
- `id` — Identificador único (de Pathway usuarios)
- `org_id` — Organización a la que pertenece (NUEVO)
- `nombre` — Nombre del coach
- `email` — Email único
- `specialty` — Especialidad de coaching
- `status` — active, inactive
- `joinedAt` — Fecha de unión a la org
- `capacity` — Máximo número de clientes
- `avatar` — Emoji o foto
- `nps`, `retention_rate`, `completion_rate` — Métricas agregadas (NUEVAS)

**Relaciones:**
- N:1 con `organizacion`
- 1:N con `coach_client_assignments` (clientes asignados)
- 1:N con `sesiones` (sesiones realizadas, de Pathway)
- 1:N con `feedback_clients` (evaluaciones de clientes)

---

### 2.4 Cliente (Candidato de Pathway, extendido)

**Concepto:** Persona en un programa de coaching. Existe en Pathway, se extiende en MultiCoach.

**Responsabilidades:**
- Participa en programa de 4 semanas
- Tiene coach asignado
- Progresa a través de semanas del programa
- Accede a portal de cliente (reutilizado de Pathway)
- Genera evaluaciones/feedback

**Atributos clave:**
- `id` — Identificador único (de Pathway candidatos)
- `org_id` — Organización a la que pertenece (NUEVO)
- `nombre` — Nombre del cliente
- `email` — Email único
- `coachId` — Coach asignado (NUEVO)
- `program` — Programa actual (Pathway 4 Semanas)
- `programWeek` — Semana actual (1-4)
- `status` — active, completed, paused
- `startDate`, `endDate` — Fechas del programa
- `progress` — Porcentaje completado (0-100)
- `riskLevel` — low, medium, high (NUEVO)
- `sector`, `role` — Contexto del candidato
- `avatar` — Emoji o foto

**Relaciones:**
- N:1 con `organizacion`
- N:1 con `coach` (coach asignado)
- 1:N con `sesiones` (sesiones del programa)
- 1:N con `evaluaciones` (feedback del coach)
- 1:1 con `cv_publicado` (de Pathway)
- 1:1 con `carta_presentacion` (de Pathway)

---

### 2.5 Programa

**Concepto:** Estructura de 4 semanas de coaching.

**Responsabilidades:**
- Define contenido por semana
- Agrupa clientes por semana
- Asigna coaches a semanas
- Calcula métricas agregadas de completitud

**Atributos clave:**
- `id` — Identificador único
- `org_id` — Organización (todos los programas pertenecen a 1 org)
- `name` — Nombre (ej: "Pathway 4 Semanas")
- `week` — Semana (1, 2, 3, 4)
- `status` — active, completed
- `startDate` — Fecha de inicio
- `coaches` — Array de IDs de coaches
- `activeClients` — Clientes activos esta semana
- `totalClients` — Clientes totales
- `completedClients` — Clientes que finalizaron
- `completionRate` — Porcentaje completitud
- `avgDuration` — Duración promedio de sesiones

**Relaciones:**
- N:1 con `organizacion`
- N:N con `coaches`
- 1:N con `clientes` (asignados a esta semana)

---

### 2.6 Sesión (de Pathway, visible en MultiCoach)

**Concepto:** Encuentro entre coach y cliente.

**Responsabilidades:**
- Registra realización de sesión
- Almacena duración, notas, fecha
- Calcula impacto en progreso del cliente

**Atributos clave:**
- `id` — Identificador único (de Pathway)
- `org_id` — Organización (para contexto de MultiCoach)
- `coachId` — Coach que realiza
- `clientId` — Cliente que participa
- `date` — Fecha y hora
- `duration` — Duración en minutos
- `status` — completed, cancelled, scheduled
- `notes` — Notas del coach
- `feedback` — Evaluación del cliente (opcional)

**Relaciones:**
- N:1 con `organizacion`
- N:1 con `coach`
- N:1 con `cliente`
- 0:1 con `evaluacion` (feedback del cliente)

---

### 2.7 Analytics (Datos agregados)

**Concepto:** Métricas calculadas y almacenadas periódicamente.

**Responsabilidades:**
- Agrega KPIs de la organización
- Rastrea crecimiento mensual
- Calcula retención por semana
- Identifica tendencias
- Genera reportes con Claude

**Atributos clave:**
- `id` — Identificador único
- `org_id` — Organización
- `period` — Fecha del período (mes, semana)
- `kpis` — {totalClients, activeCoaches, completionRate, avgNps, revenue}
- `monthlyGrowth` — [{month, clients, revenue}]
- `retention` — [{week, retention}]
- `coachUtilization` — [{coach, utilization}]
- `forecast` — [{month, projected, confidence}]
- `analysis` — Análisis con Claude (NUEVO)
- `recommendations` — Recomendaciones de Claude
- `actions` — Acciones propuestas

**Relaciones:**
- N:1 con `organizacion`
- 0:N con `action_tracking` (acciones marcadas como completadas)

---

### 2.8 Facturación

**Concepto:** Control de suscripción, uso, y pagos.

**Responsabilidades:**
- Gestiona plan actual
- Rastrea uso de recursos
- Genera invoices
- Integra con Stripe

**Atributos clave:**
- `id` — Identificador único
- `org_id` — Organización
- `plan` — Basic, Pro, Enterprise
- `price` — Precio mensual en EUR
- `billingCycle` — monthly, annual
- `status` — active, past_due, cancelled
- `nextBillingDate` — Próxima facturación
- `stripeCustomerId` — ID de cliente en Stripe
- `usage` — {coaches, clients, storage, sessions, reports}
- `limits` — {maxCoaches, maxClients, maxStorage, ...}

**Relaciones:**
- 1:1 con `organizacion`
- 1:N con `invoices` (historial de facturas)
- 1:N con `usage_events` (logs de uso)

---

### 2.9 Configuración

**Concepto:** Preferencias y settings de la organización.

**Responsabilidades:**
- Almacena branding personalizado
- Guarda preferencias de notificaciones
- Controla integraciones conectadas
- Define contexto de análisis (objetivos, audiencia)

**Atributos clave:**
- `id` — Identificador único
- `org_id` — Organización
- `branding` — {name, logo, colors, tagline, description}
- `notifications` — {email: {...}, push: {...}}
- `integrations` — [{type: "slack|stripe|google", status, tokens}]
- `analyticsContext` — {objective, audience, keyPages, conversions}
- `security` — {twoFactorEnabled, sessionTimeout, ...}

**Relaciones:**
- 1:1 con `organizacion`

---

### 2.10 Riesgo de Cliente (NUEVO)

**Concepto:** Evaluación dinámica de si un cliente está en riesgo de no completar.

**Responsabilidades:**
- Calcula score de riesgo (low, medium, high)
- Identifica factores de riesgo
- Proporciona recomendaciones
- Alerta a owner y coach

**Atributos clave:**
- `id` — Identificador único
- `clientId` — Cliente evaluado
- `coachId` — Coach asignado
- `org_id` — Organización
- `riskLevel` — low, medium, high
- `factors` — [{name, weight, value}] — Factores detectados
- `score` — 0-100
- `lastAssessment` — Última fecha de evaluación
- `recommendations` — Acciones sugeridas

**Relaciones:**
- N:1 con `cliente`
- N:1 con `coach`
- N:1 con `organizacion`

---

## 3. Inventario Pathway

Revisión exhaustiva de funcionalidades existentes en Pathway y cómo se reutilizan, extienden o desarrollan nuevas en MultiCoach.

### 3.1 Autenticación y Usuarios

**Pathway actual:**
- Supabase Auth (JWT) para login
- Usuarios en tabla `public.usuarios`
- Roles: usuario (cliente), coach, admin

**MultiCoach:** Se reutiliza sin cambios
- Login de owner/admin usa Supabase Auth
- JWT vía `auth.uid()`
- Tabla `usuarios` con org_id agregado (no modifica login)

**Decisión:** ✅ **Reutilizar sin cambios**

---

### 3.2 Gestión de Coaches

**Pathway actual:**
- Tabla `usuarios` con rol='coach'
- Panel en `panel-v2.html`
- Datos: nombre, email, avatar, especialidad, status
- Métodos para editar perfil

**MultiCoach:** Se amplía
- Mismos datos de Pathway
- NUEVO: `org_id` en tabla usuarios (coach pertenece a org)
- NUEVO: `coach_client_assignments` — Asignaciones explícitas de clientes
- NUEVO: Métricas calculadas (NPS, retención, completitud por org)
- NUEVO: Visualización de capacidad (clientes asignados / máximo)

**Decisión:** ✅ **Ampliar para organizaciones**

**Cambios mínimos:**
- Agregar `org_id` a usuarios (nullable para backward compatibility)
- Crear tabla `coach_client_assignments(coach_id, client_id, org_id, estado)`
- Crear vista o Edge Function para métricas por org

---

### 3.3 Gestión de Candidatos/Clientes

**Pathway actual:**
- Tabla `candidatos` con datos de formulario
- Portal de cliente en `cliente.html`
- Datos: nombre, email, sector, rol, fechas, CV
- Progreso por semana (1-4)
- Status: activo, completado

**MultiCoach:** Se amplía
- Mismos datos de Pathway
- NUEVO: `org_id` en candidatos
- NUEVO: `coach_id` — Asignación explícita de coach a cliente
- NUEVO: `risk_level` — Evaluación de riesgo (low, medium, high)
- NUEVO: Visualización de clientes por coach
- NUEVO: Historial de asignaciones de coach

**Decisión:** ✅ **Ampliar para organizaciones**

**Cambios mínimos:**
- Agregar `org_id` a tabla candidatos
- Agregar `coach_id` a candidatos (relación 1:N)
- Crear tabla `client_risk_assessments` para evaluar riesgo

---

### 3.4 Programas

**Pathway actual:**
- Concepto implícito: "Semana 1, Semana 2, Semana 3, Semana 4"
- No existe tabla de programas, es lógico en candidatos
- Contenido por semana en Recursos

**MultiCoach:** Se estructura
- NUEVO: Tabla `programas` para reificar semanas como entidades
- Campos: id, org_id, name, week, status, coaches, dates
- Agrupa clientes por semana
- Asigna coaches a semanas
- Calcula métricas agregadas por semana

**Decisión:** 🆕 **Debe construirse desde cero**

**Implementación:**
- Crear tabla `programas(id, org_id, name, week, status, ...)`
- Edge Function para agregar coaches a programas
- View para clientes activos en programa

---

### 3.5 Sesiones y Calendario

**Pathway actual:**
- `sesiones_registro` — Tabla de sesiones completadas
- Campos: id, candidato_id, coach_id, fecha, duración, notas
- Calendario en cliente.html (visual)
- Integraciones: Calendly (iframe en cliente.html)

**MultiCoach:** Se reutiliza con extensión
- Mismo `sesiones_registro` de Pathway
- NUEVO: Acceso desde MultiCoach para Owner (ver sesiones por coach)
- NUEVO: Métricas de sesiones por coach (total, duración promedio)
- NUEVO: Sincronización de Calendly para analytics

**Decisión:** ✅ **Reutilizar con capacidades organizacionales**

**Cambios:**
- Filtros por `org_id` en Edge Functions
- Crear vistas que agreguen sesiones por coach/org

---

### 3.6 Chat

**Pathway actual:**
- Chat en tiempo real entre coach y cliente
- Almacenamiento en `mensajes` o `contactos_chat`
- Interfaz en portal del cliente

**MultiCoach:**
- NO replicar chat en MultiCoach
- Owner NO participa en chats (eso es entre coach y cliente)
- MultiCoach puede MOSTRAR resumen de chat (último mensaje, timestamp) pero no permite escribir
- Link a portal del cliente para acceso directo si necesita intervenir

**Decisión:** ❌ **No duplicar. Enlazar a Pathway**

---

### 3.7 Evaluaciones y Feedback

**Pathway actual:**
- Evaluaciones de cliente al coach (NPS, satisfacción)
- Almacenados en tabla `evaluaciones` o similar
- Visible en portal del cliente

**MultiCoach:** Se extiende
- Mismos datos de Pathway
- NUEVO: Agregación por coach en MultiCoach (ver NPS, satisfacción en detail)
- NUEVO: Cálculo de NPS promedio para KPIs
- NUEVO: Segmentación por período (semanal, mensual)

**Decisión:** ✅ **Reutilizar con agregación organizacional**

---

### 3.8 Portal del Cliente

**Pathway actual:**
- `cliente.html` — Portal completo del cliente
- Secciones: Dashboard, Documentos (CV, Carta), LinkedIn, Empleos, Recursos, Sesiones
- Gamificación (medallas, progreso)
- Chat y Calendly

**MultiCoach:** Se reutiliza, NO se replica
- Owner NO crea nuevo portal
- Owner SUPERVISA el portal del cliente desde MultiCoach
- Link directo desde Client Detail al portal (cliente.html)
- Owner VE progreso, actividad, pero NO ACCEDE a funcionalidades (chat, CV, etc.)

**Decisión:** ❌ **No crear nuevo portal. Enlazar a Pathway**

---

### 3.9 Panel del Coach

**Pathway actual:**
- `panel-v2.html` — Panel del coach
- Secciones: Resumen, Clientes, Links, Pagos, Analytics, Sesiones
- Gestiona sus clientes
- Acceso a analytics personalizadas

**MultiCoach:** Se reutiliza, NO se replica
- Owner NO crea nuevo panel
- Owner SUPERVISA coaches desde Coaches/Coach Detail
- Coach SIGUE usando `panel-v2.html` para su trabajo
- MultiCoach NO reproduce funcionalidades del panel

**Decisión:** ❌ **No duplicar. Enlazar a Pathway**

---

### 3.10 Recursos

**Pathway actual:**
- Tabla/contenido de recursos por semana
- Links a CV, LinkedIn, Networking, Entrevistas, etc.
- Visible en portal del cliente

**MultiCoach:** Se reutiliza, NO se modifica
- MultiCoach NO gestiona recursos
- Owner VE que hay recursos pero NO los crea ni edita
- Link a Pathway si necesita acceder

**Decisión:** ❌ **No duplicar. Solo lectura desde Pathway**

---

### 3.11 Documentos (CV, Carta de Presentación)

**Pathway actual:**
- `cv_publicados` — CVs generados por cliente
- `carta_presentacion` — Cartas generadas por cliente
- Editores: cv.html, carta.html
- Storage: Uploadcare

**MultiCoach:** Se reutiliza, NO se replica
- Owner VE resumen de documentos de cliente (CV generado, Carta)
- Owner NO edita documentos
- Link a Pathway si necesita ver/descargar

**Decisión:** ❌ **No duplicar. Enlazar a Pathway**

---

### 3.12 Analytics y Reportes

**Pathway actual:**
- Analytics weeklies en panel (Web Analytics)
- Cálculos de KPIs: clientes, completitud, retention
- Reportes automáticos con Claude

**MultiCoach:** Se amplía significativamente
- Mismo cálculo de KPIs, pero agregado por ORGANIZACIÓN (no por dominio)
- NUEVO: Analytics de coaches (utilización, NPS, retención)
- NUEVO: Analytics de clientes (riesgo, progreso, retención)
- NUEVO: Proyecciones y forecast por org
- NUEVO: Análisis con Claude de estrategia de org
- NUEVO: Contextualización (objetivos, audiencia, conversiones)

**Decisión:** ✅ **Ampliar para contexto organizacional**

**Reutilizo:**
- Edge Function `analytics-weekly` (adaptar para org_id)
- Claude API para análisis
- Tablas de histórico (analytics_reports)

---

### 3.13 Facturación (Billing)

**Pathway actual:**
- Tabla `billing_data` — Datos de plan (no en Supabase aún, mock en código)
- Integración con Stripe para pagos de coaches
- Webhooks de Stripe para cambios de suscripción

**MultiCoach:** Se reifica
- NUEVO: Tabla `organizations_billing` para plan por org
- NUEVO: Relación 1:1 entre org y plan
- NUEVO: Tracking de uso (coaches, clientes, storage)
- NUEVO: Invoice history
- NUEVO: Webhooks para cambios de plan

**Decisión:** 🆕 **Debe construirse desde cero** (pero reutiliza integración Stripe)

---

### 3.14 Marca Blanca (White-Label)

**Pathway actual:**
- Configuración limitada de colores en landing
- Algunas páginas públicas no personalizadas

**MultiCoach:** Se amplía
- NUEVO: Tabla `organization_branding` — Nombre, logo, colores, tagline
- NUEVO: Editor visual (owner-brand.html)
- NUEVO: Aplicación de marca a portales de coach
- Posibilidad futura: Dominios custom por org

**Decisión:** 🆕 **Debe construirse desde cero**

---

### 3.15 Seguridad Multi-Tenant

**Pathway actual:**
- RLS policies en Supabase
- Filtrado por `auth.uid()` en algunas tablas
- Separación entre coach y cliente

**MultiCoach:** Se amplía
- NUEVO: Filtrado por `org_id` en todas las tablas
- NUEVO: Policies que verifican `users.org_id = organizations.id`
- NUEVO: Verificación de pertenencia a org antes de acceso
- NUEVO: Auditoría de accesos (quién accedió qué, cuándo)

**Decisión:** ✅ **Ampliar RLS para org_id**

---

### Resumen de Decisiones

| Funcionalidad | Decisión | Detalle |
|---|---|---|
| Autenticación | Reutilizar | Sin cambios, JWT de Supabase Auth |
| Coaches | Ampliar | Agregar org_id, métricas por org |
| Clientes | Ampliar | Agregar org_id, coach_id, risk_level |
| Programas | Nuevo | Estructura de semanas como entidades |
| Sesiones | Ampliar | Filtros por org, agregación de métricas |
| Chat | No duplicar | Link a Pathway, owner no participa |
| Evaluaciones | Ampliar | Agregación por coach y org |
| Portal Cliente | No duplicar | Link a Pathway, owner supervisa |
| Panel Coach | No duplicar | Link a Pathway, owner supervisa |
| Recursos | No duplicar | Solo lectura desde Pathway |
| Documentos | No duplicar | Link a Pathway, owner supervisa |
| Analytics | Ampliar | Por org, con contexto y forecast |
| Facturación | Nuevo | Billing por organización |
| Marca Blanca | Nuevo | Editor de branding personalizado |
| Seguridad | Ampliar | RLS por org_id |

---

## 4. Roadmap de Integración

Orden de fases de desarrollo después del frontend, optimizado para minimizar riesgos y permitir feedback temprano.

### Fase 0: Infraestructura Base (Pre-requisito)

**Antes de cualquier pantalla, establecer la base:**

```
Fase 0 (Semana 1-2)
├─ Crear tablas base en Supabase
│  ├─ organizations (org_id, name, owner_id, plan, status, ...)
│  ├─ usuarios (agregar org_id, mantener backward compatibility)
│  ├─ coach_client_assignments (coach_id, client_id, org_id, estado)
│  ├─ programas (id, org_id, week, name, status, ...)
│  └─ organizations_billing (org_id, plan, price, nextBillingDate, ...)
│
├─ Configurar RLS por org_id
│  ├─ Policies que filtren por org_id
│  ├─ Policies que verifiquen user.org_id
│  └─ Auditoría de accesos
│
├─ Crear migraciones de datos
│  ├─ Poblar organizations con datos iniciales (test)
│  ├─ Asignar usuarios a orgs
│  └─ Mapear coaches y clientes a orgs
│
└─ Edge Functions base
   ├─ Función para validar user ∈ org
   ├─ Función para obtener org_id del usuario
   └─ Middleware de autenticación/autorización
```

**Riesgos minimizados:**
- Establece la estructura fundamental
- Permite que todas las pantallas tengan acceso a data correcta desde el inicio
- Evita refactorización masiva después

---

### Fase 1: Dashboard

```
Fase 1 (Semana 3)
│
├─ Endpoint GET /api/organization/{org_id}/dashboard/kpis
│  ├─ Edge Function fetch-org-kpis
│  ├─ Calcula desde usuarios (coaches), candidatos, sesiones
│  └─ Cachea resultados (actualiza cada 1h)
│
├─ Endpoint GET /api/organization/{org_id}/coaches/summary
│  ├─ Edge Function fetch-coaches-summary
│  └─ Lista coaches + métricas individuales
│
├─ Endpoint GET /api/organization/{org_id}/activity/recent
│  ├─ Edge Function track-organization-activity
│  └─ Últimos eventos (nuevo cliente, coach agregado, etc.)
│
└─ Conectar frontend (owner-coaches.html)
   └─ Reemplazar mock data con datos reales
```

**Por qué primero:**
- Dashboard es lectura pura (bajo riesgo)
- Valida que la arquitectura base funciona
- Proporciona visibilidad inmediata del progreso
- Permite feedback del usuario tempranamente

**Métricas de éxito:**
- KPIs se actualizan en tiempo real
- Datos coinciden con realidad (coaches activos, clientes totales)
- Performance <500ms por request

---

### Fase 2: Coaches

```
Fase 2 (Semana 4)
│
├─ Endpoints para listado
│  ├─ GET /api/organization/{org_id}/coaches
│  ├─ GET /api/organization/{org_id}/coaches/{coach_id}
│  └─ Filtros: búsqueda, status, capacidad
│
├─ Endpoints para actualización (cambios mínimos)
│  ├─ PATCH /api/organization/{org_id}/coaches/{coach_id}
│  │  └─ Solo status y basic info (NO tocar datos de Pathway)
│  └─ Edge Function update-coach-status
│
├─ Endpoints para métricas
│  ├─ GET /api/organization/{org_id}/coaches/{coach_id}/metrics
│  ├─ Edge Function get-coach-metrics
│  └─ Calcula NPS, retención, completitud
│
├─ Conectar frontend
│  ├─ owner-coaches.html (lista + filtros)
│  └─ owner-coach-detail.html (perfil + clientes)
│
└─ Tabla intermediate: coach_client_assignments
   └─ Mapea coaches a clientes explícitamente
```

**Por qué segundo:**
- Depende de Fase 0
- Coaches son reutilización de Pathway (bajo riesgo)
- Permite asignación de clientes a coaches
- Genera datos para analytics

**Métricas de éxito:**
- Coaches listados correctamente filtrados por org
- Métricas calculadas en tiempo real
- Asignación de clientes sin errores

---

### Fase 3: Clientes

```
Fase 3 (Semana 5)
│
├─ Endpoints para listado
│  ├─ GET /api/organization/{org_id}/clients
│  ├─ Filtros: búsqueda, status, risk, coach, programa
│  └─ Sorte: nombre, progreso, riesgo
│
├─ Endpoints para actualización
│  ├─ PATCH /api/organization/{org_id}/clients/{client_id}
│  │  └─ Cambiar coach asignado (validar capacidad)
│  └─ Edge Function reassign-coach
│
├─ Nuevo: Risk Assessment
│  ├─ Edge Function assess-client-risk
│  ├─ Análisis basado en: progreso, actividad, feedback
│  └─ Tabla client_risk_assessments
│
├─ Conectar frontend
│  ├─ owner-clients.html (lista + filtros)
│  └─ owner-client-detail.html (perfil + coach + riesgo)
│
└─ Validaciones
   ├─ Coach no puede exceder capacidad
   ├─ Cliente debe tener coach asignado
   └─ Risk level se recalcula después de cambios
```

**Por qué tercero:**
- Depende de Fase 1 y 2
- Clientes son reutilización de Pathway (bajo riesgo)
- Presenta nueva lógica (risk assessment)
- Permite supervisión y gestión efectiva

**Métricas de éxito:**
- Clientes filtrados correctamente por org
- Reasignación de coaches sin violar capacidad
- Risk level preciso (validado con expertos)

---

### Fase 4: Programas

```
Fase 4 (Semana 6)
│
├─ Crear tabla programas
│  ├─ id, org_id, name, week, status
│  ├─ coaches (array de coach_ids)
│  └─ Seedear con Pathway 4 Semanas
│
├─ Endpoints
│  ├─ GET /api/organization/{org_id}/programs
│  ├─ GET /api/organization/{org_id}/programs/{program_id}
│  ├─ GET /api/organization/{org_id}/programs/{program_id}/clients
│  └─ Edge Function list-org-programs
│
├─ Métricas
│  ├─ Clientes activos por semana
│  ├─ Tasa completitud
│  ├─ Duración promedio
│  └─ Coaches asignados
│
└─ Conectar frontend
   └─ owner-programs.html (programas por semana + coaches)
```

**Por qué cuarto:**
- Depende de Fase 3
- Estructuración lógica (semanas como entidades)
- Proporciona contexto para analytics
- Bajo riesgo (nuevos datos, no modifica existentes)

**Métricas de éxito:**
- Programas agrupados correctamente por semana
- Clientes asignados a semana correcta
- Métricas agregadas precisas

---

### Fase 5: Analytics

```
Fase 5 (Semana 7-8)
│
├─ Endpoints de KPIs
│  ├─ GET /api/organization/{org_id}/analytics/kpis
│  ├─ GET /api/organization/{org_id}/analytics/growth
│  ├─ GET /api/organization/{org_id}/analytics/retention
│  ├─ GET /api/organization/{org_id}/analytics/coach-utilization
│  ├─ GET /api/organization/{org_id}/analytics/nps
│  └─ GET /api/organization/{org_id}/analytics/forecast
│
├─ Edge Functions
│  ├─ calculate-org-kpis
│  ├─ calculate-monthly-growth
│  ├─ calculate-retention-curve
│  ├─ calculate-coach-utilization
│  └─ generate-analytics-report (con Claude)
│
├─ Analytics Context (NUEVO)
│  ├─ POST /api/organization/{org_id}/analytics/context
│  ├─ Store: objetivo, audiencia, páginas clave, conversiones
│  └─ Inyectar al prompt de Claude
│
├─ Reportes automáticos
│  ├─ Edge Function que corre cada semana
│  ├─ Analiza data con Claude
│  └─ Genera recomendaciones
│
└─ Conectar frontend
   └─ owner-analytics.html (4 tabs con gráficos)
```

**Por qué quinto:**
- Depende de data de Fases 1-4
- Alto impacto (visibilidad ejecutiva)
- Requiere lógica de cálculo compleja
- Integración con Claude

**Métricas de éxito:**
- Gráficos se actualizan correctamente
- Análisis de Claude es accionable
- Forecast es confiable (validar después 2-3 semanas)

---

### Fase 6: Facturación & Configuración

```
Fase 6 (Semana 9)
│
├─ Billings & Plans
│  ├─ Crear tabla organizations_billing
│  ├─ Endpoints: GET plan, GET usage, GET invoices
│  ├─ Integración con Stripe (webhooks)
│  └─ Conectar owner-billing.html
│
├─ Configuración
│  ├─ Endpoints: GET/PATCH org details
│  ├─ Gestión de usuarios (invite, delete, roles)
│  ├─ Preferencias de notificaciones
│  ├─ Integraciones (Slack, Google, Zapier)
│  └─ Conectar owner-settings.html
│
└─ Seguridad
   ├─ 2FA setup
   ├─ Auditoría de accesos
   └─ Session management
```

**Por qué sexto:**
- Depende de Fase 0 (estructura base)
- Bajo riesgo (configuración, no data operativa)
- Puede hacerse en paralelo con Phase 5

**Métricas de éxito:**
- Plan y uso sincronizados con Stripe
- Notificaciones se envían correctamente
- Auditoría registra accesos

---

### Fase 7: Marca Blanca

```
Fase 7 (Semana 10)
│
├─ Crear tabla organization_branding
│  ├─ name, logo, primaryColor, secondaryColor, ...
│  └─ Seed con defaults
│
├─ Endpoints
│  ├─ GET /api/organization/{org_id}/brand
│  ├─ PATCH /api/organization/{org_id}/brand
│  └─ Edge Function update-org-branding
│
├─ Aplicar marca a portales
│  ├─ Inyectar colores en cliente.html
│  ├─ Actualizar logo en header de panel
│  └─ Estilos dinámicos con CSS variables
│
└─ Conectar frontend
   └─ owner-brand.html (color picker, templates, preview)
```

**Por qué séptimo:**
- Depende de Fase 0
- Bajo riesgo (cosméticos)
- Alto valor (diferenciación visual)
- Puede hacerse después del MVP base

**Métricas de éxito:**
- Colores aplicados consistentemente
- Preview es exacto
- Cambios se reflejan sin recargar

---

### Fase 8: Refinamiento & Producción

```
Fase 8 (Semana 11-12)
│
├─ Testing exhaustivo
│  ├─ Multi-tenant isolation (intentar acceso entre orgs)
│  ├─ Performance (carga con múltiples orgs)
│  ├─ Datos reales (migración de test data)
│  └─ Stress testing (simular uso real)
│
├─ Documentación
│  ├─ API docs (OpenAPI/Swagger)
│  ├─ Runbooks de operación
│  └─ Guía de troubleshooting
│
├─ Deployment a producción
│  ├─ Migración de datos de Pathway
│  ├─ Setup de dominio custom (si aplica)
│  └─ Monitoreo y alertas
│
└─ Beta con primeros clientes
   ├─ Feedback de owner
   ├─ Iteración rápida
   └─ GA launch
```

---

### Timeline Visual

```
Semana:  1-2     3       4       5       6       7-8     9       10      11-12
Fase:    BASE    D'board Coaches Clientes Progs   Analytics Billing Brand   Prod
         
├────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│        │       │       │       │       │       │       │       │       │
│ Infra  │ Ready │       │       │       │       │       │       │       │
│ Tables │ for   │       │       │       │       │       │       │       │
│ RLS    │ MVP   │       │       │       │       │       │       │       │
│        │       │       │       │       │       │       │       │       │
└────────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘
```

---

## 5. Riesgos Técnicos

Identificación de riesgos, dependencias, bloqueos, y estrategias de mitigación.

### 5.1 Riesgos de Seguridad

#### R1: Aislamiento Multi-Tenant Insuficiente

**Severidad:** 🔴 CRÍTICO

**Descripción:**
Un usuario/coach podría acceder datos de otra organización si el filtrado por org_id no es exhaustivo.

**Escenario:**
- Coach de org A obtiene token JWT
- Modifica request: `GET /api/organization/org-b-id/clients`
- Servidor devuelve clientes de org B (violación de seguridad)

**Dependencias:**
- RLS policies en Supabase
- Validación de org_id en Edge Functions
- JWT claims correctos (user.org_id)

**Mitigación:**
- ✅ Implementar RLS estricto por org_id en TODAS las tablas
- ✅ Validación de pertenencia antes de cualquier query: `users.org_id = {org_id}`
- ✅ Tests de aislamiento (intentar acceso cross-org)
- ✅ Auditoría de accesos (quién accedió qué, cuándo)
- ✅ Security review pre-GA

**Momento de validación:** Fase 0 (Infraestructura)

---

#### R2: Exposición de Password Hash

**Severidad:** 🔴 CRÍTICO

**Descripción:**
`password_hash` en tabla `usuarios` podría filtrarse si no está protegida por RLS.

**Escenario:**
- Frontend hace query a `/rest/v1/usuarios`
- Response incluye `password_hash` (no debería)
- Datos sensibles expuestos

**Mitigación:**
- ✅ GRANT SELECT columnas específicas (excluir password_hash)
- ✅ RLS policy: anon/authenticated NO pueden leer password_hash
- ✅ Auth via Supabase Auth (no password validation en cliente)
- ✅ Pre-GA security scan

**Momento de validación:** Fase 0

---

#### R3: JWT Expiración y Renovación

**Severidad:** 🟡 ALTO

**Descripción:**
Sesiones de usuario pueden expirar sin renovación automática.

**Escenario:**
- User obtiene JWT válido por 1 hora
- Sigue navegando en MultiCoach
- JWT expira después de 1 hora
- Siguiente request falla (401 Unauthorized)
- User debe volver a loguear

**Mitigación:**
- ✅ Implementar refresh token logic
- ✅ Renovar JWT automáticamente antes de expiración (en background)
- ✅ Si falla, redirigir a login con mensaje claro
- ✅ Mantener sesión en localStorage (no localStorage para token)

**Momento de validación:** Fase 0 / Fase 1

---

### 5.2 Riesgos de Datos

#### R4: Inconsistencia de Data Entre Pathway y MultiCoach

**Severidad:** 🟡 ALTO

**Descripción:**
MultiCoach lee de tablas de Pathway que pueden cambiar en paralelo, causando inconsistencias.

**Escenario:**
- MultiCoach cache: Coach A tiene 5 clientes
- Coach completa sesión con cliente 6
- Cache de MultiCoach aún muestra 5 (stale data)

**Dependencias:**
- Estrategia de cache/invalidación
- Event-driven updates

**Mitigación:**
- ✅ No cachear datos críticos (clientes, sesiones) más de 5 minutos
- ✅ Event-driven invalidation: cuando Pathway actualiza, notifica MultiCoach
- ✅ Webhook de Supabase para cambios en tablas
- ✅ Background job que re-sincroniza cada 30 minutos
- ✅ Display de "last updated at" en UI

**Momento de validación:** Fase 3 (Clientes)

---

#### R5: Migración de Data Pathway → MultiCoach

**Severidad:** 🟡 ALTO

**Descripción:**
Migrar datos existentes de Pathway (coaches, clientes) a MultiCoach sin corromper requiere precisión.

**Escenario:**
- 100 coaches y 500 clientes en Pathway
- Agregar org_id a todos
- Rollback fallido → data incompleta

**Dependencias:**
- SQL migrations limpias
- Backup de BD antes
- Script de rollback probado

**Mitigación:**
- ✅ Realizar migration en environment de staging primero
- ✅ Backup completo de BD antes de migration
- ✅ Script de migration con validaciones
- ✅ Rollback script probado
- ✅ Validación post-migration (conteos, integridad)
- ✅ Dry-run antes de production

**Momento de validación:** Pre-Fase 1 (después Fase 0)

---

#### R6: Pérdida de Sesiones Huérfanas

**Severidad:** 🟠 MEDIO

**Descripción:**
Sesiones (`sesiones_registro`) que no tienen coach_id o client_id asignado correctamente.

**Escenario:**
- Cliente es reasignado a nuevo coach
- Sesiones antiguas quedan huérfanas (coach_id = null)
- Métricas del coach incompletas

**Mitigación:**
- ✅ Al reasignar coach, actualizar sesiones históricas (con fecha límite)
- ✅ Mantener audit trail de reasignaciones
- ✅ Validación: no permitir delete de coach si tiene sesiones
- ✅ Reportes que flaguen sesiones huérfanas

**Momento de validación:** Fase 3 (Clientes)

---

### 5.3 Riesgos de Performance

#### R7: Queries Lentas en Analytics

**Severidad:** 🟡 ALTO

**Descripción:**
Calcular KPIs agregados (total clientes, retención, NPS) puede ser lento si hay 1000+ registros por org.

**Escenario:**
- Query: `SELECT COUNT(*) FROM candidatos WHERE org_id = X`
- Con 50,000 candidatos en BD → 2 segundos
- Frontend espera →timeout o mal UX

**Dependencias:**
- Índices de BD
- Materialización de vistas
- Edge Function caching

**Mitigación:**
- ✅ Índices en (org_id, status, created_at) en tablas principales
- ✅ Materializar vistas: `org_aggregates` (actualizada cada 1h)
- ✅ Cache en Edge Functions (Redis o similar)
- ✅ Paginar resultados grandes (no traer 10k registros)
- ✅ Monitoring de query performance (log queries lentas)

**Momento de validación:** Fase 5 (Analytics)

---

#### R8: Memory Leak en Edge Functions

**Severidad:** 🟡 ALTO

**Descripción:**
Edge Functions pueden acumular memoria entre invocaciones si no se limpian correctamente.

**Escenario:**
- Edge Function acumula conexiones a BD
- Después de 1000 invocaciones → OOM (Out of Memory)
- Servicio crashea

**Mitigación:**
- ✅ Cerrar conexiones explícitamente
- ✅ Usar connection pooling (PgBouncer)
- ✅ Monitoring de memoria de función
- ✅ Límites de timeout (no queries indefinidas)
- ✅ Unit tests con stress testing

**Momento de validación:** Fase 1 (Dashboard)

---

### 5.4 Riesgos de Integración

#### R9: Ruptura de Pathway al Agregar org_id

**Severidad:** 🔴 CRÍTICO

**Descripción:**
Agregar columna `org_id` a tabla `usuarios` o `candidatos` puede quebrar queries existentes de Pathway.

**Escenario:**
- Query antigua: `INSERT INTO usuarios (email, password_hash, ...) VALUES (...)`
- Migración: Agregar `org_id` como NOT NULL
- Queries antiguas fallan (NULL en org_id)

**Dependencias:**
- Backward compatibility de Pathway
- Tests de Pathway siguen pasando

**Mitigación:**
- ✅ `org_id` nullable inicialmente (DEFAULT NULL)
- ✅ Paso 1: Agregar columna nullable
- ✅ Paso 2: Llenar valores existentes con org default
- ✅ Paso 3: Cambiar a NOT NULL
- ✅ Ejecutar Pathway tests después de cada paso
- ✅ Coordinar con cambios de Pathway (evitar conflictos)

**Momento de validación:** Fase 0 (Infraestructura)

---

#### R10: Desincronización de Coaches Entre Pathway y MultiCoach

**Severidad:** 🟠 MEDIO

**Descripción:**
Coach puede cambiar datos en Pathway que MultiCoach no refleja (ej: especialidad).

**Escenario:**
- Coach edita especialidad en panel-v2.html
- MultiCoach cache muestra especialidad vieja
- Owner ve data incorrecta

**Mitigación:**
- ✅ Event-driven updates (Supabase realtime)
- ✅ Invalidar cache cuando coach actualiza datos
- ✅ Mostrar "last synced at" timestamp
- ✅ Botón refresh manual en UI

**Momento de validación:** Fase 2 (Coaches)

---

### 5.5 Riesgos de Operación

#### R11: Runaway Costs con Stripe

**Severidad:** 🟡 ALTO

**Descripción:**
Múltiples organizaciones pueden incurrir costos de Stripe rápidamente si no se controla.

**Escenario:**
- 100 orgs × $29/mes (Basic) = $2900/mes
- Si cobro menos, runaway costs
- Modelo de negocio quebrado

**Dependencias:**
- Pricing y contrato con clientes
- Monitoring de MRR
- Automation de billing

**Mitigación:**
- ✅ Definir pricing tier claro (Basic, Pro, Enterprise)
- ✅ Configurar hard limits (max coaches, clients por tier)
- ✅ Automated billing (Stripe subscriptions)
- ✅ Monitoreo de MRR y churn
- ✅ Dashboard de ingresos en MultiCoach admin

**Momento de validación:** Fase 6 (Billing)

---

#### R12: Falta de Auditoría

**Severidad:** 🟡 ALTO

**Descripción:**
Si algo falla, no hay logs de qué pasó (quién accedió, cuándo, de dónde).

**Escenario:**
- Owner reporta: "Mi data desapareció"
- Sin logs → imposible investigar
- Culpabilidad unclear

**Mitigación:**
- ✅ Tabla `audit_logs` en Supabase
- ✅ Loguear: quién accedió, qué data, cuándo, resultado
- ✅ Retención de logs (2 años mínimo)
- ✅ Acceso solo a owner y admins
- ✅ Dashboard de auditoría en settings

**Momento de validación:** Fase 0 (Infraestructura)

---

#### R13: Disaster Recovery

**Severidad:** 🟡 ALTO

**Descripción:**
Si Supabase/datos se pierden, no hay backup.

**Escenario:**
- Supabase BD se corrompe
- Backups automáticos no disponibles
- Datos irrecuperables

**Mitigación:**
- ✅ Backups automáticos de Supabase (daily)
- ✅ Backups off-site (no solo Supabase)
- ✅ Restore testing (probar restore cada 3 meses)
- ✅ RTO/RPO definidos (max 4 horas downtime)

**Momento de validación:** Pre-GA (Fase 8)

---

### 5.6 Matriz de Riesgos

| # | Riesgo | Severidad | Fase | Mitigación | Status |
|---|---|---|---|---|---|
| R1 | Multi-tenant isolation | 🔴 CRÍTICO | 0 | RLS strict | ⏳ Pre-impl |
| R2 | Password hash exposure | 🔴 CRÍTICO | 0 | GRANT + RLS | ⏳ Pre-impl |
| R3 | JWT expiration | 🟡 ALTO | 0/1 | Refresh logic | ⏳ Pre-impl |
| R4 | Data inconsistency | 🟡 ALTO | 3 | Event-driven | ⏳ Pre-impl |
| R5 | Migration failure | 🟡 ALTO | Pre-1 | Dry-run + rollback | ⏳ Pre-impl |
| R6 | Orphaned sessions | 🟠 MEDIO | 3 | Audit trail | ⏳ Pre-impl |
| R7 | Slow analytics | 🟡 ALTO | 5 | Indices + cache | ⏳ Pre-impl |
| R8 | Memory leak | 🟡 ALTO | 1 | Pooling + monitor | ⏳ Pre-impl |
| R9 | Break Pathway | 🔴 CRÍTICO | 0 | Nullable column | ⏳ Pre-impl |
| R10 | Coach desync | 🟠 MEDIO | 2 | Realtime events | ⏳ Pre-impl |
| R11 | Runaway costs | 🟡 ALTO | 6 | Pricing + limits | ⏳ Pre-impl |
| R12 | No audit trail | 🟡 ALTO | 0 | Audit logs | ⏳ Pre-impl |
| R13 | No disaster recovery | 🟡 ALTO | 8 | Daily backups | ⏳ Pre-impl |

---

## 6. Dependencias Críticas

Trabajos que DEBEN estar listos antes de pasar a la siguiente fase.

### Entre Fases

```
Fase 0 → Fase 1: ✅ Tablas creadas, RLS activado, migrations probadas
Fase 1 → Fase 2: ✅ Dashboard funciona, datos reales fluyen
Fase 2 → Fase 3: ✅ Coaches listables, métricas calculadas
Fase 3 → Fase 4: ✅ Clientes por coach, risk assessment working
Fase 4 → Fase 5: ✅ Programas estructurados, clientes por semana
Fase 5 → Fase 6: ✅ Analytics preciso, histórico de datos
Fase 6 → Fase 7: ✅ Billing funcionando, Stripe integrado
Fase 7 → Fase 8: ✅ Marca aplicada, testing exhaustivo
```

---

## 7. Hitos Clave (No de Código)

Este documento solo arquitectura, sin implementación. Hitos arquitectónicos:

- ✅ Definición de API por pantalla (COMPLETADO EN ESTE DOC)
- ✅ Modelo lógico de entidades (COMPLETADO EN ESTE DOC)
- ✅ Inventario Pathway (COMPLETADO EN ESTE DOC)
- ✅ Roadmap de integración (COMPLETADO EN ESTE DOC)
- ✅ Riesgos técnicos y mitigaciones (COMPLETADO EN ESTE DOC)

**Próximo paso:** Revisar este documento, ajustar, y proceder a **Implementación Fase 0** (infraestructura).

---

## 8. Conclusión

**MultiCoach es una capa de administración sobre Pathway.** La arquitectura está diseñada para:

1. **Reutilizar sin duplicar** — Coaches, clientes, programas, sesiones de Pathway se usan tal cual
2. **Extender para organizaciones** — Agregar org_id y métricas agregadas
3. **Construir lo nuevo** — Programas, facturación, marca, análisis de org
4. **Minimizar riesgo** — Fases pequeñas, validación constante, fallback a Pathway

El roadmap de 12 semanas permite que el MVP esté listo para beta en Semana 7, con refinamiento y GA en Semana 12.

---

**Documento Aprobado Por:** Arquitecto  
**Fecha:** Julio 2026  
**Status:** ✅ LISTO PARA IMPLEMENTACIÓN
