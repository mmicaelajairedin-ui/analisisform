# FASE 0: App Store Connect — Requisitos previos IAP Coach Plans

**Status:** EJECUTAR MANUALMENTE EN APP STORE CONNECT  
**Fecha:** 2026-09-09  
**Responsable:** Micaela (usuario)  
**Backend listo:** Espera por datos de App Store Connect  

---

## Objetivo de Fase 0

Configurar completamente App Store Connect para que IAP Coach Plans (auto-renewable subscriptions) esté lista para validar desde backend. **No se hace código aún.** Solo setup en App Store y documentación de secrets que necesitará Supabase.

---

## Estructura de Producto IAP Coach Plans

### Subscription Group (uno para ambas monedas)
- **Name:** `PathwayCoachPlans`
- **Description:** Coach Plans (Basic & Pro) — auto-renewable monthly subscriptions
- **Localizable:** Single tier con precios por territorio

### Products (2 auto-renewable subscriptions)

#### 1. Coach Basic Monthly
- **Product Type:** Auto-Renewable Subscription
- **Product ID:** `coach.plan.basic.monthly`
- **Reference Name:** Coach Basic Monthly
- **Subscription Group:** PathwayCoachPlans
- **Billing Cycle:** Monthly (1 month)
- **Renewal:** Auto-renewable
- **Billing Grace Period:** 3 days (Apple default)
- **Billing Retry:** Enabled (Apple default 3 retries)
- **Free Trial Period:** None (no trial for IAP — web trial handled separately)
- **Price Tier:** See regional pricing below
- **Family Sharing:** Allowed (coach chooses)
- **Localization:** See regional pricing

#### 2. Coach Pro Monthly
- **Product Type:** Auto-Renewable Subscription
- **Product ID:** `coach.plan.pro.monthly`
- **Reference Name:** Coach Pro Monthly
- **Subscription Group:** PathwayCoachPlans
- **Billing Cycle:** Monthly (1 month)
- **Renewal:** Auto-renewable
- **Billing Grace Period:** 3 days
- **Billing Retry:** Enabled
- **Free Trial Period:** None
- **Price Tier:** See regional pricing below
- **Family Sharing:** Allowed
- **Localization:** See regional pricing

---

## Precios Regionales — CRÍTICO

**Regla:** Apple recomienda usar "Tier" pricing system, pero puedes también configurar precio manual por región. Usa TIERS si Apple lo permite; si no, configura manual.

### Base Tier Mapping (sugerido)

Pathway actual: Basic $29/mo, Pro $59/mo USD.

| Territory | Coach Basic | Coach Pro | Notes |
|-----------|-------------|----------|-------|
| **USD** (US) | Tier 1 ($0.99) → ~$29 USD | Tier 2 (~$59 USD) | Reference |
| **EUR** (Spain, EU) | ~€28 | ~€58 | Apple suele redondear; verifica en ASC |
| **GBP** (UK) | ~£26 | ~£54 | |
| **MXN** (Mexico) | ~$500-600 MXN | ~$1000-1200 MXN | Ajusta según FX actual |
| **ARS** (Argentina) | Consultar ASC pricing API | | Volatilidad de FX — revisión mensual sugerida |
| **COP** (Colombia) | ~$120K-150K COP | ~$250K-300K COP | |
| **CLP** (Chile) | ~$25K-28K CLP | ~$50K-55K CLP | |

**⚠️ IMPORTANTE:**
- No copies precios USD directamente. Usa **App Store Connect pricing tiers** o revisa **regional recommendations**.
- Algunos territorios (AR, MX) requieren ajustes frecuentes por FX.
- Prueba en **Sandbox** antes de ir a producción.

**Acción:** 
1. En App Store Connect → Your App → In-App Purchases → Coach Basic Monthly
2. Click "Pricing and Availability"
3. **Manualmente** o via **Tier**, configura precio para CADA territorio (mínimo: US, ES, MX, AR, CO, CL)
4. Haz lo mismo para Coach Pro Monthly
5. **Screenshot** los precios finales y guarda en `docs/app-store-connect-pricing-snapshot.txt`

---

## Subscription Group Setup

**En App Store Connect:**

1. Navega a: **Your App** → **In-App Purchases** → **Subscription Groups**
2. Click **Create Subscription Group** (if not exists)
3. **Subscription Group Name:** `PathwayCoachPlans`
4. Agregar ambos productos a este grupo:
   - Coach Basic Monthly (`coach.plan.basic.monthly`)
   - Coach Pro Monthly (`coach.plan.pro.monthly`)
5. **Guardar.**

**Confirmación esperada:** Ambos productos aparecen bajo `PathwayCoachPlans` en la lista de In-App Purchases.

---

## App Store Server Notifications V2 — Webhook Configuration

Apple enviará notificaciones a un webhook cuando ocurran eventos de suscripción (renewal, cancellation, grace period, etc.).

### Webhook Endpoint

**Tu endpoint será:**
```
https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook
```

(Supabase Edge Function, aún no creada, pero debe estar lista en Fase 1 Backend)

### Configuración en App Store Connect

1. Ve a **App Store Connect** → **Your App** → **Configuration** (o Settings)
2. Busca sección **App Information** → **Notifications Configuration** (o similar; varía por versión ASC)
3. En **Server Notifications Settings** (o **Webhooks**):
   - **Webhook Endpoint URL:** `https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook`
   - **Version:** `2` (V2, NO V1)
   - **Events to subscribe:** Select ALL (la Edge Function filtrará):
     - SUBSCRIBED
     - DID_RENEW
     - DID_FAIL_TO_RENEW
     - DID_RECOVER
     - DID_CHANGE_RENEWAL_PREF
     - DID_CHANGE_RENEWAL_STATUS
     - GRACE_PERIOD_EXPIRED
     - EXPIRED
     - REVOKE
     - REFUND
     - PRICE_INCREASE
     - OFFER_REDEEMED
4. **Test webhook endpoint** (si ASC lo permite): envía un test payload
5. **Guardar.**

**Verificación:** ASC debe mostrar el endpoint registrado y estado ✅ "verified" o "configured".

### Secrets Necesarios en Supabase (para la Edge Function)

Guardaremos estos **después** que App Store Connect genere las keys (paso siguiente).

---

## App Store Server API Key Generation

Apple necesita que generes una API Key para que **nuestro backend pueda hacer llamadas a App Store Server API** (para validar transacciones, obtener información de suscripción, etc.).

### En App Store Connect:

1. Ve a **Users and Access** → **Keys** (o **App Store Connect API Keys**)
2. Busca sección **App Store Server API Keys** (NO App Store Connect API Keys, son distintas)
3. Click **Create API Key**
4. **Name:** `Pathway IAP Backend`
5. **Role:** `Developer` (mínimo requerido para leer suscripciones)
6. **Primary Role:** Select when prompted
7. Click **Create**
8. **Se genera una key .p8** → **DESCARGAR INMEDIATAMENTE** (solo se descarga una vez)
9. Guarda el archivo en un lugar seguro (no en GitHub):
   - Sugerido: `/root/.app-store-keys/pathway-iap-private.p8` (en el servidor, no en repo)
   - O guardar temporalmente y agregar a Supabase Secrets

### Valores a DOCUMENTAR (después de crear):

- **Key ID:** `[ID único de la key, ej. ABC123DEF45]`
- **Issuer ID:** `[ID de tu App Store Connect team, ej. 12345678-1234-1234-1234-123456789012]`
- **.p8 file:** `[Contenido completo de la key privada — GUARDADA EN SECRETO]`

**Acción:** 
1. Crea la key en ASC
2. Descargala y guarda en `/root/.app-store-keys/pathway-iap-private.p8` 
3. Documenta Key ID e Issuer ID (anota aquí abajo)
4. NO hagas commit del .p8 a GitHub

---

## App Store Connect — Datos a Extraer (Después de arriba)

Una vez hayas completado arriba, necesitaremos estos datos **EN TEXTO PLANO** para configurar Supabase Secrets:

| Dato | Valor | Dónde sacarlo |
|------|-------|---|
| **Bundle ID** | `com.pathwaycareercoach.ios` | App Store Connect → App → General |
| **Team ID** | `[10-char alphanumeric]` | App Store Connect → User & Access → Membership |
| **App ID (ASC)** | `[numeric]` | App Store Connect → App → App Information |
| **Issuer ID** | `[UUID format]` | App Store Connect → Users & Access → Keys → (después de crear key) |
| **Key ID** | `[26-char alphanumeric]` | App Store Connect → Users & Access → Keys → (después de crear key) |
| **Private Key (.p8)** | `[Full text content]` | App Store Connect → Users & Access → Keys → Download |
| **Webhook Endpoint** | `https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook` | Configuraste arriba |
| **Subscription Group ID** | `PathwayCoachPlans` | Confirmaste arriba |
| **Product ID (Basic)** | `coach.plan.basic.monthly` | Definiste arriba |
| **Product ID (Pro)** | `coach.plan.pro.monthly` | Definiste arriba |

---

## Checklist Fase 0 — App Store Connect Setup

- [ ] **Subscription Group creado**: `PathwayCoachPlans`
- [ ] **Product 1 creado**: Coach Basic Monthly (`coach.plan.basic.monthly`)
  - [ ] Auto-renewable subscription
  - [ ] Agregado a `PathwayCoachPlans`
  - [ ] Precios configurados para ≥6 territorios
- [ ] **Product 2 creado**: Coach Pro Monthly (`coach.plan.pro.monthly`)
  - [ ] Auto-renewable subscription
  - [ ] Agregado a `PathwayCoachPlans`
  - [ ] Precios configurados para ≥6 territorios
- [ ] **Server Notifications V2 configurado**:
  - [ ] Webhook endpoint: `https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook`
  - [ ] Version: `2`
  - [ ] Todos los eventos suscritos (12 tipos)
- [ ] **App Store Server API Key generada**:
  - [ ] Key creada con rol Developer
  - [ ] .p8 descargado y guardado seguro
  - [ ] Key ID documentado
  - [ ] Issuer ID documentado
- [ ] **Datos extraídos**:
  - [ ] Bundle ID
  - [ ] Team ID
  - [ ] Issuer ID
  - [ ] Key ID
  - [ ] Private Key (.p8 path)
  - [ ] Precios por territorio documentados

---

## Supabase Secrets Necesarios (para Fase 1)

Una vez completes App Store Connect, estos secrets se almacenarán en Supabase Edge Functions:

```
APPLE_BUNDLE_ID = "com.pathwaycareercoach.ios"
APPLE_TEAM_ID = "[10-char]"
APPLE_KEY_ID = "[26-char, de App Store Server API Key]"
APPLE_ISSUER_ID = "[UUID, de App Store Server API Key]"
APPLE_PRIVATE_KEY = "[contenido completo del .p8 descargado]"
APPLE_WEBHOOK_ENDPOINT = "https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook"
APPLE_SUBSCRIPTION_GROUP = "PathwayCoachPlans"
APPLE_PRODUCT_BASIC = "coach.plan.basic.monthly"
APPLE_PRODUCT_PRO = "coach.plan.pro.monthly"
```

**Seguridad:** El .p8 debe guardarse SOLO en Supabase Secrets, NUNCA en código, NUNCA en GitHub, NUNCA en email.

---

## Requisitos Faltantes / Bloqueados

### ✅ Puedo hacer sin App Store Connect:
- Crear migraciones SQL (schema, usuarios_suscripciones_iap, etc.)
- Crear Edge Functions (apple-iap-webhook, validate-iap, etc.)
- Crear tests Playwright
- Documentar tipos TypeScript
- Preparar integración Apple ↔ Supabase
- Configurar RLS para nuevas tablas
- Preparar panel-v2.html (sin hacer merge)

### ⛔ BLOQUEADO (necesita App Store Connect):
- Testing real de IAP en iOS (Sandbox)
- Testing real de webhook (Apple → Supabase)
- Verificación de Product IDs reales
- Verificación de precios reales
- Build y TestFlight
- Validación de App Store Server API (necesita key real)

---

## Archivos Generados por Fase 0

```
FASE_0_APP_STORE_SETUP.md              ← Este documento
docs/app-store-connect-pricing-snapshot.txt  ← Tu screenshot de precios
docs/app-store-connect-secrets.txt     ← Datos de ASC (documentado, no en código)
```

---

## Siguiente Paso

**Cuando completes** todos los checkboxes arriba:

1. **Documenta los datos** en `docs/app-store-connect-secrets.txt`:
   ```
   Bundle ID: [valor]
   Team ID: [valor]
   Issuer ID: [valor]
   Key ID: [valor]
   Private Key location: /root/.app-store-keys/pathway-iap-private.p8
   Webhook Endpoint: https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook
   Subscription Group: PathwayCoachPlans
   Product IDs: coach.plan.basic.monthly, coach.plan.pro.monthly
   Precios: [resumen breve]
   ```
   
2. **Confirma en el chat**: "Fase 0 completada en App Store Connect"
3. **Yo procedo a Fase 1** (Backend): Migraciones + Edge Functions

---

## Resumen Fase 0

| Item | Status | Dato |
|------|--------|------|
| Subscription Group | PENDIENTE | `PathwayCoachPlans` |
| Product Basic | PENDIENTE | `coach.plan.basic.monthly` |
| Product Pro | PENDIENTE | `coach.plan.pro.monthly` |
| Precios (6+ territorios) | PENDIENTE | TBD |
| Server Notifications V2 | PENDIENTE | `https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook` |
| API Key | PENDIENTE | Key ID + Issuer ID + .p8 |
| GO/NO-GO Fase 1 | BLOQUEADO | Espera por Fase 0 completado |

---

**Documento creado:** 2026-09-09  
**Versión:** 1.0  
**Responsable de acción:** Micaela (App Store Connect manual)  
**Backend:** Espera por datos de ASC
