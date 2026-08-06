# Phase 2 Security Validation — Ejecutable

**Objetivo:** Validar que RLS + Edge Functions cierren correctamente.

**Output:** `validation-report.json` con evidencia PASS/FAIL de cada test.

---

## Preparación (5 min)

### 1. Obtener credenciales Supabase (staging)

Ir a: Supabase Dashboard → Settings → API

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Obtener IDs de test

**Opción A: Queries SQL en Supabase Editor**

```sql
-- Org de test
SELECT id FROM organizaciones LIMIT 1;
-- → TEST_ORG_ID

-- Owner user (para generar JWT luego)
SELECT id, email FROM usuarios WHERE rol='owner' AND org_id='<TEST_ORG_ID>' LIMIT 1;
-- → TEST_OWNER_EMAIL, TEST_OWNER_ID

-- Coach users
SELECT id, email FROM usuarios WHERE rol='coach' AND org_id='<TEST_ORG_ID>' LIMIT 2;
-- → TEST_COACH_ID (primer coach), TEST_OTHER_COACH_ID (segundo coach)

-- Client del coach
SELECT id FROM candidatos WHERE org_id='<TEST_ORG_ID>' AND coach_id='<TEST_COACH_ID>' LIMIT 1;
-- → TEST_CLIENT_ID

-- Otra org (para cross-org test)
SELECT id FROM organizaciones WHERE id != '<TEST_ORG_ID>' LIMIT 1;
-- → TEST_OTHER_ORG_ID (opcional)
```

```bash
export TEST_ORG_ID="00000000-0000-0000-0000-000000000001"
export TEST_COACH_ID="00000000-0000-0000-0000-000000000011"
export TEST_OTHER_COACH_ID="00000000-0000-0000-0000-000000000012"
export TEST_CLIENT_ID="00000000-0000-0000-0000-000000000021"
export TEST_OTHER_ORG_ID="00000000-0000-0000-0000-000000000002"
```

### 3. Generar JWTs de test

Supabase crea JWTs automáticamente en el dashboard (muy fácil). O usa `supabase gen jwt --secret <JWT_SECRET>`.

**Opción A: Desde Supabase Dashboard**
- Auth → Users
- Click en usuario (owner/coach)
- Copy el "User UID" 
- En navegador console:
  ```javascript
  // Login con ese user
  const { data: { session } } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password'
  });
  console.log(session.access_token); // → copy esto
  ```

**Opción B: CLI**
```bash
# Generate test JWT (expires in 1 hour, good for testing)
supabase gen jwt --secret "$(supabase secrets get JWT_SECRET)"
```

```bash
export TEST_OWNER_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export TEST_COACH_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Ejecución (2 min)

### Paso 1: Copiar script al workspace

```bash
# Ya está en scratchpad
cp scratchpad/validate-phase2.ts .
```

### Paso 2: Ejecutar tests

```bash
# Asegúrate de tener Deno instalado (https://deno.land)
# Si no: brew install deno (Mac) o scoop install deno (Windows)

deno run --allow-net --allow-env validate-phase2.ts
```

### Paso 3: Revisar salida

```
🔒 Phase 2 Security Validation

Configuration:
  Supabase URL: https://project.supabase.co
  Test Org ID: 00000000-0000-0000-0000-000000000001
  Test Coach ID: 00000000-0000-0000-0000-000000000011
  Test Client ID: 00000000-0000-0000-0000-000000000021

Starting tests...

✅ RLS_001: Owner (service role) can read all candidatos in org
✅ RLS_002: Coach (via JWT) can only read own candidatos (RLS filters)
✅ RLS_003: Coach cannot see other coach's clients (RLS blocks)
⊘ RLS_004: Skipped (TEST_OTHER_ORG_ID not set)
✅ EF_001: Edge function rejects request without JWT
✅ EF_002: Edge function rejects coach_id tampering (create cita for other coach)
✅ EF_003: Edge function rejects invalid JWT

============================================================
📊 Summary
============================================================
Total Tests: 7
✅ Passed: 6
❌ Failed: 0
Success Rate: 100%

📄 Report saved to: validation-report.json
```

---

## Report (validation-report.json)

Estructura:

```json
{
  "timestamp": "2026-08-06T10:30:00.000Z",
  "summary": {
    "total": 7,
    "passed": 6,
    "failed": 0,
    "success_rate": "100%"
  },
  "tests": [
    {
      "test_id": "RLS_001",
      "category": "RLS_READ",
      "description": "Owner (service role) can read all candidatos in org",
      "role": "owner",
      "expected_result": "ALLOW",
      "actual_result": "ALLOW",
      "status": "PASS",
      "http_status": 200,
      "request": {
        "method": "GET",
        "url": ".../rest/v1/candidatos?org_id=eq.00000000...",
        "headers_sent": { "apikey": "***" }
      },
      "response": {
        "status": 200,
        "body": { "rows": 5 }
      },
      "timestamp": "2026-08-06T10:30:00.123Z"
    },
    ...
  ]
}
```

**Interpretar:**
- `status: PASS` = test funcionó como se esperaba ✅
- `status: FAIL` = test falló (ver `block_reason`) ❌
- `expected_result: ALLOW` + `actual_result: BLOCK` = seguridad funciona
- `expected_result: BLOCK` + `actual_result: ALLOW` = VULNERABILITY (reportar inmediatamente)

---

## Tests Incluidos

| Test ID | Tipo | Qué valida | Expected | 
|---------|------|-----------|----------|
| RLS_001 | RLS_READ | Owner ve todos los candidatos | ALLOW |
| RLS_002 | RLS_READ | Coach ve solo sus candidatos (filtered by RLS) | ALLOW |
| RLS_003 | RLS_READ | Coach NO ve clientes de otro coach | BLOCK |
| RLS_004 | CROSS_ORG | Coach NO ve datos de otra org | BLOCK |
| EF_001 | EDGE_FUNCTION | Edge function rechaza JWT ausente | BLOCK |
| EF_002 | EDGE_FUNCTION | Edge function rechaza coach_id tampering | BLOCK |
| EF_003 | EDGE_FUNCTION | Edge function rechaza JWT inválido | BLOCK |

---

## Troubleshooting

### "Cannot find supabase" error
```bash
# Instala supabase CLI
brew install supabase/tap/supabase
# o: npm install -g @supabase/cli
```

### "Cannot find deno" error
```bash
# Instala Deno
curl -fsSL https://deno.land/install.sh | sh
# Añade a PATH: ~/.deno/bin
```

### "HTTP 401/403 on queries"
- Verifica que `SUPABASE_SERVICE_KEY` es correcto (es muy largo, 200+ chars)
- Verifica que `TEST_ORG_ID` existe en tu Supabase
- Verifica que el JWT no está expirado

### "RLS_002 FAIL: should_have_blocked"
Significa que el RLS NO está filtrando correctamente. Verifica:
```sql
-- En Supabase SQL Editor
SELECT * FROM pg_policies 
WHERE tablename = 'candidatos' AND policyname LIKE '%read%';
-- Debe devolver policies de READ con org_id filter
```

### "EF_002 FAIL: http_404"
Edge function no existe. Verifica:
```bash
supabase functions list
# Debe incluir: crear-cita-red, mi-red, asignar-cliente
```

---

## Criterio de Cierre Phase 2

✅ **Phase 2 CIERRA cuando:**
- All 7 tests = PASS (o 6 PASS si RLS_004 es SKIPPED)
- No FAIL status
- Success rate ≥ 85%
- Todos los block_reasons son válidos (rls_filtered, tampering_detected, etc.)

❌ **Phase 2 BLOQUEADA si:**
- Cualquier test FAIL
- `expected_result: BLOCK` pero `actual_result: ALLOW` (security issue)
- HTTP 500+ errors

---

## Siguiente Paso

Una vez que validation-report.json muestra 100% PASS:

1. Guardar el report en git
2. Cerrar Phase 2 formalmente
3. **ENTONCES:** Priority 2 — Diseño System aplicado sobre multicoach.html real
   - Auditar componentes
   - Aplicar Lucide icons
   - Unificar colores + typography
   - Resultado: cambios visuales concretos en el producto

---

## Archivo de Salida

```bash
# Report JSON (para documentación / audit trail)
cat validation-report.json | jq '.summary'

# Output esperado:
# {
#   "total": 7,
#   "passed": 6,
#   "failed": 0,
#   "success_rate": "100%"
# }
```

Cuando tengas el report con 100% PASS, compartí el resultado y cerramos Phase 2 ✅
