# La base de la plataforma — qué se replica sí o sí

> **Para qué sirve esto:** que crear algo nuevo (un nicho, un panel) **replique**
> la base en vez de crear un clon que se desincroniza. Acá vive el estándar; el
> test `scripts/check-parity.js` lo hace cumplir. No es un refactor grande: crece
> hallazgo por hallazgo, sin romper nada.

## La idea en una frase

Separar el **CABLEADO** (formulario, guardado, auth, chat, presencia, medallas —
lo que se repite) del **CONTENIDO** (las preguntas y detalles de cada nicho — lo
único que debería cambiar). El cableado se define una vez acá y se **verifica**
que esté presente en todas las pantallas que lo necesitan.

## Cómo se organiza la paridad

- **Familias** = pantallas del mismo tipo, que comparten cableado:
  - **Portales del cliente:** `cliente.html` (carrera, linaje base/async),
    `pathway-fit-cliente.html`, `pathway-fin-cliente.html` (linaje pathway).
  - **Paneles del coach:** `panel-v2.html`, `panel-empresa.html`, `empleado.html`.
  - **Formularios:** `formulario.html`, `pathway-fit-form.html`, `pathway-fin-form.html`.
- **Contratos transversales** = piezas que aparecen en varias familias y deben
  respetar el **mismo contrato** para interoperar (chat, guardado a Supabase,
  auth, presencia).

## Dos niveles (para crecer sin romper nada)

| Nivel | Qué pasa si falta | Cuándo usarlo |
|-------|-------------------|---------------|
| **enforce** | el test **falla** y frena el merge | la pieza ya está bien en todos → se congela |
| **report** | solo se **lista** como hueco pendiente | hay un hueco real todavía → se documenta sin romper CI |

Cuando cerramos un hueco, se sube de `report` a `enforce` en `check-parity.js`.

## Contrato del chat coach↔cliente (el caso testigo)

El chat vive en las dos puntas (portal del cliente **y** panel del coach). Hoy
**coinciden** en las 4 pantallas; el contrato lo mantiene así:

- **Dónde se guarda:** columna `candidatos.notas_coach`, como **array JSON**.
- **Forma del mensaje:** `{ from, text, time, ts }`.
- **Emisor (`from`):** `'coach'` o `'cliente'` (nunca `client`/`user`/`sender`).
- **Dedup:** por `from|text|ts`.

`check-parity.js` falla si alguna pantalla rompe este vocabulario.

## Invariantes: detectar errores, no solo ausencias

La matriz de familias dice si una pieza **está**. Los **invariantes** dicen si
está **bien**. Detectan el caso "la pieza existe pero implementada mal/insegura",
que la matriz de presencia no ve. Cada invariante que hoy se cumple queda
congelado: si un clon futuro lo rompe, el test falla. Hoy vigentes:

| Invariante | Qué error atrapa |
|-----------|-------------------|
| **chat-merge-safe** | enviar un mensaje escribiendo `notas_coach` **sin re-leer** antes → pisa los mensajes de la otra punta (pérdida de datos) |
| **chat-escape** | renderizar `m.text` **crudo** (concatenado sin `esc()`/`hh()`) → inyección XSS |
| **auth-expiry** | `sbGet` que no maneja **401/403** → token vencido muestra el portal vacío en vez de mandar a login |
| **chat-dedup** | `_mkey` que no usa la clave canónica `from\|text\|ts` → mensajes duplicados o que no se emparejan |

Al arreglar un bug de cableado nuevo, sumar un invariante acá para que no vuelva.

> Pendiente (mejora, no bug): hoy son 4 implementaciones del mismo contrato. El
> destino ideal es un único `pw-chat.js` que todas incluyan. El contrato protege
> el "hoy" mientras tanto.

## Líneas de producto (el mapa real)

La plataforma no es "1 producto con nichos": son varias líneas, algunas sobre la
base y otras como islas.

| Línea | Portal | Formulario | Panel | Estado base |
|-------|--------|-----------|-------|-------------|
| **Carrera** (core) | `cliente.html` | `formulario.html` | `panel-v2.html` | define la base |
| **Fitness** (nicho) | `pathway-fit-cliente` | `pathway-fit-form` | usa `panel-v2` | sobre la base |
| **Finanzas** (nicho) | `pathway-fin-cliente` | `pathway-fin-form` | usa `panel-v2` | sobre la base (con huecos) |
| **Empresas** (B2B nuevo) | *(por hacer)* | *(por hacer)* | `panel-empresa` | 🟡 maqueta, isla |
| Express | — | `cv-express` | `admin-express` | isla |
| Marketplace | — | `registro` | `coach` / `coaches` | isla |
| Agenda | — | `reservar`=`agendar` | — | isla |
| *Team interno* | — | — | `empleado.html` | fuera de paridad (no es producto) |

## Estado actual (julio 2026)

Portales del cliente:

| Portal | chat | subGate | consent | presencia | informe |
|--------|:----:|:-------:|:-------:|:---------:|:-------:|
| `cliente.html` (base) | ✓ | ✓ | — | ✗ | ✗* |
| `pathway-fit-cliente` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pathway-fin-cliente` | ✓ | ✓ | ✓ | ✗ | ✗ |

Paneles del coach:

| Panel | datos reales | pw-auth | aislamiento | chat | presencia | medalla |
|-------|:-----------:|:-------:|:-----------:|:----:|:---------:|:-------:|
| `panel-v2` (core+nichos) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `panel-empresa` (B2B) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

\* `cliente.html` es del linaje async y podría cargar el informe con otro patrón
(a confirmar). Por eso está en `report`, no en `enforce`.

**Huecos conocidos (a decidir uno por uno):**
- **Presencia** ("coach en línea" + latido) solo existe en fitness. Es infra, no
  de nicho → candidato a bajar a la base y sumar a fin/cliente.
- **Informe de IA** en el arranque: fitness lo carga; finanzas no lo consulta.
  ¿Finanzas debería mostrar el informe? Si sí, es un bug a cerrar.
- **`formulario.html`** (carrera) no tiene el branding de coach (`&coach=`) que
  sí tienen los formularios de nicho.

## El producto de Empresas: cablearlo SOBRE la base (no como isla)

`panel-empresa.html` hoy es **maqueta** (UI `.ecw-`, sin datos ni auth). Es el
momento ideal para que herede el cableado en vez de reinventarlo. Al cablearlo:

1. Cargar **`pw-auth.js`** (fuente única de clave/URL + JWT).
2. Usar los **helpers `sbGet/sbPatch`** compartidos, no funciones nuevas.
3. **🔴 Aislamiento multi-empresa (`empresaGuard`)** desde el día 1: cada query
   filtra por `empresa_id`. Es el equivalente B2B de `coachGuard`; sin esto, una
   empresa podría ver datos de otra (agujero de seguridad).
4. Si tiene chat, respetar el **contrato `notas_coach` `{from,text}`**, no el
   sistema `mensajes` aparte.
5. Reusar **medalla + foto + presencia** del panel base (o su contrato).
Lo que SÍ puede diferir (contenido): la UI, las columnas de datos y las preguntas.

## Cómo trabajar con esto

- **Al detectar un hueco** (una pieza que un clon perdió): sumarlo a la lista de
  piezas de su familia en `check-parity.js`, nivel `report`. Queda documentado.
- **Al cerrar el hueco** (agregar la pieza donde faltaba): subirlo a `enforce`.
- **Al crear un nicho nuevo:** copiar la estructura de un portal existente y
  correr `node scripts/check-parity.js` — te dice qué cableado te falta para que
  quede a la par, en vez de descubrir los huecos en producción.

Corre junto a los otros guardianes:
`node scripts/check-syntax.js && node scripts/check-smoke.js && node scripts/check-guardrails.js && node scripts/check-parity.js`

## Diseño unificado + white-label (la 4ta garantía)

Objetivo: que lo NUEVO nazca con la misma tipografía, espacios y colores, y que
se pinte con el color de cada coach (+ sus variantes) sin reimplementar nada.

**El token que manda: `--accent`.** Es el color del coach. Toda pieza nueva debe
usar `var(--accent)` (y sus variantes `--accent-dark/-mid/-light/-soft`), nunca
un hex suelto. Así el white-label la sigue sola.

**Cómo estaba (fragmentado):** cada pantalla tenía su propio motor de marca con
su propio token — `cliente.html`→`--brand`, fit/fin→`--rose`, panel→`--pw-bosque`.
Reusar el white-label en algo nuevo era imposible.

**Cómo quedó (unificado):**
- **`pathway-base.css`** = base canónica de tokens (colores, `--accent` + variantes,
  tipografía `--pw-serif/--pw-sans`, escala de espaciado `--sp-*`). Es para pantallas
  NUEVAS (ej. el producto de empresas). *No se enlaza sobre portal.css/panel porque
  sus clases de componente (`.app`, `.card`) chocarían.*
- **`pw-brand.js`** = motor ÚNICO de white-label. `PWBrand.apply(colorDelCoach)`
  aplica el color + variantes a `--accent*` (y a los históricos `--brand*`/`--rose*`).
  Lo nuevo incluye este script y llama `PWBrand.apply(...)`.
- **Los 4 motores viejos** (`_pwBrandVars`, `_applyCoachColor`, `_applyPanelBrand`)
  ahora ADEMÁS setean `--accent`, así `var(--accent)` sigue al coach en TODA la app.
  Guardrail: si un motor deja de setear `--accent`, el test falla.

**Al construir algo nuevo:** incluí `pathway-base.css` + `pw-brand.js`, usá los
tokens (`var(--accent)`, `--pw-serif`, `--sp-4`…) y llamá `PWBrand.apply(color)`.
Queda unificado y white-label sin diseño desde cero.

> Pendiente (convergencia gradual, sin apuro): unificar los 3 juegos de nombres de
> token (`--brand`/`--rose`/`--pw-bosque`) en `--accent` a medida que se toque cada
> pantalla. Hoy conviven vía alias; no se fuerza para no romper looks.
