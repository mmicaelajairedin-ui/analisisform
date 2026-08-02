# Sprint 5.1 — Aprobación Oficial y Cierre

**Fecha**: 2026-08-02  
**Aprobador**: Micaela Jairedin (Product Owner)  
**Estado**: ✅ APROBADO Y CONGELADO

---

## DECISIÓN OFICIAL

**SPRINT 5.1 ESTÁ CONGELADO.**

No se modifica, no se cambia, no se extiende hasta tener aprobación explícita de rediseño arquitectónico.

---

## POR QUÉ SPRINT 5.1 FUE CRÍTICO

El logro más importante de Sprint 5.1 **no fue el código**. Fue la separación arquitectónica:

```
❌ ANTES (error clásico SaaS):
  Usuario.rol = "coach"
    ↓
  Permiso automático = TODO

✅ AHORA (correcto):
  Usuario.rol = "coach" (metadato)
    ↓
  Usuario.capacidades = Set["clientes.read", "agenda.create", ...]
    ↓
  Usuario.scope = "own" / "team" / "organization"
    ↓
  Permiso = capacidad + scope
```

**Esto evita que en el futuro cada nicho termine con paneles duplicados.**

---

## VALIDACIÓN DEL MODELO

### ✅ 1. Modelo de Capacidades

```
Usuario
  ├─ Preset base (ej: "Coach Estándar")
  ├─ Personalización manual (agregar/quitar capacidades)
  ├─ Validación de dependencias (clientes.edit → clientes.read)
  ├─ Capacidades finales (resultado)
  └─ Scopes asignados (own/team/organization)
```

**Por qué funciona**:
- Una fuente de verdad (tabla `user_capacidades`)
- Escalable a N nichos sin rediseño
- Compatible con cualquier organización

### ✅ 2. Presets Validados

| Rol | Casos de Uso | Capacidades | Escalabilidad |
|-----|--------------|-------------|---------------|
| Owner | Control total org | 40 | ✅ Vender a founders |
| Coach Estándar | Operación diaria | 23 | ✅ Vender a agencias |
| Coach Senior | Más alcance | 30 | ✅ Empresas con leads internos |
| Recruiter | Selección de talento | 12 | ✅ Vender a equipos de sourcing |
| Asistente | Apoyo operativo | 9 | ✅ Empresas medianas |
| Admin Recursos | Gestión interna | 11 | ✅ Modular para cualquier org |
| RRHH | Reportes empresa | 5 | ✅ Empresas grandes |

**Resultado**: Puedes vender MultiCoach a:
- ✅ Agencia de coaches (modelo Owner + Coaches)
- ✅ Empresa grande (modelo Owner + Recruiter + RRHH)
- ✅ Consultoría (modelo Owner + Coach Senior + Asistente)
- ✅ Equipo de sourcing (modelo Owner + Recruiter)

Sin escribir una línea de código diferente.

### ✅ 3. Scopes (own/team/organization)

```
Coach estándar:
  ├─ clientes.read (scope=own) → VE solo sus clientes
  ├─ agenda.view_own → VE solo su calendario
  └─ analytics.view_personal → VE solo sus métricas

Coach senior:
  ├─ clientes.read (scope=own) → VE solo sus clientes
  ├─ agenda.view_team → VE calendario del equipo
  └─ analytics.view_organization → VE todas las métricas

Owner:
  ├─ clientes.read (scope=organization) → VE todos los clientes
  ├─ agenda.view_organization → VE toda la agenda
  └─ analytics.view_organization → VE todas las métricas
```

**Por qué es crítico**: Responde la pregunta eterna en SaaS:

> "¿El usuario puede ver TODO o solo lo suyo?"

Sprint 5.1 la responde **explícitamente**, en código y en permiso.

---

## ADVERTENCIAS ANTES DE SPRINT 5.2

### ⚠️ 1. Capacidad vs Rol — La Fuente de Verdad

**En Sprint 5.2, hay que vigilar que NUNCA ocurra:**

```javascript
// ❌ INCORRECTO
if (user.rol === 'owner') {
  // Acceso automático a TODO
}

// ✅ CORRECTO
if (hasCapability(user, 'config.organization')) {
  // Acceso solo a eso
}
```

**Por qué**: Si ligáis permisos al rol en lugar de a capacidades:
- Perdéis toda la flexibilidad de presets
- Termináis con `if (rol === ...) if (rol === ...) if (rol === ...)`
- Cada nicho necesita su próprio rol
- Volvéis al problema que resolvieron en Sprint 5.1

**Validación en QA**:
- [ ] Buscar `user.role ===` en todo el código de Sprint 5.2
- [ ] Buscar `user.tipo ===` en todo el código de Sprint 5.2
- [ ] Asegurar que TODA validación de permisos usa `hasCapability()`

### ⚠️ 2. UI Escondido ≠ Seguridad

Sprint 5.1 lo documentó bien:

```
Bloquear API + Ocultar UI + Limpiar caché
```

**El error típico**:
```
API:    ✓ Abierta sin validar capacidad
UI:     ✓ Botón escondido (user_id=123 no lo ve)
Seguridad: ❌ user_id=123 puede hacer CURL al endpoint
```

**En Sprint 5.2, validar**:
- [ ] `POST /agendas/create` valida `agenda.create` ✓
- [ ] `PATCH /agendas/:id` valida `agenda.edit` ✓
- [ ] `DELETE /agendas/:id` valida `agenda.cancel` ✓
- [ ] RLS en Supabase filtra por `organization_id` ✓
- [ ] UI oculta botones si falta capacidad (UX, no seguridad) ✓

### ⚠️ 3. Auditoría: Mantenerla Siempre

Sprint 5.1 definió 5 eventos:

```
capacidad.changed
client.assigned
client.shared
agenda.created
agenda.canceled
```

**En Sprint 5.2, para CADA cambio en agenda**:

```sql
INSERT INTO auditoria_capacidades (
  organization_id,
  user_id_target,    -- Quién fue afectado
  user_id_actor,     -- Quién hizo el cambio
  timestamp,
  evento,             -- 'agenda.created'
  capacidad,          -- 'agenda.create'
  valor_nuevo,
  razon,              -- Opcional pero recomendado
  ip_address,
  session_id
) VALUES (...)
```

**Por qué**: Esto es CRÍTICO para B2B.

Una empresa con 50 coaches: "¿Quién creó la sesión con Cliente X? ¿Quién la canceló? ¿Por qué?"

Sin auditoría = indemostrable.

---

## ESTADO FINAL DE SPRINT 5.1

### Entregables

✅ **Documentación** (5 documentos, 4000+ líneas)
- sprint-5-architecture.md
- sprint-5-1-capacidades-especificacion.md
- sprint-5-1-matriz-permisos-oficial.md
- sprint-5-1-cierre-checklist-final.md
- sprint-5-2-agenda-arquitectura.md

✅ **Código** (4 archivos + 1 integración)
- supabase/migrations/user_capacidades.sql
- scripts/capacidades.js
- scripts/capacidades-init.js
- scripts/capacidades-ui.js
- multicoach.html (integración Equipo drawer)

✅ **Matriz Oficial**
- 57 capacidades (40 activas, 17 reserved)
- 7 presets validados
- 25 reglas de dependencias
- 5 eventos de auditoría

### Restricciones

🔒 **CONGELADO**

Cambios permitidos:
- ✅ Agregar capacidades reserved (no activas)
- ✅ Cambiar descripciones (no el ID)

Cambios prohibidos:
- ❌ Eliminar capacidades
- ❌ Renombrar capacidades
- ❌ Cambiar dependencias
- ❌ Modificar presets
- ❌ Rediseñar modelo

**Próxima revisión**: Sprint 5.5 o Fase 2 (si empresa requiere cambios)

---

## TRANSICIÓN A SPRINT 5.2

### La Recomendación Estratégica

**NO empezar por "calendario visual bonito".**

Orden correcto:

**Fase 1: Backend Sólido** (2 semanas)
```
✓ Crear evento (POST /agendas)
✓ Editar evento (PATCH /agendas/:id)
✓ Cancelar evento (DELETE /agendas/:id)
✓ Detectar conflicto (validación)
✓ Auditar todo (logging)
✓ Permisos (capacidades Sprint 5.1)
✓ RLS en Supabase
```

**Fase 2: Vista de Calendario** (1 semana)
```
✓ Renderizar eventos
✓ Mostrar conflictos (visual)
✓ Drag-drop para mover
✓ Modal para crear
```

**Por qué**: Un calendario bonito con reglas débiles genera deuda técnica.
- Usuarios reportan conflictos "mágicos"
- Datos inconsistentes en BD
- Auditoría incompleta
- Difícil de arregllar después

**Con backend primero**: Datos confiables desde día 1.

### Autorización Recomendada

Antes de escribir Sprint 5.2 CÓDIGO, entregar:

- [ ] Diagrama de flujo (crear → editar → cancelar)
- [ ] Matriz de conflictos (qué no se puede hacer)
- [ ] API contract (endpoints + status codes)
- [ ] RLS esperada (qué ve cada role)
- [ ] Relación explícita con Sprint 5.1 (capacidades mapeadas)

Después: Aprobación de PO → Inicio de código.

---

## REFLEXIÓN ESTRATÉGICA

Sprint 5.1 marca un punto de inflexión.

**Antes**: MultiCoach era "panel para coaches de carrera"

**Ahora**: MultiCoach es "OS de operación para equipos de profesionales de cualquier especialidad"

La escalabilidad no está en el calendario bonito. Está en:

```
1. Capacidades (qué puede hacer)
2. Scopes (qué ve según su nivel)
3. Presets (modelos reutilizables)
4. Auditoría (trazabilidad)
5. Permisos organizacionales (especialidades, módulos)
```

Si mantienen esa disciplina (como hicieron en Sprint 5.1), pueden vender esto a:
- ✅ Agencias de coaching
- ✅ Equipos de recursos humanos
- ✅ Empresas de recruiting
- ✅ Consultorías
- ✅ Equipos de asesoría financiera

Sin rediseñar.

---

## FIRMA DE APROBACIÓN

**Micaela Jairedin**
Product Owner, Pathway

**Fecha**: 2026-08-02

**Estado**: ✅ APROBADO PARA CONGELACIÓN

> "Lo importante ahora es no tocarlo más. Mantener la disciplina que aplicaron en Sprint 5.1 cuando empiecen a vender a empresas. Eso es lo que evitará romper el producto."

---

## SIGUIENTES FASES

- **Sprint 5.2**: Arquitectura de Agenda (diseño técnico primero, código después)
- **Sprint 5.3**: Cobros (basado en Sprint 5.1 + 5.2)
- **Sprint 5.4**: Colaboración (completa el modelo multi-equipo)
- **Sprint 5.5+**: Integraciones (Google Calendar, Zoom, Stripe)
- **Fase 2**: Marketplace y Comunidad (reserved)

---

**FIN DE APROBACIÓN OFICIAL**
