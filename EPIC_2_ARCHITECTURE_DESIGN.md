# EPIC 2: Arquitectura Funcional y Lógica — MultiCoach × Pathway

**Fase:** Diseño Funcional y Lógico (pre-técnico)  
**Objetivo:** Definir qué hace el sistema sin fijar cómo se implementa  
**Audiencia:** Revisión de Micaela antes de proceder a Arquitectura Técnica

---

## 0. Principios Rectores

Estos principios NUNCA cambian. Toda decisión posterior debe respetarlos:

1. **Independencia de Pathway**  
   Pathway (69 coaches, 37 clientes, proceso de mentoria de 4 semanas) sigue funcionando exactamente como hoy. MultiCoach no interfiere con su operación.

2. **No Sustitución, Reutilización**  
   MultiCoach no reemplaza el Panel del Coach ni el Portal del Cliente. Administra permisos y contexto organizacional. Las pantallas de coaching existentes se reutilizan (con soporte para clientes enterprise).

3. **Dominios Separados**  
   - **MultiCoach:** Administra organizaciones, asignaciones, permisos, supervisión, facturación.
   - **Pathway:** Ejecuta el proceso de coaching: análisis, CV, cartas, sesiones, documentos.

4. **Integridad de Datos**  
   Nunca se corrompen datos existentes. Los cambios son aditivos o scoped a su contexto (empresa, coach, cliente).

---

## 1. Arquitectura Funcional

### 1.1 Dominios de Negocio

El sistema se organiza alrededor de 8 dominios funcionales independientes:

#### **Dominio 1: Organización**
Define qué es una empresa en MultiCoach.

| Aspecto | Descripción |
|---------|------------|
| **Responsabilidad** | Agrupar coaches y clientes en contextos de trabajo |
| **Actores** | Propietario de organización (Owner) |
| **Operaciones** | Crear org, ver miembros, editar datos org, ver métricas agregadas |
| **Datos** | Nombre, sector, país, contacto, configuración, plan de suscripción |
| **Integración con Pathway** | Las orgs de MultiCoach pueden opcionalmente usar Pathway; los coaches legacy de Pathway siguen siendo individuales (sin org) |

#### **Dominio 2: Usuarios y Roles**
Define identidades y permisos.

| Aspecto | Descripción |
|---------|------------|
| **Responsabilidad** | Autenticar y autorizar en contexto de organización |
| **Actores** | Owner, Coach Enterprise, Client Enterprise, Admin |
| **Operaciones** | Login, cambiar permisos, invitar a org, revocar acceso, auditoría de sesiones |
| **Datos** | Email, nombre, rol dentro de la org, foto, preferencias (idioma, zona horaria, etc.) |
| **Integración con Pathway** | Los coaches legacy de Pathway tienen identidad en Pathway. Los coaches enterprise tienen identidad TANTO en Pathway como en MultiCoach (mismo email, dos contextos) |

#### **Dominio 3: Coaches y Asignaciones**
Gestiona quién trabaja con quién.

| Aspecto | Descripción |
|---------|------------|
| **Responsabilidad** | Crear equipos de coaches y asignar clientes |
| **Actores** | Owner, Coach |
| **Operaciones** | Agregar coach a org, crear equipo, asignar cliente a coach, cambiar asignaciones, desactivar coach |
| **Datos** | Coach ID, especialidad, clientes asignados, estado (activo/inactivo), fecha inicio en org |
| **Integración con Pathway** | El coach ve en su panel solo los clientes asignados por MultiCoach. Pathway sigue mostrando datos del formulario de intake |

#### **Dominio 4: Clientes**
Define el registro de clientes enterprise.

| Aspecto | Descripción |
|---------|------------|
| **Responsabilidad** | Registro único de clientes en una organización |
| **Actores** | Owner, Coach, Client |
| **Operaciones** | Importar cliente, ver perfil, ver progreso, marcar hito, desactivar cliente |
| **Datos** | Email, nombre, foto, cargo, sector, fecha inicio, coach asignado, progreso (%), notas |
| **Integración con Pathway** | El cliente accede a su portal y ve su nombre/foto/coach en contexto organizacional. El análisis y documentos vienen de Pathway |

#### **Dominio 5: Operación (Sesiones, Documentos, Progreso)**
Sincroniza el proceso de coaching.

| Aspecto | Descripción |
|---------|------------|
| **Responsabilidad** | Mostrar dónde está cada cliente en el viaje de 4 semanas |
| **Actores** | Owner (agregado), Coach, Client |
| **Operaciones** | Ver sesiones agenda, subir documentos, marcar tareas hechas, generar reportes de progreso |
| **Datos** | Sesiones (fecha, tema, notas), docs (CV, carta), tareas, medallas, logros |
| **Integración con Pathway** | Lee el estado actual del cliente desde Pathway (formulario completado, análisis listo, CV guardado, sesión agendada). No replica ni copia |

#### **Dominio 6: Analytics y Reportes**
Proporciona visibilidad empresarial.

| Aspecto | Descripción |
|---------|------------|
| **Responsabilidad** | Mostrar salud del negocio (retención, progreso, conversión) |
| **Actores** | Owner, Admin |
| **Operaciones** | Ver dashboard (clientes activos, coaches, progreso agregado), filtrar por período/coach/sector |
| **Datos** | Métricas: clientes en semana 1/2/3/4, completitud documentos, sesiones agendadas, tasa de finalización |
| **Integración con Pathway** | Lee datos de progreso de Pathway sin modificar |

#### **Dominio 7: Facturación y Suscripción**
Gestiona el pago y ciclo de vida.

| Aspecto | Descripción |
|---------|------------|
| **Responsabilidad** | Administrar suscripciones organizacionales |
| **Actores** | Owner, Admin |
| **Operaciones** | Ver plan actual, cambiar plan, ver facturación, descargar recibos, renovar suscripción |
| **Datos** | Plan (básico/pro/custom), precio, fecha inicio/renovación, estado (activa/vencida), histórico de pagos |
| **Integración con Pathway** | El acceso de coaches/clientes se activa/desactiva según estado de suscripción de la org |

#### **Dominio 8: Configuración y Marca**
Personalización y preferencias.

| Aspecto | Descripción |
|---------|------------|
| **Responsabilidad** | Adaptar el sistema a la identidad de la organización |
| **Actores** | Owner, Admin |
| **Operaciones** | Editar nombre org, subir logo, elegir colores, configurar dominios custom, activar/desactivar features |
| **Datos** | Logo, colores, fuente, dominio custom, idioma, zona horaria, features activas |
| **Integración con Pathway** | Los coaches de Pathway siguen viendo el logo/colores de Pathway. Las orgs enterprise ven su propia marca en el contexto MultiCoach |

---

### 1.2 Flujos de Usuario (Funcionales, no técnicos)

#### **Flujo 1: Owner Crea y Administra una Organización**

```
Owner (primera vez)
  ↓
Llena datos de org (nombre, sector, país)
  ↓
Sistema genera org_id único y la asigna a su usuario
  ↓
Owner ve dashboard con 0 coaches, 0 clientes
  ↓
Owner invita coaches (envía link o email)
  ↓
Coaches aceptan invitación y quedan dentro de la org
  ↓
Owner importa/agrega clientes (CSV o manual)
  ↓
Owner asigna clientes a coaches
  ↓
Owner ve dashboard: N clientes, N coaches, X% en semana 1, Y% en semana 2, etc.
```

#### **Flujo 2: Coach Enterprise Trabaja con sus Clientes**

```
Coach (ya en Pathway, ahora parte de una org enterprise)
  ↓
Loguea en el panel del coach (URL: mismo panel-v2.html)
  ↓
Panel detecta que es parte de una org
  ↓
Ve SOLO sus clientes asignados por el Owner
  ↓
Agenda sesiones, sube documentos, marca tareas (mismo flujo que hoy)
  ↓
Datos se guardan en contexto de su org
  ↓
Owner ve el progreso agregado en su dashboard
```

#### **Flujo 3: Cliente Enterprise Accede a su Portal**

```
Cliente (invitado por Owner o Coach)
  ↓
Recibe email con link a portal
  ↓
Se loguea (o crea cuenta si es primera vez)
  ↓
Ve su nombre, foto, coach asignado en contexto de su org
  ↓
Accede a sesiones, documentos, recursos (mismo portal que hoy, pero con contexto)
  ↓
Marca tareas, descarga materiales, ve progreso
```

#### **Flujo 4: Admin ve Web Analytics y Leads Captados**

```
Admin (solo en Pathway, no MultiCoach)
  ↓
Accede a sección de Web Analytics
  ↓
Ve KPIs de pathwaycareercoach.com y micaelajairedin.com
  ↓
Ve leads captados por el chatbot
  ↓
Puede exportar o enviar a coaches manualmente
```

---

## 2. Arquitectura Lógica

### 2.1 Relaciones Entre Dominios

```
PATHWAY (Existente)
├─ Coaches individuales (legacy)
│  ├─ Lee: formularios, análisis, CVs
│  └─ Escribe: sesiones, notas, documentos
│
└─ Clientes individuales (legacy)
   ├─ Lee: su perfil, sesiones, recursos
   └─ Escribe: tareas, foto, preferencias

MULTICOACH (Nuevo)
├─ Organizaciones
│  └─ Owner (administra la org)
│     ├─ Coaches enterprise (parte de la org)
│     │  └─ Reutilizan panel-v2.html (con scope de org)
│     │
│     └─ Clientes enterprise (parte de la org)
│        └─ Reutilizan cliente.html (con scope de org)
│
└─ Integraciones
   ├─ Lee sesiones, documentos, progreso de Pathway
   └─ NO modifica datos de Pathway (lectura only para Pathway legacy)
```

### 2.2 Mapeo de Actores a Funcionalidades

| Actor | Puede Hacer | Acceso a Datos |
|-------|-------------|-----------------|
| **Coach Legacy (Pathway)** | Ver sus clientes legacy, agendar sesiones, subir docs | Sus clientes en Pathway |
| **Coach Enterprise (MultiCoach)** | Idem + ver su org, ver asignaciones | Sus clientes dentro de su org |
| **Owner Enterprise** | Crear org, invitar coaches, asignar clientes, ver dashboard, cambiar plan | Toda la org (coaches, clientes, progreso) |
| **Client Legacy (Pathway)** | Ver su perfil, sesiones, documentos, recursos | Su perfil en Pathway |
| **Client Enterprise (MultiCoach)** | Idem + ver su org, su coach, progreso en contexto | Su perfil dentro de su org |
| **Admin (Pathway)** | Ver Web Analytics, leads captados, gestionar coaches legacy | Datos de Pathway (read-only), leads del chatbot |

### 2.3 Datos Compartidos vs. Silos

```
COMPARTIDOS (mismo email → misma identidad):
├─ Usuario email/nombre/foto
├─ Sesiones con el coach (agenda)
├─ Documentos (CV, carta)
└─ Formulario de intake (análisis)

SILOS (separados por contexto):
├─ Coach legacy → solo sus clientes legacy
├─ Coach enterprise → solo sus clientes dentro de su org
├─ Client legacy → solo Pathway
├─ Client enterprise → su org en MultiCoach + su sesiones/docs en Pathway
└─ Org enterprise → sus coaches y clientes (no ve otros)
```

---

## 3. Garantías Funcionales (No Técnicas)

### 3.1 Garantías de Aislamiento

1. **Un coach enterprise NO ve clientes de otra org**
2. **Un owner enterprise NO ve datos de otras orgs**
3. **Un cliente legacy sigue viendo SOLO Pathway**
4. **Un cliente enterprise ve su org + su contexto de coaching**
5. **Cambios en MultiCoach NO corrompen Pathway**

### 3.2 Garantías de Disponibilidad

1. **Si MultiCoach cae, Pathway sigue funcionando**
2. **Si MultiCoach es lento, Pathway es rápido**
3. **Coaches legacy NO se ven afectados por MultiCoach**

### 3.3 Garantías de Auditoría

1. **Se registra quién accedió a qué y cuándo**
2. **Se registran cambios de asignaciones (quién movió qué cliente)**
3. **Se registran intentos de acceso no autorizado**

---

## 4. Decisiones Abiertas (Para Arquitectura Técnica)

Las siguientes decisiones se tomarán en EPIC 3 (Arquitectura Técnica):

1. **Estructura de almacenamiento**  
   ¿Uno o varios schemas? ¿Una sola BD o múltiples? ¿Replicación?

2. **Autenticación**  
   ¿Cómo se mapean usuarios legacy a enterprise? ¿Token refresh? ¿Duración?

3. **Autorización**  
   ¿RLS, middleware de API, checks en frontend, o combinación?

4. **APIs y Endpoints**  
   ¿REST, GraphQL, Edge Functions? ¿Caching?

5. **Sincronización de Datos**  
   ¿Cómo se sincroniza Pathway ↔ MultiCoach? ¿En tiempo real o eventual?

6. **Escalabilidad**  
   ¿Cómo manejar 100 orgs, 1000 coaches, 10k clientes?

7. **Migración de Coaches Legacy a Enterprise**  
   ¿Cómo se convierte un coach individual en coach de una org sin perder datos?

---

## 5. Resultado Esperado Posterior a EPIC 2 (Este Documento)

Una vez aprobada esta Arquitectura Funcional y Lógica:

### EPIC 3: Arquitectura Técnica
- Decidir estructura de BD (schemas, replicación, etc.)
- Definir APIs y autenticación (JWT, roles, permisos)
- Definir RLS y guardrails técnicas

### EPIC 4: Implementación
- Crear tablas/migraciones
- Implementar Edge Functions
- Conectar frontend a APIs

### EPIC 5: Integración UX/UI
- Decidir navegación con Product Design
- Implementar multicoach.html
- Adaptar panel-v2.html y cliente.html para enterprise

---

## 6. Checklist de Aprobación

- [ ] Principios rectores están claros
- [ ] Los 8 dominios cubren el negocio
- [ ] Flujos de usuario son coherentes
- [ ] Garantías de aislamiento son suficientes
- [ ] Pathway no se ve comprometido
- [ ] Decisiones técnicas quedan para EPIC 3
