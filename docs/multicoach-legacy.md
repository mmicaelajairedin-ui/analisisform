# MultiCoach — legacy tras el cierre del Carril A (septiembre 2026)

**Nada de lo que aparece aquí se ha borrado.** Este documento existe para que se
sepa qué quedó sin uso y por qué, y para que el borrado sea una decisión
posterior y deliberada, no un efecto colateral del cierre.

Decisión de partida: **MultiCoach oficial = `multicoach.html` (Carril A)**. Es la
única aplicación de red que se termina y se mantiene.

---

## 1. Permisos del colaborador — tres almacenes, uno solo vivo

Antes del cierre convivían tres sitios distintos para "qué ve un colaborador":

| Almacén | Quién escribía | Quién leía | Estado |
|---|---|---|---|
| `usuarios.configuracion.mc_permisos` | nadie | nadie | **AHORA es la fuente única** |
| `usuarios.configuracion.permisos` | los toggles de la ficha de coach | nadie decidía nada con él | Sigue vivo, **otra cosa** |
| tabla `colaborador_permisos` | **nadie** | 3 frontends | **LEGACY** |

### `mc_permisos` — la fuente única
Contrato, validado por `editar-coach-red`:

```json
{ "v": 1, "org_id": "<uuid de la org>", "grants": ["clientes", "agenda", "..."] }
```

`grants` es la lista **completa**, no un incremento: quitar un permiso es
guardar la lista sin él. El vocabulario lo define MultiCoach
(`MC_GRANT_DEFS` en `multicoach.html`) y la edge function lo guarda verbatim.

Escribe: la pestaña **Acceso** de la ficha de coach (`_mcAccSave`).
Leen: `multicoach.html` (`mcBoot`), `login.html` / `login-en.html`, `panel-v2.html`.

Semántica: **sin la clave = acceso completo** (el dueño todavía no lo acotó);
lista vacía = sin acceso a ninguna sección.

### `configuracion.permisos` — NO es lo mismo, y sigue en uso
Claves `negocio`, `perfil_publico`, `marketplace`. Son **capacidades de Pathway**
(qué puede hacer esa persona como coach, si figura dando clases, si recibe
clientes del marketplace), no acceso a secciones de MultiCoach. Se quedan como
están y se siguen editando desde el carril lateral de la ficha.

### Tabla `colaborador_permisos` — LEGACY
- Migración: `supabase/migrations/0109_colaborador_permisos.sql`
- **Ninguna pantalla la escribió nunca.** Solo se podía poblar por SQL a mano,
  así que en la práctica todo colaborador se quedaba sin permisos.
- Ya no la lee nadie. **No se ha borrado**: si alguien la pobló manualmente,
  esos datos siguen ahí.
- Para retirarla: comprobar que está vacía o migrar sus filas a
  `configuracion.mc_permisos`, y solo entonces borrar tabla y migración.

---

## 2. Carriles retirados — todavía en el repositorio

Ninguno se ha borrado ni redirigido en esta fase.

| Carril | Archivos | Estado |
|---|---|---|
| B | `multicoach-v3.html` | Ya no es destino de nadie. `login`, `pago-listo` y `panel-v2` apuntan a `multicoach.html`. Su edge function `dashboard` **sí se conserva** como backend a reutilizar. |
| C | 11 × `owner-*.html` en la raíz | Maqueta navegable, sin backend ni sesión. Se sirve públicamente en el dominio. |
| D | `multicoach/pages/` (10), `multicoach/js/` (3), `multicoach/styles/` (3) | Inalcanzable: los enlaces del menú no tienen `href` ni listener. Define un segundo sistema de diseño sin tokens Pathway. |

Antes de borrar C y D conviene extraer dos referencias del carril C: el layout de
`owner-program-detail.html` y su patrón de una URL por pantalla.

---

## 3. Edge functions desplegadas que MultiCoach no usa

Se dejan desplegadas. Ninguna es un bug; simplemente el carril A resuelve lo
mismo por otra vía.

**Duplicadas** — hay otra función, gateada al dueño, que ya hace el trabajo:

| Sin usar | La cubre |
|---|---|
| `reassign-client` | `asignar-cliente` (mismas dos tablas) |
| `load-org-clients` | `mi-red` |
| `load-team-members` | `mi-red` |
| `add-collab-to-org` | `agregar-coach-red` con `member_role:'colaborador'` |
| `remove-member-org` | `eliminar-coach-red` |
| `change-owner-org` | `cambiar-owner` |

**De administración** — son operaciones de la admin sobre una organización
cliente, no del dueño sobre la suya. No deben aparecer nunca en MultiCoach:
`cambiar-plan-org`, `suspender-org`.

**Fuera del alcance del producto:** `business-identity-generate` y
`analizar-logo` (Business Identity Engine — proyecto aparte, ver
`docs/BUSINESS_IDENTITY_ENGINE.md`), junto con la maqueta
`multicoach/pages/owner-identidad.html`.

**Conservada y ahora sí en uso desde el carril A:** `add-coach-to-org`, cuyo
gate se abrió al dueño de la organización en este cierre. La pantalla que la
usará (sumar a la red un coach que ya existe como independiente) es P2 y no
entra en el cierre núcleo.

---

## 4. Alta self-serve de red — fuera del cierre, y por qué

La Fase 8 del plan decía: implementar solo si abrir el gate de
`crear-multicoach` es un cambio mínimo y seguro; si toca una decisión de
producto o de cobros, documentarlo y dejarlo fuera. **Toca una decisión de
cobros, así que queda fuera.**

`crear-multicoach` recibe en el cuerpo `{ email, nombre, nombre_red, plan, nicho,
dias }` y crea al dueño y su organización con los límites del plan y la duración
de prueba que se le pidan. Hoy está gateada a `rol='admin'` y eso es lo que la
hace segura: quien decide plan y prueba es Micaela.

Abrirla al público no es cambiar un gate — es decidir antes:

- ¿Se cobra antes o después de crear la red? (`stripe-webhook` ya trata el plan
  «red», pero **espera encontrar un dueño con ese email**: si no lo encuentra
  avisa a la admin y no crea nada. Así que el orden importa.)
- ¿Qué planes son self-serve? Tal como está, el cuerpo puede pedir `plan:'pro'`
  —coaches y clientes ilimitados— gratis.
- ¿Cuántos días de prueba, y quién impide que alguien pida 3 650?
- ¿Qué evita el alta masiva de redes falsas?

Ninguna de esas respuestas está en el repositorio. Hasta que existan, el alta de
una red se sigue haciendo desde el panel admin, que es lo que hay hoy.

---

## 5. Pendiente técnico único: almacenamiento de los adjuntos

Las fotos, planes, documentos y recursos de la ficha del cliente se ven al
soltarlos pero **viven solo en memoria**: se pierden al recargar. En el cierre se
quitó el «✓» que afirmaba lo contrario y ahora, en una red real, la zona de
arrastre avisa de que es una vista previa.

Falta decidir el almacenamiento: **Uploadcare** (ya en uso para los CV, con
cuenta y widget montados) o **Supabase Storage** (mismo proveedor que el resto
de los datos, con RLS por org). Es una decisión, no un desarrollo: en cuanto
esté, son cinco puntos de subida (`_avatarDrop`, `_cliDocFiles`, `_progFiles`,
`_sesFiles`, `_recursosFiles`) y una columna donde guardar las URLs.

---

## 6. `pathway-handoff` — conservada, sin uso

`login.html` mandaba al dueño a `pathwayplatforms.com` con un código de un solo
uso emitido por `pathway-handoff`. Ese dominio nunca se activó
(`docs/PATHWAYPLATFORMS_SETUP.md` lo marca PENDING), así que el dueño acababa
fuera del producto. Ahora la entrada es `/multicoach.html`, mismo origen, y el
handoff no hace falta: la sesión viaja sola.

La función **sigue desplegada y sin tocar**. Si algún día se activa el dominio
propio, se vuelve a ella cambiando el bloque del login — y actualizando a la vez
el guardrail `multicoach: el dueño logueado ve su RED REAL`, que hoy exige el
destino único.

---

## 7. Pasos de despliegue de este cierre

Nada de esto se ha desplegado. En orden:

1. **SQL Editor de Supabase** — aplicar `supabase/migrations/0112_programs_rls_fix.sql`.
   Es idempotente y solo toca policies. **Sin ella no hay Programas**: la tabla
   sigue siendo invisible para el dueño y el listado sale vacío.
2. **Edge functions** — redesplegar las dos que cambiaron:
   `supabase functions deploy mi-red --no-verify-jwt`
   `supabase functions deploy add-coach-to-org --no-verify-jwt`
   (`mi-red` es la que hace que la nota del cliente vuelva al recargar.)
3. **Frontend** — el push a `main` lo publica solo (Cloudflare Pages).

Comprobación después de desplegar, con sesión de dueño real:
- entrar por el login y aterrizar en `/multicoach.html`;
- Programas: crear uno, recargar, y que siga;
- ficha de cliente: escribir una nota, recargar, y que siga;
- ficha de coach → Acceso: quitar un módulo, guardar, entrar como ese
  colaborador y comprobar que no ve esa sección.

---

## 8. Un hallazgo fuera del alcance del cierre

`tests/coach-services-ios-blocking.test.js` está escrito en estilo Jest
(`describe`/`test` globales, sin importarlos de `@playwright/test`). Como
`playwright.config.js` recoge todo `./tests`, el runner **aborta al recolectar y
la suite entera se queda en 0 tests**. Se ha comprobado que ocurre igual en
`origin/main`, así que **es anterior a este cierre y no lo causa**.

Consecuencia: la suite de Playwright de este repositorio llevaba tiempo sin
ejecutar nada, lo que explica que «los tests estén verdes» no significara nada.
No se ha tocado el archivo — es de iOS, no de MultiCoach. Arreglarlo (moverlo a
un runner de Jest o reescribirlo con la API de Playwright) es una tarea aparte.
