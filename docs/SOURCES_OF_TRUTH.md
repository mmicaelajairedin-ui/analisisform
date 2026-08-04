# Fuentes de Verdad — Pathway

**Fecha:** 2026-08-04  
**Propósito:** Una única fuente de verdad para cada concepto (Regla 3).  
**Ciclo:** Sprint 0 ejecución.

---

## Tabla de Propietarios

| Concepto | Tabla | Campo/Ubicación | Propietario | Notas |
|----------|-------|-----------------|-------------|-------|
| **Organización (empresa)** | `organizaciones` | `id, nombre, plan, dominio, max_coaches, max_clientes, estado_sub, fecha_fin_prueba` | MultiCoach escribe | Solo datos de la empresa, NO info específica de coach |
| **Coach (identidad)** | `usuarios` | `id, email, nombre, rol, activo, auth_id` | Panel-v2 escribe | Centro de identidad del coach |
| **Organización (FK del coach)** | `usuarios` | `org_id` (columna UUID) | Panel-v2 escribe | **ÚNICA fuente.** Fallback `configuracion.org_id` deprecated (legacy only). Nunca escribir al JSONB. |
| **Rol en la red** | `usuarios.configuracion` | `.member_role` ("coach" \| "colaborador") | Panel-v2 + MultiCoach escriben | Coach da clases; Colaborador gestiona sin dar clases. |
| **Especialidad/Nicho** | `usuarios.configuracion` | `.coach_type` ("carrera" \| "fitness" \| "financiero") | Panel-v2 escribe | Especialidad del coach (distinto de member_role). |
| **Config Coach** | `usuarios` | `configuracion` (JSONB) | Panel-v2 + MultiCoach escriben | Estructura interna definida abajo |
| **Negocio** | `usuarios.configuracion` | `.negocio {}` | Panel-v2 escribe | Horarios, especialidades, servicios |
| **Marca** | `usuarios.configuracion` | `.marca {}` | Panel-v2 + MultiCoach escriben | Logo, colores, fonts (uno solo) |
| **Portal (cliente)** | Render en `cliente.html` | Lee `.portal {}` | No persiste | Dato: `usuarios.configuracion.portal` |
| **Landing** | Render en `index.html` | Lee `.landing {}` | No persiste | Dato: `usuarios.configuracion.landing` |
| **IA** | `usuarios.configuracion` | `.ia {}` | IA reads | Prompt context, especialidad, tono |
| **Cliente** | `candidatos` | `id, coach_id, nombre, email, activo` | Panel-v2 escribe | Un único coach responsable (coach_id) |
| **Reasignación** | `coach_client_assignments` | `client_id, coach_id, assigned_at` | Panel-v2 escribe | Única fuente de "quién tiene a quién" |
| **Sesiones** | `citas` o `citas_red` | `id, coach_id, cliente_id, fecha` | Panel-v2 + MultiCoach escriben | Única fuente de verdad para eventos |

---

## Estructura de `usuarios.configuracion` (JSONB)

```json
{
  "member_role": "coach|colaborador",
  "coach_type": "carrera|fitness|financiero",
  "negocio": {
    "especialidad": "string",
    "servicios": ["service1", "service2"],
    "horarios": { "lunes": ["09:00-12:00", "14:00-18:00"] },
    "ubicacion": "string"
  },
  "marca": {
    "logo": "url",
    "colores": ["#color1", "#color2"],
    "font": "string",
    "bio_publica": "string"
  },
  "portal": {
    "mostrar_calendario": true,
    "mostrar_testimonios": true
  },
  "landing": {
    "titulo": "string",
    "subtitulo": "string",
    "cta_button": "string"
  },
  "ia": {
    "prompt_system": "string",
    "tone": "formal|casual|friendly"
  }
}
```

**IMPORTANTE:** 
- `org_id` NO va aquí. Vive en la columna `usuarios.org_id`
- `member_role` y `coach_type` son campos distintos:
  - `member_role`: Rol en la red (coach da clases / colaborador gestiona)
  - `coach_type`: Especialidad (carrera / fitness / finanzas)

---

## Cambios de este ciclo

### Ciclo 1: Eliminar duplicado de `org_id`
- ✅ **Encontrado:** `configuracion.org_id` nunca se escribe (solo fallback legacy)
- ✅ **Decisión:** Usar SOLO `usuarios.org_id` (columna)
- ✅ **Implementación:** Documentado. Código no cambia.
- ✅ **Riesgo:** BAJO (fallback aún existe si falta columna)
- 📋 **Pendiente:** Limpiar `configuracion.org_id` en datos reales (siguiente ciclo)

### Ciclo 2: Aclarar `member_role` vs `coach_type` (NO duplicado)
- ✅ **Investigado:** Audit reportó `tipo` duplicado con `coach_type`
- ✅ **Hallazgo:** NO hay duplicado. Son campos distintos:
  - `member_role`: Rol del coach en la red (coach vs colaborador)
  - `coach_type`: Especialidad/nicho (carrera vs fitness vs finanzas)
- ✅ **Implementación:** Documentado en estructura JSONB. Código no cambia.
- ✅ **Riesgo:** NINGUNO (campos legítimos y usados correctamente)

### Ciclo 3: Normalización de emails (funciona correctamente)
- ✅ **Investigado:** Verificar si emails se normalizan consistentemente
- ✅ **Hallazgo:** Email normalization IS implemented correctly. Todos los save points normalizan a lowercase + trim:
  - `panel-v2.html` línea 12095: Crear cliente → `em=_val("nc-email").trim().toLowerCase()`
  - `panel-v2.html` línea 12068: Deactivar/reactivar → `cliEmail=(cliRow && cliRow.email) ? cliRow.email.toLowerCase().trim() : ""`
  - `panel-v2.html` línea 12205: Reset password → `pem=(""+ppc.email).toLowerCase().trim()`
  - `panel-v2.html` línea 10368: Grant access → `em=(""+(email||"")).toLowerCase().trim()`
  - `formulario.html` línea 818: Form save → `.toLowerCase().trim()`
  - Todos los comparisons usan `.toLowerCase().trim()` pattern
- ✅ **Implementación:** Código ya normaliza correctamente. Sin cambios necesarios.
- ✅ **Riesgo:** NINGUNO (implementación correcta y verificada)

### Ciclo 4: organizaciones.owner_id — Nueva FK (Transición incremental)
- ✅ **Investigado:** owner_email es TEXT; debe ser UUID FK a usuarios.id
- ✅ **Problema:** Integridad referencial, data consistency (pueden quedar orgs huérfanas)
- ✅ **Solución (Opción A incremental):**
  - Agregar columna `owner_id UUID REFERENCES usuarios(id)` (nullable)
  - Migrar datos existentes: `UPDATE organizaciones SET owner_id = (SELECT id FROM usuarios WHERE email = organizaciones.owner_email)`
  - Edge functions escriben AMBOS campos (owner_id + owner_email)
  - Lectura puede seguir con owner_email mientras se verifica
  - owner_email se elimina en ciclo posterior (cuando todo use owner_id)
- ✅ **Implementación:**
  - Migration: `0107_organizaciones_owner_id.sql` creada
    - Agrega columna owner_id (nullable, con FK)
    - Migra datos existentes
    - Crea índice idx_organizaciones_owner_id
  - Edge functions actualizadas (escritura de AMBOS campos):
    - `crear-multicoach/index.ts`: upsertOrg ahora acepta ownerId opcional
    - `cambiar-owner/index.ts`: PATCH a org incluye owner_id
    - `convertir-multicoach/index.ts`: POST a org incluye owner_id
  - panel-v2.html, login.html, multicoach.html: No requieren cambios (lectura sigue con owner_email)
- ✅ **Riesgo:** BAJO (owner_email se mantiene para compatibilidad, migration es additive)
- 📋 **Próximo:** Después de verificar producción, eliminar owner_email (Ciclo 5)

---

## Reglas para nuevas funcionalidades

1. **Antes de crear un campo nuevo:** verifica esta tabla
2. **Antes de guardar un dato:** ¿dónde vive?
3. **Nunca duplicar conceptos**
4. **Si no está en esta tabla:** proponer dónde debe vivir (no crear nuevas columnas/tablas)
