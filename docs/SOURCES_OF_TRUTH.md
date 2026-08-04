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

**IMPORTANTE:** `org_id` NO va aquí. Vive en la columna `usuarios.org_id`.

---

## Cambios de este ciclo

### Ciclo 1: Eliminar duplicado de `org_id`
- ✅ **Encontrado:** `configuracion.org_id` nunca se escribe (solo fallback legacy)
- ✅ **Decisión:** Usar SOLO `usuarios.org_id` (columna)
- ✅ **Implementación:** Documentado. Código no cambia.
- ✅ **Riesgo:** BAJO (fallback aún existe si falta columna)
- 📋 **Pendiente:** Limpiar `configuracion.org_id` en datos reales (siguiente ciclo)

---

## Reglas para nuevas funcionalidades

1. **Antes de crear un campo nuevo:** verifica esta tabla
2. **Antes de guardar un dato:** ¿dónde vive?
3. **Nunca duplicar conceptos**
4. **Si no está en esta tabla:** proponer dónde debe vivir (no crear nuevas columnas/tablas)
