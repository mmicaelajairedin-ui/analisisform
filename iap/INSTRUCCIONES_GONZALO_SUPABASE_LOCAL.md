# Supabase Local para Testing IAP — Instrucciones para Gonzalo

**Objetivo:** Levantar backend IAP localmente en Mac sin tocar producción ni incurrir costos.

---

## 1. Prerequisitos

- **macOS** con Docker Desktop instalado (o Colima)
- **Node.js** 18+ y npm
- **Git** (repositorio `analisisform` ya clonado)

---

## 2. Instalar Supabase CLI

En macOS con Homebrew:

```bash
brew install supabase/tap/supabase
```

Verificar:
```bash
supabase --version  # Debería salir v1.x.x
```

(Si usas otra plataforma: https://supabase.com/docs/guides/cli/getting-started)

---

## 3. Configurar config.toml (deshabilitar migraciones temporalmente)

**ANTES de levantar Supabase**, edita `supabase/config.toml`:

```toml
[db.migrations]
enabled = false  # Cambiar a false temporalmente
```

Esto evita que las migraciones corro automáticamente en `supabase start`. Gonzalo las ejecutará manualmente después del bootstrap.

---

## 4. Levantar Supabase Local

En el directorio raíz del repositorio `analisisform`:

```bash
# Inicializar (si es la primera vez)
supabase init

# Levantar contenedores Docker + DB local (sin ejecutar migraciones)
supabase start
```

**Salida esperada:**
```
Started supabase local development server.

API URL: http://localhost:54321
Anon Key: eyJhbGc...
Service Role Key: eyJhbGc...
```

**Anotar estas credenciales** — se usarán en los pasos siguientes.

---

## 5. Bootstrap Local (crear tabla usuarios base)

**IMPORTANTE: Este paso se ejecuta UNA SOLA VEZ al inicio, DESPUÉS de `supabase start` y ANTES de las migraciones**

```bash
# Espera ~30 segundos después de `supabase start` para que la DB esté lista
psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/bootstrap_local.sql
```

**Qué hace:**
- Crea tabla base `usuarios` con índices
- (auth schema, auth.users, auth.uid(), y roles ya existen en Supabase)

**Salida esperada:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
COMMENT
 status
────────────────────────────────────────────
 Bootstrap complete: usuarios table created for local testing
```

---

## 6. Aplicar Migraciones IAP

```bash
# Después del bootstrap, habilita migraciones nuevamente
# En supabase/config.toml, cambiar [db.migrations] enabled = true

# Luego aplica las migraciones pendientes (NO reset, que borraría usuarios)
supabase migration up
```

Esto ejecutará:
- **`supabase/migrations/20261001_iap_subscriptions.sql`** — Crea tabla `usuarios_suscripciones_iap` (FK a usuarios funciona)

**⚠️ IMPORTANTE:** Usar `migration up`, NO `db reset`. El reset recrea toda la BD, borrando la tabla usuarios que acabas de crear.

**✅ Seguridad en Producción:**
- `bootstrap_local.sql` está FUERA de `supabase/migrations/`
- `supabase db push` lo ignora completamente (nunca ve este archivo)
- Es solo para desarrollo local
- No se mergea a `main` (ya está en rama `claude/iap-local-testing`)

**Verificar en pgAdmin local** (opcional):
- URL: http://localhost:54323
- Usuario: postgres
- Contraseña: postgres
- Base de datos: postgres
- Tabla: `usuarios_suscripciones_iap` (debería existir con indexes + RLS)

---

## 7. Configurar Secretos para Edge Functions Locales

Crear archivo `.env.local` **en la raíz del proyecto** (`analisisform/.env.local`):

```bash
# Credenciales Supabase (se obtienen de `supabase start`)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<copiar de supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<copiar de supabase start output>

# Secretos Apple — Micaela proporciona credenciales REALES de Sandbox (ver sección 5B abajo)
APPLE_ISSUER_ID=<Issuer ID de Micaela (App Store Connect)>
APPLE_KEY_ID=<Key ID de In-App Purchase de Micaela>
APPLE_PRIVATE_KEY_P8=<Contenido del .p8 proporcionado por Micaela>
APPLE_BUNDLE_ID=com.pathwaycareercoach.twa
APPLE_ENVIRONMENT=sandbox
```

**IMPORTANTE:**
- Este archivo `.env.local` está **gitignored** (no se sube a Git)
- Los valores de Apple son **reales**, no ficticios — `check-entitlement` llama a Apple Sandbox API
- **Nunca pegues claves privadas en chat** — Micaela proporciona las credenciales desde su cuenta App Store Connect
- Sin Paid Apps Agreement en la cuenta de Micaela, no se pueden hacer compras sandbox reales (ver limitaciones en sección 10)

### 7B. Obtener Credenciales Apple Sandbox (Micaela autoriza)

Gonzalo solicita a Micaela las credenciales de Sandbox desde su cuenta App Store Connect:

1. **Micaela accede a App Store Connect**
2. **Users and Access → Integrations**
3. **In-App Purchase** → Obtiene API key (o genera nueva si no existe)
4. **Descarga .p8 file** (contiene la clave privada)
5. **Proporciona a Gonzalo:**
   - `APPLE_ISSUER_ID` = Issuer ID (visible en el dashboard)
   - `APPLE_KEY_ID` = Key ID (visible en el dashboard, 10 caracteres)
   - `APPLE_PRIVATE_KEY_P8` = Contenido completo del archivo .p8

**Nota:** Estas credenciales son privadas de la cuenta de Micaela. No se comparten públicamente; solo Gonzalo las recibe via canal privado.

---

## 8. Ejecutar Edge Functions Localmente

En otra terminal (desde `analisisform/`):

```bash
supabase functions serve
```

**Salida esperada:**
```
Serving functions on http://localhost:54321/functions/v1
```

Las tres funciones están disponibles:
- `http://localhost:54321/functions/v1/validate-iap` (POST)
- `http://localhost:54321/functions/v1/check-entitlement` (POST)
- `http://localhost:54321/functions/v1/apple-iap-webhook` (POST)

---

## 9. Configurar App iOS para Apuntar a Backend Local

**En Xcode (Gonzalo):**

1. Obtener IP LAN del Mac:
   ```bash
   # En la terminal del Mac
   ifconfig | grep "inet " | grep -v 127.0.0.1
   # Algo como: inet 192.168.1.50
   ```

2. En la app iOS, cambiar endpoint de desarrollo:
   ```swift
   let baseURL = ProcessInfo.processInfo.environment["IAP_API_URL"] ?? 
                 "http://192.168.1.50:54321"  // Reemplazar con tu IP
   ```

3. O usar configuración de Build:
   - Scheme → Edit Scheme → Run → Arguments Passed On Launch
   - Agregar: `-com.pathwaycareercoach.iap_api_url http://192.168.1.50:54321`

**Verificar conectividad:**
```bash
# Desde iPhone en mismo wifi
curl http://192.168.1.50:54321/functions/v1/validate-iap
# Debería retornar un error HTTP (esperado, sin JWT)
```

---

## 10. TIER 1 Testing — 5 Pruebas Locales (Sin Apple Sandbox)

**Precondición crítica**: Verificar que Supabase CLI está configurado SOLO para local:
```bash
supabase status
# NO debe mostrar "project-ref" ni "linked to project"
# Debe mostrar "API running on http://localhost:54321"
```

**NUNCA ejecutar `supabase db push`, `supabase functions deploy --project-ref`, ni ningún comando con `--linked` o `--project-ref`.**

### Test 1: JWT Inválido — Verificar DB Intacta

**Acción:**
```bash
# Contar filas ANTES
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT COUNT(*) FROM usuarios_suscripciones_iap;"

# POST sin JWT válido
curl -X POST http://localhost:54321/functions/v1/validate-iap \
  -H "Authorization: Bearer invalid-token-12345" \
  -H "Content-Type: application/json" \
  -d '{}' \
  > /tmp/test1-response.txt

# Contar filas DESPUÉS
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT COUNT(*) FROM usuarios_suscripciones_iap;"
```

**Resultados esperados:**
- HTTP 401 Unauthorized (en /tmp/test1-response.txt)
- Conteo de filas antes = conteo después (DB intacta)
- Mensaje: "Unauthorized"

**Guarda:**
- `/tmp/test1-response.txt` (respuesta HTTP)
- Screenshot del conteo de filas antes/después

---

### Test 2: JWS Alterado — Firma Criptográfica Rechazada

**Acción:**
```bash
# Generar JWT válido
JWT=$(supabase auth admin create-user \
  --email test-jws@example.com \
  --password TestPassword123! | jq -r '.user_id')

# JWS válido de prueba (firmado localmente con clave de prueba)
# Para esta prueba, usar un JWS que tenga estructura válida pero firma alterada
JWS_VALID="eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlCWVRDQ0FRZWdBd0lCQWdJUldQLzBZMENFb0JRRExJQUFBQUhpcVFBQ0J4UjBFQkd3Y2tCR0Z3Z1lJQkJ4UjBFQkd3Y2tCR0Z3Z1lJQkJTVEZRTUI0WERUSXhNVE13TmpNeU5ESTBOMlYzQkE0eENqQUtCZ2dxa2hraUc5dzBCQlRVeFFEQitCQkJZMENFb0JRRExJQUFBQUhpcVFBQ0J4UjBFQkd3Y2tCR0Z3Z1lJQkJTVEZRTUI0WERUSXhNVE13TmpNeU5ESTBOMlYzQkE0eENqQktCZ1lxV2tJRlx1MDAzZDNCRjRwLFtdXX0="
JWS_TAMPERED="${JWS_VALID:0:-20}abcdefghij1234567890"  # Cambiar últimos 20 chars

# POST con JWS alterado
curl -X POST http://localhost:54321/functions/v1/check-entitlement \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"receipt\": \"$JWS_TAMPERED\", \"appAccountToken\": \"$JWT\"}" \
  > /tmp/test2-response.txt

cat /tmp/test2-response.txt
```

**Resultados esperados:**
- HTTP 400 Bad Request
- Mensaje contiene "signature verification" (NO "JSON parse error" ni "format error")
- DB sin nuevas filas

**Guarda:**
- `/tmp/test2-response.txt`
- Confirmar en el message que dice "signature" (no "format")

---

### Test 4: Idempotencia — 3 Webhooks, 1 Row

**Acción:**
```bash
# Crear usuario local de prueba
JWT=$(supabase auth admin create-user \
  --email test-webhook@example.com \
  --password TestPassword123! | jq -r '.user_id')

# Notification UUID (ficticio, consistente para las 3 pruebas)
NOTIF_UUID="12345678-1234-5678-abcd-ef0123456789"

# Payload de webhook (estructura simple para local)
PAYLOAD='{
  "notificationType": "DID_CHANGE_RENEWAL_STATUS",
  "notificationUUID": "'$NOTIF_UUID'",
  "data": {
    "original_transaction_id": "test-tx-001",
    "user_id": "'$JWT'",
    "state": "active"
  }
}'

# Test 4.1: Primer webhook
echo "=== Test 4.1: Primer webhook ===" 
curl -X POST http://localhost:54321/functions/v1/apple-iap-webhook \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" > /tmp/test4-1.txt

psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT COUNT(*) FROM usuarios_suscripciones_iap WHERE latest_notification_uuid = '$NOTIF_UUID';" \
  > /tmp/test4-1-count.txt

# Test 4.2: Segundo webhook (mismo UUID)
echo "=== Test 4.2: Segundo webhook (idempotent) ===" 
curl -X POST http://localhost:54321/functions/v1/apple-iap-webhook \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" > /tmp/test4-2.txt

psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT COUNT(*) FROM usuarios_suscripciones_iap WHERE latest_notification_uuid = '$NOTIF_UUID';" \
  > /tmp/test4-2-count.txt

# Test 4.3: Tercero webhook (mismo UUID)
echo "=== Test 4.3: Tercer webhook (idempotent) ===" 
curl -X POST http://localhost:54321/functions/v1/apple-iap-webhook \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" > /tmp/test4-3.txt

psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT COUNT(*) FROM usuarios_suscripciones_iap WHERE latest_notification_uuid = '$NOTIF_UUID';" \
  > /tmp/test4-3-count.txt
```

**Resultados esperados:**
- Test 4.1: HTTP 200, count = 1
- Test 4.2: HTTP 200, count = 1 (NO duplicado)
- Test 4.3: HTTP 200, count = 1 (NO duplicado)

**Guarda:**
- `/tmp/test4-*.txt` (respuestas HTTP)
- `/tmp/test4-*-count.txt` (conteos de DB)

---

### Test 5: Transiciones de Estado — Evento Antiguo NO Revierte

**Acción:**
```bash
# Crear usuario de prueba
JWT=$(supabase auth admin create-user \
  --email test-transition@example.com \
  --password TestPassword123! | jq -r '.user_id')

# INSERT manual: estado "active" con timestamp reciente
psql postgresql://postgres:postgres@localhost:54322/postgres -c "
INSERT INTO usuarios_suscripciones_iap (
  usuario_id, original_transaction_id, state, updated_at, last_notification_at
) VALUES (
  '$JWT', 'test-tx-transition', 'active', 
  NOW(), NOW()
) ON CONFLICT (original_transaction_id) DO NOTHING;
"

# Verificar estado ANTES
echo "=== ANTES ===" 
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT state, updated_at FROM usuarios_suscripciones_iap WHERE original_transaction_id = 'test-tx-transition';" \
  > /tmp/test5-before.txt

# POST webhook con evento ANTIGUO (2 minutos atrás)
OLD_TIMESTAMP=$(date -d "2 minutes ago" -u +"%Y-%m-%dT%H:%M:%SZ")
curl -X POST http://localhost:54321/functions/v1/apple-iap-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "notificationType": "EXPIRED",
    "notificationUUID": "old-event-uuid",
    "data": {
      "original_transaction_id": "test-tx-transition",
      "state": "expired",
      "signedDate": "'$OLD_TIMESTAMP'"
    }
  }' > /tmp/test5-webhook.txt

# Verificar estado DESPUÉS
echo "=== DESPUÉS ===" 
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT state, updated_at FROM usuarios_suscripciones_iap WHERE original_transaction_id = 'test-tx-transition';" \
  > /tmp/test5-after.txt
```

**Resultados esperados:**
- Estado ANTES: "active"
- Webhook: HTTP 200 (se procesa pero no modifica estado)
- Estado DESPUÉS: "active" (SIN CAMBIAR)

**Guarda:**
- `/tmp/test5-before.txt` y `/tmp/test5-after.txt` (estado DB)
- `/tmp/test5-webhook.txt` (respuesta del webhook)
- Confirmar que son iguales (o que el timestamp del webhook es ignorado)

---

### Test 6a: E2E Simulado (Sin Apple Real)

**Acción:**
```bash
# Crear usuario
JWT=$(supabase auth admin create-user \
  --email test-e2e@example.com \
  --password TestPassword123! | jq -r '.user_id')

echo "JWT: $JWT"

# Step 1: validate-iap
echo "=== Step 1: validate-iap ===" 
curl -X POST http://localhost:54321/functions/v1/validate-iap \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{}' > /tmp/test6-step1.txt

APP_ACCOUNT_TOKEN=$(cat /tmp/test6-step1.txt | jq -r '.appAccountToken')
echo "appAccountToken: $APP_ACCOUNT_TOKEN"

# Step 2: check-entitlement con JWS de prueba
echo "=== Step 2: check-entitlement ===" 
curl -X POST http://localhost:54321/functions/v1/check-entitlement \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "receipt": "test-jws-payload",
    "appAccountToken": "'$APP_ACCOUNT_TOKEN'"
  }' > /tmp/test6-step2.txt

# Step 3: Verificar DB
echo "=== Step 3: DB state ===" 
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT usuario_id, product_id, state FROM usuarios_suscripciones_iap LIMIT 5;" \
  > /tmp/test6-step3.txt
```

**Resultados esperados:**
- Step 1: HTTP 200, appAccountToken = JWT
- Step 2: HTTP 400 (JWS inválido es esperado en test local)
- Step 3: DB puede o no tener nuevas filas (depende de Step 2)

**Guarda:**
- `/tmp/test6-step*.txt`

---

## 11. Flujo de Testing Local (ANTIGUO — referencia)

### 8.1 Pre-Purchase: Generar appAccountToken

```bash
# Obtener JWT local
JWT=$(supabase auth admin create-user \
  --email test@example.com \
  --password TestPassword123! | jq -r '.user_id')

# Llamar validate-iap
curl -X POST http://localhost:54321/functions/v1/validate-iap \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json"
# Retorna: { "ok": true, "appAccountToken": "<uuid>" }
```

### 8.2 Post-Purchase: Verificar Entitlement

En iOS (StoreKit 2 Sandbox):
1. Usuario inicia compra
2. StoreKit retorna `receipt` (JWS firmado por Apple Sandbox)
3. App envía a `check-entitlement`:

```bash
curl -X POST http://localhost:54321/functions/v1/check-entitlement \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "receipt": "<JWS_de_StoreKit>",
    "appAccountToken": "<uuid_generado_en_8.1>"
  }'
# Retorna: { "ok": true, "access": true, "plan": "basic" }
```

### 8.3 Webhook: Test Payload Firmado

**Nota:** Apple webhooks no pueden alcanzar `localhost`. Para testing:
- Opción A: Usar payload de prueba firmado localmente (ver sección 9)
- Opción B: Saltarse webhook en sandbox, probar solo con `check-entitlement`
- Opción C: Usar `ngrok` para exponer localhost a internet (avanzado)

---

## 11. Testing sin Webhooks Reales (Fallback para localhost)

Crear script `test-webhook-local.sh`:

```bash
#!/bin/bash

# Payload de prueba con firma ficticia (no es válida para producción)
PAYLOAD='{
  "notificationType": "SUBSCRIBED",
  "notificationUUID": "12345678-1234-5678-abcd-ef0123456789",
  "data": {
    "signedTransactionInfo": "...",
    "signedRenewalInfo": "..."
  }
}'

# Enviar a webhook local (sin validar firma, solo probar lógica)
curl -X POST http://localhost:54321/functions/v1/apple-iap-webhook \
  -H "Content-Type: application/json" \
  -d "{ \"notification\": $PAYLOAD }"
```

**Importante:** Esta es una prueba de LÓGICA, no de seguridad. La firma real de Apple solo se valida en `check-entitlement`.

---

## 12. Limpiar y Parar

```bash
# Detener servicios locales
supabase stop

# Resetear base de datos (borra todo)
supabase db reset

# Eliminar contenedores Docker
docker-compose down
```

---

## Limitaciones Conocidas

⚠️ **Webhooks de Apple no pueden alcanzar localhost:**
- Apple no puede enviar notificaciones a `http://localhost:54321`
- Renovación automática no se prueba en local (requiere URL pública)
- Usar payloads firmados simulados para testing de lógica webhook

⚠️ **check-entitlement requiere Paid Apps Agreement (en la cuenta de Micaela):**
- `check-entitlement` llama a Apple Sandbox API con credenciales de Micaela
- Sin Paid Apps Agreement en la cuenta App Store Connect de Micaela, no se pueden hacer compras sandbox reales
- Alternativa: probar solo la validación de estructura (sin llamada a Apple)

✅ **Lo que SÍ se prueba completamente en local:**
- Validación de JWT (pre-purchase con `validate-iap`)
- Validación de JWS (post-purchase con `check-entitlement` + credenciales Apple reales)
- Persistencia en DB local
- RLS policies
- Lógica de idempotencia webhook
- Manejo de errores

---

## Checklist Final

- [ ] Supabase CLI instalado (`brew install supabase/tap/supabase`)
- [ ] `supabase start` ejecutándose sin errores
- [ ] Migraciones aplicadas (base usuarios + IAP)
- [ ] `.env.local` creado con credenciales Apple Sandbox **reales** (de App Store Connect)
- [ ] `supabase functions serve` ejecutándose
- [ ] iPhone conectado al wifi local del Mac
- [ ] App iOS apunta a `http://192.168.x.x:54321`
- [ ] Prueba de conectividad exitosa (curl desde iPhone)
- [ ] Test pre-purchase exitoso (appAccountToken generado)
- [ ] **Test post-purchase:** requiere Paid Apps Agreement + compra sandbox real

---

## Preguntas / Bloqueadores

Si algo falla:

1. **Error de Docker:** `supabase start` no levanta
   - Verificar Docker Desktop en ejecución
   - `docker ps` debería mostrar contenedores

2. **JWT no se genera:** `supabase auth admin create-user` falla
   - Verificar que `supabase start` haya creado servicio auth
   - Esperar 10 segundos después de `supabase start`

3. **iPhone no alcanza Mac:**
   - Verificar que ambos están en mismo wifi
   - Reemplazar IP correctamente en app iOS
   - `ping 192.168.x.x` desde iPhone

4. **Función no encuentra secretos:**
   - Verificar `.env.local` está en raíz del proyecto
   - `supabase functions serve` debe estar en nueva terminal
   - Reiniciar `supabase functions serve` después de cambiar `.env.local`

---

**Contacto:** Si hay dudas, escribir en el thread del proyecto.

---

# DEPLOY A PRODUCCIÓN — Runbook para Micaela

**Estado:** ⏸️ **NO DESPLEGAR AÚN.** Esperando confirmación explícita de Micaela.

**Requisitos previos antes de ejecutar:**
1. Todas las correcciones de código (Swift + JS) están en rama `claude/project-thread-2z7kdw` y mergeadas a `main`
2. Supabase CLI instalado localmente: `supabase --version`
3. Acceso autenticado: `supabase projects list` debe mostrar `analisisform` (proyecto de producción)
4. Testing local completado (si aplica)

---

## Paso 1: Aplicar Migración a Producción

**Comando (ejecutar desde raíz del repositorio):**

```bash
supabase db push --project-ref ddxnrsnjdvtqhxunxnwj
```

**Qué hace:**
- Detecta `supabase/migrations/20261001_iap_subscriptions.sql` (nunca antes aplicada a producción)
- Aplica la migración idempotente en la tabla `public`
- Crea:
  - Tabla `usuarios_suscripciones_iap` (con FK a `usuarios.id`)
  - Índices (usuario_id, app_account_token, product_id, state, expires_at)
  - RLS policies (SELECT/UPDATE para service_role, restrictivo para anon/authenticated)
  - Columnas: usuario_id, original_transaction_id, app_account_token, product_id, state, expires_at, created_at, updated_at, latest_notification_uuid, notification_count

**Salida esperada:**
```
Pushing migrations to analisisform (ddxnrsnjdvtqhxunxnwj)...
Staging migrations...
  [20261001_iap_subscriptions.sql]
Applying migrations...
✓ 20261001_iap_subscriptions
```

**Verificación (post-deploy):**
```bash
supabase db remote diff --project-ref ddxnrsnjdvtqhxunxnwj | head -20
# Debería estar vacío (no hay cambios pendientes)
```

---

## Paso 2: Desplegar 3 Edge Functions a Producción

**Comando (ejecutar secuencialmente desde raíz):**

```bash
# 1. validate-iap
supabase functions deploy validate-iap --project-ref ddxnrsnjdvtqhxunxnwj

# 2. check-entitlement
supabase functions deploy check-entitlement --project-ref ddxnrsnjdvtqhxunxnwj

# 3. apple-iap-webhook
supabase functions deploy apple-iap-webhook --project-ref ddxnrsnjdvtqhxunxnwj
```

**Salida esperada (para cada una):**
```
Deploying function 'validate-iap'...
✓ Function deployed at https://api.pathwaycareercoach.com/functions/v1/validate-iap
```

**Verificación (post-deploy):**
```bash
supabase functions list --project-ref ddxnrsnjdvtqhxunxnwj | grep -E "(validate-iap|check-entitlement|apple-iap-webhook)"
# Debería mostrar 3 funciones en status "ACTIVE"
```

---

## Paso 3: Configurar Secretos en Producción

**Prerequisitos:**
- Micaela debe tener credenciales Apple Sandbox/Production de App Store Connect
- No compartir claves privadas en chat (comunicación privada/segura)

**Comando para cada secreto (ejecutar desde raíz):**

```bash
supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_ISSUER_ID="<issuer_id_de_Micaela>"

supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_KEY_ID="<key_id_de_Micaela>"

supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_PRIVATE_KEY_P8="<contenido_del_p8_de_Micaela>"

supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_BUNDLE_ID="com.pathwaycareercoach.twa"

supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_ENVIRONMENT="sandbox"  # Cambiar a "production" solo cuando se lance a App Store
```

**Lista completa de secretos requeridos:**
| Secreto | Descripción | Origen | Requerido |
|---------|-------------|--------|----------|
| `APPLE_ISSUER_ID` | Issuer ID de App Store Connect | Micaela (App Store Connect) | ✅ |
| `APPLE_KEY_ID` | Key ID de In-App Purchase (10 chars) | Micaela (App Store Connect) | ✅ |
| `APPLE_PRIVATE_KEY_P8` | Clave privada P8 (líneas sin saltos) | Micaela (descarga .p8) | ✅ |
| `APPLE_BUNDLE_ID` | Bundle ID de la app (com.pathway...) | Fijo en código | ✅ |
| `APPLE_ENVIRONMENT` | "sandbox" o "production" | Controlado por desplegador | ✅ |
| `SUPABASE_URL` | Auto (variables de entorno de Supabase) | Sistema | ✅ Auto |
| `SUPABASE_ANON_KEY` | Auto | Sistema | ✅ Auto |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Sistema | ✅ Auto |

**Verificación:**
```bash
supabase secrets list --project-ref ddxnrsnjdvtqhxunxnwj
# Debería mostrar 5 secretos (APPLE_* + BUNDLE_ID)
```

---

## Paso 4: Habilitar Workflow de Deploy en GitHub

**IMPORTANTE:** El workflow de deploy en CI está **deshabilitado** (paso de deploy comentado en `.github/workflows/`).

**Para habilitar (Micaela autoriza):**

1. Abrir `.github/workflows/deploy-iap-functions.yml` (si existe) o el workflow relevante
2. Buscar la línea con condición de deploy:
   ```yaml
   - name: Deploy IAP Functions
     if: false  # ← Cambiar a `if: github.ref == 'refs/heads/main'`
   ```
3. Cambiar `if: false` a `if: github.ref == 'refs/heads/main'`
4. Commit + push a `main`
5. El próximo push a `main` ejecutará el deploy automáticamente

**Alternativa (sin workflow):**
Ejecutar manualmente los pasos 1-3 desde terminal (no depende de CI).

---

## Rollback — Reversión de Cambios

**⚠️ IMPORTANTE:** Una vez desplegados, los cambios son en VIVO. El rollback debe ser planeado.

### Opción A: Revertir Función (rápido, recomendado)

```bash
# Desplegar versión anterior desde rama/commit anterior
git checkout <commit_anterior_antes_de_iap>
supabase functions deploy validate-iap --project-ref ddxnrsnjdvtqhxunxnwj
# Repetir para check-entitlement y apple-iap-webhook
```

### Opción B: Deshabilitar Función (sin revertir código)

```bash
# Eliminar función (deja la tabla intacta)
supabase functions delete validate-iap --project-ref ddxnrsnjdvtqhxunxnwj
supabase functions delete check-entitlement --project-ref ddxnrsnjdvtqhxunxnwj
supabase functions delete apple-iap-webhook --project-ref ddxnrsnjdvtqhxunxnwj
```

**Consecuencia:** Las apps iOS verán errores 404 al llamar a las funciones. Clientes en la pantalla de compra no podrán proceder (fallback a Stripe).

### Opción C: Revertir Migración (máximo cuidado)

```bash
# Crear migración de reversión (manual)
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_rollback_iap.sql
# Contenido: DROP TABLE IF EXISTS usuarios_suscripciones_iap CASCADE;
# Luego: supabase db push
```

**Riesgo:** Borra datos si ya hay compras en la tabla. Usar solo en caso de error crítico.

---

## Monitoreo Post-Deploy

**Logs en Supabase:**
```bash
# Ver errores de funciones en últimas 24h
supabase functions logs validate-iap --project-ref ddxnrsnjdvtqhxunxnwj --tail
supabase functions logs check-entitlement --project-ref ddxnrsnjdvtqhxunxnwj --tail
supabase functions logs apple-iap-webhook --project-ref ddxnrsnjdvtqhxunxnwj --tail
```

**Tabla de diagnostics en DB:**
- `usuarios_suscripciones_iap`: registros de compras (verificar que se registren)
- `client_errors` (si existe): reporta errores del lado del cliente

**Health check manual:**
```bash
# Probar que validate-iap responde (requiere JWT válido)
JWT_COACH=$(supabase auth admin create-user --email test@example.com --password Test123! --project-ref ddxnrsnjdvtqhxunxnwj | jq -r '.user_id')
curl -X POST https://api.pathwaycareercoach.com/functions/v1/validate-iap \
  -H "Authorization: Bearer $JWT_COACH" \
  -H "Content-Type: application/json" \
  -d '{}'
# Respuesta esperada: { "ok": true, "appAccountToken": "<uuid>" }
```

---

## Checklist Pre-Deploy

- [ ] Código Swift en `ios/CoachPlansViewModel.swift` con fixes de Oct 19 (commit c5038d6+)
- [ ] Código JS en `pw-capgo-iap.js` con fixes de Oct 19 (JWT, appAccountToken)
- [ ] Bootstrap local (`supabase/bootstrap_local.sql`) NO está en `supabase/migrations/` (comprobado)
- [ ] Migración `20261001_iap_subscriptions.sql` está en `supabase/migrations/`
- [ ] Edge Functions (`validate-iap`, `check-entitlement`, `apple-iap-webhook`) compiladas sin errores Deno
- [ ] `.env.local` en rama con credenciales Apple **reales** para testing
- [ ] Tests locales ejecutados y validados (pre-purchase, webhook idempotencia)
- [ ] Micaela autoriza deploy con palabra clave: "AUTORIZO DEPLOY IAP"
- [ ] Micaela proporciona credenciales Apple Sandbox (Issuer ID, Key ID, .p8)

---

## Próximos Pasos

1. **Hoy:** Consolidar todos los fixes en rama `claude/project-thread-2z7kdw`
2. **Testing local (Gonzalo):** Ejecutar suite de tests con Supabase local + app iOS
3. **Micaela autoriza:** Ejecutar comandos de deploy cuando esté lista
4. **Post-deploy:** Monitoreo 48h, validar que transacciones se registran en DB
5. **App Store:** Habilitar compras reales solo después de validación completa

---

**Preguntas antes de ejecutar?** Escribir en el thread del proyecto. **No hacer deploy sin autorización explícita de Micaela.**
