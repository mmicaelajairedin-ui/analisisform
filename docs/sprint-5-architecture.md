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

## 14. PLAN DE VALIDACIÓN

```
ANTES DE IMPLEMENTAR (Sprint 5.1):

□ Walkthrough con Micaela
  - ¿El modelo soporta tus clientes reales?
  - ¿Hay escenarios faltantes?
  - ¿La separación Equipo/Clientes tiene sentido?

□ Validar Modelos de Cobros
  - ¿Modelo A es lo que usa AcmeCorp hoy?
  - ¿Qué pasa si quiere cambiar a B o C?

□ Validar Specialidades Habilitadas
  - ¿Funciona así para múltiples nichos?
  - ¿Es sencillo habilitar/deshabilitar?

□ Validar Biblioteca
  - ¿Cubre los casos: CV + LinkedIn vs Running + Hipertrofia?
  - ¿El nombre "Biblioteca" tiene sentido?

□ Validar Brand Engine
  - ¿Es sencillo customizar por org?
  - ¿No rompe mobile?

Outcome esperado:
└─ Arquitectura validada, pronta para Sprint 5.1 (BD + APIs)
```

---

**Documento completo. Agnóstico del nicho, estructura clara, listo para implementación.**
