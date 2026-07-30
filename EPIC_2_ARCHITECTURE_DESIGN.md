# EPIC 2: Arquitectura Funcional y Lógica — MultiCoach × Pathway

**Fase:** Diseño Funcional y Lógico (pre-técnico)  
**Objetivo:** Definir qué hace el sistema sin fijar cómo se implementa  
**Audiencia:** Documento Rector de Producto  
**Aprobación Requerida:** Micaela Jairedin

---

## 0. ¿Qué es MultiCoach?

### Definición del Producto

**MultiCoach es la plataforma de administración empresarial para organizaciones que utilizan Pathway.**

Pathway ejecuta el proceso de coaching de 4 semanas: análisis, CV, cartas, sesiones, documentos. Es un sistema individual, de coach a cliente.

MultiCoach es la capa de administración que se coloca **sobre** Pathway cuando una organización (empresa, consultora, agencia) quiere escalar el servicio de coaching a múltiples coaches y clientes bajo un modelo empresarial.

### Lo Que Hace MultiCoach

MultiCoach **administra el contexto organizacional** — quién trabaja en qué organización, quién tiene permiso para ver qué cliente, cómo se factura, qué reportes necesita el propietario — **sin ejecutar el coaching**.

La ejecución del coaching (sesiones, documentos, análisis) sigue siendo **100% responsabilidad de Pathway**. MultiCoach simplemente proporciona el perímetro empresarial alrededor.

### Analogía

```
Pathway = el motor de coaching (análisis, CV, sesiones, documentos)
MultiCoach = la cabina de administración (permisos, org, facturación, reportes)

Un coach individual usa Pathway sin MultiCoach.
Una empresa usa MultiCoach + Pathway juntos.
```

---

## 1. Límites del Sistema

### Qué Hace MultiCoach

✅ **Administración de Organizaciones**
- Crear y gestionar empresas/consultoras como unidades administrativas
- Mantener datos de la organización (nombre, sector, país, contacto)

✅ **Gestión de Coaches**
- Invitar coaches a una organización
- Asignar clientes a coaches
- Ver historial de actividad por coach
- Desactivar coaches cuando sea necesario

✅ **Gestión de Clientes**
- Importar/registrar clientes en una organización
- Asignar clientes a coaches específicos
- Ver estado de progreso agregado
- Crear reportes de progreso por cliente/coach

✅ **Permisos y Acceso**
- Garantizar que cada actor (owner, coach, cliente) vea SOLO lo que le corresponde
- Auditar intentos de acceso no autorizado
- Gestionar ciclo de vida de credenciales

✅ **Analytics y Reportes Empresariales**
- Dashboard de salud de la organización (clientes activos, tasa de progreso, etc.)
- Reportes de retención y conversión
- Métricas por coach y por período

✅ **Facturación y Suscripción**
- Gestionar planes y pagos de la organización
- Controlar acceso según estado de suscripción
- Historial de facturación

✅ **Configuración y Marca**
- Personalización de la experiencia por organización (logo, colores, idioma)
- Activación/desactivación de features
- Configuración de preferencias organizacionales

✅ **Supervisión**
- Owner puede ver agregados de su equipo
- Auditoría de quién accedió a qué y cuándo

### Qué NO Hace MultiCoach

❌ **NO ejecuta sesiones de coaching**
- Las sesiones las gestiona el coach en Pathway
- MultiCoach solo MUESTRA el estado de las sesiones

❌ **NO sustituye el Panel del Coach**
- El coach sigue usando panel-v2.html para su trabajo diario
- MultiCoach proporciona solo el contexto organizacional (scope de clientes, asignaciones)

❌ **NO sustituye el Portal del Cliente**
- El cliente sigue usando cliente.html para acceder a su perfil, documentos, recursos
- MultiCoach proporciona solo el contexto de su organización (nombre, logo, coach asignado)

❌ **NO reemplaza funcionalidades existentes de Pathway**
- Análisis de CV: lo hace Pathway, no MultiCoach
- Generación de informes: lo hace Pathway, no MultiCoach
- Sesiones y agendar: lo hace Pathway, no MultiCoach
- Recursos y documentos: los gestiona Pathway, no MultiCoach

❌ **NO inventa nuevas pantallas si Pathway ya las tiene**
- Principio de reutilización: MultiCoach suma contexto a pantallas existentes, no crea duplicadas

---

## 2. Principios Rectores → Criterios de Aceptación

Cada principio es verificable y debe constar en test/audit.

### Criterio 1: Independencia de Pathway

**Principio:** Pathway funciona igual con o sin MultiCoach.

| Prueba | Esperado | Verificable |
|--------|----------|------------|
| ¿Puede un coach legacy acceder si MultiCoach está down? | Sí, sin limitación | CI test: POST /login legacy coach sin MultiCoach → debe funcionar |
| ¿Se rompen datos de Pathway si MultiCoach falla? | No, jamás | Test de integridad: COUNT(*) public.* antes/después de falla de MultiCoach = igual |
| ¿Puede un cliente legacy ver su perfil si MultiCoach no existe? | Sí, sin cambio | CI test: cliente legacy accede a cliente.html → ve todo igual |
| ¿Se ejecutan sesiones si MultiCoach está apagado? | Sí, normalmente | Procedimiento: validar en producción que sesiones de Pathway continúan |

**Resultado:** Si MultiCoach cae, Pathway sigue 100% operativo. Si MultiCoach nunca existiera, Pathway funcionaría idéntico.

---

### Criterio 2: No Sustitución, Reutilización

**Principio:** MultiCoach se coloca como **capa de administración**, no como sustituto de nada.

| Prueba | Esperado | Verificable |
|--------|----------|------------|
| ¿Existe panel-multicoach.html NUEVO y duplicado de panel-v2.html? | No | Code review: MultiCoach REUTILIZA panel-v2.html con scope de org, no crea uno nuevo |
| ¿Existe cliente-multicoach.html NUEVO y duplicado de cliente.html? | No | Code review: MultiCoach REUTILIZA cliente.html con scope de org |
| ¿Existe una pantalla de "Sesiones" en MultiCoach? | No, se reutiliza de Pathway | Code review: Sesiones las gestiona Pathway, MultiCoach solo muestra estado |
| ¿Existiría duplicación funcional sin justificación explícita? | No, nunca | PR Policy: toda duplicación requiere aprobación de Micaela + documento de justificación |

**Resultado:** Toda funcionalidad consolidada en Pathway se reutiliza. La duplicación es excepcional y requiere documento justificativo.

---

### Criterio 3: Dominios Separados y Claros

**Principio:** MultiCoach administra. Pathway ejecuta. Límites definidos.

| Prueba | Esperado | Verificable |
|--------|----------|------------|
| ¿Sabe un developer dónde va cada feature? | Sí, hay documento | Este documento define qué hace y qué no hace MultiCoach |
| ¿Podría un feature terminar en el lugar incorrecto? | Sí, si no se valida | Code review checklist: ¿Este cambio respeta los límites de MultiCoach? |
| ¿Está claro para un nuevo developer qué es administración y qué es coaching? | Sí, explícito | Glosario de términos (sección 3) define los conceptos unívocamente |

**Resultado:** No hay ambigüedad. Si alguien no sabe dónde va una feature, consulta este documento y queda claro.

---

### Criterio 4: Integridad de Datos — Nunca Corrupción

**Principio:** Cambios en MultiCoach son aditivos o scoped. Nunca corrompen Pathway.

| Prueba | Esperado | Verificable |
|--------|----------|------------|
| ¿Puede MultiCoach escribir en public.* (tablas de Pathway)? | No, jamás | RLS test (EPIC 1.5): intento INSERT a public.* desde multicoach auth → 403 |
| ¿Puede existir dato inconsistente entre coach_id y asignaciones? | No | Audit trigger: si coach_id en candidatos ≠ assignments, alerta |
| ¿Se pierden datos legales si alguien desactiva una organización? | No | Soft-delete policy: orgs desactivadas mantienen datos en BD, no se borran |
| ¿Hay backup automático de public.* antes de cambios? | Sí, Supabase | Verificable: snapshots cada 6h en Supabase production |

**Resultado:** Garantía absoluta de integridad de datos. Pathway legacy es inmutable desde MultiCoach.

---

### Criterio 5: Única Fuente de Verdad para el Coaching

**Principio:** Pathway es la única fuente de verdad para datos de coaching. MultiCoach es observador/administrador.

| Prueba | Esperado | Verificable |
|--------|----------|------------|
| ¿Está el análisis del cliente en Pathway o en MultiCoach? | En Pathway | MultiCoach solo LEE ese análisis, no lo guarda localmente |
| ¿Está el CV en Pathway o en MultiCoach? | En Pathway | MultiCoach solo ve referencia, Pathway es dueño |
| ¿Está el estado de sesión en Pathway o en MultiCoach? | En Pathway | MultiCoach únicamente reporta: "sesión agendada sí/no", punto |
| ¿Si un dato cambia en Pathway, MultiCoach se entere automáticamente? | Sí, o en tiempo real | Test: coach actualiza CV en Pathway → MultiCoach ve cambio sin delay |

**Resultado:** No hay duplicación de datos. MultiCoach es observador del sistema, no almacén.

---

### Criterio 6: Ningún Owner Puede Ver Datos de Otra Organización

**Principio:** Aislamiento multi-tenant garantizado.

| Prueba | Esperado | Verificable |
|--------|----------|------------|
| ¿Puede owner A ver coaching_state de org B? | No, jamás | RLS + audit: intento de owner A a datos org B → bloqueado + logged |
| ¿Puede un coach de org A ver clientes de org B? | No, jamás | RLS: coach query con filtro org_id, no ve otro org |
| ¿Puede existir fuga entre organizaciones? | No | Test: 2 orgs paralelas, verificar isolamiento total |

**Resultado:** Cada organización vive en su propia burbuja. Aislamiento total.

---

## 3. Glosario de Términos

Cada término tiene una única definición. Se usa consistentemente en todo el proyecto.

| Término | Definición | Ejemplos |
|---------|-----------|----------|
| **Pathway** | Sistema de coaching de 4 semanas ejecutado por un coach a un cliente. Incluye análisis, CV, cartas, sesiones, documentos, recursos. |  Coach individual ve 37 clientes, cada uno hace su proceso. |
| **MultiCoach** | Plataforma de administración empresarial que se coloca sobre Pathway para gestionar múltiples coaches y clientes bajo un modelo organizacional. | Un consultora invita 5 coaches, les asigna 50 clientes en total; MultiCoach administra esa estructura. |
| **Organización** | Unidad administrativa en MultiCoach: empresa, consultora, agencia o cualquier entidad que agrupa coaches y clientes. | "Acme Consulting", "Growth Partners", "HR Recruitment Inc." |
| **Owner** | Propietario/administrador de una organización. Puede crear equipos, asignar clientes, ver reportes, cambiar plan de suscripción. | CEO o gerente de la consultora. |
| **Coach** | Profesional que ejecuta sesiones de coaching sobre un cliente en Pathway. Puede ser individual (legacy) o parte de una organización (enterprise). | Coach individual: 69 coaches legacy de Pathway. Coach enterprise: coaches dentro de una org. |
| **Cliente** | Persona que recibe coaching. Accede a su portal, ve documentos, agenda sesiones, completa tareas. Puede ser individual (legacy) o parte de una org (enterprise). | 37 clientes legacy + N clientes enterprise en diversas orgs. |
| **Programa** | Ciclo de coaching: típicamente 4 semanas de actividad estructurada (análisis → CV → carta → sesiones → entrega). | Programa estándar = 4 semanas. |
| **Administración** | Funciones de gestión no-coaching: crear orgs, asignar coaches, generar reportes, facturación. Responsabilidad de MultiCoach. | "Admin de la org" ≠ "Admin del coaching" |
| **Operación / Ejecución** | Funciones de coaching: sesiones, análisis, documentos, recursos. Responsabilidad de Pathway. | "El coach ejecuta la sesión" = operación. "El owner ve reportes" = administración. |
| **Supervisión** | Capacidad del owner para ver estado agregado de clientes, coaches, progreso. Lectura solamente. | Dashboard con "X clientes en semana 2, Y en semana 3". |
| **Permisos / Acceso** | Reglas de quién puede ver y hacer qué. Administradas por MultiCoach (org scope) + Pathway (datos de coaching). | Coach solo ve sus clientes, owner ve toda la org, cliente ve solo su perfil. |
| **Legacy** | Recursos pre-MultiCoach: coaches individuales, clientes individuales, datos en Pathway que NO están en una organización. | Los 69 coaches legacy seguirán funcionando igual con o sin MultiCoach. |
| **Enterprise** | Recursos post-MultiCoach: coaches parte de una organización, clientes asignados a una org. | Coaches + clientes dentro de una organización MultiCoach. |

---

## 4. Principios Rectores (Originales)

Estos principios NUNCA cambian. Toda decisión posterior debe respetarlos.  
**(Ver Sección 2 para Criterios de Aceptación verificables por cada uno.)**

1. **Independencia de Pathway** (Criterio 1)
   Pathway funciona idénticamente con o sin MultiCoach.

2. **No Sustitución, Reutilización** (Criterio 2)
   MultiCoach reutiliza pantallas existentes; nunca las reemplaza.

3. **Dominios Separados** (Criterio 3)
   MultiCoach administra. Pathway ejecuta. Límites claros.

4. **Integridad de Datos** (Criterio 4)
   Pathway es inmutable desde MultiCoach. Cambios solo en contexto propio.

5. **Única Fuente de Verdad** (Criterio 5)
   Pathway es la única fuente de verdad para coaching. MultiCoach observa.

6. **Aislamiento Multi-Tenant** (Criterio 6)
   Cada organización ve SOLO sus datos. Jamás fuga entre orgs.

---

## 5. Arquitectura Funcional

### 5.1 Dominios de Administración

MultiCoach organiza su funcionalidad en 8 dominios. Cada uno respeta los límites definidos en la Sección 1.

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

### 5.2 Flujos de Usuario (Funcionales, no técnicos)

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

## 6. Arquitectura Lógica

### 6.1 Relaciones Entre Dominios

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

### 6.2 Mapeo de Actores a Funcionalidades

| Actor | Puede Hacer | Acceso a Datos |
|-------|-------------|-----------------|
| **Coach Legacy** | Ver sus clientes, agendar sesiones, subir docs | Sus clientes en Pathway |
| **Coach Enterprise** | Idem + ver su org, ver asignaciones | Sus clientes dentro de su org |
| **Owner (Org Enterprise)** | Crear org, invitar coaches, asignar clientes, ver reportes, cambiar plan | Toda su org (coaches, clientes, progreso) |
| **Client Legacy** | Ver su perfil, sesiones, documentos, recursos | Su perfil en Pathway |
| **Client Enterprise** | Idem + ver su org, su coach, progreso en contexto | Su perfil dentro de su org |
| **Admin (Pathway)** | Ver Web Analytics, leads, gestionar coaches legacy | Datos de Pathway (read-only) |

### 6.3 Datos Compartidos vs. Silos

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

## 7. Garantías Funcionales (Verificables)

### 7.1 Aislamiento Multi-Tenant (Criterio 6)

1. Un coach enterprise NO ve clientes de otra org
2. Un owner NO ve datos de otras orgs
3. Un cliente legacy sigue viendo SOLO Pathway
4. Un cliente enterprise ve su org + su coaching
5. Cambios en MultiCoach NO corrompen Pathway

### 7.2 Disponibilidad (Criterio 1)

1. Si MultiCoach cae, Pathway sigue 100% operativo
2. Si MultiCoach es lento, Pathway no se afecta
3. Coaches legacy funcionan con o sin MultiCoach

### 7.3 Auditoría y Trazabilidad (Administración)

1. Se registra quién accedió a qué y cuándo
2. Se registran cambios de asignaciones (quién movió qué cliente)
3. Se registran intentos de acceso no autorizado
4. Todos los registros quedan en Pathway (única fuente de verdad)

---

## 8. Decisiones Abiertas (Para Arquitectura Técnica — EPIC 3)

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

## 9. Roadmap Post-Aprobación

Una vez aprobado este documento como **Arquitectura Funcional y Lógica Rector de MultiCoach**:

### EPIC 3: Arquitectura Técnica
Decidir la implementación física respetando todos los límites de esta arquitectura:
- Estructura de almacenamiento (BD, schemas, replicación)
- APIs y endpoints (REST, GraphQL, Edge Functions)
- Autenticación y autorización (JWT, roles, permisos)
- RLS y guardrails técnicas
- Sincronización Pathway ↔ MultiCoach

### EPIC 4: Implementación de Backend
- Crear migraciones y tablas
- Implementar Edge Functions
- Conectar APIs a frontend

### EPIC 5: UX/UI y Producto
- Decidir navegación y flujos UI con Product Design
- Implementar multicoach.html (panel de Owner)
- Adaptar panel-v2.html para coaches enterprise
- Adaptar cliente.html para clientes enterprise

### EPIC 6+: Escalabilidad, Integraciones, Go-Live
- Migración de coaches legacy a enterprise (si aplica)
- Integración con sistemas externos (Stripe, Calendly, etc.)
- Preparación para producción
- Go-live y monitoreo

---

## 10. Checklist de Aprobación Oficial

**Este documento será considerado APROBADO cuando se completen todos estos checks:**

✅ **Definición de Producto**
- [ ] Queda claro QUÉ es MultiCoach (administración, no coaching)
- [ ] Queda claro que MultiCoach se pone SOBRE Pathway, no lo reemplaza

✅ **Límites del Sistema**
- [ ] Está explícito qué MultiCoach SÍ hace (8 funciones)
- [ ] Está explícito qué MultiCoach NO hace (4 exclusiones)
- [ ] Está claro que los límites son INVARIABLES

✅ **Criterios de Aceptación**
- [ ] Los 6 principios rectores tienen pruebas verificables
- [ ] Cada criterio podría implementarse como test o audit

✅ **Glosario**
- [ ] Cada término tiene definición única
- [ ] El glosario es referencia para todo el proyecto
- [ ] No hay ambigüedad entre conceptos

✅ **Arquitectura Funcional**
- [ ] Los 8 dominios cubren todas las necesidades administrativas
- [ ] Flujos de usuario son coherentes y completos
- [ ] Arquitectura lógica refleja relaciones reales

✅ **Garantías**
- [ ] Garantías de aislamiento son verificables
- [ ] Garantías de disponibilidad son realistas
- [ ] Auditoría y trazabilidad definidas

✅ **Decisiones Abiertas**
- [ ] Todas las decisiones técnicas están explícitamente abiertas para EPIC 3
- [ ] No hay detalles técnicos cerrados

---

**Aprobado por:** _________________________ (Micaela Jairedin)  
**Fecha:** ________________________  
**Próximo EPIC:** EPIC 3 — Arquitectura Técnica
