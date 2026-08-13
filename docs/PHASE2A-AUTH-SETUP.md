# Phase 2A Auth Infrastructure — Setup Completo

**Fecha:** 2026-08-13  
**Estado:** ✅ Infraestructura lista. Tests estáticos PASS. E2E pendiente.

---

## 📋 Resumen

La infraestructura de autenticación para validar los 7 endpoints Phase 2A está **completa y cableada**. El flujo:

1. ✅ **Inicializar Supabase client** con anon key
2. ✅ **Renovar sesión** con refresh token (flow official de Supabase v2.112.1)
3. ✅ **Obtener access_token** del session renovada
4. ✅ **Usar Bearer token** en Authorization header para POST requests
5. ✅ **Validar respuestas** según contratos definidos
6. ✅ **Sin secretos** en logs (tokens siempre ocultos)
7. ✅ **Sin bypasses** (sin service_role, email/password, JWT manual)

---

## ✅ QUÉ ESTÁ COMPLETO

### 1. Scripts de Testing

**`scripts/phase2a-real-tests-run.cjs`** (368 líneas)
- ✅ Inicializa Supabase con `@supabase/supabase-js` v2.112.1
- ✅ Implementa `refreshAuthSession()` usando API oficial
- ✅ **6 unit tests estáticos** — valida infraestructura sin E2E
  - Supabase client inicializado
  - Variables y endpoints configurados
  - Contratos de respuesta definidos
  - Seguridad (no imprime secretos)
- ✅ **7 E2E tests** (desactivados sin refresh token) — POST HTTP a los 7 endpoints
  - CREATE_COACH → `/agregar-coach-red`
  - CREATE_CLIENT → `/agregar-cliente-red`
  - EDIT_COACH → `/editar-coach-red`
  - EDIT_CLIENT → `/editar-cliente-red-index-ts`
  - DELETE_COACH → `/eliminar-coach-red`
  - DELETE_CLIENT → `/eliminar-cliente-red-index-ts-`
  - REASSIGN_CLIENT → `/asignar-cliente`

**`scripts/phase2a-test-auth-flow.cjs`** (280 líneas)
- ✅ 7 unit tests de infraestructura
- ✅ Valida que TODO está cableado correctamente
- ✅ NO ejecuta E2E real (solo validación estática)
- ✅ Exit 0 si TODO está OK

### 2. Workflow de GitHub Actions

**`.github/workflows/phase2a-real-tests.yml`**
- ✅ Job `infrastructure` — ejecuta unit tests
  - No necesita secrets
  - Valida que el cableado está correcto
- ✅ Job `tests` — ejecuta E2E real (si refresh token disponible)
  - Recibe `PATHWAY_SUPABASE_ANON_KEY` del secret
  - Recibe `PATHWAY_TEST_OWNER_A_REFRESH_TOKEN` del secret
  - Ejecuta el runner
- ✅ Upload de resultados como artifact

### 3. Endpoints Confirmados

Los **7 endpoints reales** en Supabase (con nombres exactos incluyendo sufijos):

```
POST https://api.pathwaycareercoach.com/functions/v1/agregar-coach-red
POST https://api.pathwaycareercoach.com/functions/v1/agregar-cliente-red
POST https://api.pathwaycareercoach.com/functions/v1/editar-coach-red
POST https://api.pathwaycareercoach.com/functions/v1/editar-cliente-red-index-ts
POST https://api.pathwaycareercoach.com/functions/v1/eliminar-coach-red
POST https://api.pathwaycareercoach.com/functions/v1/eliminar-cliente-red-index-ts-
POST https://api.pathwaycareercoach.com/functions/v1/asignar-cliente
```

---

## ⏳ CONFIGURACIÓN PARA EJECUTAR E2E REAL

### Paso 1: Obtener Refresh Token

**Opción A — Desde el navegador** (recomendado):
1. Abre https://pathwaycareercoach.com/login.html
2. Login como propietario de test (owner del org)
3. Abre DevTools → Application → Local Storage
4. Copia el valor de `sb-ddxnrsnjdvtqhxunxnwj-auth-token`
4. Parsea como JSON y extrae `refresh_token`

**Opción B — Desde un script Node** (para automatizar):
```javascript
const { createClient } = require('@supabase/supabase-js');
const client = createClient(
  'https://ddxnrsnjdvtqhxunxnwj.supabase.co',
  'ANON_KEY'
);

// Después del login real:
const { data } = await client.auth.getSession();
console.log('Refresh token:', data.session.refresh_token);
```

### Paso 2: Configurar en GitHub

1. Ve a **Settings → Secrets and variables → Actions**
2. Crea `PATHWAY_TEST_OWNER_A_REFRESH_TOKEN` con el valor
3. Crea `PATHWAY_SUPABASE_ANON_KEY` con la anon key del proyecto

### Paso 3: Ejecutar Tests

```bash
# Local (con env vars):
export PATHWAY_SUPABASE_URL="https://ddxnrsnjdvtqhxunxnwj.supabase.co"
export PATHWAY_SUPABASE_ANON_KEY="eyJ..."
export PATHWAY_TEST_OWNER_A_REFRESH_TOKEN="eyJ..."
node scripts/phase2a-real-tests-run.cjs

# En GitHub Actions:
# El workflow ya está configurado. Push a main o dispara manualmente:
# Actions → Phase 2A Real Tests → Run workflow
```

---

## 📊 TESTS ESTATICOS — RESULTADOS

```
✅ Test 1: Script runner existe y tiene estructura
✅ Test 2: Endpoints exactos registrados (7)
✅ Test 3: No imprime secretos en logs
✅ Test 4: Flujo de autenticación completo (5 pasos)
✅ Test 5: No usa bypass ni service_role
✅ Test 6: Workflow GitHub Actions configurado
✅ Test 7: runUnitTests es completamente estático

📊 Results: 7/7 PASS, 0/7 FAIL
```

---

## 🔐 SEGURIDAD — Checklist

- ✅ Tokens NUNCA se imprimen en console.log
- ✅ Usa Supabase Auth API oficial (`refreshSession`)
- ✅ Bearer token en Authorization header
- ✅ NO usa service_role
- ✅ NO usa email/password
- ✅ NO genera JWT manualmente
- ✅ NO hace bypass de autenticación
- ✅ Validaciones de env claras (error si falta anon key)

---

## 🚀 SIGUIENTE PASO

Una vez que tengas el refresh token configurado en GitHub:

1. Push del branch actual a `main` (o cualquier rama)
2. El workflow automático ejecutará:
   - Job `infrastructure` → 7 unit tests → ~2s
   - Job `tests` → 7 E2E tests → ~15s
3. Resultados en Actions → Phase 2A Real Tests

**Tiempo total esperado:** ~20s

---

## 📝 NOTAS

- El runner distingue entre `runUnitTests()` (estático) y `runE2ETests()` (real HTTP)
- Sin refresh token, SOLO corre unit tests (exit 0)
- Con refresh token, corre unit tests + E2E tests
- Cada test E2E es independiente (si uno falla, los otros continúan)
- Los secrets NUNCA se imprimen (validado por tests de seguridad)
