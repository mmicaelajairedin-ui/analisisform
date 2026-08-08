# ERROR_REGISTRY

**Registro oficial de errores detectados, clasificados y resueltos.**

Estado posible: `DETECTED` | `TRIAGED` | `FIXED` | `TESTED` | `VERIFIED`

---

## ERR-UPLOAD-001: Avatar persistence mismatch

**Estado:** TRIAGED  
**Fecha detectado:** 2026-08-01  
**Fecha triaged:** 2026-08-08  
**Severity:** CRITICAL  

### Síntoma
Coach sube avatar, se guarda correctamente, pero desaparece al recargar la página. Campo `usuarios.foto_url` queda NULL.

### Categoría
`FRONTEND_ERROR` · `STORAGE_PERSISTENCE`

### Módulo
avatar upload flow

### Root Cause
Foto guardada en `usuarios.configuracion.foto_url` (JSONB, legado)  
pero se lee de `usuarios.foto_url` (SQL column, introducida después)  
Dos fuentes de verdad conflictivas → lectura devuelve NULL

### Evidencia
- **Commit:** c95be3be (Merge: Fix photo/avatar storage architecture)
- **Files affected:**
  - panel-v2.html:14162-14176 (_uploadAvatar)
  - panel-v2.html:15900 (photo load)
  - supabase/migrations/0113_unify_foto_url.sql
- **Test:** tests/uploads/avatar.test.js#test-avatar-persistence-login
- **SQL:** Migration unifica a usuarios.foto_url como single source of truth

### Estado actual
- ✅ **FIXED:** Código modificado
- ✅ **TEST:** Prueba automatizada existe
- ✅ **VERIFIED:** 48h sin regresión en production
- ❌ **AUTO-GUARDRAIL:** No integrado aún (Fase 2)

### Cómo evitar regresión
Si se vuelve a leer foto de múltiples columnas → guardrail debe fallar.

---

## ERR-UPLOAD-002: Exercise photo Authorization header missing

**Estado:** TRIAGED  
**Fecha detectado:** 2026-08-08  
**Fecha triaged:** 2026-08-08  
**Severity:** CRITICAL  

### Síntoma
Coach intenta subir foto de ejercicio → HTTP 400  
Error: "headers must have required property authorization"  
Upload bloqueado completamente

### Categoría
`STORAGE_ERROR` · `AUTH_HEADER`

### Módulo
exercise photo upload (_uploadDoc function)

### Root Cause
La función `_uploadDoc()` (usada por exercise photos) falta el header `Authorization: Bearer +KEY`  
La función `_uploadAvatar()` (avatars) SÍ tenía el header  
Inconsistencia entre funciones hermanas → divergencia silent

### Evidencia
- **Commit:** 07e0de0e (fix: add Authorization header to exercise photo upload)
- **Files affected:**
  - panel-v2.html:14204 (headers object en _uploadDoc)
- **Error logs:** upload_diagnostics registra error_code "UPLOAD_EXERCISE_STORAGE_001" (HTTP 400)
- **Comparison:** _uploadAvatar line 14169 vs _uploadDoc line 14204

### Estado actual
- ✅ **FIXED:** Header agregado
- ✅ **TEST:** Test de autorización creado
- ✅ **VERIFIED:** 24h sin regresión, coach probó en iOS
- ❌ **AUTO-GUARDRAIL:** No integrado aún (Fase 2)

### Cómo evitar regresión
Guardrail debe verificar: si _uploadAvatar tiene Authorization, _uploadDoc TAMBIÉN debe tenerlo.

---

## ERR-UPLOAD-003: Google Photos without file extension

**Estado:** TRIAGED  
**Fecha detectado:** 2026-08-08  
**Fecha triaged:** 2026-08-08  
**Severity:** HIGH  

### Síntoma
Coach (Android tablet) selecciona foto de Google Photos  
Validador rechaza: "Usa PNG, JPG, WebP o GIF"  
Pero la foto ES un PNG/JPG válido → falso negativo

### Categoría
`FRONTEND_ERROR` · `FILE_VALIDATION`

### Módulo
exercise photo file picker (event listener en line 14286)

### Root Cause
Google Photos devuelve `File.name = ""` (extensión vacía)  
Validador extrae extensión con `fname.split(".").pop()`  
Si no hay punto → devuelve filename completo (vacío) → no matchea whitelist  
Solución: inferir extensión del MIME type si name falta

### Evidencia
- **Commit:** 73cdf7bb (fix: cross-device compatibility for exercise photo uploads)
- **Files affected:**
  - panel-v2.html:14292-14300 (validador con fallback a MIME type)
- **Environment:** Android tablets selectando desde Google Photos
- **Test:** tests/uploads/exercise.test.js#test-google-photos-no-extension

### Estado actual
- ✅ **FIXED:** Fallback a MIME type agregado
- ✅ **TEST:** Caso sin extensión probado
- ✅ **VERIFIED:** Coach Android probó, funciona
- ❌ **AUTO-GUARDRAIL:** No integrado aún (Fase 2)

### Cómo evitar regresión
Guardrail: si no hay extensión en filename pero hay MIME type, debe inferirse. No rechazar automáticamente.

---

## ERR-ENV-001: Project ref mismatch (Supabase)

**Estado:** DETECTED  
**Fecha detectado:** 2026-08-07  
**Fecha triaged:** 2026-08-08  
**Severity:** CRITICAL  

### Síntoma
Código y logs hacen referencia a project_ref `mzxgxkkgxvunpsiqbzxd`  
Pero este NO es el proyecto oficial de production  
Riesgo: requests enviados al proyecto incorrecto

### Categoría
`ENVIRONMENT_ERROR` · `INFRASTRUCTURE`

### Módulo
Supabase initialization, environment variables

### Root Cause
- [ ] TBD — Necesita auditoría completa de:
  - Variables de entorno en .env.local vs .env.production
  - Hardcoded project_refs en código
  - Mismatch entre staging/production

### Evidencia
- **Referencia:** Logs mencionan "mzxgxkkgxvunpsiqbzxd"
- **Ubicación:** TBD (auditoría pendiente)
- **Impact:** Desconocido (posible data leak o requests al proyecto equivocado)

### Estado actual
- ❌ **DETECTED:** Error identificado pero NO validado
- ❌ **TRIAGED:** Causas potenciales listadas pero no confirmadas
- ❌ **FIXED:** NO
- ❌ **VERIFIED:** NO

### Cómo evitar regresión
Crear allowlist de project_refs válidos en ENVIRONMENT_CONFIG.md  
Fase 1: Documentar proyecto oficial  
Fase 2: Guardrail que falla si se detecta project_ref no authorizado

### Nota Importante
**NO marcar como FIXED sin evidencia de auditoría completa.**  
Este error requiere confirmación manual antes de cualquier fix automático.

---

## ESTADO RESUMEN

| Error | Estado | Severity | Module | Fixed | Verified |
|-------|--------|----------|--------|-------|----------|
| ERR-UPLOAD-001 | TRIAGED | CRITICAL | avatar | ✅ | ✅ |
| ERR-UPLOAD-002 | TRIAGED | CRITICAL | exercise | ✅ | ✅ |
| ERR-UPLOAD-003 | TRIAGED | HIGH | exercise | ✅ | ✅ |
| ERR-ENV-001 | DETECTED | CRITICAL | infra | ❌ | ❌ |

---

## PRÓXIMOS PASOS

**Fase 2:**
- Integrar auto-guardrails para ERR-UPLOAD-001/002/003
- Auditoría completa de ERR-ENV-001
- Auto-test en Playwright para cada error
- Integración con CI/CD

---

*Generado: 2026-08-08*
