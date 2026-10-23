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

Primero, obtén el ID del contenedor PostgreSQL:

```bash
# Espera ~30 segundos después de `supabase start` para que la DB esté lista
CONTAINER_ID=$(docker ps --filter="label=com.docker.compose.service=db" --format="{{.ID}}" | head -1)
echo "Container ID: $CONTAINER_ID"
```

Luego aplica el bootstrap:

```bash
# Ejecutar bootstrap dentro del contenedor Docker
docker exec -i $CONTAINER_ID psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/bootstrap_local.sql
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

## 6. Aplicar Migraciones IAP (Manualmente)

**⚠️ IMPORTANTE: NO usar `db reset` ni `migration up` — hay conflictos de versiones en migraciones viejas. Aplicar solo las migraciones IAP manualmente.**

Obtén el ID del contenedor nuevamente (si es necesario):

```bash
CONTAINER_ID=$(docker ps --filter="label=com.docker.compose.service=db" --format="{{.ID}}" | head -1)
```

Aplica las dos migraciones IAP **en orden** con docker exec:

```bash
# 1. Crear tabla usuarios_suscripciones_iap
docker exec -i $CONTAINER_ID psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261001_iap_subscriptions.sql

# 2. Agregar columna last_signed_date para deduplicación atómica
docker exec -i $CONTAINER_ID psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20261023_add_last_signed_date.sql
```

**Qué hace:**
- **`20261001_iap_subscriptions.sql`** — Crea tabla `usuarios_suscripciones_iap` con FK a `usuarios.id`, índices, RLS policies
- **`20261023_add_last_signed_date.sql`** — Agrega columna `last_signed_date` para validación atómica de webhooks duplicados

**Salida esperada:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
ALTER TABLE
```

**Verificación (contar filas):**

```bash
# Antes de tests, verificar que tabla existe
docker exec $CONTAINER_ID psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT COUNT(*) as row_count FROM usuarios_suscripciones_iap;"
# Debería retornar: 0 (tabla creada, vacía)
```

**✅ Seguridad en Producción:**
- `bootstrap_local.sql` está FUERA de `supabase/migrations/`
- `supabase db push` lo ignora completamente (nunca ve este archivo)
- Es solo para desarrollo local
- No se mergea a `main` (ya está en rama `fix/iap-webhook-security`)

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

## 10. TIER 1 Testing — Deno Tests Locales

**Precondición crítica**: Verificar que Supabase CLI está configurado SOLO para local:
```bash
supabase status
# NO debe mostrar "project-ref" ni "linked to project"
# Debe mostrar "API running on http://localhost:54321"
```

**NUNCA ejecutar `supabase db push`, `supabase functions deploy --project-ref`, ni ningún comando con `--linked` o `--project-ref`.**

### Ejecutar Tests de Seguridad Webhook

**Setup: Obtén el Container ID (una sola vez)**

```bash
CONTAINER_ID=$(docker ps --filter="label=com.docker.compose.service=db" --format="{{.ID}}" | head -1)
echo "Container ID: $CONTAINER_ID"
```

**Test Run 1: Con `IAP_ALLOW_UNSIGNED_TEST=true` (test local permitido)**

```bash
# Terminal 1: levantar funciones CON --env-file
supabase functions serve --env-file supabase/functions/apple-iap-webhook/.env.test

# Terminal 2: contar filas ANTES
docker exec $CONTAINER_ID psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT COUNT(*) as before_count FROM usuarios_suscripciones_iap;" > /tmp/tier1-run1-before.txt

# Terminal 2: ejecutar tests con variable de entorno (permite payloads sin firma para local)
cd supabase/functions/apple-iap-webhook
IAP_ALLOW_UNSIGNED_TEST=true deno test --allow-net --allow-env webhook-security.test.ts > /tmp/tier1-run1-output.txt 2>&1

# Terminal 2: contar filas DESPUÉS
docker exec $CONTAINER_ID psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT COUNT(*) as after_count FROM usuarios_suscripciones_iap;" > /tmp/tier1-run1-after.txt
```

**Resultados esperados:**
- `ok | X passed | 0 failed` (todos pasan)
- Conteo antes ≈ conteo después (DB intacta después de los tests)

Estos tests validan:
- Deduplicación por NotificationUUID
- Rechazo de eventos stale (older signedDate)
- Validación en test mode (campos requeridos)
- Atomicidad de UPDATE
- Validación de hostname whitelist

**Guarda:**
- `/tmp/tier1-run1-output.txt` (salida de deno test)
- `/tmp/tier1-run1-before.txt` (conteo DB antes)
- `/tmp/tier1-run1-after.txt` (conteo DB después)

---

### Test Run 2: Sin `IAP_ALLOW_UNSIGNED_TEST` (producción stricta)

**Acción:**
```bash
# Terminal 1: levantar funciones SIN --env-file (usa .env del sistema)
supabase functions serve

# Terminal 2: contar filas ANTES
docker exec $CONTAINER_ID psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT COUNT(*) as before_count FROM usuarios_suscripciones_iap;" > /tmp/tier1-run2-before.txt

# Terminal 2: ejecutar tests sin pasar IAP_ALLOW_UNSIGNED_TEST (modo producción)
cd supabase/functions/apple-iap-webhook
deno test --allow-net --allow-env webhook-security.test.ts > /tmp/tier1-run2-output.txt 2>&1

# Terminal 2: contar filas DESPUÉS
docker exec $CONTAINER_ID psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT COUNT(*) as after_count FROM usuarios_suscripciones_iap;" > /tmp/tier1-run2-after.txt
```

**Resultados esperados:**
- El comportamiento es diferente a Run 1 (más estricto)
- Tests que dependen de `IAP_ALLOW_UNSIGNED_TEST=true` pueden fallar
- Conteo antes ≈ conteo después (DB intacta)

**Guarda:**
- `/tmp/tier1-run2-output.txt` (salida de deno test)
- `/tmp/tier1-run2-before.txt` (conteo DB antes)
- `/tmp/tier1-run2-after.txt` (conteo DB después)

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
- [ ] Test Run 1 exitoso (deno test con .env.test)
- [ ] Test Run 2 exitoso (deno test sin .env.test)
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

5. **Deno test falla:**
   - Verificar que `supabase functions serve` está corriendo en otra terminal
   - Verificar que `.env.test` existe en `supabase/functions/apple-iap-webhook/`
   - Ejecutar desde dentro del directorio de la función: `cd supabase/functions/apple-iap-webhook`

---

**Contacto:** Si hay dudas, escribir en el thread del proyecto.

---

## ⚠️ Nota sobre Deploy a Producción

**Los comandos de deploy a producción están en documento separado:** `iap/DEPLOY_PRODUCCION_NO_EJECUTAR_SIN_AUTORIZACION.md`

**IMPORTANTE:** No ejecutar ningún comando de `supabase db push`, `supabase functions deploy --project-ref`, ni ningún comando con `--project-ref ddxnrsnjdvtqhxunxnwj` desde este documento. Son para producción y requieren autorización explícita de Micaela.

Este documento (`INSTRUCCIONES_GONZALO_SUPABASE_LOCAL.md`) es **SOLO para testing local en Mac**.

---
