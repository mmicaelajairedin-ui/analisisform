# EPIC 1.5: RLS Validation con JWT Real

**Estado:** 🟡 **ABIERTO (Bloqueador: Obtener JWT tokens)**  
**Fecha Init:** 2026-07-30  
**Objetivo:** Validar que RLS policies protegen correctamente el aislamiento multi-tenant

---

## 📋 Requerimiento de Validación

Confirmar que cada rol ve EXACTAMENTE lo permitido:

### Owner (dueño de org)
- ✅ Ve su organización
- ✅ Ve sus coaches
- ✅ Ve sus clientes
- ❌ NO ve otra organización
- ❌ NO ve coaches de otra org

### Coach
- ✅ Ve sus clientes asignados
- ✅ Ve info mínima de su org
- ❌ NO ve clientes sin asignación
- ❌ NO ve otra organización

### Cliente
- ✅ Ve su perfil
- ✅ Ve su coach asignado
- ❌ NO ve otros clientes
- ❌ NO ve otra organización

### Admin
- ✅ Ve TODO (todas las orgs)

---

## 🔧 Tres Opciones de Validación

### Opción A: Supabase Standard URL (⭐ RECOMENDADA)

**Ventajas:**
- Rápido (~30 min)
- No requiere cambios de config
- Script automatizado listo

**Pasos:**
1. Identificar `[project-id]` de Supabase (en Settings → General)
2. Crear 3 test users en Supabase Auth (CLI o Dashboard)
3. Ejecutar script: `EPIC_1_RLS_VALIDATION.js` con URL estándar
4. Verificar resultados JSON

**URL a usar:**
```
https://[project-id].supabase.co/auth/v1/token?grant_type=password
```

**Bloqueador actual:**
- ❌ URL custom `api.pathwaycareercoach.com` no expone `/auth/v1/token`
- ✅ Solución: Cambiar temporalmente a URL estándar o crear edge function

---

### Opción B: E2E Tests con Playwright (Más Robusta)

**Ventajas:**
- Valida UI + RLS en conjunto
- Tests reutilizables
- Parte de EPIC 2.5

**Desventajas:**
- Lento (~2-3 horas)
- Requiere mock de UI

**Pasos:**
1. Crear test data en multicoach.* (test users, coaches, clients)
2. Escribir Playwright tests que loguean cada rol
3. Verificar que solo ven datos permitidos en UI
4. Ejecutar antes de go-live

---

### Opción C: SQL Manual Testing

**Ventajas:**
- Control total
- Flexible
- Verificable directamente

**Desventajas:**
- Manual (error-prone)
- Lento (~1 hora por rol)

**Pasos:**
1. Abrir SQL Editor de Supabase
2. Para cada rol:
   ```sql
   SET LOCAL role 'owner' — simular rol
   SELECT * FROM multicoach.candidatos WHERE org_id = '...';
   ```
3. Verificar que filtra según RLS
4. Probar casos de ataque (intentar ver otra org, etc)

---

## 🎯 Recomendación: Opción A

**Por qué:**
- ✅ Script automatizado (rápido)
- ✅ Reproducible (datos claros)
- ✅ JSON output (fácil de parsear)
- ✅ Cubre todos los casos críticos
- ✅ Tiempo: 30 min vs 3 horas

**Plan de Opción A:**

### Fase 1: Setup (10 min)
```bash
# 1. Obtener project-id
# En Supabase Dashboard → Settings → General
# Ej: ddxnrsnjdvtqhxunxnwj

# 2. Crear test users en Supabase Auth
# (via CLI o Dashboard UI)
# - owner1@test.com / pwd
# - coach1@test.com / pwd
# - client1@test.com / pwd

# 3. Crear correspondencia en multicoach.usuarios
# INSERT INTO multicoach.usuarios (auth_id, email, rol, org_id, ...)
# (mapear email → auth.uid)
```

### Fase 2: Test (15 min)
```bash
# Ejecutar script
node EPIC_1_RLS_VALIDATION.js \
  --supabase-url "https://ddxnrsnjdvtqhxunxnwj.supabase.co" \
  --anon-key "eyJhbGc..." \
  --test-users-file test-users.json

# Salida: JSON con resultados por rol
# {
#   "owner": { "status": "PASS", "tests": [...] },
#   "coach": { "status": "PASS", "tests": [...] },
#   "client": { "status": "PASS", "tests": [...] }
# }
```

### Fase 3: Validación (5 min)
- ✅ owner: todos los tests PASS
- ✅ coach: solo clientes asignados PASS
- ✅ client: solo sí mismo PASS
- ✅ isolation: org1 no accede org2

---

## ⚠️ Bloqueador: Obtener JWT Tokens

**Problema:**
```
api.pathwaycareercoach.com 
  → No expone /auth/v1/token
  → No se pueden obtener JWT de URL custom
```

**Solución A (Rápida):**
Usar URL estándar Supabase temporalmente para test:
```
https://[project-id].supabase.co/auth/v1/token
```
(mismo proyecto Supabase, solo URL diferente)

**Solución B (Robusta):**
Crear edge function en Supabase que exponga token endpoint:
```typescript
// functions/get-token/index.ts
export async function POST(req) {
  const { email, password } = await req.json();
  const { data } = await supabase.auth.signInWithPassword({ email, password });
  return new Response(JSON.stringify({ access_token: data.session.access_token }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## 📊 Test Cases a Validar

### Test 1: Owner ve su org
```
Query: SELECT COUNT(*) FROM multicoach.organizaciones 
       WHERE owner_email = 'owner1@test.com'
Expected: 1
```

### Test 2: Coach ve clientes asignados
```
Query: SELECT COUNT(*) FROM multicoach.candidatos c
       WHERE c.id IN (
         SELECT client_id FROM multicoach.coach_client_assignments
         WHERE coach_id = (SELECT id FROM multicoach.usuarios WHERE email='coach1@test.com')
         AND estado='activa'
       )
Expected: 1 (client asignado)
```

### Test 3: Coach NO ve clientes sin asignación
```
Query: SELECT COUNT(*) FROM multicoach.candidatos 
       WHERE email='unassigned-client@test.com'
Expected: 0 (RLS bloquea)
```

### Test 4: Cliente ve solo sí mismo
```
Query: SELECT COUNT(*) FROM multicoach.candidatos 
       WHERE email='client1@test.com'
Expected: 1
```

### Test 5: Cliente NO ve otros clientes
```
Query: SELECT COUNT(*) FROM multicoach.candidatos 
       WHERE email='client2@test.com'
Expected: 0 (RLS bloquea)
```

### Test 6: Aislamiento de Org (CRÍTICO)
```
Query: SELECT COUNT(*) FROM multicoach.organizaciones 
       WHERE id = '[ORG-2-ID]'  (org diferente)
Expected: 0 para coach/client, 1 para owner (si es suya)
```

---

## 🚦 Criterio de Éxito

✅ **EPIC 1.5 PASSED** si:
- ✅ Owner pasa todos sus tests
- ✅ Coach pasa aislamiento (no ve clientes sin asignación)
- ✅ Cliente pasa aislamiento (no ve otros clientes)
- ✅ Admin ve TODO
- ✅ Multi-tenant 100% validado
- ✅ Reporte JSON generado

❌ **EPIC 1.5 FALLA** si:
- ❌ Coach ve clientes sin asignación
- ❌ Cliente ve otros clientes
- ❌ Role puede acceder otra org
- ❌ Cualquier fuga de datos

---

## 📝 Decisión Requerida

**Micaela decide:**

1. **Opción A** (Script automatizado — 30 min)
   - Ir directamente a validación

2. **Opción B** (E2E tests — 2-3 horas)
   - Tests reutilizables para EPIC 2.5

3. **Opción C** (Manual SQL — flexible)
   - Máximo control, mínima automatización

**Mi recomendación:** A + C
- A: Validación rápida de casos principales
- C: Pruebas manuales de attack scenarios

---

## 🔄 Timeline Sugerido

**Si Opción A:**
- Hoy: Setup + Test (45 min total)
- Mañana: Go/No-go, decisión sobre EPIC 2

**Si Opción B:**
- Hoy: Setup test data
- Mañana-día siguiente: Escritura tests
- Después: Ejecución

**Si Opción C:**
- Hoy: Manual testing de casos principales
- Mañana: Manual testing de ataques
- Después: Documentación

---

**Siguiente paso:** Decidir opción + resolver bloqueador JWT

