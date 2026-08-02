# Sprint 5.0 — Arquitectura Organizacional de Pathway (Multinícho)

**Estado**: Diseño de arquitectura funcional (sin código)  
**Objetivo**: Definir modelo base agnóstico del nicho para permisos, agendas, cobros y colaboración  
**Válido para**: Sprint 5.1 a 5.4, cualquier especialidad de coaching, extensible a 10+ años

---

## 0. PRINCIPIO FUNDAMENTAL

**Pathway es agnóstico del nicho. Dos entidades distintas: EQUIPO y CLIENTES.**

```
ARQUITECTURA CONCEPTUAL

┌──────────────────────────────────────────────────────────────┐
│ ORGANIZACIÓN                                                 │
│ (Logo, Branding, Especialidades Habilitadas, Modelos Cobros)│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────┐  ┌────────────────────────┐│
│  │ EQUIPO (Personas)           │  │ CLIENTES               ││
│  │ - Owner                     │  │ - Cliente 1 (Career)   ││
│  │ - Coach Ana (Career, Exec)  │  │ - Cliente 2 (Fitness)  ││
│  │ - Coach Carlos (Fitness)    │  │ - Cliente 3 (Career)   ││
│  │ - Recruiter María           │  │ - Cliente 4 (Executive)││
│  │ - Admin Juan                │  │                        ││
│  │ (con Capacidades)           │  │ (con Especialidad)     ││
│  └─────────────────────────────┘  └────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ESPECIALIDADES (Eje Ortogonal, Compartido)              ││
│  │ ✓ Career  ✓ Executive  ✓ Fitness                        ││
│  │ (Coach Ana ∈ {Career, Executive})                       ││
│  │ (Cliente 1 asignado a ∈ {Career})                       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ BRAND ENGINE (Paleta, Tokens, UI) — Org. Level         ││
│  │ (No pertenece al nicho, es de la Organización)          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Diferenciación Crítica**:
- **"Personas del Equipo"**: Tienen capacidades (qué pueden hacer)
- **"Clientes"**: Tienen especialidad asignada + programa + sesiones
- Cuando escribas "Buscar persona", está claro que es equipo
- Cuando escribas "Buscar cliente", está claro que recibe coaching
- **Sin ambigüedad operativa**

---

## 1. MODELO DE EQUIPO (Personas)

**Estructura base: Owner, Coach, Colaborador (sin roles fijos).**

### 1.1 Tipos de Persona del Equipo

```
OWNER
├─ Dueño de la organización
├─ 1 por organización
├─ Configura especialidades habilitadas, modelo de cobros, branding
└─ Capacidades: todas (heredadas por defecto)

COACH
├─ Brinda sesiones (cualquier especialidad que domine)
├─ Puede tener 1+ especialidades (ej: Career + Executive)
├─ Solo ve clientes en sus especialidades asignadas
├─ Capacidades: típicamente sesiones, programas, clientes propios
└─ Cobra según modelo de cobros de la org

COLABORADOR
├─ Apoya sin brindar sesiones (Admin, Recruiter, HR, etc.)
├─ Puede tener 1+ especialidades (ej: Recruiter puede crear clientes Career + Executive)
├─ Capacidades específicas según función
└─ NO tiene acceso directo a cobros
```

### 1.2 Atributos Mínimos de Persona (Equipo)

```
id                    (UUID)
org_id                (FK a organizaciones)
tipo                  (owner | coach | colaborador)
email                 (único por org)
nombre                (nombre completo)
foto                  (URL)
estado                (activo | invitado | vacaciones | suspendido | inactivo)
especialidades_id     (JSONB: ["career", "executive"]) — subset de org.especialidades_habilitadas
datos_contacto
  - teléfono
  - timezone
  - idioma
  - ubicación
fecha_incorporación   (cuándo entró a la org)
última_actividad      (timestamp)
metadata
  - capacidades_activas   (lista de capability IDs)
  - permisos_heredados    (de grupo, si aplica)
  - estado_cobro          (activo, suspendido, deuda)
```

---

## 2. MODELO DE CLIENTES

**Entidad separada del equipo. Reciben coaching en una especialidad específica.**

### 2.1 Atributos Mínimos de Cliente

```
id                    (UUID)
org_id                (FK a organizaciones)
coach_id              (FK a personas/equipo)
coach_secondary_id    (FK opcional — para co-coaching)
especialidad          (career | fitness | executive | etc.) — single, constrained a org.especialidades_habilitadas
email                 (único por org)
nombre                (nombre completo)
foto                  (URL)
estado                (activo | en_pausa | completado | inactivo)
programa_id           (FK a programas)
biblioteca_id         (FK a biblioteca — derivado de especialidad)
fecha_inicio          (cuándo comenzó)
fecha_fin_estimada    (duración típica)
última_actividad      (timestamp)
metadata
  - notas_coach       (privadas para equipo)
  - progreso_json     (métricas del programa)
  - sesiones_count    (total completadas)
```

---

## 3. ESPECIALIDADES (Eje Ortogonal)

**Independiente de si eres equipo o cliente. Define qué programas/recursos/formularios existen.**

### 3.1 Especialidades Soportadas

```
Career              (coaching de carrera)
Executive           (coaching ejecutivo)
Leadership          (liderazgo)
Fitness             (entrenamiento físico)
Nutrition           (nutrición)
Wellness            (bienestar integral)
Financial           (finanzas personales)
Business            (negocio/emprendimiento)
Psychology          (psicología clínica)
Recruiting          (reclutamiento)
HR                  (RRHH corporativo)
(extensible a +20)
```

### 3.2 Especialidades Habilitadas por Organización

```
Organización "AcmeCorp Coaching"
├─ Especialidades Habilitadas: ["Career", "Executive", "Leadership", "Recruiting"]
│  (no usa Fitness, Nutrition, Wellness)
│
├─ Coach Ana
│  └─ Puede trabajar en: Career + Executive
│     (subset de lo habilitado en org)
│
├─ Coach Carlos
│  └─ Puede trabajar en: Career
│
├─ Recruiter María
│  └─ Puede crear clientes en: Career + Recruiting
│     (aunque la org habilite Leadership, ella no maneja eso)
│
└─ Cliente 1
   └─ Asignado a: Career (una sola especialidad por cliente)
```

**Ventaja**: La organización elige qué nichos ofrece (puede ser 1 o 20). El sistema soporta todos sin cambios.

---

## 4. BIBLIOTECA + PROGRAMAS + RECURSOS

**Tres niveles para máxima flexibilidad.**

### 4.1 Estructura Jerárquica

```
ESPECIALIDAD "Career"
├─ BIBLIOTECA "Búsqueda de Empleo"
│  ├─ Programa 1: "CV Express" (2 semanas)
│  ├─ Programa 2: "LinkedIn Pro" (3 semanas)
│  └─ Programa 3: "Entrevistas Mastery" (4 semanas)
│
├─ BIBLIOTECA "Desarrollo Profesional"
│  ├─ Programa 1: "Marca Personal"
│  ├─ Programa 2: "Networking Avanzado"
│  └─ Programa 3: "Cambio de Carrera"
│
└─ RECURSOS (todos los de Career)
   ├─ PDFs: "CV Template", "Cover Letter Guide"
   ├─ Videos: "LinkedIn Optimization", "Interview Tips"
   ├─ Plantillas: "30-60-90 Plan", "Salary Negotiation"
   ├─ Ejercicios: "Mock Interviews"
   ├─ Formularios: "Intake Form", "Progress Tracker"
   └─ IA: Análisis de CV, sugerencias de palabras clave

ESPECIALIDAD "Fitness"
├─ BIBLIOTECA "Hipertrofia"
│  ├─ Programa 1: "Push/Pull/Legs" (12 semanas)
│  ├─ Programa 2: "Upper/Lower" (8 semanas)
│  └─ Programa 3: "Full Body" (6 semanas)
│
├─ BIBLIOTECA "Running"
│  ├─ Programa 1: "5K en 8 semanas"
│  ├─ Programa 2: "Maratón en 16 semanas"
│  └─ Programa 3: "Ultra Trail"
│
└─ RECURSOS (todos los de Fitness)
   ├─ Videos: "Proper Form for Squat", "Running Posture"
   ├─ Plantillas: "Weekly Meal Prep", "Training Log"
   ├─ Ejercicios: Base de 500+ ejercicios con video
   ├─ Formularios: "Body Composition Assessment", "Running Test"
   └─ IA: Análisis de form desde video, sugerencias de progresión
```

### 4.2 Modelo de Datos

```
especialidades
├─ id (career, fitness, etc.)
├─ nombre
└─ descripcion

bibliotecas
├─ id (UUID)
├─ org_id (FK)
├─ especialidad_id (FK) — cada biblioteca pertenece a una especialidad
├─ nombre (ej: "Búsqueda de Empleo")
├─ descripcion
└─ orden

programas
├─ id (UUID)
├─ org_id (FK)
├─ biblioteca_id (FK) — programa pertenece a biblioteca (y por lo tanto a especialidad)
├─ nombre (ej: "CV Express")
├─ duracion_semanas
├─ contenido (JSONB: pasos, módulos, recursos integrados)
└─ activo

recursos
├─ id (UUID)
├─ org_id (FK)
├─ especialidad_id (FK) — recurso puede usarse en múltiples programas de la misma especialidad
├─ tipo (pdf | video | plantilla | ejercicio | formulario | ia_prompt)
├─ nombre
├─ url (o contenido embebido)
├─ tags (para búsqueda cross-programa)
└─ activo

clientes_programas (relación)
├─ cliente_id (FK)
├─ programa_id (FK)
├─ fecha_inicio
├─ fecha_fin_estimada
├─ progreso (JSONB: módulos completados, tareas hechas)
└─ estado (en_progreso | completado | pausado)
```

---

## 5. BRAND ENGINE (Nivel de Organización)

**No pertenece a especialidades. Cada organización define su propia identidad visual.**

```
ORGANIZACIÓN
├─ Logo (URL)
├─ Colores
│  ├─ Primary (acento principal)
│  ├─ Secondary (acentos)
│  ├─ Neutral (grises, blancos)
│  └─ Semantic (éxito, warning, error)
├─ Tipografía
│  ├─ Display Face (H1, H2)
│  ├─ Body Face (párrafos)
│  └─ Mono Face (código)
├─ Componentes
│  ├─ Botones (primary, secondary, danger)
│  ├─ Cards (estilos base)
│  ├─ Formularios (inputs, dropdowns)
│  ├─ Badges (roles, estados, especialidades)
│  └─ Iconografía (set único Lucide)
├─ Espaciado & Elevación
│  ├─ Gaps (12px, 16px, 24px)
│  ├─ Padding (16px, 20px, 24px)
│  └─ Shadows (xs, sm, md, lg)
└─ Temas
   ├─ Light (modo claro)
   └─ Dark (modo oscuro)

RESULTADO
└─ Toda la UI (portales, paneles, dashboards) hereda automáticamente
   (Sin cambiar código, solo los tokens)
```

### 5.1 Impacto Técnico

```
Tabla: org_branding
├─ org_id (PK)
├─ logo_url
├─ colores_json (primary, secondary, neutral, semantic)
├─ tipografia_json (display, body, mono)
├─ componentes_json (botones, cards, etc.)
├─ espaciado_json (gaps, padding, shadows)
└─ activo

Sistema:
├─ CSS custom properties generadas automáticamente
├─ :root[data-org-id="..."] con todos los tokens
├─ Portal cliente: <link rel="stylesheet" href="/themes/org-{org_id}.css">
├─ Panel coach: mismo sistema
└─ Deploy: rebuild CSS si branding cambia (trigger vía webhook)
```

---

## 6. MODELO DE CAPACIDADES (Equipo)

**Granular, asignables, agnóstico del nicho.**

### 6.1 Matriz Simplificada (Ejemplos Clave)

```
CLIENTES
├─ CLI-001: Crear clientes (cualquier especialidad en la org)
├─ CLI-002: Editar clientes propios
├─ CLI-003: Editar clientes de otros (admin)
├─ CLI-004: Ver clientes propios
├─ CLI-005: Ver todos los clientes (admin)
├─ CLI-006: Filtrar por especialidad / estado
└─ CLI-007: Exportar lista

SESIONES / AGENDA
├─ AGD-001: Ver propia agenda
├─ AGD-002: Ver agenda del equipo (admin)
├─ AGD-003: Crear sesión (propia)
├─ AGD-004: Editar sesión (propia)
├─ AGD-005: Cancelar sesión
├─ AGD-006: Reasignar sesión a otro coach (admin)
├─ AGD-007: Bloquear tiempo (vacaciones)
└─ AGD-008: Coordinar con otros coaches

PROGRAMAS
├─ PRG-001: Ver programas disponibles
├─ PRG-002: Asignar programa a cliente (coach)
├─ PRG-003: Editar programas de su especialidad (coach)
├─ PRG-004: Editar cualquier programa (admin)
└─ PRG-005: Crear programa nuevo

RECURSOS
├─ RES-001: Ver recursos de su especialidad (coach)
├─ RES-002: Ver todos los recursos (admin)
├─ RES-003: Crear / subir recursos (coach o admin)
└─ RES-004: Editar recursos de su especialidad

MENSAJES & CHAT
├─ MSG-001: Enviar mensaje a cliente
├─ MSG-002: Enviar mensaje a equipo
├─ MSG-003: Ver historial de mensajes (propios + asignados)
└─ MSG-004: Ver chat de equipo

ANALYTICS
├─ ANA-001: Ver analytics propios (mis clientes, mis sesiones)
├─ ANA-002: Ver analytics de especialidad (mi especialidad)
├─ ANA-003: Ver analytics completas (admin)
└─ ANA-004: Descargar reportes

ORGANIZACIÓN
├─ ORG-001: Ver configuración de org (datos básicos)
├─ ORG-002: Editar configuración (admin)
├─ ORG-003: Invitar personas (admin)
├─ ORG-004: Remover personas (admin)
├─ ORG-005: Configurar capacidades (owner)
├─ ORG-006: Ver branding (todos)
├─ ORG-007: Editar branding (owner)
└─ ORG-008: Habilitar/deshabilitar especialidades (owner)

COBROS
├─ PAY-001: Ver propios pagos (coach)
├─ PAY-002: Solicitar pago (coach)
├─ PAY-003: Ver todos los pagos (admin)
├─ PAY-004: Procesar pagos (admin)
├─ PAY-005: Configurar modelo de cobros (owner)
└─ PAY-006: Ver facturación (owner)

AUDITORÍA
├─ AUD-001: Ver historial de cambios (admin)
├─ AUD-002: Exportar auditoría (owner)
└─ AUD-003: Ver acceso a datos sensibles (owner)

INTEGRACIONES
├─ INT-001: Conectar Google Calendar (coach)
├─ INT-002: Conectar Zoom (coach)
├─ INT-003: Conectar Stripe (owner)
├─ INT-004: Conectar Slack (admin)
└─ INT-005: Conectar IA Claude (admin)
```

---

## 7. AGENDAS (Agnósticas del Nicho)

**Funciona igual para sesiones de Career, Fitness, Executive, etc.**

### 7.1 Tipos de Eventos

```
SESIÓN CON CLIENTE
├─ 1:1 o grupo
├─ Coach + Cliente(s) confirmados
├─ Puede tener: notas pre-sesión, tareas, video link, registros
└─ Estados: programada | completada | cancelada | no-show

REUNIÓN INTERNA (Coaches entre sí)
├─ Supervisión 1:1
├─ Coordinación de casos
├─ Planificación
└─ Solo coaches + admin

DISPONIBILIDAD
├─ Coach dice "estoy disponible 14:00-16:00"
├─ Admin ve dónde encajar sesiones
└─ Se convierte en Sesión cuando se asigna cliente

BLOQUEO DE TIEMPO
├─ Vacaciones, enfermedad, conferencia
├─ Bloquea la agenda completamente
└─ Visible a admin para reasignaciones

EVENTOS EXTERNOS
├─ Importados de Google Calendar / Outlook
├─ Pathway ve "ocupado" en esos slots
└─ Sync bidireccional
```

### 7.2 Vistas de Agenda

```
COACH - VISTA PERSONAL
├─ Mis sesiones + mis bloqueos + disponibilidades
├─ Filtros: por semana, por cliente, por tipo
└─ Integraciones: Google Calendar sync

ADMIN - VISTA DE EQUIPO
├─ Todas las sesiones + todos los bloqueos + disponibilidades
├─ Estructura: Calendario matricial (coaches vs horarios)
├─ Acciones: Crear sesión, asignar cliente, detectar conflictos
└─ Alertas: Coaches sin sesiones, overbooking, vacíos

ADMIN - VISTA DE CLIENTE
├─ Todas las sesiones de un cliente (con diferentes coaches)
├─ Filtros: por coach, por programa, por mes
└─ Acciones: Cambiar hora, cambiar coach, añadir notas

CLIENTE - VISTA SU AGENDA
├─ Sus sesiones + próxima fecha
├─ Acciones: Confirmar asistencia, cancelar, añadir pregunta
└─ Integraciones: Recibir link video, recordatorio 24h antes
```

---

## 8. COBROS (Multimodelo, Agnóstico del Nicho)

**4 modelos completos soportados desde el inicio.**

### 8.1 Modelo A: "Empresa Cobra Todo"

```
Flujo: Cliente → Empresa → Coach (comisión)

Aplicable a: Agencias, corporativos, RRHH con presupuesto fijo
Impacto: Mismo para Career, Fitness, Executive — agnóstico
```

### 8.2 Modelo B: "Coach Cobra Directamente"

```
Flujo: Cliente → Coach (100%, menos fee Pathway)

Aplicable a: Coaches independientes, marketplace
Impacto: Mismo para cualquier especialidad
```

### 8.3 Modelo C: "Bolsas de Sesiones"

```
Flujo: Empresa compra 10/20/50 sesiones → distribuye entre clientes

Aplicable a: Corporativos, retención de talento
Impacto: Agnóstico — sesión es sesión
```

### 8.4 Modelo D: "Suscripción Metered"

```
Flujo: Coach paga $29-199/mes → cobra a clientes directamente (100%)

Aplicable a: Coaches solos, MVPs
Impacto: Independiente del nicho
```

---

## 9. COLABORACIÓN (7 Patrones Agnósticos)

**Sin roles rígidos. Capacidades configurables.**

### 9.1 Ejemplo: Coach Senior + Coach Junior

```
Coach Junior (Career)
└─ Capacidades: Ver propios clientes, crear sesiones propias, editar propias

Coach Senior (Career + Executive)
├─ Todo lo del Junior, PLUS:
├─ Ver analytics del equipo
├─ Coordinar con otros coaches
├─ Supervisar casos de Coach Junior
└─ Escalar si no resuelve

Reunión Interna: Supervisión 1:1 (Coach Senior + Junior)
└─ Chat privado en sesión de cliente para handover
```

### 9.2 Ejemplo: Recruiter + Coaches

```
Recruiter (capacidades: Crear clientes, Ver todos, Asignar)
└─ Crea Cliente Career → asignado automáticamente a Coach disponible

Coach (capacidades: Ver propios clientes, sesiones)
└─ Notificación: "Recruiter María te asignó nuevo cliente"

Auditoría
└─ "Recruiter X creó cliente para Coach Y"
```

---

## 10. AUDITORÍA

**Inmutable, 30+ event types, agnóstico del nicho.**

```
CATEGORÍAS
├─ PERSONAS (equipo): creada, invitada, capacidades asignadas, removida
├─ CLIENTES: creado, editado, asignado, reasignado, completado, eliminado
├─ SESIONES: creada, modificada, cancelada, completada, reasignada, no-show
├─ PROGRAMAS: creado, editado, asignado, completado, archivado
├─ COBROS: pago procesado, comisión calculada, modelo cambiado
├─ CONFIGURACIÓN: org editada, integración conectada, especialidades habilitadas
└─ SEGURIDAD: login, logout, acceso denegado, contraseña reseteada

ESTRUCTURA
├─ Tabla: audit_log
├─ Inmutable (no se puede borrar)
├─ Índices: (org_id, timestamp), (user_id, timestamp), (entidad, entidad_id)
├─ Retención: 7 años (GDPR compliant)
└─ Exportable: CSV, JSON
```

---

## 11. INTEGRACIONES FUTURAS

**Diseñadas desde el inicio, sin breaking changes.**

```
CALENDARIOS (Google, Outlook, iCal)
├─ Coach conecta → Pathway importa eventos
├─ Pathway ve bloques como "no disponible"
├─ Sesiones Pathway → Google (con link Zoom)
└─ Bidireccional

VIDEO (Zoom, Teams, Google Meet, Meet)
├─ Sesión creada → generar meeting link automático
├─ Cliente recibe link + recordatorio 24h
├─ Recording + transcrip → archivo en Pathway
└─ Agnóstico (no solo Zoom)

MENSAJERÍA (Slack, WhatsApp, Teams Chat)
├─ Coach recibe notificación en Slack: "Sesión con Cliente X en 1h"
├─ Coach puede confirmar desde Slack → marca en Pathway
├─ Admin recibe alertas: "Coach no confirmó sesión"
└─ Bidireccional

FACTURACIÓN (Stripe, PayPal)
├─ Stripe: cobro a cliente, payout a coach (según modelo)
├─ Webhook: notificar cuando pago se completa/falla
├─ Dashboard: mostrar estado de pago
└─ Refunds: procesar desde Pathway

IA (Claude, GPT)
├─ Analizar notas de sesión → generar resumen automático
├─ Analizar conversación → detectar riesgos
├─ Generar propuestas de programa basado en cliente
├─ Analizar audio de sesión (si se graba)
└─ Agnóstico: funciona para Career, Fitness, etc.

COMPLIANCE & SEGURIDAD
├─ GDPR: derecho a olvido, exportar datos
├─ Auditoría inmutable de acceso a datos sensibles
├─ Encryption at rest + in transit
└─ SOC2 ready
```

---

## 12. RESUMEN DE CAMBIOS RESPECTO A VERSIÓN ANTERIOR

### Correcciones Conceptuales

1. **Personas ≠ Clientes**
   - Antes: Todo era "persona" (confuso)
   - Ahora: EQUIPO (personas/staff) vs CLIENTES (reciben coaching)
   - Elimina ambigüedad operativa

2. **Especialidades Habilitadas por Org**
   - Antes: Especialidad directamente en persona/cliente
   - Ahora: Org elige qué nichos ofrece (1 o 20)
   - Coach Ana ⊆ Especialidades Habilitadas
   - Cliente asignado a 1 especialidad

3. **Estructura de Programas: Biblioteca**
   - Antes: Especialidad → Programas
   - Ahora: Especialidad → Biblioteca → Programas → Clientes
   - Una empresa puede tener Career con CV, LinkedIn, Entrevistas
   - Executive con Liderazgo, Comunicación

4. **Recursos como Entidad Propia**
   - Antes: Mencionados de pasada
   - Ahora: PDFs, vídeos, plantillas, ejercicios, IA, formularios
   - Compartibles entre programas de la misma especialidad
   - Searchable y taggable

5. **Brand Engine a Nivel de Organización**
   - Antes: Asumido, no documentado
   - Ahora: Logo, Paleta, Tipografía, Componentes, Espaciado
   - NO pertenece a especialidades
   - Toda la UI (portal, panel, dashboards) hereda automáticamente

---

## 13. DIAGRAMA FINAL (VISTA DE 1000 PIES)

```
ORGANIZACIÓN "AcmeCorp"
├─ Brand: Logo, Paleta, Tokens
├─ Especialidades Habilitadas: [Career, Executive, Fitness]
│  (no ofrece Nutrition, Wellness)
│
├─ EQUIPO
│  ├─ Owner (Micaela)
│  ├─ Coach Ana (Career, Executive)
│  ├─ Coach Carlos (Fitness)
│  ├─ Recruiter María (puede crear clientes en Career + Executive)
│  └─ Admin Juan
│
├─ CLIENTES
│  ├─ Cliente 1: Career (Ana) — Programa "CV Express"
│  ├─ Cliente 2: Executive (Ana) — Programa "Liderazgo Estratégico"
│  ├─ Cliente 3: Fitness (Carlos) — Programa "Hipertrofia 12w"
│  └─ Cliente 4: Career (Ana) — Programa "LinkedIn Pro"
│
├─ BIBLIOTECAS & PROGRAMAS
│  ├─ Career
│  │  ├─ Biblioteca "Búsqueda"
│  │  │  ├─ Programa "CV Express" (2w)
│  │  │  ├─ Programa "LinkedIn Pro" (3w)
│  │  │  └─ Programa "Entrevistas" (4w)
│  │  └─ Biblioteca "Desarrollo"
│  │     ├─ Programa "Marca Personal" (4w)
│  │     └─ Programa "Networking" (3w)
│  │
│  ├─ Executive
│  │  └─ Biblioteca "Liderazgo"
│  │     ├─ Programa "360 Feedback" (6w)
│  │     ├─ Programa "Comunicación" (4w)
│  │     └─ Programa "Estrategia" (8w)
│  │
│  └─ Fitness
│     ├─ Biblioteca "Fuerza"
│     │  ├─ Programa "PPL" (12w)
│     │  └─ Programa "Full Body" (8w)
│     └─ Biblioteca "Running"
│        ├─ Programa "5K" (8w)
│        └─ Programa "Maratón" (16w)
│
├─ RECURSOS (Compartidos por especialidad)
│  ├─ Career: PDFs, Videos, Templates, Exercises, Formularios, IA prompts
│  ├─ Executive: PDFs, Videos, Casos de Estudio, Ejercicios, IA
│  └─ Fitness: Videos, Plantillas Meal Prep, 500+ Ejercicios, IA Form Check
│
├─ AGENDAS
│  ├─ Coach Ana: 20 sesiones/mes (Career + Executive)
│  ├─ Coach Carlos: 15 sesiones/mes (Fitness)
│  └─ Sistema: Detecta conflictos, sugiere reasignaciones
│
├─ COBROS
│  └─ Modelo A: Empresa cobra todo, comisiona coaches (50-70%)
│
├─ AUDITORÍA
│  └─ 30+ eventos inmutables, exportable, GDPR compliant
│
└─ INTEGRACIONES
   ├─ Google Calendar (sync bidireccional)
   ├─ Zoom (genera links automático)
   ├─ Stripe (cobros, payouts)
   ├─ Slack (notificaciones)
   └─ Claude IA (análisis de sesiones)

RESULTADO
└─ Si mañana AcmeCorp quiere Wellness o Nutrition:
   1. Owner habilita especialidades
   2. Recruiter puede crear clientes
   3. Coach nuevo se suma con esas especialidades
   4. Sistema sin cambios — solo datos nuevos
```

---

## 13.5 REGLA ARQUITECTÓNICA CRÍTICA — "MultiCoach No Reemplaza, Orquesta"

**MultiCoach no duplica funcionalidades de paneles individuales. Agrega información organizacional.**

### Principio

```
Panel del Coach (panel-v2.html)
├─ Responsabilidad: Dashboard individual del coach
├─ Datos: Sus clientes, sesiones, progreso, ingresos, objetivos, métricas personales
├─ Scope: Work diario del coach
└─ Ejemplo: "Este coach tiene 8 clientes, 3 sesiones esta semana, retención 95%"

MultiCoach (multicoach.html)
├─ Responsabilidad: Dashboard organizacional (Owner/Admin)
├─ Datos: Agregados de la empresa
├─ Scope: Gestión de la organización
├─ Ejemplo: "12 coaches activos, 94 clientes, distribución desbalanceada, 1 alerta"

REGLA: Nunca duplicar KPIs
└─ Si un dato ya existe en panel-v2.html como métrica individual,
   aparece en MultiCoach SOLO como agregado (total, promedio, gráfico)
```

### Casos de Uso

**Caso 1: Retención de Clientes**

```
PANEL DEL COACH (panel-v2.html)
├─ "Mis clientes": 8
├─ "Clientes completados": 6
├─ "Mi retención": 75%
└─ [Gráfico de retención personal]

MULTICOACH (multicoach.html)
├─ "Retención global de org": 82%
├─ [Gráfico de retención por coach]
│  ├─ Coach Ana: 85%
│  ├─ Coach Carlos: 78%
│  └─ Coach María: 81%
├─ [Alerta]: "Coach Carlos con retención por debajo del promedio"
└─ "¿Abrir panel de Coach Carlos?" (reutiliza panel-v2.html con contexto de Carlos)

NO duplicar:
└─ El cálculo de retención por coach en MultiCoach
    (ya existe en panel individual de cada coach)
```

**Caso 2: Sesiones Completadas**

```
PANEL DEL COACH (panel-v2.html)
├─ "Mis sesiones esta semana": 5
├─ "Mis sesiones este mes": 18
└─ [Timeline personal de sesiones]

MULTICOACH (multicoach.html)
├─ "Sesiones de la org esta semana": 42
├─ [Gráfico de carga por coach]
│  ├─ Coach Ana: 6 sesiones
│  ├─ Coach Carlos: 4 sesiones
│  └─ Coach María: 5 sesiones
├─ [Alerta]: "Carga desbalanceada: Ana tiene 50% de sesiones"
└─ "Resumen Coach Ana: 6 sesiones esta semana" (data agregada)

NO reimplementar:
└─ El timeline personal (ya existe en panel individual)
```

**Caso 3: Clientes Asignados**

```
PANEL DEL COACH (panel-v2.html)
├─ "Mis clientes": 8
├─ [Lista completa con detalles]
│  ├─ Cliente 1: En programa, semana 2 de 4
│  ├─ Cliente 2: Completado hace 3 días
│  └─ etc.
├─ [Filtros: activos, completados, pausados]
└─ [Editar cliente, crear notas, etc.]

MULTICOACH (multicoach.html)
├─ "Clientes asignados a Coach Ana": 8
├─ [Estados simples]
│  ├─ Activos: 6
│  ├─ Completados: 1
│  └─ Pausados: 1
├─ [Último cliente asignado]: "Cliente X, hace 2 días"
└─ "Abrir panel de Ana" (para ver lista completa)

NO duplicar:
└─ La lista detallada (ya existe en panel individual)
```

### Cuándo Abrir el Panel Individual desde MultiCoach

```
DESDE MULTICOACH, OWNER PUEDE:

1. Ver Drawer Rápido (Equipo Module)
   ├─ Datos de la persona (nombre, email, foto)
   ├─ Rol y especialidades
   ├─ Clientes asignados (count)
   ├─ Sesiones esta semana (count)
   ├─ Retención (%)
   ├─ Disponibilidad (%)
   ├─ Última actividad
   └─ Botón: "Abrir panel completo de [Coach]"

2. Abrir Panel Completo (panel-v2.html)
   ├─ URL: /panel-v2.html?coach_id=[coach_id]
   ├─ Mismo interface que el coach ve (o view-only si Owner no es coach)
   ├─ Acceso a: clientes detallados, sesiones, progreso, ingresos, etc.
   └─ Owner puede editar (si tiene permisos) o solo ver

NUNCA crear un segundo dashboard de coach en MultiCoach
└─ Reutilizar panel-v2.html con contexto diferente
```

### Test Mental: "¿Dónde va esta funcionalidad?"

```
Pregunta: "Quiero ver el progreso de Cliente X"
├─ ¿Es trabajo diario del coach? SÍ
├─ Panel del Coach → Clientes → Cliente X → Progreso detallado
└─ MultiCoach → NO aparece (solo en agregado: "6 clientes en progreso")

Pregunta: "Quiero distribuir carga entre coaches"
├─ ¿Es trabajo diario del coach? NO (es gestión)
├─ Panel del Coach → NO aparece
└─ MultiCoach → Distribución de carga, alertas de desbalance

Pregunta: "Quiero ver sesiones esta semana"
├─ Coach individual → Panel del Coach → "Mis 5 sesiones" (detalladas)
├─ Owner mirando un coach → MultiCoach → "Sesiones: 5" (resumen)
├─ Owner mirando toda la org → MultiCoach → "42 sesiones" (agregado)
└─ NUNCA repetir el timeline personal

Pregunta: "Quiero editar nombre de cliente"
├─ ¿Es trabajo diario del coach? SÍ
├─ Panel del Coach → Clientes → Editar
└─ MultiCoach → NO aparece (solo información de lectura)
```

### Beneficios de Esta Regla

```
✓ Mantenibilidad
  └─ Un solo lugar donde vive cada funcionalidad

✓ Consistencia
  └─ Los datos no se duplican, no hay divergencia

✓ Performance
  └─ No calcular dos veces lo mismo

✓ UX Claro
  └─ Owner sabe dónde va cada acción (detail → panel individual, aggregate → MultiCoach)

✓ Velocidad de Desarrollo
  └─ No reimplementar lógica que ya existe

✓ Testing Simplificado
  └─ Cada sistema se prueba de forma independiente
```

---

---

## 14. SINGLE SOURCE OF TRUTH (SSOT)

**Cada funcionalidad tiene UN único propietario. Nunca se implementa en dos módulos distintos.**

### Mapa de Propietarios

```
PANEL DEL COACH (panel-v2.html)
├─ Propietario: Coach individual
├─ Responsabilidades:
│  ├─ Mis clientes (detalles completos)
│  ├─ Mis sesiones (timeline personal)
│  ├─ Mi progreso (de mis programas)
│  ├─ Mis ingresos (si aplica)
│  ├─ Mi disponibilidad
│  ├─ Mis métricas personales
│  └─ Mis mensajes privados
└─ Regla: Esta funcionalidad NUNCA aparece en MultiCoach

CLIENTE (portal cliente)
├─ Propietario: Cliente/participante
├─ Responsabilidades:
│  ├─ Mi programa (progreso, sesiones, recursos)
│  ├─ Mi agenda (mis sesiones confirmadas)
│  ├─ Mi perfil (mis datos)
│  ├─ Mis mensajes con coach
│  ├─ Mi comunidad (si habilitada)
│  └─ Mis recursos y tareas
└─ Regla: Esta funcionalidad NUNCA aparece en Panel Coach

MULTICOACH (multicoach.html)
├─ Propietario: Owner/Empresa
├─ Responsabilidades:
│  ├─ Visión organizacional (coaches, clientes, especialidades)
│  ├─ Gestión de equipo (invitar, capacidades, estados)
│  ├─ Distribución de carga (quién tiene cuántos clientes)
│  ├─ Retención global (agregada, no detalle individual)
│  ├─ Alertas organizacionales
│  ├─ Tendencias generales
│  ├─ Configuración de organización
│  └─ Visión de cobros (agregada)
└─ Regla: Esta funcionalidad NUNCA aparece en Panel Coach

MARKETPLACE (futuro)
├─ Propietario: Owner/Captación
├─ Responsabilidades:
│  ├─ Promoción de especialidades
│  ├─ Perfil público de la organización
│  ├─ Captación de clientes nuevos
│  └─ Landing de cada especialidad
└─ Regla: Conecta con Panel Coach/Cliente, no duplica

COMUNIDAD (futuro)
├─ Propietario: Clientes + Coaches
├─ Responsabilidades:
│  ├─ Contenido compartido
│  ├─ Networking entre clientes
│  ├─ Debates temáticos
│  └─ Recursos colaborativos
└─ Regla: Complementa Panel Coach/Cliente, no reemplaza

CONFIGURACIÓN (organizacional)
├─ Propietario: Owner
├─ Responsabilidades:
│  ├─ Branding (logo, paleta, tokens)
│  ├─ Especialidades habilitadas
│  ├─ Modelos de cobros
│  ├─ Integraciones (Google, Zoom, Stripe)
│  ├─ Capacidades y permisos
│  ├─ Ciclo de vida de la organización
│  └─ Datos legales y compliance
└─ Regla: Centralizado, una sola fuente de verdad
```

### Test SSOT: "¿Dónde vive esta funcionalidad?"

```
"Quiero ver mis clientes" (Coach)
└─ ÚNICA ubicación: Panel Coach
   (MultiCoach: solo counts, no lista)

"Quiero cambiar mi password" (Coach)
└─ ÚNICA ubicación: Panel Coach (Settings)
   (Cliente: su propio Settings)
   (MultiCoach: NO aparece)

"Quiero ver la distribución de carga" (Owner)
└─ ÚNICA ubicación: MultiCoach
   (Panel Coach: NO aparece, ver solo mis clientes)

"Quiero editar el branding" (Owner)
└─ ÚNICA ubicación: Configuración
   (Panel Coach: hereda, no edita)
   (MultiCoach: acceso, no almacena)

"Quiero definir las especialidades" (Owner)
└─ ÚNICA ubicación: Configuración
   (Panel Coach: solo ve las que le asignaron)
   (MultiCoach: solo consume)
```

**Protección**: Si en 3 meses alguien dice "vamos a agregar esto a MultiCoach también", la respuesta es "NO, vive en [módulo único], reutiliza datos de ahí".

---

## 15. ORGANIZACIÓN = CONTENEDOR

**Nada existe "en el sistema". Todo pertenece a una organización.**

### Estructura de Contenencia

```
ORGANIZACIÓN (Contenedor de todo)
│
├─── BRANDING
│    ├─ Logo, paleta, tipografía
│    ├─ Componentes, espaciado, sombras
│    ├─ Temas (light/dark)
│    └─ Tokens CSS generados automáticamente
│
├─── ESPECIALIDADES HABILITADAS
│    ├─ [Career, Executive, Fitness] (elige la org)
│    ├─ Cada especialidad mapea a Bibliotecas
│    └─ Coach puede tener subset, Cliente tiene 1
│
├─── PERSONAS DEL EQUIPO
│    ├─ Owner (1 por org)
│    ├─ Coaches (N, cada uno con especialidades)
│    ├─ Colaboradores (Admin, Recruiter, HR, etc.)
│    └─ Cada persona hereda permisos base del rol + capacidades configuradas
│
├─── CLIENTES
│    ├─ Cliente 1 (especialidad Career, coach Ana)
│    ├─ Cliente 2 (especialidad Fitness, coach Carlos)
│    └─ Cada cliente = persona que recibe coaching
│
├─── BIBLIOTECA + PROGRAMAS + RECURSOS
│    ├─ Especialidad Career
│    │  ├─ Biblioteca "Búsqueda"
│    │  │  ├─ Programa "CV Express"
│    │  │  ├─ Programa "LinkedIn Pro"
│    │  │  └─ (Recursos compartidos: CVTemplate.pdf, MockInterview.mp4)
│    │  └─ Biblioteca "Desarrollo"
│    │     └─ (Programas propios)
│    └─ (Otras especialidades)
│
├─── CONFIGURACIÓN
│    ├─ Datos legales (nombre, RFC, dirección)
│    ├─ Modelos de cobros (Modelo A, B, C o D)
│    ├─ Integraciones (Google, Zoom, Stripe, Slack)
│    ├─ Capacidades disponibles en la org
│    ├─ Alertas y notificaciones
│    └─ Ciclo de vida (activa, suspendida, cancelada)
│
└─── COBROS
     ├─ Modelo elegido (centralizado)
     ├─ Transacciones (facturas, pagos, comisiones)
     ├─ Reportes (ingresos, gastos, movimientos)
     └─ Integraciones de pago (Stripe, PayPal)
```

### Implicaciones Técnicas

```sql
-- TODO en la BD está namespaceado por org_id
personas
├─ org_id (FK, PK compuesta)
├─ id
└─ ...

clientes
├─ org_id (FK, PK compuesta)
├─ id
└─ ...

bibliotecas
├─ org_id (FK, PK compuesta)
├─ id
└─ ...

recursos
├─ org_id (FK, PK compuesta)
├─ id
└─ ...

-- RLS: SELECT * FROM personas WHERE org_id = auth.org_id()
-- (usuario solo ve datos de SU organización)

-- Multi-tenancy a nivel de BD
-- Nunca queries globales sin org_id
```

### Consecuencia: Aislamiento de Datos

```
Organización A ("AcmeCorp")
├─ 12 coaches, 94 clientes
├─ Especialidades: [Career, Executive, Fitness]
├─ Modelo de cobros: A
└─ Branding: Logo Acme, colores corporativos

Organización B ("FitnessPro")
├─ 3 coaches, 28 clientes
├─ Especialidades: [Fitness, Nutrition, Wellness]
├─ Modelo de cobros: D
└─ Branding: Logo Fitness, colores vibrantes

(Datos NUNCA se cruzan)
├─ Coach de AcmeCorp NO ve clientes de FitnessPro
├─ Reportes de AcmeCorp NO incluyen datos de FitnessPro
├─ Integraciones de AcmeCorp NO afectan a FitnessPro
└─ Branding de AcmeCorp NO se aplica a FitnessPro
```

---

## 16. MÓDULOS INDEPENDIENTES (Por Roles/Funcionalidades)

**Cada módulo es independiente. Puede evolucionar sin romper otros.**

### Módulos Principales

```
DASHBOARD (multicoach.html)
├─ Responsabilidad: Visión organizacional
├─ Datos: Agregados (nº coaches, clientes, especialidades)
├─ Acceso: Owner, Admin
├─ Evolución: Puede agregar nuevos KPIs sin afectar otros módulos
└─ Independencia: No toca datos de Panel Coach

EQUIPO (dentro de MultiCoach)
├─ Responsabilidad: Gestión de personas del equipo
├─ Datos: Roles, especialidades, capacidades, disponibilidad
├─ Acceso: Owner, Admin
├─ Evolución: Puede cambiar matriz de capacidades sin afectar Agenda
└─ Independencia: No toca sesiones, solo gestión de personas

CLIENTES (dentro de MultiCoach)
├─ Responsabilidad: Visión de clientes (admin)
├─ Datos: Lista, especialidades, coaches asignados, estado
├─ Acceso: Owner, Admin, Coach (solo propios)
├─ Evolución: Puede agregar filtros sin afectar Panel Coach
└─ Independencia: No toca datos detallados del cliente (viven en Panel Coach)

AGENDA
├─ Responsabilidad: Coordinación de sesiones
├─ Datos: Sesiones, bloques de tiempo, disponibilidad, conflictos
├─ Acceso: Coach (propia), Admin (equipo)
├─ Evolución: Puede agregar sincronización Google sin afectar otros módulos
└─ Independencia: Agnóstica del nicho (Career, Fitness, etc.)

PROGRAMAS
├─ Responsabilidad: Definición de programas por especialidad
├─ Datos: Bibliotecas, programas, contenido, módulos
├─ Acceso: Coach (crear/editar propios), Owner (crear/editar todos)
├─ Evolución: Puede cambiar estructura sin afectar Panel Coach
└─ Independencia: Vive en Configuración, consumido por Agenda y Cliente

RECURSOS
├─ Responsabilidad: Activos (PDFs, videos, plantillas, ejercicios)
├─ Datos: Archivos, tags, especialidades, permisos
├─ Acceso: Compartible por especialidad
├─ Evolución: Puede agregar nuevo tipo de recurso sin romper programas
└─ Independencia: Referenciales, no afectan flujo principal

PANEL COACH (panel-v2.html)
├─ Responsabilidad: Dashboard individual del coach
├─ Datos: Mis clientes, sesiones, progreso, ingresos, métricas
├─ Acceso: Coach (propio), Admin (si permitido)
├─ Evolución: Puede agregar nuevas métricas sin afectar MultiCoach
└─ Independencia: Totalmente separado de gestión organizacional

CLIENTE (portal cliente)
├─ Responsabilidad: Experiencia del cliente
├─ Datos: Mi programa, progreso, sesiones, recursos, coach
├─ Acceso: Cliente (propio)
├─ Evolución: Puede agregar comunidad sin afectar Panel Coach
└─ Independencia: Agnóstico de cómo se gestiona en MultiCoach

CONFIGURACIÓN
├─ Responsabilidad: Datos y políticas de org
├─ Datos: Branding, especialidades, capacidades, integraciones, cobros
├─ Acceso: Owner
├─ Evolución: Central, cambios se propagan automáticamente
└─ Independencia: Alimenta a otros módulos, no consume de ellos

MARKETPLACE (futuro)
├─ Responsabilidad: Captación pública
├─ Datos: Landing, perfiles, testimonios
├─ Acceso: Público (no autenticado)
├─ Evolución: Puede evolucionar sin afectar módulos internos
└─ Independencia: Consume datos de Configuración (branding)

COMUNIDAD (futuro)
├─ Responsabilidad: Networking y contenido compartido
├─ Datos: Posts, comentarios, miembros, temáticas
├─ Acceso: Clientes + Coaches
├─ Evolución: Puede crecer sin cambiar Panel Coach o Cliente
└─ Independencia: Complementa, no reemplaza otros módulos
```

### Beneficios

```
✓ Escalabilidad
  └─ Agregar nuevos módulos sin tocar los existentes

✓ Testing
  └─ Cada módulo se prueba de forma aislada

✓ Deployment
  └─ Actualizar Agenda sin afectar Panel Coach

✓ Ownership
  └─ Equipo A dueño de Agenda, Equipo B dueño de Cobros

✓ Evolución
  └─ Cambiar Panel Coach sin tocar MultiCoach

✓ Reusabilidad
  └─ Lógica de Programas reutilizable en Panel Coach y Cliente
```

---

## 17. PERMISOS POR CAPACIDAD, NUNCA POR PANTALLA

**La autorización es granular: `capacidad.acción`, no "puede acceder a Agenda".**

### Modelo Incorrecto (Anti-patrón)

```
Coach
  ↓
  Puede abrir: Panel Coach
              Agenda
              Mensajes
  NO puede: Configuración
            MultiCoach
            Billing

❌ PROBLEMA:
   - Difícil ser específico ("¿puede EDITAR agenda o solo VER?")
   - Acoplado a pantallas (si renombras URL, rompes permisos)
   - No reutilizable (lógica de permisos mezclada con UI)
```

### Modelo Correcto (Capacidades Granulares)

```
CAPACIDADES (Atómicas, reutilizables)

agenda.view       (puede ver su agenda)
agenda.edit       (puede editar sus sesiones)
agenda.create     (puede crear sesiones)
agenda.reasign    (puede reasignar a otro coach)

clientes.view     (puede ver asignados)
clientes.create   (puede crear nuevo cliente)
clientes.edit     (puede editar propio)
clientes.assign   (puede asignar a coach)

programas.view    (puede ver disponibles)
programas.create  (puede crear nuevo)
programas.edit    (puede editar propio)

analytics.view    (puede ver propios datos)
analytics.admin   (puede ver datos de equipo)

billing.view      (puede ver propios pagos)
billing.admin     (puede procesar pagos)

configuracion.view   (puede ver settings org)
configuracion.edit   (puede editar settings)

mensajes.send     (puede enviar mensajes)
mensajes.chat     (puede participar en chat)
```

### Mapeo Rol → Capacidades

```
OWNER
└─ 200 capacidades (todas)
   ├─ agenda.*
   ├─ clientes.*
   ├─ programas.*
   ├─ analytics.*
   ├─ billing.*
   ├─ configuracion.*
   ├─ integraciones.*
   ├─ auditoria.*
   └─ equipo.*

COACH
└─ 48 capacidades
   ├─ agenda.view
   ├─ agenda.edit (propio)
   ├─ agenda.create
   ├─ clientes.view (asignados)
   ├─ clientes.edit (propios)
   ├─ programas.view
   ├─ programas.create
   ├─ programas.edit (propio)
   ├─ analytics.view (propios)
   ├─ billing.view (propios)
   ├─ mensajes.send
   ├─ mensajes.chat
   ├─ recuros.view
   └─ (más...)

COLABORADOR (Admin)
└─ 80 capacidades
   ├─ agenda.view (todos)
   ├─ agenda.reasign
   ├─ clientes.view (todos)
   ├─ clientes.create
   ├─ clientes.assign
   ├─ analytics.admin
   ├─ billing.admin
   ├─ equipo.view
   ├─ equipo.invite
   ├─ programas.view (todos)
   ├─ recursos.create
   ├─ integraciones.view
   └─ (más...)

COLABORADOR (Recruiter)
└─ 15 capacidades
   ├─ clientes.create
   ├─ clientes.view (todos)
   ├─ clientes.assign
   ├─ agenda.view (equipo, solo carga)
   ├─ analytics.view (global simple)
   ├─ mensajes.send
   └─ (solo lo necesario)
```

### Implementación (Backend)

```typescript
// Middleware: Verificar capacidad antes de acción
async function checkCapacity(req, res, next) {
  const { usuario } = req.auth;
  const { capacidad_requerida } = req.route.meta;
  
  const tiene_capacidad = await db.personas_capacidades
    .findOne({
      persona_id: usuario.id,
      capacidad: capacidad_requerida,
      activa: true
    });
  
  if (!tiene_capacidad) {
    return res.status(403).json({ error: "Capacidad requerida: " + capacidad_requerida });
  }
  next();
}

// Uso en rutas
app.get('/api/agenda', checkCapacity({ capacidad: 'agenda.view' }), (req, res) => {
  // Lógica
});

app.patch('/api/agenda/:id', checkCapacity({ capacidad: 'agenda.edit' }), (req, res) => {
  // Lógica
});
```

### Beneficios

```
✓ Granularidad
  └─ Capacidad específica para cada acción (no "acceso a pantalla")

✓ Reutilización
  └─ Misma capacidad `agenda.view` se usa en Panel Coach, MultiCoach, API

✓ Auditabilidad
  └─ Log: "Coach Ana intentó `clientes.assign` sin capacidad"

✓ Flexibilidad
  └─ Cambiar permisos sin código (solo BD)

✓ Escalabilidad
  └─ Agregar nuevas capacidades sin rediseñar el sistema

✓ Independencia de UI
  └─ Si cambias URLs o nombres de pantallas, permisos no se rompen
```

---

## 🎯 FIN DE ARQUITECTURA

**Hasta aquí llega el diseño. A partir de aquí, implementación.**

### Cierre: Lo que está CONGELADO

✅ Separación Equipo vs Clientes  
✅ Especialidades Habilitadas por Organización  
✅ Biblioteca → Programas → Recursos  
✅ Brand Engine a nivel de Organización  
✅ MultiCoach no reemplaza, orquesta  
✅ Single Source of Truth (SSOT)  
✅ Organización = Contenedor  
✅ Módulos Independientes  
✅ Permisos por Capacidad  

**Esta arquitectura es la base. No se cambia sin consenso explícito.**

### Orden de Implementación (Sprints 5.1 → 5.4)

```
✅ Sprint 5.1 (Sem 1-2): Capacidades y Permisos
   ├─ Tabla: personas_capacidades
   ├─ Matriz de asignación: Owner, Coach, Colaborador
   ├─ Middleware de autenticación
   └─ Tests: "Coach sin capacidad X no puede acceder a Y"

✅ Sprint 5.2 (Sem 3-4): Agenda Compartida
   ├─ Tabla: sesiones, availability_blocks
   ├─ Vistas: Coach personal, Admin equipo
   ├─ Conflictos y sugerencias automáticas
   └─ Integraciones base: Google Calendar

✅ Sprint 5.3 (Sem 5-6): Modelo de Cobros
   ├─ Tablas: pagos, comisiones (según modelo elegido)
   ├─ Cálculo automático de ingresos/comisiones
   ├─ Reportes: Facturación, movimientos
   └─ Integraciones: Stripe

✅ Sprint 5.4 (Sem 7-8): Colaboración y Flujos
   ├─ 7 Patrones de Colaboración
   ├─ Reasignaciones automáticas
   ├─ Chat y notificaciones
   └─ Auditoría inmutable
```

### Qué NO Hacer Ahora

❌ Refinar más la arquitectura  
❌ Agregar "posibles integraciones futuras" que no se implementan en Sprint 5  
❌ Diseñar UI detallada (eso es Sprint X.5+)  
❌ Optimizaciones prematuras de BD  
❌ "¿Y si en el futuro...?" (si aplica, es Sprint 6+)  

### Próximo Paso

**Sprint 5.1: Validación rápida con Micaela (1 hora).**
- ¿Esto cubre tus casos reales?
- ¿Falta algo crítico?

**Si Sí → Empezar 5.1 (Capacidades + Permisos)**  
**Si No → Ajustar puntos específicos, no rediseñar**

---

**Arquitectura cerrada. Implementación comienza en Sprint 5.1.**
