# Icon System de Pathway — una sola librería para toda la plataforma

**Objetivo:** que TODAS las pantallas (landing, panel del coach `panel-v2`,
`multicoach`, portales del cliente career/fit/finanzas y páginas de empresa)
usen **los mismos iconos, con el mismo estilo**. Nada de pequeñas diferencias
de una pantalla a otra, ni emojis del sistema mezclados con SVGs.

## La regla (no negociable)

- **Librería única:** solo iconos **[Lucide](https://lucide.dev/icons)**. No se
  mezcla con Font Awesome, Material, Feather, Ionicons, etc. (el check
  `scripts/check-icons.js` lo hace fallar el build).
- **Estilo:** **outline** (line icons), nunca filled.
- **Grosor:** `stroke-width: 2px`.
- **Tamaño:** **20px** por defecto · **18px** en botones chicos (`.pw-ic-sm`).
- **Color:** **`#1F4030`** (token `--pw-icon`). Dentro de un control con color
  propio (botón sólido, badge de color) el icono **hereda `currentColor`** para
  no quedar invisible sobre fondos oscuros.
- **Sin emojis en el chrome.** Los emojis quedan SOLO como *contenido*:
  medallas 🥇🥈🥉, banderas de país, la mascota 🐐, y los iconos a color de la
  agenda fitness (💪⭐🍎). Todo lo que sea icono de *interfaz* (nav, botones,
  tabs, badges de sección, tarjetas) va en Lucide.
- **Los mensajes de email/WhatsApp NO son chrome.** Son texto plano que se envía
  fuera de la plataforma (no renderiza SVG), así que ahí los emojis se quedan.

## Fuente única de verdad

| Archivo | Qué es |
|---------|--------|
| `pw-icons.css` | El **estilo**: tamaño, grosor, color, el "chip" gris. Cambiar el look de TODOS los iconos = tocar solo este archivo. |
| `pw-icons.js`  | El **mapa** de iconos Lucide (`window.PWI.IC`) + la API para renderizarlos. Sumar un icono nuevo = agregarlo acá UNA vez. |

`panel-v2.html` ya **no** declara su propio mapa: hace `var IC = window.PWI.IC`.
El chat (`pw-ia-chat.js`) comparte el mismo set y estilo (outline, 2px).

## Cómo usar un icono

**1. En HTML estático** — con `<i data-ic>` (se monta solo en `DOMContentLoaded`):

```html
<a class="btn-primary"><i data-ic="calendar" data-sm></i> Agenda una demo</a>
<div class="hp-ni"><i data-ic="settings" data-size="13"></i> Configuración</div>
```

- `data-sm` → 18px (botones chicos).
- `data-size="N"` → tamaño puntual en px (contextos muy chicos como mockups).
- `data-title="..."` → accesibilidad (agrega `aria-label` + `<title>`).

**2. En JS (HTML que se inyecta con `innerHTML` después de cargar)** — con
`PWI.svg()`, porque `data-ic` solo se auto-monta al cargar la página:

```js
'<a class="pw-primary-cta">' + PWI.svg('calendar', {sm:true}) + ' Agenda tu demo</a>'
PWI.svg('checkCircle', {size:46})     // tamaño puntual
PWI.chip('star')                       // icono dentro del chip gris redondeado
```

> ⚠️ Si el texto pasa por una función `esc()` antes de ir al DOM, el SVG se
> escaparía y saldría como texto. En esos casos (ej. chips del chat) se deja el
> label sin icono, o se renderiza el icono aparte del texto escapado.

**3. Icono dentro del chip gris** (el cuadradito de las tarjetas Resumen /
Fortalezas / Áreas a mejorar / Estrategia): `PWI.chip('target')` o
`<span class="pw-icchip"><i data-ic="target"></i></span>`.

## Agregar un icono nuevo

1. Buscar el nombre en https://lucide.dev/icons (siempre el outline).
2. Copiar el path/inner SVG y agregarlo a `IC` en **`pw-icons.js`** con un nombre
   semántico (ej. `calendar`, `briefcase`, `trendUp`).
3. Usarlo por ese nombre en todas las pantallas. **Nunca** pegar un `<svg>`
   suelto en una pantalla — eso reintroduce el drift que este sistema elimina.

## El check que lo blinda

`node scripts/check-icons.js` (corre en CI y en el comando pre-commit):

- **Falla** si: falta la fuente única o se le cambió el spec; aparece otra
  librería de iconos; una pantalla clave no carga `pw-icons.js`; o `panel-v2`
  vuelve a declarar su propio mapa.
- **Reporta** (sin frenar el merge) los emojis pictográficos de chrome que aún
  quedan en superficies ya migradas, para irlos cerrando. Al terminar de
  convertir una pantalla, agregarla a la lista `CONVERTED` del check.

## Estado de la migración

- ✅ Fundación (`pw-icons.js` + `pw-icons.css`) + guardrail + este doc.
- ✅ Fuente única cargada en landing, `panel-v2`, `multicoach`, portales
  career/fit/finanzas, empresa, login, cv/carta, registro.
- ✅ `panel-v2` usa `window.PWI.IC` (ya no duplica el mapa).
- ✅ Chat (`pw-ia-chat.js`) alineado al spec (outline, 2px).
- ✅ Landing (`index.html`) con el chrome convertido a Lucide.
- ⏳ Pendiente: barrer el chrome emoji restante de `panel-v2`, `multicoach`,
  `cliente` y los portales fit/fin (usar `PWI.svg`/`data-ic`, subir cada
  pantalla a `CONVERTED` en el check al terminarla).
