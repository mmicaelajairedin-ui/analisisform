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

> Pendiente (mejora, no bug): hoy son 4 implementaciones del mismo contrato. El
> destino ideal es un único `pw-chat.js` que todas incluyan. El contrato protege
> el "hoy" mientras tanto.

## Estado actual (julio 2026)

Portales del cliente:

| Portal | chat | subGate | consent | presencia | informe |
|--------|:----:|:-------:|:-------:|:---------:|:-------:|
| `cliente.html` (base) | ✓ | ✓ | — | ✗ | ✗* |
| `pathway-fit-cliente` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pathway-fin-cliente` | ✓ | ✓ | ✓ | ✗ | ✗ |

\* `cliente.html` es del linaje async y podría cargar el informe con otro patrón
(a confirmar). Por eso está en `report`, no en `enforce`.

**Huecos conocidos (a decidir uno por uno):**
- **Presencia** ("coach en línea" + latido) solo existe en fitness. Es infra, no
  de nicho → candidato a bajar a la base y sumar a fin/cliente.
- **Informe de IA** en el arranque: fitness lo carga; finanzas no lo consulta.
  ¿Finanzas debería mostrar el informe? Si sí, es un bug a cerrar.

## Cómo trabajar con esto

- **Al detectar un hueco** (una pieza que un clon perdió): sumarlo a la lista de
  piezas de su familia en `check-parity.js`, nivel `report`. Queda documentado.
- **Al cerrar el hueco** (agregar la pieza donde faltaba): subirlo a `enforce`.
- **Al crear un nicho nuevo:** copiar la estructura de un portal existente y
  correr `node scripts/check-parity.js` — te dice qué cableado te falta para que
  quede a la par, en vez de descubrir los huecos en producción.

Corre junto a los otros guardianes:
`node scripts/check-syntax.js && node scripts/check-smoke.js && node scripts/check-guardrails.js && node scripts/check-parity.js`
