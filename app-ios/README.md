# Pathway — App para iOS (App Store)

Esta carpeta arma la app de iPhone de Pathway usando **Capacitor**. La app es
un "envoltorio" que carga tu sitio en vivo (`pathwaycareercoach.com`) dentro de
una app nativa. Reutiliza el 100% de la plataforma web: no hay código duplicado.

## ⚠️ Lo que ya está resuelto (importante)

- La app abre `https://pathwaycareercoach.com/login.html?app=1`. Ese `?app=1`
  activa `pw-app.js`, que **oculta todos los botones de pago dentro de la app**.
  Esto es obligatorio: Apple exige su propio cobro (30%) para suscripciones
  digitales compradas *dentro* de la app. Modelo "reader" (como Netflix/Spotify):
  la coach se suscribe en la WEB con Stripe, y la app es solo "iniciá sesión y usá".
- En la web normal (fuera de la app) nada de esto se activa: los cobros siguen igual.

## Requisitos (una sola vez, en tu Mac)

1. **Mac con macOS** actualizado.
2. **Xcode** — instalalo gratis desde la Mac App Store (pesa varios GB).
3. **Node.js 18 o superior** — descargalo de https://nodejs.org (versión LTS).
4. **CocoaPods** — abrí la Terminal y corré: `sudo gem install cocoapods`
5. Tu cuenta de **Apple Developer** ya activa (los US$99/año) y el contrato de
   licencia aceptado en https://developer.apple.com/account (¡el aviso que viste!).

## Pasos para compilar (en la Terminal de tu Mac)

```bash
# 1. Entrá a esta carpeta
cd app-ios

# 2. Instalá las dependencias
npm install

# 3. Generá el proyecto nativo de iOS (esto crea la subcarpeta ios/)
npx cap add ios

# 4. Sincronizá la configuración
npx cap sync

# 5. Abrí el proyecto en Xcode
npx cap open ios
```

## Dentro de Xcode

1. En el panel izquierdo, clic en **App** (el proyecto, arriba de todo).
2. Pestaña **Signing & Capabilities**:
   - **Team**: elegí tu cuenta de Apple Developer.
   - **Bundle Identifier**: dejá `com.pathwaycareercoach.app` (o el que registres).
3. Pestaña **General**:
   - **Display Name**: `Pathway`
   - **App Icon**: arrastrá tu ícono (necesitás una imagen **1024×1024 px**, sin
     transparencia — podés partir de `logo-mark.png` o `icon-512.png` del repo y
     escalarla a 1024).
4. Elegí un simulador (ej. "iPhone 15") arriba y apretá ▶ (Play) para **probarla**.
5. Cuando esté OK: menú **Product → Archive** → **Distribute App** → **App Store
   Connect** → subir.

## En App Store Connect (https://appstoreconnect.apple.com)

1. **Apps → +  → Nueva app**. Plataforma iOS, nombre "Pathway", bundle id el de arriba.
2. Completá: descripción, capturas de pantalla (iPhone), categoría (Business /
   Productivity), política de privacidad (ya tenés `privacidad.html`).
3. **Clasificación por edades**: respondé las preguntas (incluidas las nuevas de
   redes sociales que te avisó Apple).
4. **Cumplimiento UE (DSA)**: declará tu condición de comerciante.
5. Enviá a revisión.

## ⚠️ Riesgo a tener en cuenta: regla 4.2 de Apple

Apple a veces rechaza apps que son "solo una web envuelta" sin valor nativo.
Para reducir el riesgo, el próximo paso recomendado es agregar **notificaciones
push nativas** (Pathway ya tiene la infraestructura: `pw-push.js` + edge function
`send-push`). Con Capacitor se suma el plugin `@capacitor/push-notifications`.
Si Apple rechaza por 4.2, ese es el primer refuerzo a implementar.

## Cambiar contenido de la app

Como la app carga el sitio en vivo, **cualquier cambio que publiques en la web
aparece automáticamente en la app** — sin recompilar ni volver a subir a Apple.
Solo hay que recompilar y re-subir si cambiás algo *nativo* (ícono, nombre,
permisos, plugins).

## Android (a futuro)

Con esta misma base, agregar Android es casi gratis: `npx cap add android` y
abrir en Android Studio. Google Play cuesta US$25 (pago único) y no necesita Mac.
