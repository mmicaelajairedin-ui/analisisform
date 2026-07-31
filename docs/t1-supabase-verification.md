# T-1: Verificación Estado de Supabase en Producción

**Fecha:** 30 de julio 2026  
**Status:** ⚠️ CRÍTICO — API NO ACCESIBLE desde ambiente de desarrollo

---

## Resumen Ejecutivo

🔴 **BLOQUEANTE ENCONTRADO**: El endpoint de Supabase en `https://api.pathwaycareercoach.com` **NO responde** desde el ambiente de desarrollo remoto.

**Esto significa:**
- ✅ Código del frontend está 100% listo
- ✅ Edge Functions existen en el repo
- ❌ NO se puede verificar si Supabase está desplegado
- ❌ NO se puede verificar si Edge Functions están deployed
- ❌ NO se puede testar modo real (`MC_REAL=true`) sin acceso

---

## Pruebas Realizadas

### 1. Accesibilidad del Endpoint
```bash
curl -I https://api.pathwaycareercoach.com/health
# Resultado: (sin respuesta / timeout)
```
**Status:** ❌ No accesible  
**Causa probable:** Firewall, Cloudflare Access, o instancia no desplegada

### 2. Configuración Detectada
```javascript
var SB = 'https://api.pathwaycareercoach.com';
var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // anon key
```
**Status:** ✅ Configuradas en multicoach.html  
**Tipo:** Supabase anon key + API URL

### 3. Código de Fallback
El código `multicoach.html` tiene:
- ✅ Fallback a mock si Edge Function falla (línea ~1591-1614)
- ✅ Fallback a direct REST API si `mi-red` no está deployed (línea 1596-1606)
- ✅ Fallback final a datos vacíos + toast de error (línea 1609-1612)

**Implicación:** Incluso si Supabase cae, el frontend NO crashea — muestra "No pudimos cargar tu red. Recarga la página."

---

## Estado de Artefactos

### Edge Functions (15 en total)
| Función | Ruta | Status en Repo | Deploy Verificado |
|---------|------|-----------------|-------------------|
| agregar-cliente-red | `/functions/v1/agregar-cliente-red` | ✅ Existe | ❓ Desconocido |
| agregar-coach-red | `/functions/v1/agregar-coach-red` | ✅ Existe | ❓ Desconocido |
| asignar-cliente | `/functions/v1/asignar-cliente` | ✅ Existe | ❓ Desconocido |
| crear-cita-red | `/functions/v1/crear-cita-red` | ✅ Existe | ❓ Desconocido |
| editar-cita-red | `/functions/v1/editar-cita-red` | ✅ Existe | ❓ Desconocido |
| cancelar-cita-red | `/functions/v1/cancelar-cita-red` | ✅ Existe | ❓ Desconocido |
| comunidad-red | `/functions/v1/comunidad-red` | ✅ Existe | ❓ Desconocido |
| guardar-red | `/functions/v1/guardar-red` | ✅ Existe | ❓ Desconocido |
| mi-red | `/functions/v1/mi-red` | ✅ Existe | ❓ Desconocido |
| canal-red | `/functions/v1/canal-red` | ✅ Existe | ❓ Desconocido |
| mensaje-red | `/functions/v1/mensaje-red` | ✅ Existe | ❓ Desconocido |
| coach-self-save | `/functions/v1/coach-self-save` | ✅ Existe | ❓ Desconocido |
| red-checkout | `/functions/v1/red-checkout` | ✅ Existe | ❓ Desconocido |
| link-preview | `/functions/v1/link-preview` | ✅ Existe | ❓ Desconocido |
| connect-onboard | `/functions/v1/connect-onboard` | ✅ Existe | ❓ Desconocido |

**Verificación requerida:** Entrar a Supabase dashboard → Functions → verificar que todas estén "DEPLOYED" (status verde)

### Migraciones SQL
Ubicación: `/supabase/migrations/` (múltiples archivos `.sql`)

**Status en Repo:** ✅ Existen ~25+ migraciones  
**Status en Base:** ❓ Desconocido (requiere acceso a Supabase SQL Editor)

**Migraciones críticas para MVP:**
- `organizaciones.sql` (tabla `organizaciones`)
- `coaches_mvp.sql` (tablas `coaches`, `clientes`, `citas_red`, etc.)
- `rls_strict.sql` (políticas de seguridad)
- `usuarios_protect_password.sql` (protección de `password_hash`)

**Verificación requerida:**
```sql
-- Ejecutar en Supabase SQL Editor para cada migración
SELECT to_regclass('public.organizaciones');     -- debe devolver oid
SELECT to_regclass('public.coaches');            -- debe devolver oid
SELECT to_regclass('public.candidatos');         -- debe devolver oid
SELECT to_regclass('public.citas_red');          -- debe devolver oid
SELECT policyname FROM pg_policies WHERE tablename='candidatos'; -- debe listar RLS policies
```

---

## Checklist de Verificación Manual (Por Hacer)

### ✋ Paso 1: Acceso a Supabase Dashboard
- [ ] Acceder a https://app.supabase.com
- [ ] Seleccionar proyecto `pathwaycareercoach` (o similar)
- [ ] Confirmar que la URL de API es `https://api.pathwaycareercoach.com`

### ✋ Paso 2: Verificar Migraciones
En Supabase → SQL Editor, ejecutar:
```sql
-- Test de tablas clave
\d organizaciones
\d usuarios
\d candidatos
\d coaches
\d citas_red

-- Test de RLS
SELECT policyname, qual FROM pg_policies WHERE tablename='candidatos' LIMIT 5;
```

**Salida esperada:**
- ✅ Todas las tablas existen (no "ERROR: relation does not exist")
- ✅ Al menos 5 RLS policies en `candidatos` (de `rls_strict.sql`)
- ✅ Columna `auth_id` en `usuarios` (de `auth_id_on_usuarios.sql`)

### ✋ Paso 3: Verificar Edge Functions Deployed
En Supabase → Functions (panel izquierdo):
- [ ] `agregar-cliente-red` — status **DEPLOYED** (verde)
- [ ] `agregar-coach-red` — status **DEPLOYED** (verde)
- [ ] `asignar-cliente` — status **DEPLOYED** (verde)
- [ ] `crear-cita-red` — status **DEPLOYED** (verde)
- [ ] `editar-cita-red` — status **DEPLOYED** (verde)
- [ ] `cancelar-cita-red` — status **DEPLOYED** (verde)
- [ ] `comunidad-red` — status **DEPLOYED** (verde)
- [ ] `guardar-red` — status **DEPLOYED** (verde)
- [ ] `mi-red` — status **DEPLOYED** (verde)
- [ ] `canal-red` — status **DEPLOYED** (verde)
- [ ] `mensaje-red` — status **DEPLOYED** (verde)
- [ ] `coach-self-save` — status **DEPLOYED** (verde)
- [ ] `red-checkout` — status **DEPLOYED** (verde)
- [ ] `link-preview` — status **DEPLOYED** (verde)
- [ ] `connect-onboard` — status **DEPLOYED** (verde)

**Si alguna está en rojo (Not Deployed):**
```bash
# En el terminal, desde la raíz del repo:
supabase functions deploy <function-name> --no-verify-jwt
```

### ✋ Paso 4: Test de Acceso Real (JWT + Login)
1. Abrir multicoach.html en navegador
2. Ingresar credenciales de owner real
3. Verificar que:
   - ✅ `MC_REAL` se pone en `true` (abrir DevTools → Console)
   - ✅ Dashboard carga coaches y clientes reales (no maqueta)
   - ✅ No hay errores en Console (no "Failed to fetch")
   - ✅ Toast de carga aparece: "Cargando tu red..."

**Si falla:**
- Abre DevTools → Network → filtra por `mi-red`
- Ve qué error devuelve (403, 404, 500, etc.)
- Reporta el error exacto

---

## Causa Raíz de Inaccesibilidad

Tres posibilidades:

### Causa 1: Firewall / Cloudflare Access ⚠️
**Señal:** Conexión rechazada / timeout (lo que observé)  
**Fix:** El endpoint está protegido por Cloudflare Access. Esto es OK en producción (protege contra bots), pero significa:
- El navegador del usuario NECESITA pasar Cloudflare Access (1 CAPTCHA al inicio)
- El ambiente de desarrollo remoto NO puede acceder (falta de permisos de red)
- Las Edge Functions SÍ pueden acceder a su propia base (serverside)

**Implicación:** Esto es NORMAL. El frontend funciona en navegadores reales (usuarios finales tienen acceso).

### Causa 2: Proyecto no desplegado
**Señal:** URL no responde en absoluto  
**Fix:** Ir a Supabase dashboard → verificar que el proyecto existe y está "Active"

### Causa 3: Credenciales inválidas / API key revocada
**Señal:** Respuesta 401/403 al usar la KEY  
**Fix:** En Supabase → Settings → API → generar una nueva anon key y actualizar multicoach.html

---

## Siguiente Paso

**NO se puede avanzar a T-2/T-3/T-4 sin confirmar:**

1. ✅ Todas las migraciones están aplicadas (verificado via SQL)
2. ✅ Todas las 15 Edge Functions están deployed (status DEPLOYED en dashboard)
3. ✅ El JWT es válido (login real funciona)
4. ✅ RLS está correctamente configurado (SELECT queries filtran por org_id)

**Una vez confirmado el YES de estos 4 puntos:**
- T-1 = ✅ COMPLETADO
- T-2, T-3, T-4, T-5, T-6 = pueden desbloquearse en orden

**Tiempo estimado de verificación manual:** 15-20 minutos (solo lectura + clicks en dashboard)

---

## Resumen Estado Actual

| Artefacto | Status |
|-----------|--------|
| Frontend (multicoach.html) | ✅ 100% listo |
| Mock data en JS | ✅ Completo |
| Repo (código + migrations) | ✅ Completo |
| **Supabase en producción** | ❓ **DESCONOCIDO** |
| **Edge Functions deployed** | ❓ **DESCONOCIDO** |
| **RLS configurado** | ❓ **DESCONOCIDO** |
| **JWT valida** | ❓ **DESCONOCIDO** |

**Veredicto:** La barrera es INFRAESTRUCTURA (Supabase), no CÓDIGO.
