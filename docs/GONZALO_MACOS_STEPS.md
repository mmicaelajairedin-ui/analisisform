# Instrucciones para Gonzalo — Mac/Xcode Workflow

**Recibiste:** Código completamente integrado en `feature/capgo-iap-integration`  
**Tu responsabilidad:** Xcode, TestFlight, App Store  
**Tiempo estimado:** 2-3 días (incluye sandbox testing)

---

## 📋 Prerrequisitos

Antes de empezar, verifica que tienes:

- [ ] Mac con macOS 12.0+
- [ ] Xcode 14.3+
- [ ] Apple Developer Account (acceso a App Store Connect)
- [ ] iPhone o iPad con iOS 15.0+
- [ ] Git configurado (`git clone` funciona)
- [ ] Node.js 16+ instalado en la Mac

**Verificar:**
```bash
xcode-select --version
node --version
npm --version
git --version
```

---

## 🚀 FASE 1: Clonar y Setup (30 minutos)

### Paso 1.1: Clonar el repositorio

```bash
cd ~/Developer  # O donde quieras guardar el proyecto
git clone https://github.com/mmicaelajairedin-ui/analisisform.git
cd analisisform

# Cambiar a la rama con la integración IAP lista
git checkout feature/capgo-iap-integration
```

**Verificar:** Deberías ver el commit `3cb87b7` como HEAD
```bash
git log --oneline -1
# Output: 3cb87b7 feat: implement StoreKit 2 initialization layer + Capacitor integration
```

### Paso 1.2: Instalar dependencias

```bash
npm install
# Verifica que @capgo/native-purchases v8.7.0 está en node_modules
npm list @capgo/native-purchases
# Output: @capgo/native-purchases@8.7.0
```

### Paso 1.3: Abrir Xcode

```bash
# Si el proyecto es Capacitor:
npx cap open ios

# Si no, abre el workspace/proyecto de otra forma:
open YourApp.xcworkspace
```

**Importante:** Si Xcode pide actualizar versión, actualiza.

---

## 🔧 FASE 2: Configurar Xcode (20 minutos)

### Paso 2.1: Verificar Bundle ID

1. En Xcode: **Project** → **Build Settings** → Buscar "Bundle Identifier"
2. Debe ser: `com.pathwaycareercoach.twa`
3. Si es diferente, cámbialo **AHORA**

```
❌ INCORRECTO:
  com.example.MyApp
  org.pathway.app
  com.pathway.analisisform

✅ CORRECTO:
  com.pathwaycareercoach.twa
```

### Paso 2.2: Verificar Team ID

1. **Targets** → selecciona tu app target
2. **Signing & Capabilities**
3. Bajo "Team", selecciona tu Apple Developer Team
4. Xcode debe autocompletar el "Bundle Identifier Prefix"

```
Example:
Team: Micaela Jairedin (ABCD1234EF)
Bundle ID Prefix: ABCD1234EF
Final Bundle ID: ABCD1234EF.com.pathwaycareercoach.twa
```

### Paso 2.3: Agregar "In-App Purchase" Capability

1. En Signing & Capabilities → **+ Capability**
2. Busca "In-App Purchase"
3. Doble-click para agregar
4. Deberías ver un nuevo archivo `.entitlements`

**Verificar:** El archivo `.entitlements` debe contener:
```xml
<key>com.apple.developer.in-app-payments</key>
<true/>
```

### Paso 2.4: Verificar `Capacitor.podspec` (si usa Capacitor)

```bash
cat ios/Podfile | grep -i "storekit\|capgo"
```

Debe estar:
```ruby
pod '@capgo/native-purchases'
```

Si no está, agrégalo manualmente o re-sync:
```bash
npx cap sync ios
```

---

## 🛍️ FASE 3: App Store Connect Setup (45 minutos)

**Nota:** Solo el Apple Developer Account owner puede hacer esto.

### Paso 3.1: Verificar la app existe

1. Ir a [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **Apps** → Selecciona "Pathway Coach Plans" (o tu nombre de app)
3. Verifica Bundle ID = `com.pathwaycareercoach.twa`

### Paso 3.2: Crear In-App Purchase Products

En App Store Connect → Tu App → **In-App Purchases** → **+**

**Producto 1: Basic Plan**
```
Type:          Subscription (Auto-Renewable)
Product ID:    coach.plan.basic.monthly
Name:          Basic Plan
Description:   Access to Pathway coaching platform with essential features
Tier:          Tier 3 ($2.99 base, ~$29/month worldwide)
Billing:       Monthly (standard recurring)
Auto-Renew:    Enabled
Family Sharing: Enabled

Screenshot/promotional: Optional
```

**Producto 2: Pro Plan**
```
Type:          Subscription (Auto-Renewable)
Product ID:    coach.plan.pro.monthly
Name:          Pro Plan
Description:   Access to Pathway coaching platform with advanced features
Tier:          Tier 6 ($4.99 base, ~$59/month worldwide)
Billing:       Monthly (standard recurring)
Auto-Renew:    Enabled
Family Sharing: Enabled

Screenshot/promotional: Optional
```

**Verificar:** Ambos deberían estar en "Ready to Submit" o "Approved"

### Paso 3.3: Obtener Shared Secret

1. **In-App Purchases** → scroll down → **App-Specific Shared Secret**
2. Click **Manage** → **View** (o generar si no existe)
3. **Copiar el secret completo** (largo string)

```
Ejemplo: c2a...(40+ characters)...xyz
```

**Guardar en lugar seguro.** Lo necesitarás para darle a Micaela.

### Paso 3.4: Crear Sandbox Tester

1. **Users and Access** → **Testers & Roles**
2. **Sandbox Testers** → **+**
3. Ingresar datos:

```
First Name:     Test
Last Name:      Coach
Email:          test-coach-1@example.com
Password:       (generar uno seguro)
Expiration:     1 month from now
```

**Guardar credenciales en un lugar seguro.** Las usarás para testear en el device.

---

## 📱 FASE 4: Build Debug y Device Testing (1 hora)

### Paso 4.1: Conectar iPhone/iPad

1. Conecta el device vía cable USB
2. En Xcode: **Window** → **Devices and Simulators**
3. Deberías ver tu device en la lista
4. Xcode pedirá "trust device" — acepta en Xcode y en el device

### Paso 4.2: Seleccionar Target Device

1. En Xcode top toolbar, a la izquierda del play button, verás un dropdown
2. Selecciona tu device (no "iOS Simulator")
3. Ejemplo: `Gonzalo's iPhone (iOS 17.1)`

### Paso 4.3: Build y Deploy

```bash
# Opción 1: Desde Xcode
Cmd+B         # Build
Cmd+R         # Build & Run (instala en device)

# Opción 2: Desde terminal
xcodebuild build -scheme YourScheme -configuration Debug -derivedDataPath build
xcodebuild install -scheme YourScheme -configuration Debug -derivedDataPath build
```

**Esperar a que compile y se instale el app en el device.**

### Paso 4.4: Testear Login en Device

1. Abre el app en el iPhone
2. Deberías ver la pantalla de login
3. Entra con credenciales de coach (o crea una cuenta de test en producción)
4. **No** deberías ver errores en Xcode console

**Verificar en Xcode Console:**
```
[PW_STOREKIT] Bootstrap starting...
[PW_STOREKIT] ✅ Bootstrap complete
```

Si no ves esto, revisar logs en Xcode.

### Paso 4.5: Testear Plan Selection Screen

1. En el app, navega a donde están los planes (probablemente en Settings o una página de "Plans")
2. Deberías ver:
   - "Basic Plan — $29.00/month"
   - "Pro Plan — $59.00/month"

**Verificar en Console:**
```
[PW_CAPGO_IAP] Starting purchase: coach.plan.basic.monthly
```

Si ves un error tipo "Product not found", revisar que los Product IDs en App Store Connect son EXACTOS.

---

## 🧪 FASE 5: Sandbox Purchase Testing (45 minutos)

### Paso 5.1: Sign Out de Apple ID

En el device (iPhone):
1. **Settings** → **App Store**
2. Tap tu nombre (arriba)
3. **Sign Out**

### Paso 5.2: Sign In como Sandbox Tester

En el device:
1. Abre el app
2. Intenta hacer una compra (tap "Buy Plan")
3. Te pedirá Sign In → **Usa las credenciales del sandbox tester:**
   ```
   Email:    test-coach-1@example.com
   Password: (la que generaste en Paso 3.4)
   ```

### Paso 5.3: Completar Compra de Prueba

1. Después de Sign In, se abrirá **Apple's native purchase sheet**
2. Deberías ver un banner amarillo: **"This is a test transaction"**
3. Tap **"Approve"** (o Face ID si lo pide)

**En Xcode Console, deberías ver:**
```
[PW_STOREKIT] Receipt verified: {
  hasAccess: true,
  status: "ACTIVE"
}
```

### Paso 5.4: Verificar Suscripción en Backend

En Supabase Dashboard:
1. Ir a SQL Editor
2. Ejecutar:
   ```sql
   SELECT email, configuracion 
   FROM usuarios 
   WHERE email LIKE 'test-coach%';
   ```
3. En la columna `configuracion`, busca `iap_subscriptions`:
   ```json
   {
     "iap_subscriptions": [
       {
         "productId": "coach.plan.basic.monthly",
         "originalTransactionId": "...",
         "status": "ACTIVE",
         "expiryDate": "2026-10-17T12:34:56Z"
       }
     ]
   }
   ```

**Si no ves esto:**
- ❌ Revisar errores en Xcode Console
- ❌ Verificar que `check-entitlement` function está deployada
- ❌ Verificar que la Shared Secret es correcta

### Paso 5.5: Testear Refund (Opcional)

En App Store Connect → **Sandbox** → **Manage Refunds** → Selecciona la transacción de test → **Refund**

En el device:
- Abre el app
- Tap "Check Subscription"
- Deberías ver el status cambiar a "REFUNDED"

---

## 📦 FASE 6: Build Release para TestFlight (30 minutos)

**Nota:** Solo cuando el sandbox testing esté 100% OK.

### Paso 6.1: Aumentar Version Number

En Xcode:
1. **Targets** → tu app → **General**
2. Busca "Version" (ej: 1.0.0)
3. Aumenta a siguiente número (ej: 1.0.1 o 1.1.0)
4. Busca "Build Number" → incrementa en 1 (ej: 6 → 7)

### Paso 6.2: Cambiar a Release Build

En Xcode top toolbar:
1. Dropdown al lado del play button
2. Selecciona **Any iOS Device (arm64)** (no simulador)

### Paso 6.3: Archive the App

```bash
Cmd+Shift+K   # Clean build folder
Cmd+B         # Build
Cmd+Shift+B   # Archive
```

O desde menu: **Product** → **Archive**

**Esperar a que aparezca ventana de "Organizer".**

### Paso 6.4: Upload a TestFlight

En Organizer (ventana que aparece después de Archive):
1. Selecciona el archive más nuevo
2. Click **Distribute App**
3. Selecciona **App Store Connect**
4. Selecciona **Upload**
5. Sigue los pasos (signing, etc.)

**Esperar a que suba (puede tardar 5-10 minutos).**

### Paso 6.5: Verificar en App Store Connect

1. Ir a [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Tu app → **TestFlight** → **iOS Builds**
3. Deberías ver la build nueva en "Waiting for Review" o "Ready to Test"

**Guardar el Build Number (ej: "Build 6") para reportar a Micaela.**

---

## 🔗 FASE 7: Comunicar a Micaela (5 minutos)

Cuando TestFlight Build esté lista, envía a Micaela:

```
✅ TestFlight Build 6 Ready

Información técnica:
- Build Number: 6
- App Version: 1.0.1 (o el que uses)
- Bundle ID: com.pathwaycareercoach.twa
- Sandbox Tester: test-coach-1@example.com
- Shared Secret: [COPIAR DE APP STORE CONNECT]

Qué funciona:
- ✅ @capgo/native-purchases v8.7.0 installed
- ✅ StoreKit 2 initializes on app launch
- ✅ Sandbox purchase tested end-to-end
- ✅ Receipt verification working
- ✅ Subscription data saved to Supabase

Próximo paso:
Micaela activa las Edge Functions:
1. Changes if: false → if: true in .github/workflows/deploy-functions.yml
2. Pushes to main
3. GitHub Actions deploys 4 IAP functions

Cuando esté hecho, avisame para hacer más testing con funciones vivas.
```

---

## ⚡ FASE 8: Backend Deploy (Micaela hace esto)

**Tú solo monitoreas.** Micaela:

1. Accede a `feature/capgo-iap-integration`
2. En `.github/workflows/deploy-functions.yml` líneas 234-243:
   ```yaml
   - name: Deploy apple-iap-webhook
     if: false  # ← CAMBIAR A: if: true
   ```
3. Hace push a `main`
4. GitHub Actions auto-ejecuta el workflow
5. 4 Edge Functions se deplegan a Supabase

**Verificar deploy exitoso:**
```bash
supabase functions list
# Output debería incluir:
# - apple-iap-webhook
# - validate-iap
# - check-entitlement
# - detect-double-charges
```

---

## ✅ Checklist Final Antes de TestFlight

- [ ] Bundle ID es `com.pathwaycareercoach.twa`
- [ ] Team ID configurado en Xcode
- [ ] In-App Purchase capability enabled
- [ ] 2 IAP products creados en App Store Connect
- [ ] Sandbox tester creado
- [ ] Shared Secret obtenido
- [ ] App instala en device sin errores
- [ ] Login funciona
- [ ] Plan selection screen visible
- [ ] Sandbox purchase completa exitosamente
- [ ] Suscripción aparece en Supabase
- [ ] Build release creado
- [ ] TestFlight build subida
- [ ] Compartiste build info con Micaela

---

## 🆘 Troubleshooting Rápido

| Síntoma | Causa Probable | Solución |
|---------|---|---|
| "Product not found" al abrir purchase sheet | IDs en App Store Connect no exactos | Verificar `coach.plan.basic.monthly` exacto (sin espacios) |
| "This app cannot be installed on this device" | Bundle ID mismatch | Verificar en Xcode General settings |
| "In-App Purchase not available" | Capability no habilitada | Agregar en Signing & Capabilities |
| Xcode pide contraseña de Apple | Signing issue | Entrar a developer.apple.com, regenerar certificates |
| App crashes al abrir | @capgo plugin issue | Verificar `npm list @capgo/native-purchases`, re-run `npx cap sync` |
| Sandbox purchase se cuelga | Network issue | Reintentar, check wifi/cellular |
| "Invalid Shared Secret" en console | Shared Secret incorrecto o expirado | Copiar de nuevo de App Store Connect |

---

## 📞 Contacto Rápido

Cuando necesites help:
1. Revisar los 4 archivos de documentación:
   - `docs/IAP_XCODE_GONZALO_GUIDE.md` (arquitectura)
   - `docs/CAPGO_SETUP_GUIDE.md` (setup detalles)
   - `docs/APP_TSX_INTEGRATION.md` (App.tsx wiring)
   - Este archivo (Mac/Xcode pasos)

2. Si hay error en Xcode Console, buscar `[PW_STOREKIT]` o `[PW_CAPGO_IAP]`

3. Si Supabase está vacío, verificar que la función `check-entitlement` está deployada

4. Si TestFlight falla, revisar App Store Connect build logs

---

## 🎯 Timeline Estimado

| Fase | Duración | Bloqueadores |
|---|---|---|
| Clonar + setup | 30 min | Ninguno |
| Xcode config | 20 min | Ninguno |
| App Store Connect | 45 min | Apple Developer Account |
| Debug + device test | 1 hora | iPhone/iPad |
| Sandbox purchase test | 45 min | Sandbox tester creado |
| Build release | 30 min | Ninguno |
| TestFlight upload | 20 min | Internet |
| **TOTAL** | **~4 horas** | **Distribuidas en 1-2 días** |

---

## 🎬 Resumen

**Lo que recibiste:**
- ✅ @capgo/native-purchases v8.7.0 instalado
- ✅ pw-capgo-iap.js listo para usar
- ✅ pw-storekit-init.ts integrado
- ✅ 90+ tests passando
- ✅ Documentación completa

**Lo que tienes que hacer (con Mac):**
1. Clonar, instalar, abrir Xcode
2. Configurar bundle ID, capabilities, team
3. Crear productos en App Store Connect
4. Build debug, testear en device
5. Build release, upload a TestFlight
6. Avisar a Micaela cuando esté listo

**Lo que Micaela hace después:**
1. Activa las 4 Edge Functions
2. Verifica deployment
3. Tú haces más testing
4. App listo para App Store Review

**Tiempo total: 1-2 días si todo sale bien. 3-4 si hay issues.**

---

**Last Updated:** September 2026  
**Backend Ready:** ✅ YES  
**Frontend Ready:** ✅ YES  
**Your Turn:** 🟡 Now (Mac phase)  

¡Adelante, Gonzalo! 🚀
