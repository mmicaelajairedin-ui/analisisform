# Fase 4 · Analytics, Search Console y Bing — auditoría del 2026-09-16

Auditado sobre el código de los dos repositorios. **Nada de esto está supuesto:
cada "no" de abajo es un `grep` que devolvió cero.** Lo que no se puede ver desde
aquí —si una propiedad existe en la consola de Google, si un dominio está
verificado por DNS— se declara como no verificable, no como ausente.

---

## 0 · ACTUALIZACIÓN DEL 2026-09-17 — las cuatro altas están hechas, y al cablear apareció que lo anterior estaba INERTE

Micaela creó las cuatro cuentas y dio los identificadores, así que el cuello de
botella del §5 —«ninguno de los cinco cortes se puede hacer hoy»— deja de
existir:

| | Career Coach | Platforms |
|---|---|---|
| **GA4** | `G-58YWJ242GW` | `G-DXH3T9RERF` |
| **Clarity** | `yjs66fo80e` | `yjs6oqgx90` |
| **Search Console** | verificada | verificada |
| **Bing Webmaster** | importada | importada |

### El hallazgo, y es el que importa de esta segunda vuelta

**La entrega del 16 estaba puesta y no podía dispararse.** `pw-pixel.js` consulta
`window.pwConsent`, que lo define `pw-consent.js`, y si no está cargado cae a su
respaldo conservador: no carga el pixel y se queda esperando un evento
`pw-consent-change` que en esa página no va a emitir nadie. Las **tres** páginas
que este frente instrumentó —`coach.html`, `reservar.html`, `pago-listo.html`—
**no cargaban `pw-consent.js`**.

O sea que el 16 se escribió «el directorio ya se mide» y no se medía; «la reserva
ya se mide» y no se medía; y `pwTrackPurchase()` llegaba a `track()`, que hace
`if (window.fbq)` — falso sin pixel— así que **PAID seguía en cero por
construcción**, exactamente lo que el §2 decía que venía a cerrar.

Es **R-85 dos veces seguidas en el mismo frente**: la primera fue un instrumento
sin llamantes; la segunda, llamantes sin la condición que los habilita. Y lo
tenía escrito delante: la cabecera de `pw-consent.js` dice desde siempre «**Debe
incluirse ANTES de pw-pixel.js**».

Medido, no deducido: `window.pwConsent` lo define **un solo fichero** (`grep` de
`window.pwConsent *=` → `pw-consent.js` y nada más), y `coach.html` cargaba
`pw-icons.js`, `pw-pixel.js` y `testimonios.js`. Ninguno más.

### Qué se ha hecho

1. **`pw-analytics.js`** — GA4 + Clarity, una sola puerta, con la misma doctrina
   que el pixel: constante vacía ⇒ **no se inyecta ningún script, no se abre
   ninguna conexión y no se pone ninguna cookie**. Y la misma puerta de
   consentimiento, sin excepción: **Clarity graba la sesión**, así que esto no es
   una decisión de métrica, es un permiso.
2. **El conjunto de páginas que miden se DERIVA, no se escribe a mano**:
   sitemap (todo lo indexable) **∪** embudo (las que ya cargan el pixel) **∪**
   `verify.html`, que es el escalón de ACTIVATION del §E. Son **58**.
3. **43 de esas 58 no tenían `pw-consent.js`** — entre ellas las tres de arriba y
   el clúster de contenido entero. Se añade, antes de la medición.
4. **Dos guardarraíles** (295 → 297), con **seis mutaciones, cada una roja por su
   propia aserción**: que la carga siga detrás de su identificador y de su
   consentimiento, y que el conjunto medido se derive y en el orden correcto.

### Consecuencia asumida, y se dice en vez de esconderse

El banner de cookies pasa a verse también en el blog, las calculadoras, la ficha
del directorio y las dos páginas transaccionales. **No es una doctrina nueva** —es
la que el sitio ya aplica en sus landings— y la decisión se guarda por visitante
en `localStorage`, así que quien ya aceptó no vuelve a verlo. La alternativa era
medir sin permiso, con grabación de sesión incluida, y eso no se hace.

### Lo que sigue SIN cablear, a propósito

**ACTIVATION y la reserva**, con la definición exacta del §E de este mismo
documento: las dos necesitan que alguien las NOMBRE y las dé de alta en Meta
Events Manager antes de existir en el código. Lo que sí cambia es que ahora
`verify.html` y `reservar.html` **cargan la medición**, así que los dos escalones
se ven como PÁGINA en GA4 aunque todavía no existan como evento nombrado.

Lo que sigue debajo es la auditoría del 2026-09-16, que no se toca.

---

## 1 · Qué existe de verdad

| Herramienta | Career Coach (`analisisform`) | Platforms (`multicoach`) |
|---|---|---|
| **GA4** | **no existe** · 0 `gtag(`, 0 `G-XXXXXXX`, 0 `GTM-` | **no existe** |
| **Google Tag Manager** | **no existe** | **no existe** |
| **Google Search Console** | **sin verificar por HTML** · 0 `google-site-verification`, 0 fichero `google*.html` en la raíz. Podría estar verificado por DNS — **no se puede saber desde aquí** | ídem |
| **Bing Webmaster** | **sin verificar por HTML** · 0 `msvalidate.01`, no hay `BingSiteAuth.xml` | ídem |
| **Microsoft Clarity** | **no existe** · las coincidencias de "clarity" son la palabra en textos de contenido y un filtro de ruido de un test | **no existe** |
| **Meta Pixel** | **SÍ, y activo** · `pw-pixel.js`, Pixel ID puesto, cargado en 14 páginas | **no existe** |
| **Atribución de origen** | **SÍ** · first-touch de `utm_*`, `fbclid`, `gclid` y referrer en `localStorage` (`pw_attr`), y se adjunta al lead | **no existe** — su único `utm_` es la aserción de un test |
| **Eventos de conversión** | declarados 5, **cableados 2** — ver abajo | ninguno |

**El hallazgo que enmarca el resto: `pw-pixel.js` es una buena base y está a
medio cablear.** Hace exactamente lo que hay que hacer —una sola fuente de
verdad, first-touch, y helpers por evento— y su taxonomía coincide casi punto
por punto con el embudo pedido. Lo que falta no es diseño: son llamantes.

---

## 2 · El embudo, escalón por escalón

| Escalón | ¿Se medía el 2026-09-16? | Dónde |
|---|---|---|
| **ORGANIC** | **no** · sin GSC ni GA4 no hay ninguna fuente de búsqueda orgánica | — |
| **LANDING** | parcial · PageView en 14 páginas | `pw-pixel.js` |
| **CTA** | **no** · ningún clic de llamada a la acción se cuenta | — |
| **CONTACT** | parcial · `Lead` automático al hacer `POST` a `contactos_chat` | landings |
| **SIGNUP** | sí · `CompleteRegistration` | `registro.html` y su gemela inglesa |
| **ACTIVATION** | **no** · no existe evento | — |
| **TRIAL** | sí · `StartTrial`, junto al registro | `registro*.html` |
| **PAID** | **no** · `pwTrackPurchase` estaba declarado y **sin un solo llamante** | — |

Y tres agujeros concretos, que son los que esta entrega cierra:

* **El directorio entero era invisible.** `coach.html` —la ficha pública de cada
  coach, el canal que más trabajo ha costado construir— **no cargaba
  `pw-pixel.js`**: ni una visita, ni atribución. Y su formulario de contacto va
  por la Edge Function `contacto-coach`, que el hook de `Lead` **no
  interceptaba** (solo miraba el `INSERT` REST de las landings). Un contacto
  desde el directorio no generaba ningún evento. **Es R-99 aplicada a la
  medición: dos entradas a la misma acción se instrumentan las dos.**
* **`reservar.html`**, la página donde de verdad se reserva, tampoco cargaba el
  pixel. (`agendar.html` y `demo.html` sí, pero son redirecciones de 35 líneas:
  medían el clic de paso, no la reserva.)
* **`pago-listo.html`**, la confirmación de Stripe, tampoco. Así que **PAID se
  medía en cero por construcción**, con registro y trial sí medidos: el embudo
  se cortaba justo donde empieza el dinero.

---

## 3 · Qué se ha hecho aquí, sin necesitar ninguna credencial

1. **`coach.html`, `reservar.html` y `pago-listo.html` cargan `pw-pixel.js`.**
   PageView y atribución de origen en los tres escalones ciegos.
2. **El hook de `Lead` cubre las DOS puertas**: el `INSERT` REST de las landings
   y la Edge Function `contacto-coach` del directorio. El origen se sigue
   inyectando **solo** en el `INSERT` REST, donde `origen` es una columna:
   meterle un campo que no espera a la Edge Function sería romperla para medir.
3. **`pago-listo.html` dispara `pwTrackPurchase()`**, una vez por pestaña. Se
   llega ahí solo desde el redirect de Stripe, así que la visita ES la compra;
   la guarda evita que una recarga o el botón atrás cuenten otra.
4. **El guardarraíl de tracking pasa de vigilar un fichero a vigilar el embudo**:
   exige la etiqueta `<script>` en las tres páginas nuevas, que el hook cubra las
   dos puertas, y que la compra se dispare **con** su guarda. Seis mutaciones,
   cada una roja por su propia aserción.

> Un tropiezo del método que conviene no repetir, y que es **INC-073 otra vez en
> el mismo repositorio**: la primera versión de la comprobación buscaba la cadena
> `pw-pixel.js` y daba **verde con el `<script>` ya retirado**, porque el
> comentario que hay encima nombra el fichero. Se exige la etiqueta.

**Lo que NO se ha inventado.** Ningún evento nuevo. `pwTrackDemo` sigue sin
llamante y `reservar.html` no dispara conversión, porque el nombre correcto de
ese evento en Events Manager es una decisión, no una deducción — ver abajo.

---

## 4 · Lo que necesita a Micaela · QUÉ · DÓNDE · CÓMO · POR QUÉ

### A · GA4 — no existe ninguna propiedad enganchada

* **QUÉ** · un ID de medición `G-XXXXXXXXXX` por propiedad (una para
  `pathwaycareercoach.com`, otra para `pathwayplatforms.com`).
* **DÓNDE** · `analytics.google.com` → Administrar → Crear propiedad → Flujo de
  datos web.
* **CÓMO** · pegarlo y decirlo aquí. El código se cablea igual que `pw-pixel.js`:
  una constante, y si está vacía **no carga nada**.
* **POR QUÉ** · sin GA4 no hay forma de ver el escalón **ORGANIC** ni de separar
  el tráfico por sección. El Meta Pixel mide conversiones de anuncios, no
  búsqueda orgánica: son dos preguntas distintas.

### B · Google Search Console — sin verificación en el HTML

* **QUÉ** · saber si los dos dominios están verificados, y verificarlos si no.
* **DÓNDE** · `search.google.com/search-console`.
* **CÓMO** · lo más robusto es **propiedad de dominio por DNS** (cubre `http`,
  `https`, `www` y subdominios de una vez). Si prefiere la meta de HTML, se pega
  el `content` y lo cableo.
* **POR QUÉ** · es la ÚNICA fuente de consultas de búsqueda reales, y es lo que
  hace falta para separar **marca** de **no-marca**, que es la pregunta que
  decide si el SEO está funcionando. Además es donde se ve si el `sitemap.xml` se
  ha enviado y cuántas URL están indexadas — dos cosas que desde aquí **no se
  pueden mirar** y que condicionan el siguiente paso del directorio.

### C · Bing Webmaster Tools — sin verificación en el HTML

* **QUÉ** · alta y verificación de los dos dominios.
* **DÓNDE** · `bing.com/webmasters`.
* **CÓMO** · permite **importar desde Search Console** en dos clics, así que
  conviene hacerlo DESPUÉS de B.
* **POR QUÉ** · Bing alimenta a Copilot y a ChatGPT Search. Para un producto que
  quiere ser citado por asistentes, no es un buscador secundario.

### D · Microsoft Clarity — no instalado

* **QUÉ** · un ID de proyecto.
* **DÓNDE** · `clarity.microsoft.com`, gratis y sin límite de tráfico.
* **CÓMO** · igual que GA4: constante vacía = no carga.
* **POR QUÉ** · grabaciones y mapas de calor. Es lo que contesta *por qué* un
  escalón del embudo pierde gente, que ningún contador responde.

### E · Dos eventos que hay que NOMBRAR antes de cablear

* **ACTIVATION** · hoy no existe. El momento objetivo es que el coach verifique
  su email (`verify.html`), que es lo que desbloquea la IA en el panel.
* **RESERVA** · una cita reservada en `reservar.html` no es lo mismo que una
  *demo del producto*, así que disparar ahí el `Schedule` que usa `pwTrackDemo`
  mezclaría dos embudos —el del candidato y el del coach— en el mismo número.
* **QUÉ / DÓNDE / CÓMO** · decidir el nombre y darlo de alta como **evento
  personalizado** en Meta Events Manager → Conversiones personalizadas. Sin ese
  alta, un evento con nombre nuevo llega y no se puede optimizar sobre él.
* **POR QUÉ** · un evento inventado desde el código que nadie ha registrado mide
  en un sitio donde nadie mira. Prefiero dejarlo sin cablear y dicho.

### F · Platforms no mide absolutamente nada

`pathwayplatforms.com` no tiene pixel, ni GA4, ni Clarity, ni verificación. Es
coherente con que hasta hace tres días fuera un formulario de acceso, y deja de
serlo ahora que es una home pública con un CTA comercial. Se cablea en cuanto
haya A y, si se quiere, D. El patrón ya está decidido en ese repositorio:
**una variable de entorno vacía que no carga nada** hasta que se rellena, como
`VITE_DEMO_URL`.

---

## 5 · La segmentación que se pidió, y qué hace falta para tenerla

| Corte | Con qué se obtiene | ¿Se puede hoy? |
|---|---|---|
| Career Coach vs Platforms | dos propiedades de GA4 y dos de Search Console | **no** — falta A y B |
| Directory (`/coach/*`) | informe de páginas de GA4 + filtro de ruta en GSC | **no** — falta A y B |
| Tools (`cv-express`, `cv`, `carta`) | ídem | **no** |
| Content (blog y artículos) | ídem | **no** |
| Brand vs Non-brand | **solo** el informe de consultas de Search Console | **no** — falta B, y no hay sustituto |

O sea: **ninguno de los cinco cortes se puede hacer hoy**, y los cinco dependen
de dos altas que tardan minutos. Es el cuello de botella real de la Fase 4 — no
el código.
