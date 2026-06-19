# 📱 Publicar Pathway en la App Store — Guía paso a paso

Esta guía lleva la plataforma **Pathway** (que ya funciona en la web) a una
**app de iPhone en la App Store**. La parte técnica ya está preparada en esta
carpeta (`app-ios/`); lo que falta son pasos que **se hacen en una Mac**.

> **Resumen honesto:** no se puede compilar ni subir una app de iPhone sin una
> **Mac con Xcode**. Tu iPhone sirve para *probar* la app y para *sacar las
> capturas*, pero no para *armarla*. Si no tenés Mac: pedí prestada una, o usá
> un servicio de "Mac en la nube" (ej. **Codemagic**, tiene plan gratis).

---

## Cómo funciona esta app

Es una **envoltura** (con una herramienta llamada Capacitor): la app abre tu
sitio en vivo `pathwaycareercoach.com/app.html` dentro de una ventana propia,
con su ícono, su pantalla de inicio y nombre "Pathway". Ventaja: **cada vez que
actualizás la web, la app se actualiza sola** — no hay que volver a subir nada a
Apple por cada cambio.

- **ID de la app (bundle id):** `com.pathwaycareercoach.app`
- **Nombre:** Pathway
- **Abre en:** `https://pathwaycareercoach.com/app.html?source=ios`

---

## FASE 0 — Esperar el email de Apple (ya en curso)

Pagaste el Apple Developer Program (99 €/año). Apple tarda **24-48 h** (a veces
más) en activar la cuenta. Cuando llegue el email **"Welcome to the Apple
Developer Program"**, ya podés entrar a [App Store Connect](https://appstoreconnect.apple.com)
y seguir. Hasta entonces, no se puede subir nada.

---

## FASE 1 — Preparar en la Mac

Necesitás instalar (una sola vez):
1. **Xcode** — gratis desde la App Store de la Mac (pesa varios GB, tardá).
2. **Node.js** — desde https://nodejs.org (versión LTS).
3. **CocoaPods** — en la Terminal: `sudo gem install cocoapods`

Después, en la Terminal de la Mac:

```bash
# 1) Traé el código (la rama donde está preparado todo)
git clone https://github.com/mmicaelajairedin-ui/analisisform.git
cd analisisform
git checkout claude/admiring-lamport-5wg96j   # o la rama donde quedó app-ios/

# 2) Entrá a la carpeta de la app
cd app-ios

# 3) Instalá las dependencias
npm install

# 4) Generá el proyecto de iPhone (crea la carpeta ios/)
npx cap add ios

# 5) Generá íconos y splash desde app-ios/assets/icon.png y splash.png
npx capacitor-assets generate --ios

# 6) Sincronizá todo al proyecto iOS
npx cap sync ios

# 7) Abrí el proyecto en Xcode
npx cap open ios
```

Si algún comando `npx cap ...` no se encuentra, usá `npx @capacitor/cli ...`.

---

## FASE 2 — Configurar y probar en Xcode

Ya con Xcode abierto (panel izquierdo → seleccioná el proyecto **App**):

1. **Signing & Capabilities** → **Team**: elegí tu cuenta de Apple (la del
   Developer Program). Xcode crea el certificado solo.
2. Confirmá que **Bundle Identifier** sea `com.pathwaycareercoach.app`.
3. **General** → poné **Version** `1.0` y **Build** `1`.
4. Conectá tu **iPhone** por cable, elegilo arriba como destino y tocá ▶️
   (Run). La app se instala en tu teléfono → probala de punta a punta
   (login de coach, login de cliente, todo).

> Si al correr pide "Trust" en el iPhone: Ajustes → General → VPN y gestión de
> dispositivos → confiá en tu certificado de desarrollador.

---

## FASE 3 — Crear la ficha en App Store Connect

Entrá a https://appstoreconnect.apple.com → **Apps** → **+** → **Nueva app**:

- **Plataforma:** iOS
- **Nombre:** Pathway (si está tomado, probá "Pathway Career Coach")
- **Idioma principal:** Español (y agregá Inglés como idioma adicional)
- **Bundle ID:** `com.pathwaycareercoach.app` (el que registró Xcode)
- **SKU:** `pathway-001` (interno, lo que quieras)

Después completá la ficha (pestaña de la versión 1.0):

| Campo | Qué poner |
|-------|-----------|
| **Subtítulo** | "Coaching de carrera con IA" |
| **Descripción** | Qué es Pathway, para coaches y para candidatos (reusá texto de la landing) |
| **Palabras clave** | coaching, carrera, CV, empleo, mentoría, LinkedIn |
| **URL de soporte** | https://pathwaycareercoach.com |
| **URL de privacidad** | https://pathwaycareercoach.com/privacidad.html |
| **Categoría** | Negocios (o Productividad) |
| **Precio** | Gratis |
| **Clasificación por edad** | 4+ |

**Capturas de pantalla (obligatorias):** sacalas desde tu iPhone con la app
abierta (botón lateral + subir volumen). Apple pide al menos las del tamaño
**6.7"** (iPhone 15/16 Pro Max). Subí 3-5 pantallas lindas (dashboard, portal
del cliente, perfil del coach).

**Privacidad de datos ("nutrition labels"):** Apple pregunta qué datos
recopilás. Pathway guarda **email y nombre** (para la cuenta) — marcá eso,
vinculado a la identidad del usuario, uso "funcionamiento de la app".

**⚠️ Cuenta de demo (clave para que no te rechacen):** en "App Review
Information" tenés que dejar un **usuario y contraseña de prueba** para que el
revisor de Apple pueda entrar. Creá un coach de prueba en tu panel y poné ahí
ese email + contraseña, con una nota: *"Use these credentials to log in as a
coach."*

---

## FASE 4 — Subir y enviar a revisión

En Xcode:
1. Arriba, cambiá el destino a **"Any iOS Device (arm64)"**.
2. Menú **Product → Archive**. Esperá a que compile.
3. En la ventana **Organizer** que se abre → **Distribute App** →
   **App Store Connect** → **Upload**. Seguí los pasos (Xcode firma solo).
4. Volvé a App Store Connect: en la versión, elegí el **build** que subiste
   (tarda ~15 min en aparecer tras procesarse).
5. **Add for Review** → **Submit**.

La revisión de Apple tarda **de 1 a 3 días** normalmente.

---

## FASE 5 — Si te rechazan (qué esperar)

El rechazo más común para apps que "muestran un sitio web" es el **Guideline
4.2 (Minimum Functionality)**. Pathway **no** es una web de folletos: es una
herramienta real con login, gestión de clientes, informes con IA, documentos y
chat — eso suele alcanzar. Si igual lo objetan:

- Respondé en el **Resolution Center** explicando que es un SaaS funcional para
  coaches (no contenido de marketing), con cuentas, datos privados y trabajo
  real dentro de la app.
- El refuerzo más fuerte es agregar **notificaciones push nativas** (ver abajo).

---

## SIGUIENTE (v1.1) — Notificaciones push nativas (opcional)

Hoy tenés push **web** (funciona en la PWA, no dentro de la app nativa). Para
push dentro de la app de iPhone hace falta el camino de Apple (APNs):

1. En el [portal de Apple Developer](https://developer.apple.com) → Keys →
   creá una **APNs Key** (.p8). Guardá el Key ID y el Team ID.
2. En Xcode → Signing & Capabilities → **+ Capability → Push Notifications**.
3. Agregá el plugin: `npm install @capacitor/push-notifications` y registrá el
   token del dispositivo (código de ejemplo en la doc de Capacitor).
4. En el backend (`supabase/functions/send-push`) sumá el envío por APNs además
   del web push actual.

Esto se puede dejar para una segunda versión. La v1.0 puede salir sin esto.

---

## Costos y tiempos (realista)

- **Apple Developer Program:** 99 €/año (ya pagado). Se renueva solo cada año.
- **Mac:** propia / prestada / nube (Codemagic gratis para empezar).
- **Primera publicación:** medio día de trabajo en la Mac + 1-3 días de revisión
  de Apple.
- **Mantenimiento:** como la app carga el sitio en vivo, los cambios de la web
  NO requieren volver a subir a Apple. Solo resubís si cambiás el ícono, el
  nombre, o agregás funciones nativas (como push).

---

## Archivos de esta carpeta

| Archivo | Qué es |
|---------|--------|
| `capacitor.config.json` | Configuración: ID, nombre, a qué URL apunta |
| `package.json` | Dependencias de Capacitor (se instalan con `npm install`) |
| `www/index.html` | Pantalla de respaldo si el celular está sin internet |
| `assets/icon.png` | Ícono 1024×1024 (App Store) — generado del logo |
| `assets/splash.png` | Pantalla de inicio 2732×2732 |
| `.gitignore` | Ignora `node_modules/` y la carpeta `ios/` (se generan en la Mac) |
