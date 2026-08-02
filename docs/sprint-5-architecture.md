# Sprint 5.0 — Arquitectura Organizacional de Pathway

**Estado**: Diseño de arquitectura funcional (sin código)  
**Objetivo**: Definir el modelo base para permisos, agendas, cobros y colaboración  
**Válido para**: Sprint 5.1 a 5.4 y future-proof para 10+ años

---

## 1. MODELO DE PERSONAS

**NO son roles, son TIPOS DE USUARIO CON CAPACIDADES ASIGNABLES.**

### 1.1 Tipos de Persona

```
┌─────────────────────────────────────────────────────────────────┐
│ Personas en Pathway (sin asumir permisos aún)                   │
├─────────────────────────────────────────────────────────────────┤
│ 1. OWNER                                                         │
│    - Dueño de la organización (empresa, agencia, coach solo)     │
│    - Puede ser una persona o entidad legal                       │
│    - 1 por organización                                          │
│    - Facturación va a nombre del OWNER                           │
│                                                                  │
│ 2. COACH                                                         │
│    - Quien brinda sesiones de coaching                           │
│    - Puede ser empleado, contratista o independiente             │
│    - Tiene clientes asignados                                    │
│    - Visibilidad según modelo de cobros y capacidades            │
│                                                                  │
│ 3. COLABORADOR                                                   │
│    - Apoya el trabajo de coaches (admin, recruiter, RRHH, etc.) │
│    - No brinda sesiones directas                                 │
│    - Capacidades específicas según rol funcional                 │
│    - Puede tener acceso a clientes, programas, agendas, etc.     │
│                                                                  │
│ NOTA: Un mismo email puede tener múltiples personas en           │
│ múltiples organizaciones, pero solo 1 tipo por organización.     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Atributos Mínimos de Persona

```
id                    (UUID)
org_id                (FK a organizaciones)
tipo                  (owner | coach | colaborador)
email                 (único por org)
nombre                (nombre completo)
foto                  (URL)
estado                (activo | invitado | vacaciones | suspendido | inactivo)
datos_contacto
  - teléfono
  - timezone
  - idioma
  - ubicación (país)
  - empresa (si es coach externo)
fecha_incorporación   (cuándo entró a la org)
última_actividad      (timestamp)
metadata
  - capacidades_activas   (lista de capability IDs)
  - permisos_heredados    (de grupo)
  - estado_cobro          (activo, suspendido, deuda)
  - especialidades        (carrera, fitness, finanzas, etc.)
```

---

## 2. MODELO DE CAPACIDADES

**Sistema flexible: cada persona tiene un set de capacidades que se puede activar/desactivar sin cambiar "rol".**

### 2.1 Matriz Completa de Capacidades

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CAPACIDADES PATHWAY (Base de Datos Extensible)                           │
├──────────────────────────────────────────────────────────────────────────┤
│ ID      | Capacidad                        | Nivel | Descripción        │
├─────────┼────────────────────────────────────┼───────┼────────────────────┤
│ CLI-001 | Crear clientes                    | Base  | Agregar candidatos │
│ CLI-002 | Editar clientes propios           | Base  | Datos básicos       │
│ CLI-003 | Editar clientes de otros          | Admin | Ver/cambiar todos   │
│ CLI-004 | Eliminar clientes                 | Admin | Borrar registro     │
│ CLI-005 | Ver clientes propios              | Base  | Solo los asignados  │
│ CLI-006 | Ver todos los clientes            | Admin | Visibilidad total   │
│ CLI-007 | Filtrar por estado                | Base  | Vivos, completados  │
│ CLI-008 | Exportar lista de clientes        | Admin | CSV/Excel           │
│         |                                    |       |                    │
│ ASG-001 | Asignar clientes a coaches        | Admin | Redistribución      │
│ ASG-002 | Asignar clientes a sí mismo       | Base  | Auto-asignación     │
│ ASG-003 | Reasignar por urgencia            | Coach | Cambios rápidos     │
│ ASG-004 | Ver quién está asignado a quién   | Coach | Visibilidad equipo  │
│         |                                    |       |                    │
│ PRG-001 | Crear programas                   | Base  | Plantillas de plan  │
│ PRG-002 | Editar programas propios          | Base  | Solo los creados    │
│ PRG-003 | Editar programas de otros         | Admin | Todos               │
│ PRG-004 | Ver programas disponibles         | Base  | Catálogo            │
│ PRG-005 | Asignar programas a clientes      | Coach | Sesiones 4 semanas  │
│ PRG-006 | Ver progreso de cliente           | Coach | Dentro del programa │
│         |                                    |       |                    │
│ AGD-001 | Ver propia agenda                 | Base  | Mis sesiones        │
│ AGD-002 | Ver agenda del equipo             | Admin | Todas las sesiones  │
│ AGD-003 | Crear sesión (propia)             | Base  | Con mis clientes    │
│ AGD-004 | Crear sesión (para otros)         | Admin | Cross-coach         │
│ AGD-005 | Editar sesión propia              | Base  | Cambiar hora/datos   │
│ AGD-006 | Editar sesión de otros            | Admin | Override            │
│ AGD-007 | Cancelar sesión                   | Base  | Con notificación     │
│ AGD-008 | Ver disponibilidad de coaches     | Admin | Para asignación      │
│ AGD-009 | Bloquear tiempo (vacaciones, etc) | Base  | No disponible        │
│ AGD-010 | Coordinar con otros coaches       | Coach | Comunicación        │
│         |                                    |       |                    │
│ MSG-001 | Enviar mensaje a cliente          | Base  | Chat 1:1            │
│ MSG-002 | Enviar mensaje a coach            | Base  | Colaboración        │
│ MSG-003 | Enviar mensaje a equipo           | Admin | Broadcast           │
│ MSG-004 | Ver historial de mensajes         | Base  | Propios + asignados  │
│ MSG-005 | Ver mensajes de otros coaches     | Admin | Auditoría           │
│         |                                    |       |                    │
│ ANA-001 | Ver analytics propios             | Base  | Mis KPIs            │
│ ANA-002 | Ver analytics del equipo          | Admin | Agregado            │
│ ANA-003 | Ver metrics de clientes           | Coach | Progreso, retención │
│ ANA-004 | Ver datos de cobros               | Admin | Ingresos, comisiones │
│ ANA-005 | Descargar reportes                | Admin | PDF/CSV             │
│         |                                    |       |                    │
│ ORG-001 | Ver configuración de org          | Base  | Datos básicos        │
│ ORG-002 | Editar configuración de org       | Admin | Nombre, logo, etc.   │
│ ORG-003 | Invitar personas a org            | Admin | Onboarding          │
│ ORG-004 | Remover personas de org           | Admin | Offboarding         │
│ ORG-005 | Configurar capacidades            | Owner | Matriz de permisos   │
│ ORG-006 | Ver integraciones                 | Admin | Status Stripe, etc.  │
│ ORG-007 | Configurar integraciones          | Owner | API keys, webhooks   │
│         |                                    |       |                    │
│ PAY-001 | Ver propios pagos                 | Coach | Comisiones, saldo    │
│ PAY-002 | Solicitar pago                    | Coach | Transferencia        │
│ PAY-003 | Ver todos los pagos               | Admin | Historial, estado    │
│ PAY-004 | Procesar pagos                    | Admin | Aprobar/rechazar     │
│ PAY-005 | Configurar modelo de cobros       | Owner | A/B/C/D              │
│ PAY-006 | Ver facturación                   | Owner | Ingresos, impuestos   │
│         |                                    |       |                    │
│ AUD-001 | Ver historial de cambios          | Admin | Quién hizo qué       │
│ AUD-002 | Exportar auditoría                | Owner | Compliance           │
│         |                                    |       |                    │
│ INT-001 | Conectar Google Calendar          | Coach | Sincronizar sesiones │
│ INT-002 | Conectar Outlook                  | Coach | Alternativa          │
│ INT-003 | Integrar Zoom                     | Base  | Video conferencias   │
│ INT-004 | Integrar Teams                    | Base  | Alternativa          │
│ INT-005 | Integrar Slack                    | Admin | Notificaciones       │
│ INT-006 | Integrar WhatsApp                 | Admin | Mensajes             │
│ INT-007 | Conectar IA (Claude)              | Admin | Análisis automático  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Presets de Capacidades (Ejemplos, No Roles Fijos)

Estos NO son "roles" sino recomendaciones. Se pueden customizar.

```
PRESET "Coach Senior" (ejemplo):
  - Todas las de Coach
  + ANA-002 Ver analytics del equipo
  + ASG-003 Reasignar por urgencia
  + MSG-002 Enviar mensaje a coach
  + AGD-010 Coordinar con otros coaches

PRESET "Recruiter":
  - CLI-001 Crear clientes
  - ASG-002 Asignar clientes a sí mismo
  + CLI-006 Ver todos los clientes
  + MSG-001 Enviar mensaje a cliente
  + AGD-002 Ver agenda del equipo
  + ANA-003 Ver metrics de clientes

PRESET "RRHH/Administrativo":
  - ORG-002 Editar configuración de org
  + ORG-003 Invitar personas
  + PRG-005 Asignar programas
  + ANA-001 Ver analytics propios
  + MSG-001 Enviar mensaje a cliente

PRESET "Owner/Admin Completo":
  - Todas las capacidades habilitadas
  - Acceso a configuración de cobros
  - Acceso a auditoría
```

### 2.3 Matriz de Capacidades por Tipo (Base)

```
                        | OWNER | COACH | COLABORADOR
────────────────────────┼───────┼───────┼─────────────
CLI-001 Crear clientes  |  ✓    |  ✓    |  Configurable
CLI-006 Ver todos       |  ✓    |  ✗    |  Configurable
ASG-001 Asignar         |  ✓    |  ✗    |  Configurable
PRG-003 Editar programas|  ✓    |  ✗    |  Configurable
AGD-002 Ver equipo      |  ✓    |  ✗    |  Configurable
ANA-002 Analytics equipo|  ✓    |  ✗    |  Configurable
ORG-005 Config. capacid.|  ✓    |  ✗    |  ✗
PAY-005 Config. cobros  |  ✓    |  ✗    |  ✗
AUD-001 Ver auditoría   |  ✓    |  ✗    |  Configurable

IMPORTANTE: Estos son DEFAULTS. La organización puede cambiar.
```

---

## 3. MODELO DE AGENDAS

**Escenarios complejos que NO se pueden ignorar.**

### 3.1 Tipos de Eventos en Agenda

```
┌─────────────────────────────────────────────────────────────────┐
│ EVENTOS QUE EXISTEN EN LA AGENDA                                │
├─────────────────────────────────────────────────────────────────┤
│ 1. SESIÓN CON CLIENTE                                           │
│    - Coaching (1:1)                                              │
│    - Grupo (múltiples clientes)                                  │
│    - Duración: típicamente 1h                                    │
│    - Coach + Cliente(s) confirmados                              │
│    - Puede tener:                                                │
│      * Notas pre-sesión                                          │
│      * Tareas asignadas                                          │
│      * Video conferencia (Zoom/Teams)                            │
│      * Registros post-sesión                                     │
│                                                                  │
│ 2. REUNIÓN INTERNA (Coaches entre sí)                          │
│    - Supervisión/1:1 con coach senior                           │
│    - Coordinación de casos cruzados                              │
│    - Planificación de programa                                   │
│    - Duración variable (30 min - 2h)                             │
│    - Solo coaches + admin                                        │
│                                                                  │
│ 3. DISPONIBILIDAD (Bloque sin cliente asignado aún)            │
│    - Coach dice "estoy disponible 14:00-16:00"                  │
│    - Sirve para que admin vea dónde encajar sesiones            │
│    - Se convierte en Sesión cuando se asigna cliente            │
│                                                                  │
│ 4. BLOQUEO DE TIEMPO (Vacaciones, enfermedad, etc.)            │
│    - "No disponible 24-31 agosto"                                │
│    - Bloquea la agenda completamente para ese rango              │
│    - Visible a admin para reasignaciones                         │
│                                                                  │
│ 5. REUNIÓN CON TERCEROS (Zoom con cliente, Teams con directivo)│
│    - Evento externo que impacta disponibilidad                   │
│    - Coach importa de Google Calendar / Outlook                  │
│    - Pathway ve "ocupado" en esos slots                          │
│                                                                  │
│ 6. TAREAS (NO son eventos de calendario, son to-do)            │
│    - "Preparar informe para María"                               │
│    - "Hacer seguimiento a Juan"                                  │
│    - Se ve en sidebar pero no ocupa tiempo del calendario        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Vistas de Agenda Necesarias

```
A. COACH - VISTA PERSONAL
   Muestra: Mis sesiones + mis bloqueos + disponibilidades
   Filtros: Por semana, por cliente, por tipo
   Acciones: Crear sesión, bloquear tiempo, marcar como completada
   Integraciones: Google Calendar (sync bidireccional)

B. ADMIN - VISTA DE EQUIPO
   Muestra: Todas las sesiones + todos los bloqueos + disponibilidades
   Estructura: Calendario matricial (coaches vs horarios)
   Acciones: Crear sesión para coach X, asignar cliente, detectar conflictos
   Alertas: Coaches sin sesiones esa semana, overbooking, vacíos

C. ADMIN - VISTA DE CLIENTE
   Muestra: Todas las sesiones de un cliente (con diferentes coaches)
   Filtros: Por coach, por programa, por mes
   Acciones: Cambiar hora, cambiar coach, añadir notas

D. CLIENTE - VISTA SU AGENDA
   Muestra: Mis 4 sesiones + próxima fecha
   Acciones: Confirmar asistencia, cancelar, añadir pregunta
   Integraciones: Recibir link Zoom, recordatorio 24h antes

E. ANALÍTICA - OCUPACIÓN
   Muestra: % de ocupación por coach, sesiones completadas, tasa de no-show
   Alertas: Coaches con pocas sesiones, clientes sin asignar
```

### 3.3 Escenarios Complejos de Coordinación

```
ESCENARIO 1: Coach A está de vacaciones
├─ Admin ve el bloqueo en agenda
├─ Admin debe reasignar sus 12 clientes a otros coaches
├─ Sistema sugiere distribución balanceada
├─ Cada reasignación genera notificación + entrada en auditoría
└─ Coach B puede rechazar si está sobrecargado

ESCENARIO 2: Dos coaches comparten cliente
├─ Cliente tiene sesiones con Coach A (lunes) y Coach B (jueves)
├─ Coach B ve progreso de Coach A (con permiso)
├─ En reunión interna pueden coordinarse
├─ Auditoría registra quién vio qué
└─ Cliente ve ambos coaches en su historial

ESCENARIO 3: Reasignación por urgencia
├─ Coach A debe cancelar última hora
├─ Sistema busca coaches disponibles en ese slot
├─ Admin elige Coach B
├─ Cliente recibe notificación de cambio
├─ Se genera entrada en auditoría
└─ Conversación en chat entre coaches para handover

ESCENARIO 4: Cliente pide cambio de coach
├─ Cliente puede solicitar vía plataforma o email
├─ Admin aprueba/rechaza
├─ Si aprueba, busca disponibilidad con otro coach
├─ Se reasignan todas las sesiones pendientes
├─ Auditoría registra motivo del cambio
└─ Chat privado entre coaches antiguo y nuevo

ESCENARIO 5: Conflicto de doble booking
├─ Admin intenta agregar sesión que choca con bloqueo
├─ Sistema alerta "Coach X no disponible 14:00-15:00"
├─ Admin puede:
│  a) Elegir otro coach
│  b) Cambiar hora
│  c) Forzar (y generar flag de conflicto)
└─ Si fuerza, auditoría lo registra

ESCENARIO 6: Coordinación async (Chat + Agenda)
├─ Coach A comenta en sesión de cliente: "Cliente necesita nutrición"
├─ Notificación a Coach B (especialista en nutrición)
├─ Coach B abre lista de clientes compartidos
├─ Coach B propone sesión adicional
├─ Admin aprueba y lo agrega a calendario
└─ Cliente ve nueva sesión y la confirma

ESCENARIO 7: Integración Google Calendar
├─ Coach conecta su Google Calendar
├─ Pathway importa su calendario personal (reuniones, viajes)
├─ Pathway ve esos bloques como "ocupado"
├─ Admin NO puede asignar sesiones en esos horarios
├─ Coach puede sincronizar sesiones de Pathway → Google
└─ Bidireccional: si Coach agrega evento en Google, Pathway lo ve
```

### 3.4 Modelo de Datos - Sesión

```
id                    (UUID)
org_id                (FK)
coach_id              (FK -> personas)
cliente_id            (FK -> candidatos)
programa_id           (FK -> programas) [opcional]
fecha_hora_inicio     (datetime)
fecha_hora_fin        (datetime)
timezone              (coach's timezone)
estado                (programada | completada | cancelada | no-show | reprogramada)
tipo                  (1:1 | grupo | supervisión | coordinación)
notas_pre_sesion      (qué se va a discutir)
notas_post_sesion     (qué pasó, acuerdos)
enlace_zoom_id        (FK -> zoom_meetings)
chat_id               (FK -> chat_session)
created_at
created_by            (quién creó)
updated_at
updated_by            (quién fue último en cambiar)
cancelada_por
motivo_cancelacion
reasignada_desde_coach_id  (si fue reasignada)
confirmacion_coach    (true/false, timestamp)
confirmacion_cliente  (true/false, timestamp)
asistencia_cliente    (presente | ausente | canceló)
tags                  (["urgente", "follow-up", "problema"])
```

---

## 4. MODELO DE COBROS (Multi-modelo)

**Pathway debe soportar TODOS estos modelos desde el inicio. Elegir el correcto es decisión del Owner al crear organización.**

### 4.1 Los 4 Modelos Base

```
╔════════════════════════════════════════════════════════════════════════╗
║ MODELO A: "EMPRESA COBRA TODO"                                        ║
╠════════════════════════════════════════════════════════════════════════╣
║ Flujo de dinero:                                                       ║
║   Cliente paga a Empresa                                               ║
║   └→ Empresa paga comisión a Coach (ej: 50-70%)                        ║
║       └→ Pathway cobra fee a Empresa (ej: $29-199/mes SaaS)           ║
║                                                                        ║
║ Ventajas:                                                              ║
│   • Control total de la empresa sobre precios                          │
│   • Facturación unificada (empresa cobro todo)                         │
│   • Fácil auditoría de ingresos                                        │
│   • Coaches no manejan dinero                                          │
│   • Escalable: agregar coaches sin cambiar modelo                      │
│                                                                        │
║ Desventajas:                                                           │
│   • Empresa tiene riesgo de impago del cliente                         │
│   • Coaches dependen de empresa para pago                              │
│   • Posibles conflictos por comisión                                   │
│                                                                        │
║ Impacto técnico:                                                       │
│   • Stripe conectado a cuenta de Empresa                               │
│   • Coach ve comisiones estimadas en dashboard                         │
│   • Empresa genera reportes de ingresos/gastos                         │
│   • Cálculo automático de comisión según fórmula                       │
│                                                                        │
║ Casos de uso:                                                          │
│   • Agencias de coaching con múltiples coaches                         │
│   • Empresas con departamento de RRHH                                  │
│   • Programas corporativos de desarrollo                               │
║                                                                        ║
║ TABLA EN BD:                                                           │
│   - pagos (coach_id, monto, comisión%, fecha_pago, estado)            │
│   - comisiones_historico (auditoría de cálculos)                       │
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════════╗
║ MODELO B: "COACH COBRA DIRECTAMENTE"                                  ║
╠════════════════════════════════════════════════════════════════════════╣
║ Flujo de dinero:                                                       ║
║   Cliente paga a Coach (directamente o vía Pathway)                    ║
║   └→ Coach retiene 100% (menos fee de Pathway ej: 5-10%)               ║
║       └→ Coach le paga SaaS a Pathway o empresa cobra fee              ║
║                                                                        ║
║ Ventajas:                                                              ║
│   • Coach tiene 100% de control sobre precio                           │
│   • Más autonomía (modelo 1099 / independiente)                        │
│   • Pathway cobra fee pequeño (5-10%) por uso de plataforma            │
│   • Atrae coaches freelance                                            │
│                                                                        │
║ Desventajas:                                                           │
│   • Riesgo de impago recae en coach                                    │
│   • Múltiples cuentas Stripe (complejidad)                             │
│   • Compliance tax/impuesto más complejo                               │
│   • Coaches pueden dejar si no les conviene                            │
│                                                                        │
║ Impacto técnico:                                                       │
│   • Cada coach conecta su Stripe (o Pathway es intermediaria)          │
│   • Pathway cobra fee al chef, no al cliente                           │
│   • Dashboard de coach muestra ingresos netos                          │
│   • Pagos automáticos vía Stripe Payout                                │
│                                                                        │
║ Casos de uso:                                                          │
│   • Coaches independientes que usan Pathway como plataforma            │
│   • Marketplace de coaching                                            │
│   • Coaches que ya tienen clientes propios                             │
║                                                                        ║
║ TABLA EN BD:                                                           │
│   - pagos (coach_id, monto_bruto, fee_pathway%, monto_neto, estado)   │
│   - stripe_accounts (coach_id, stripe_account_id, estado)             │
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════════╗
║ MODELO C: "BOLSAS DE SESIONES" (Prepago Bulk)                         ║
╠════════════════════════════════════════════════════════════════════════╣
║ Flujo de dinero:                                                       ║
║   Empresa compra bolsa de 10/20/50 sesiones                            │
║   └→ Precio fijo por sesión ($50-200 según coach)                      ║
║       └→ Empresa distribuye sesiones entre candidatos/clientes         ║
║           └→ Coaches reciben comisión por sesión completada            ║
║                                                                        ║
║ Ventajas:                                                              ║
│   • Dinero entra antes de que se usen sesiones (flujo efectivo)        │
│   • Previsibilidad: empresa sabe cuánto invierte                       │
│   • Descuentos por volumen posibles                                    │
│   • Menos fricción: no cobrar por cliente                              │
│                                                                        │
║ Desventajas:                                                           │
│   • Sesiones no usadas = pérdida para empresa (o expiración)           │
│   • Riesgos de fraude (sesiones fake)                                  │
│   • Tracking complejo de sesiones completadas                          │
│                                                                        │
║ Impacto técnico:                                                       │
│   • Tabla "bolsas_sesiones" (org_id, cantidad, sesiones_usadas)       │
│   • Trigger: cada sesión completada decrementar saldo                  │
│   • Alerta: "Te quedan 5 sesiones en tu bolsa"                         │
│   • Reportes de utilización (30% usado, 70% sin usar)                  │
│                                                                        ║
║ Casos de uso:                                                          ║
│   • Programas corporativos de bienestar                                │
│   • Paquetes de coaching para startups                                 │
│   • Retenciones de talento (empresas compran para empleados)           │
║                                                                        ║
║ TABLA EN BD:                                                           │
│   - bolsas_sesiones (org_id, cantidad, sesiones_usadas, fecha_exp)    │
│   - consumo_bolsa_log (qué sesión consumió de qué bolsa)              │
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════════╗
║ MODELO D: "SUSCRIPCIÓN METERED" (Coach Independiente Dentro de Org)  ║
╠════════════════════════════════════════════════════════════════════════╣
║ Flujo de dinero:                                                       ║
║   Coach paga cuota fija mensual a Pathway ($29-199)                    ║
║   └→ Coach cobra a sus clientes directamente (100%)                    ║
║       └→ Pathway no toca dinero del cliente                            │
║                                                                        ║
║ Ventajas:                                                              ║
│   • Modelo más simple (SaaS puro)                                      │
│   • Coaches con autonomía total                                        │
│   • Sin complexidad de Stripe/pagos                                    │
│   • Escalable (agregar coaches = agregar suscriptores)                 │
│   • Tax sencillo (Pathway cobra suscripción, punto)                    │
│                                                                        │
║ Desventajas:                                                           │
│   • Coach no toma iniciativa → bajo engagement                         │
│   • Pathway no toma % de éxito del coach                               │
│   • Coaches pueden irse fácilmente                                     │
│                                                                        │
║ Impacto técnico:                                                       │
│   • Subscriptions en Stripe (coach_id, plan, estado)                   │
│   • Webhook de pago mensual automático                                 │
│   • NO hay integración con pagos de clientes                           │
│   • Dashboard simple: cuota pagada / vencida                           │
│                                                                        ║
║ Casos de uso:                                                          ║
│   • Coaches solos que usan Pathway como herramienta                    │
│   • MVPs iniciales para validar modelo                                 │
│   • Transición desde Modelo B                                          │
║                                                                        ║
║ TABLA EN BD:                                                           │
│   - subscripciones (coach_id, plan_id, monto_mensual, estado)         │
│   - pagos_suscripcion (coach_id, fecha, monto, status_stripe)         │
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

### 4.2 Matriz Comparativa

| Factor | Modelo A | Modelo B | Modelo C | Modelo D |
|--------|----------|----------|----------|----------|
| **Quién cobra** | Empresa | Coach | Empresa | Coach |
| **Quién paga Pathway** | Empresa | Coach | Empresa | Coach |
| **Ingresos Pathway** | SaaS fijo | % por transacción | SaaS + % bolsas | SaaS fijo |
| **Complejidad Stripe** | Media | Alta | Media | Baja |
| **Riesgo coach impago** | Bajo | Alto | Bajo | N/A |
| **Control precio** | Empresa | Coach | Empresa | Coach |
| **Atrae coaches** | Empleados | Freelance | N/A | Solos |
| **Escalabilidad** | ✓ | ✗ (compliance) | ✓ | ✓✓ |
| **Mejor para** | Agencias | Marketplace | Corporativo | MVP |

### 4.3 Decisión al Crear Organización

```
Flujo de onboarding de Owner:

1. "¿Qué tipo de organización eres?"
   a) Agencia / Empresa (Modelo A)
   b) Coach individual (Modelo B o D)
   c) Corporativo comprando bolsas (Modelo C)

2. Se configura el modelo (no es cambiarle después sin migración)

3. Se conecta Stripe (cada modelo tiene setup diferente)

4. Las capacidades de visualización de cobros cambian según modelo
   (Coach ve comisión en A, ingresos netos en B, etc.)

5. Reportes y auditoría se adaptan al modelo elegido
```

---

## 5. MODELO DE COLABORACIÓN

**NO separar Coach vs Colaborador. Son tipos de persona con capacidades diferentes.**

### 5.1 Patrones de Colaboración

```
PATRÓN 1: COACH + COACH SENIOR (Supervisión)
├─ Coach Senior: capacidad "Ver analytics de equipo"
├─ Coach Senior: capacidad "Coordinar con otros coaches"
├─ Coach Junior: ve solo sus clientes y sesiones
├─ Reunión interna semanal (supervisión 1:1)
├─ Chat: Coach Junior pregunta, Coach Senior aconseja
├─ Auditoría: "Coach Senior vio cliente de Coach Junior"
└─ Escalacion: si Coach Junior no resuelve, Coach Senior toma caso

PATRÓN 2: RECRUITER + COACH (Asignación)
├─ Recruiter: capacidad "Crear clientes", "Ver todos los clientes"
├─ Recruiter: NO puede "Editar clientes de otros"
├─ Coach: capacidad "Ver clientes propios", "Editar propios"
├─ Recruiter crea cliente → automáticamente se asigna a un coach
├─ Chat: Recruiter notifica al coach
├─ Auditoría: "Recruiter X creó cliente para Coach Y"
└─ Coach puede cambiar disponibilidad si está sobrecargado

PATRÓN 3: RRHH + ORGANIZACIÓN (Gestión de Personas)
├─ RRHH: capacidad "Invitar personas", "Ver configuración"
├─ RRHH: NO puede "Editar capacidades" (solo Owner)
├─ RRHH agrega coaches nuevos (onboarding)
├─ RRHH agrega colaboradores (asistentes, recruiters)
├─ Cada nueva persona recibe email de bienvenida
├─ RRHH puede remover personas (offboarding)
├─ Auditoría: "RRHH agregó Coach Maria", "RRHH removió Coach Carlos"
└─ Cuando se remueve, todos sus clientes se reasignan

PATRÓN 4: ASISTENTE + COACH (Soporte)
├─ Asistente: capacidad "Crear sesiones", "Ver agenda equipo"
├─ Asistente: NO puede "Editar clientes"
├─ Coach asigna asistente al cliente ("puede coordinar sesiones")
├─ Asistente coordina horarios cliente ↔ coach
├─ Chat: Asistente y coach se comunican
├─ Auditoría: "Asistente confirmó sesión con cliente"
└─ Cliente ve solo coach, no ve asistente (backend)

PATRÓN 5: OBSERVADOR (Auditor interno)
├─ Observador: capacidad "Ver todos los clientes", "Ver auditoría"
├─ Observador: NO puede "Crear", "Editar", "Eliminar"
├─ Usualmente es Owner o Compliance officer
├─ Puede descargar reportes
├─ Auditoría: "Observador revisó cliente X"
└─ No aparece en conversaciones de coaches/clientes

PATRÓN 6: RESPONSABLE SECUNDARIO
├─ Cada cliente puede tener "coach principal" + "coach secundario"
├─ Caso: cliente con 2 especialidades, 2 coaches diferentes
├─ Coach A: sesiones lunes, Coach B: sesiones jueves
├─ Ambos ven progreso del cliente (con permiso)
├─ Chat: ambos coaches pueden comentar
├─ Si falta Coach A, Coach B puede cubrir sesión
├─ Auditoría: "Coach B completó sesión de Coach A"
└─ Cliente ve ambos en su perfil

PATRÓN 7: CONSULTOR EXTERNO (Guest)
├─ Para auditorías, trainings, workshops
├─ Acceso temporal y limitado (ej: 1 semana)
├─ Capacidades específicas solo para la duración
├─ Ejemplo: "Auditor externo ve todos los programas, no toca nada"
├─ Chat: puede ver conversaciones pero no escribir (read-only)
├─ Auto-expira después de fecha end
└─ Auditoría: "Consultor externo visitó cliente X"
```

### 5.2 Matriz de Colaboración

```
Quién puede ver     | Coach | Coach Senior | Recruiter | RRHH | Admin | Owner
────────────────────┼───────┼──────────────┼───────────┼──────┼──────┼──────
Mis clientes        | ✓     | ✓            | —         | —    | ✓    | ✓
Todos los clientes  | ✗     | ✓            | ✓         | ✗    | ✓    | ✓
Mis sesiones        | ✓     | ✓            | —         | —    | ✓    | ✓
Agenda equipo       | Conf. | ✓            | ✓         | —    | ✓    | ✓
Analytics propios   | ✓     | ✓            | —         | —    | ✓    | ✓
Analytics equipo    | ✗     | ✓            | —         | —    | ✓    | ✓
Chat con cliente    | ✓     | Conf.        | ✓         | ✗    | ✓    | ✓
Chat equipo         | ✓     | ✓            | —         | —    | ✓    | ✓
Auditoría           | ✗     | —            | —         | —    | ✓    | ✓
Config. org         | ✗     | ✗            | ✗         | —    | ✓    | ✓✓
Capacidades         | ✗     | ✗            | ✗         | ✗    | —    | ✓

Leyenda:
✓ = Sí, puede
✗ = No, no puede
— = No aplica
Conf. = Configurable por Owner
✓✓ = Control total
```

### 5.3 Flujo de Comunicación

```
CHAT EN PATHWAY (Diferentes canales):

1. 1:1 Coach ↔ Cliente
   - Privado, cifrado (si aplica)
   - Historial permanente
   - Coach pueden ver si tienen permiso
   - Integración WhatsApp: coach puede enviar SMS

2. 1:1 Coach ↔ Coach
   - Para coordinación
   - Handover de cliente
   - Consulta rápida
   - No ven clientes

3. Grupo (Coaches + Admin)
   - Anuncios
   - Coordinación
   - Preguntas generales

4. Comentarios en Cliente (Privado para equipo)
   - "Este cliente necesita seguimiento extra"
   - "Cambio de horario por X razón"
   - "Cliente reportó problema Y"
   - Coach no ve (solo equipo)

5. Tareas @ Personas
   - "CC ana, verifica esto"
   - Notificación directa
   - Incorporado en auditoría
```

---

## 6. MODELO DE AUDITORÍA

**Qué acciones registrar y por qué.**

### 6.1 Eventos Auditables

```
CATEGORÍA: PERSONAS
├─ Persona creada (Owner, email, tipo, capacidades)
├─ Persona invitada (quién invitó, cuándo, a dónde)
├─ Persona aceptó invitación (timestamp)
├─ Capacidades asignadas (quién, cuáles, cuándo)
├─ Capacidades removidas (quién, cuáles, cuándo)
├─ Persona removida de org (quién, cuándo, qué pasó con sus datos)
├─ Persona cambió estado (activo → vacaciones, etc.)
└─ Contraseña reseteada (user_id, timestamp, IP)

CATEGORÍA: CLIENTES
├─ Cliente creado (quién, cuándo, qué datos)
├─ Cliente editado (campo, valor_anterior, valor_nuevo)
├─ Cliente asignado a coach (quién asignó, a quién, desde quién)
├─ Cliente reasignado (motivo, de coach_A a coach_B)
├─ Cliente marcado como completado (cuándo, por quién)
├─ Datos sensibles accedidos (acceso a salud, finanzas, etc.)
└─ Cliente eliminado (quién, cuándo, razón)

CATEGORÍA: SESIONES
├─ Sesión creada (quién, cliente, coach, fecha, hora)
├─ Sesión modificada (campo, valor_anterior, valor_nuevo)
├─ Sesión cancelada (quién, motivo)
├─ Sesión completada (quién marcó, notas)
├─ Sesión reasignada (de coach_A a coach_B, motivo)
├─ Sesión no-show (cliente ausente, quién reportó)
└─ Zoom/Teams link agregado (cuándo, por quién)

CATEGORÍA: PROGRAMAS
├─ Programa creado (quién, nombre, duración)
├─ Programa editado (campo, valor_anterior, valor_nuevo)
├─ Programa asignado a cliente (quién, cliente, programa)
├─ Programa completado (cliente finalizado)
└─ Programa archived (quién, cuándo)

CATEGORÍA: COBROS
├─ Pago procesado (monto, a quién, fecha, tipo)
├─ Pago cancelado/reembolsado (motivo)
├─ Comisión calculada (fórmula, monto, coach)
├─ Modelo de cobros cambiado (de A a B, quién, cuándo)
├─ Bolsa de sesiones comprada (cantidad, monto)
├─ Bolsa de sesiones consumida (sesión_id, cuántas)
└─ Stripe conectado (quién, cuándo, email Stripe)

CATEGORÍA: CONFIGURACIÓN
├─ Configuración org editada (campo, valor_anterior, valor_nuevo)
├─ Integración conectada (servicio, cuándo, quién)
├─ Integración desconectada (servicio, cuándo, quién)
├─ API key generada (para quién, cuándo)
├─ API key revocada (cuándo, quién)
└─ Capacidades base reconfiguradas (matriz de permisos)

CATEGORÍA: SEGURIDAD
├─ Login fallido (email, IP, timestamp) [si > 5, alertar]
├─ Login exitoso (email, IP, dispositivo, timestamp)
├─ Logout (email, timestamp)
├─ Sesión expirada
├─ Acceso denegado (email, recurso, permiso faltante)
└─ Cambio de contraseña (quién, cuándo)
```

### 6.2 Estructura de Auditoría

```
Tabla: audit_log

id                (UUID)
org_id            (FK)
timestamp         (cuando ocurrió)
user_id           (quién lo hizo, puede ser system)
accion            (enum: created, updated, deleted, reasigned, etc.)
entidad           (persona | cliente | sesion | programa | pago | config)
entidad_id        (ID de la entidad afectada)
cambios           (JSON con {campo: [antes, después]})
motivo            (texto opcional, para reasignaciones, etc.)
ip_address        (de dónde se hizo)
user_agent        (dispositivo/navegador)
metadata          (JSON para datos adicionales)

Índices:
- (org_id, timestamp DESC)
- (user_id, timestamp DESC)
- (entidad, entidad_id, timestamp DESC)

Políticas de retención:
- 7 años en Pathway (compliance)
- Exportable en formato CSV/JSON
- Immutable (no se puede borrar)
```

### 6.3 Reportes de Auditoría

```
REPORTE 1: "Quién modificó a Cliente X"
├─ Mostrar timeline de todos los cambios
├─ Quién, cuándo, qué cambió
└─ Filtrar por tipo de cambio

REPORTE 2: "Acceso a datos sensibles"
├─ Quién vio salud/finanzas de cliente X
├─ Cuándo y por cuánto tiempo
├─ IP y dispositivo

REPORTE 3: "Cambios en capacidades"
├─ Cuándo se le asignó/removió capacidad X a persona Y
├─ Quién lo hizo
├─ Por cuánto tiempo estuvo activa

REPORTE 4: "Historial de pagos"
├─ Quién procesó qué pago a quién
├─ Montos, fechas, métodos
├─ Comisiones calculadas

REPORTE 5: "Reasignaciones de clientes"
├─ De coach A a coach B, motivo, cuándo
├─ Cuántas sesiones se movieron
├─ Impacto en comisiones

REPORTE 6: "Actividad de usuario"
├─ Login/logout
├─ Acciones realizadas
├─ Recursos accedidos
└─ Tiempo en plataforma
```

---

## 7. INTEGRACIONES FUTURAS

**Pathway debe estar diseñado desde el inicio para soportar estas integraciones sin breaking changes.**

### 7.1 Calendario (Google, Outlook, iCal)

**Integración**: Bidireccional
- Coach conecta su Google Calendar / Outlook
- Pathway importa sus eventos (viajes, reuniones, vacaciones)
- Pathway ve esos bloques como "no disponible"
- Coach puede hacer sync de sesiones Pathway → Google
- Coach recibe invitations de Google/Outlook dentro de Pathway

**Impacto arquitectónico**:
- Tabla `calendar_integrations` (coach_id, proveedor, access_token, refresh_token)
- Webhook listener: cuando evento externo cambia, refrescar disponibilidad
- Cron job: cada 30 min, sync Google → Pathway
- OAuth flow: conectar Google/Microsoft

**Datos a sincronizar**:
- Events externos → bloques de "no disponible" en Pathway
- Sesiones Pathway → events en Google/Outlook (con link Zoom)
- Cambios de sesión en Pathway → update event en Google

### 7.2 Video Conferencia (Zoom, Teams, Google Meet)

**Integración**: Unidireccional (Pathway genera link)
- Admin o Coach crean sesión en Pathway
- Automáticamente genera Zoom meeting link
- Link se incluye en invitación a cliente
- Opción: grabar sesión automáticamente
- Transcrips de Zoom → archivo en Pathway

**Impacto arquitectónico**:
- Tabla `video_meetings` (sesion_id, proveedor, meeting_id, link, recording_url)
- OAuth flow: Zoom account conectada a organización
- Webhook: Zoom notifica cuando termina sesión (grabar, transcrip)
- Cron: descargar transcripts y guardar en Supabase Storage

**Datos a sincronizar**:
- Nueva sesión → crear meeting en Zoom
- Sesión cancelada → cancelar meeting
- Sesión completada → obtener recording + transcrip
- Attendees: coach + cliente (si tiene acceso a link)

### 7.3 Mensajería (Slack, WhatsApp, Teams Chat)

**Integración**: Notificaciones y bidireccional
- Coach recibe notificación en Slack: "Nueva sesión de cliente X a las 14:00"
- Coach recibe en WhatsApp: recordatorio 24h antes de sesión
- Coach puede responder en Slack "confirmado" y se marca en Pathway
- Admin recibe alertas: "Coach X no confirmó sesión"

**Impacto arquitectónico**:
- Tabla `integrations_messaging` (org_id, tipo, webhook_url, estado)
- Webhook sender: cuando evento en Pathway, enviar a Slack/WhatsApp
- Webhook receiver: cuando respuesta en Slack/WhatsApp, actualizar Pathway
- Rate limiter: no spamear notificaciones

**Datos a sincronizar**:
- Sesión creada → notificación en Slack/WhatsApp
- Sesión próxima a comenzar → recordatorio
- Cambio en disponibilidad → notificación al admin
- Pago procesado → notificación al coach

### 7.4 Facturación (Stripe, PayPal)

**Integración**: Bidireccional
- Stripe: cobro a cliente, payout a coach (según modelo)
- Webhook de Stripe: notificar cuando pago se completa/falla
- Dashboard en Pathway: mostrar estado de pago
- Refunds: procesar desde Pathway, Stripe lo ejecuta

**Impacto arquitectónico**:
- Tabla `stripe_accounts` (org_id, stripe_id, tipo_cuenta, estado)
- Tabla `stripe_customers` (cliente_id, stripe_customer_id)
- Tabla `payments_stripe` (payment_id, stripe_charge_id, webhook_status)
- Webhook receiver: escuchar charge.completed, payment_failed, etc.
- Cron: sincronizar payouts pendientes

**Datos a sincronizar**:
- Sesión completada → crear invoice en Stripe (si modelo es bolsas)
- Pago confirmado en Stripe → actualizar estado en Pathway
- Payout a coach → registrar en historial
- Refund → procesar y auditar

### 7.5 IA (Claude, GPT, etc.)

**Integración**: Análisis y generación
- Analizar notas de sesión → generar resumen automático
- Analizar conversación coach-cliente → detectar riesgos (depresión, etc.)
- Generar propuestas de programa basado en cliente
- Generar recordatorio personalizado para cliente
- Analizar audio de sesión (si se graba)

**Impacto arquitectónico**:
- Tabla `ai_analysis` (sesion_id, tipo_analisis, resultado_json, timestamp)
- API calls a Claude: enviar notas/transcripts, recibir análisis
- Bandera de privacidad: cliente puede opt-out de análisis IA
- Guardar análisis en Supabase Storage (no en memoria)

**Datos a sincronizar**:
- Nota de sesión → IA genera resumen
- Conversación chat → IA detecta patrones
- Cliente progress → IA sugiere next step
- Transcript de sesión (si existe) → IA transcribe + resume

### 7.6 Seguridad & Compliance

**Integración**: Auditoría y compliance
- GDPR compliance: derecho a olvido, exportar datos
- SOC2: auditoría de acceso a datos sensibles
- Vault: guardar datos sensibles (salud, finanzas) con encryption
- Encryption at rest: datos en reposo encriptados
- Encryption in transit: HTTPS + TLS

**Impacto arquitectónico**:
- Tabla `encryption_keys` (org_id, key_version, created_at)
- Antes de almacenar datos sensibles, encriptar
- Logs inmutables de quién accedió qué
- Derecho a olvido: borrar datos de cliente → cascada en BD

### 7.7 Matriz de Integraciones

| Integración | Tipo | Prioridad | Impacto BD | Complejidad |
|------------|------|-----------|-----------|-------------|
| Google Calendar | Bidireccional | P0 (Sprint 5+) | Media | Media |
| Outlook | Bidireccional | P0 | Media | Media |
| Zoom | Unidireccional | P0 | Media | Baja |
| Teams | Bidireccional | P1 | Baja | Media |
| Slack | Notificaciones | P1 | Baja | Baja |
| WhatsApp | Notificaciones | P1 | Baja | Media |
| Stripe | Bidireccional | P0 | Alta | Alta |
| PayPal | Bidireccional | P1 | Alta | Alta |
| Claude/IA | Unidireccional | P1 | Media | Media |
| Salesforce | Bidireccional | P2 | Alta | Alta |

---

## 8. RESUMEN DE DECISIONES ARQUITECTÓNICAS

### 8.1 Principios Clave

```
1. ✅ FLEXIBILIDAD SOBRE ROLES
   Capacidades activables/desactivables, no roles rígidos.
   Permite que organización customice permisos sin cambiar código.

2. ✅ MULTI-MODELO DE COBROS DESDE EL INICIO
   Pathway soporta A/B/C/D desde el MVP, no como feature después.
   Evita reestructuración cuando escala.

3. ✅ AUDITORÍA INMUTABLE
   Cada acción se registra y no se puede borrar.
   GDPR compliant + compliance (SOC2, HIPAA potential).

4. ✅ INTEGRACIONES COMO PRIMERA CLASE
   Google Calendar, Zoom, Stripe, IA no son "bolsa de features".
   Son parte de la arquitectura desde el inicio.

5. ✅ SEGURIDAD POR CAPAS
   RLS (Supabase) + Capacidades (nivel lógico) + Auditoría.
   No existe "se coló" porque tiene múltiples capas.

6. ✅ ESCALABILIDAD EN MENTE
   Modelo pensado para 1 coach solo hasta 1000+ en empresa.
   Agendas compartidas, coordinación, pagos automáticos.

7. ✅ COLABORACIÓN, NO JERARQUÍA
   Un cliente puede tener múltiples coaches, cada uno con roles específicos.
   Responsable secundario, coach senior, consultor, etc.
```

### 8.2 Decisiones Técnicas Requeridas (Post-Sprint 5.0)

```
A. TABLAS A CREAR (Sprint 5.1)
   ├─ personas (coaches, colaboradores, owners)
   ├─ capacidades_matriz (mapping persona → capacidades)
   ├─ sesiones (todas las sesiones, estados, coaches, clientes)
   ├─ integraciones (calendar, zoom, stripe, etc.)
   ├─ audit_log (auditoría inmutable)
   ├─ pagos_modelo_A/B/C/D (según modelo elegido)
   └─ availability_blocks (vacaciones, bloqueos, disponibilidades)

B. CAMBIOS EN TABLAS EXISTENTES
   ├─ coaches: agregar capacidades_json, modelo_cobro
   ├─ colaboradores: agregar capacidades_json, tipo_funcional
   ├─ candidatos: agregar coach_secondary, estado_sesiones
   └─ usuarios: agregar audit_trail para login/logout

C. APIs NUEVAS (Sprint 5.1-5.4)
   ├─ GET /org/:id/personas (con capacidades)
   ├─ POST /personas/:id/capacidades (asignar/remover)
   ├─ GET /sesiones (con filtros por agenda, estado, coach)
   ├─ POST /sesiones/:id/reasignar (coach → coach)
   ├─ POST /integraciones/:tipo/connect (Google, Zoom, etc.)
   └─ GET /audit (con filtros complejos)

D. FRONTEND CHANGES (Sprint 5.2+)
   ├─ Panel de capacidades (matriz) → solo Owner puede editar
   ├─ Vista de agenda (nueva) → coaches ven su agenda + equipo
   ├─ Modal de sesión (nueva) → crear/editar/cancelar
   ├─ Reasignación workflow (nuevo) → seleccionar coach destino
   └─ Dashboard de cobros (nuevo) → según modelo elegido
```

### 8.3 Plan de Validación (Post-Diseño)

```
ANTES DE IMPLEMENTAR:

□ Walkthrough con Product (Micaela)
  - ¿El modelo soporta tus clientes reales?
  - ¿Hay escenarios de negocio faltantes?

□ Validar complejidad técnica
  - ¿Las integraciones son posibles con presupuesto?
  - ¿Las queries de agenda escalan a 1000 sesiones/día?

□ Definir MVP (Sprint 5.1) vs futuro (Sprint 6+)
  - MVP: Personas + Capacidades + Sesiones básicas
  - Futuro: Agendas complejas, integraciones, cobros avanzados

□ Estimar scope por bloque
  - Sprint 5.1: Arquitectura (sem 1-2)
  - Sprint 5.2: Agendas (sem 3-4)
  - Sprint 5.3: Cobros (sem 5-6)
  - Sprint 5.4: Colaboración (sem 7-8)
```

---

## 9. VERSIÓN GRÁFICA (CONCEPTUAL)

```
ARQUITECTURA DE PATHWAY - VISTA GENERAL

┌─────────────────────────────────────────────────────────────────────────┐
│                           PATHWAY ORGANIZATION                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ OWNER       │  │ COACH A      │  │ COACH B      │  │ COLABORADOR  │ │
│  │ (1 por org) │  │ (capacidades)│  │ (capacidades)│  │ (capacidades)│ │
│  │             │  │              │  │              │  │              │ │
│  │ - Crear org │  │ - Ver propios│  │ - Ver propios│  │ - Crear      │ │
│  │ - Config.   │  │ - Ver equipo │  │ - Editar     │  │   clientes   │ │
│  │ - Permisos  │  │ - Crear ses. │  │ - Analytics  │  │ - Editar     │ │
│  │ - Cobros    │  │ - Chat       │  │ - Reasignar  │  │ - Agenda     │ │
│  │             │  │              │  │              │  │ - Chat       │ │
│  └─────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│        │                   │                  │                 │       │
│        │                   └────────┬─────────┘                 │       │
│        │                            │                           │       │
│        └────────────┬───────────────┼───────────────────────────┘       │
│                     │               │                                   │
│                     ▼               ▼                                   │
│        ┌──────────────────────────────────────┐                        │
│        │   CLIENTES (Candidatos)              │                        │
│        │   ├─ Cliente A (Coach A + B)         │                        │
│        │   ├─ Cliente B (Coach A solo)        │                        │
│        │   └─ Cliente C (Coach B + Collab)    │                        │
│        └──────────────────────────────────────┘                        │
│                     │                                                   │
│                     ▼                                                   │
│        ┌──────────────────────────────────────┐                        │
│        │   SESIONES (Agenda Compartida)       │                        │
│        │   ├─ Sesión 1 (Coach A + Cliente A)  │                        │
│        │   ├─ Sesión 2 (Coach B + Cliente A)  │                        │
│        │   └─ Sesión 3 (Coach A + Cliente B)  │                        │
│        └──────────────────────────────────────┘                        │
│                     │                                                   │
│                     ▼                                                   │
│        ┌──────────────────────────────────────┐                        │
│        │   PAGOS (Modelo Configurable)        │                        │
│        │   ├─ Modelo A (Empresa cobra)        │                        │
│        │   ├─ Modelo B (Coach cobra)          │                        │
│        │   ├─ Modelo C (Bolsas)               │                        │
│        │   └─ Modelo D (Suscripción)          │                        │
│        └──────────────────────────────────────┘                        │
│                     │                                                   │
│                     ▼                                                   │
│        ┌──────────────────────────────────────┐                        │
│        │   AUDITORÍA (Inmutable)              │                        │
│        │   └─ Log de todo: quién, qué, cuándo │                        │
│        └──────────────────────────────────────┘                        │
│                                                                         │
│  INTEGRACIONES (Futuro):                                               │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐              │
│  │ Google   │  Zoom    │ Stripe   │  Slack   │  Claude  │              │
│  │ Calendar │ Teams    │ PayPal   │Whatsapp  │   IA     │              │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. PRÓXIMOS PASOS

Esta arquitectura es la BASE para todos los sprints siguientes.

**Sprint 5.1** (2 semanas): Implementar Personas + Capacidades + Sesiones básicas  
**Sprint 5.2** (2 semanas): Agendas compartidas + coordinación  
**Sprint 5.3** (2 semanas): Modelo de cobros + integraciones Stripe  
**Sprint 5.4** (2 semanas): Colaboración + auditoría + refinamiento  

**VALIDACIÓN REQUERIDA AHORA:**
- [ ] ¿Este modelo cubre tus clientes reales?
- [ ] ¿Hay capacidades que falten?
- [ ] ¿El modelo de cobros es correcto para tu estrategia?
- [ ] ¿Hay integraciones adicionales críticas?

---

**Documento completado.** Listo para revisar y validar. ✓
