# Pathway — App móvil (iOS + Android) con Capacitor

Esta carpeta arma la app de Pathway usando **Capacitor**. La app es un
"envoltorio" nativo que carga tu sitio en vivo (`pathwaycareercoach.com`) dentro
de una app real. Reutiliza el 100% de la plataforma web: no hay código duplicado,
y **la misma base sirve para iOS y para Android** (Google Play).

## ⚠️ Lo que ya está resuelto (importante)

- **Sin comisión de Apple/Google**: la app abre
  `https://pathwaycareercoach.com/login.html?app=1`. Ese `?app=1` (y la detección
  de Capacitor en `pw-native.js`) **ocultan todos los botones de pago dentro de la
  app**. Modelo "reader" (Netflix/Spotify): la coach se suscribe en la WEB con
  Stripe, y la app es solo "iniciá sesión y usá". En la web normal nada de esto se
  activa: los cobros siguen igual.
- **Capa nativa (`pw-native.js`, en la raíz del repo)** — solo actúa dentro de la
  app; en la web es un no-op. Se encarga de:
  - Barra de estado con el color de marca + ocultar el splash al cargar.
  - Abrir los links a **otros dominios** en Safari/Chrome del sistema (no traba la
    app en una web ajena — ayuda con la regla 4.2 de Apple).
  - **Notificaciones push nativas**: pide permiso y guarda el token del dispositivo
    en Supabase (tabla `native_push_tokens`), si el usuario inició sesión.

---

## Requisitos (una sola vez)

**Para iOS (necesitás Mac):**
1. **Mac con macOS** actualizado + **Xcode** (gratis, Mac App Store).
2. **CocoaPods**: en la Terminal → `sudo gem install cocoapods`
3. Cuenta **Apple Developer** activa (US$99/año) y contrato de licencia aceptado
   en https://developer.apple.com/account (¡el aviso que viste!).

**Para Android (sirve cualquier PC/Mac):**
1. **Android Studio** (gratis) con el **SDK de Android 16 (API 36)** instalado
   (Android Studio → Settings → SDK Manager → marcá "Android 16 / API 36").
2. Cuenta **Google Play Console** (US$25, pago único).

**Para ambos:**
- **Node.js 18+** (https://nodejs.org, versión LTS).

---

## Pasos comunes (en la Terminal)

```bash
cd app-ios
npm install
```

## Compilar para iOS

```bash
npx cap add ios       # genera la carpeta ios/ (solo en Mac)
npx cap sync
npx cap open ios      # abre Xcode
```

En **Xcode**:
1. Panel izquierdo → **App** → **Signing & Capabilities**:
   - **Team**: tu cuenta de Apple Developer.
   - **Bundle Identifier**: `com.pathwaycareercoach.twa`.
   - **+ Capability** → agregá **Push Notifications** (para las notificaciones).
2. **General** → **Display Name**: `Pathway`; **App Icon**: imagen **1024×1024 px**
   (podés partir de `logo-mark.png` / `icon-512.png` escalada a 1024).
3. **Privacy Manifest**: File → Add Files to "App"… → elegí `app-ios/PrivacyInfo.xcprivacy`
   (marcá el target "App"). Apple lo exige para aprobar.
4. Elegí un simulador y ▶ para probar. Cuando esté OK:
   **Product → Archive → Distribute App → App Store Connect**.

## Compilar para Android (API 36 / Android 16)

```bash
npx cap add android   # genera la carpeta android/
```

Luego editá **`android/variables.gradle`** y poné API 36 (Google Play exige
apuntar a una API reciente):

```gradle
ext {
    minSdkVersion = 23
    compileSdkVersion = 36
    targetSdkVersion = 36        // Android 16
    // ...dejá el resto como viene
}
```

```bash
npx cap sync
npx cap open android   # abre Android Studio
```

**Actualización de una app EXISTENTE (prueba cerrada con PWABuilder):** como ya
hay una app en Play con el package `com.pathwaycareercoach.twa` (versión 1.0.0.1),
esto es un UPDATE, no una app nueva. Por eso:
- El `appId` del proyecto ya es `com.pathwaycareercoach.twa` (coincide).
- **Firmá con TU keystore existente** (`signing.keystore`, alias `pathway-key`) —
  NO crees una clave nueva, o Google rechaza la actualización.
- Subí el **versionCode** en `android/app/build.gradle` a un número mayor que el
  actual (poné `versionCode 2` o más).

En **Android Studio**: **Build → Generate Signed Bundle / APK → Android App
Bundle (.aab)** → elegí **Choose existing…** y seleccioná tu `signing.keystore` →
subí el `.aab` a la MISMA app en Google Play Console.

> **Nota sobre la API 36:** Capacitor 6 viene por defecto en API 34. Bumpear
> `variables.gradle` a 36 funciona si Android Studio tiene el SDK 36 y un Android
> Gradle Plugin reciente (8.6+). Si el build se queja, la alternativa limpia es
> actualizar a **Capacitor 7** (`npm i @capacitor/core@7 @capacitor/cli@7
> @capacitor/android@7 …`), que ya apunta a APIs nuevas.

---

## Notificaciones push — para que realmente lleguen

El registro del dispositivo ya está hecho (`pw-native.js` → tabla
`native_push_tokens`). Falta la parte de **envío**, que necesita tus credenciales:

**iOS (APNs):**
1. En https://developer.apple.com/account → Keys → crea una **APNs Auth Key** (.p8).
   Anotá el **Key ID** y tu **Team ID**.
2. Aplicá la migración `supabase/migrations/native_push_tokens.sql`.
3. Deploy de la función: `supabase functions deploy send-push-apns --no-verify-jwt`
4. Cargá los secrets en Supabase (Edge Functions → Secrets):
   `APNS_KEY_P8` (contenido del .p8), `APNS_KEY_ID`, `APNS_TEAM_ID`,
   `APNS_BUNDLE_ID` = `com.pathwaycareercoach.twa`, `APNS_ENV` = `production`.
5. Probá con un POST: `{ "emails": ["tu@email.com"], "title": "Hola", "body": "Prueba" }`

> ⚠️ La función `send-push-apns` está escrita pero **sin probar en producción**
> todavía. Hay que testearla con las credenciales reales antes de conectarla a los
> disparadores automáticos (nuevo cliente, chat, etc.). Lo hacemos juntas cuando
> tengas la APNs Key.

---

## Ventaja clave: contenido siempre actualizado

Como la app carga el sitio en vivo, **cualquier cambio que publiques en la web
aparece solo en la app** — sin recompilar ni volver a subir. Solo recompilás y
re-subís si cambiás algo *nativo* (ícono, nombre, permisos, plugins).

## App Store Connect / Play Console — fichas

- Descripción, capturas (iPhone / Android), categoría (Business / Productivity).
- Política de privacidad: ya tenés `privacidad.html`.
- **Clasificación por edades**: respondé las preguntas (incluidas las nuevas de
  redes sociales que te avisó Apple).
- **Cumplimiento UE (DSA)**: declará tu condición de comerciante.
