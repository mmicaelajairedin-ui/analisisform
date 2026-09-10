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

## 1-bis. Reconciliación con el esquema REAL de producción (septiembre 2026)

Al ir a desplegar se comprobó el esquema contra la base y **el repositorio no
era la fuente de verdad**. Las migraciones numeradas (`0102`, `0109`, `0110`,
`0111`) nunca se aplicaron; producción se gestiona con un flujo `mc_*`
timestamped que el repositorio no conoce.

### Programas: el esquema real es `mc_programas`

`programs` (inglés, migraciones 0102/0110) **no existe** y nunca existió.
Tampoco `programas` (castellano, policy de `007`). El bueno es:

| Tabla | Qué es |
|---|---|
| `mc_programas` | `id, org_id, nombre, descripcion, estado, duracion_semanas, owner_coach_id, creado_por, created_at, updated_at` |
| `mc_programa_coaches` | puente `programa_id` ↔ `usuario_id`, con `UNIQUE(programa_id, usuario_id)` y FK en cascada |

Límites que impone la base: `nombre` 1–120, `descripcion` ≤2000,
`duracion_semanas` 1–104 o NULL, `estado` ∈ `draft|active|completed|archived`.
**No hay `clients` ni `completion`.**

RLS **forzada**, con helpers `mc_pw_es_owner()`, `mc_pw_es_miembro()`,
`mc_pw_es_coach_de()`, `mc_pw_cliente_ve_programa()`. GRANT solo a
`authenticated`. El frontend no añade permisos: filtra por `org_id` como
segunda capa y deja decidir a la base.

**`0112_programs_rls_fix.sql` se retiró de la rama.** Creaba policies sobre una
tabla inexistente. Las migraciones `0102`, `0110` y `007` quedan como diseño
muerto: **no aplicar ninguna.**

### Columnas fantasma en `candidatos`

| Columna | Estado | Qué se hizo |
|---|---|---|
| `updated_at` | **no existe** | Fuera del SELECT de `mi-red` y del de respaldo. Era la causa de que **los dueños vieran su red vacía**: PostgREST devuelve 400 y `q()` lo convierte en `[]`, en silencio |
| `notas` | **no existe** | → `notas_privadas` en `mi-red` y en `editar-cliente-red` |
| `plan` | **no existe** | Se retiró el update. Ningún llamador la mandaba |
| `estado` | **no existe como columna** | No hacía falta tocar nada: `editar-cliente-red` ya recibía `estado` como *parámetro* y escribía la columna `activo` |

**`notas_coach` NO es la nota interna**: guarda el chat serializado
(`raw.notas_coach = JSON.stringify(arr)` en panel-v2). La nota del coach sobre
el cliente es **`notas_privadas`**, que es la que panel-v2 escribe y lee.

### Comportamiento que queda en la ficha de cliente

- **Notas internas:** se guardan en `notas_privadas`, **compartidas con el panel
  del coach**. Lo que escriba el dueño lo ve el coach y al revés.
- **Estado activo/inactivo:** funciona igual que antes.
- **Plan:** ya no se manda. **No había pantalla que lo editara**, así que no se
  pierde nada visible.
- **Pendiente ajeno a este cierre:** el formulario «Editar datos del cliente»
  manda `telefono`, `empresa` y `nicho`, y `editar-cliente-red` **no acepta esos
  tres campos** — los ignora en silencio. Es anterior a este trabajo y no se ha
  tocado.

---

## 1-ter. Reconversión del nicho Finanzas → Life (septiembre 2026)

`main` reconvirtió el nicho financiero a **Life**: renombró
`pathway-fin-cliente.html` → `pathway-life-cliente.html` y
`pathway-fin-form.html` → `pathway-life-form.html`, cambió el valor de nicho
`financiero`/`finanzas` por `life` y sustituyó el modelo de datos (`fin_*`) por
`proc_objetivos` / `proc_seguimiento`.

**MultiCoach se quedó fuera de esa reconversión.** No aparece en la lista de
archivos que revisa la regla `nicho Life: no vuelve la terminología ni los
campos de Finanzas` de `check-guardrails.js` (`login.html`, `auth-callback.html`,
`panel-v2.html`, `reservar.html`), así que nada avisó de que:

- `_mcPortalUrl` seguía abriendo `/pathway-fin-cliente.html`, un archivo que ya
  no existe → el botón «Ver portal» daba 404 para una red del nicho Life.
- `mcNichoKey` no reconocía `life`: como no contiene `fit` ni `financ`, caía en
  el `return 'carrera'` final **en silencio**. Una red Life se pintaba entera
  como una red de Carrera.
- Los objetos indexados por esa clave (`MCN`, `MCDET`, `MCAG`, `MC_RECURSOS`,
  `_RAIL_IMG`, `MC_REC_LABEL`, `MC_REC_EJEMPLOS`) sólo tenían la clave
  `finanzas`. `NM()` y `DET()` no tienen valor por defecto: con `MC_N='life'`
  habrían devuelto `undefined` y el panel del dueño no arranca.

Todo eso está corregido **dentro de MultiCoach**; no se tocó ningún archivo de
`main` para acomodarlo. `multicoach.html` se añadió además a la lista de esa
regla, para que la próxima vez sí avise.

**No se inventó compatibilidad hacia atrás.** Se comprobó contra producción
antes de decidirlo: `candidatos.nicho` = 27 carrera · 17 fitness · **2 life** ·
29 nulos, y **cero** `financiero`/`finanzas`; `usuarios.configuracion->>coach_type`
= 30 carrera · 19 fitness · **3 life** · 34 nulos. La migración de datos está
hecha, así que `mcNichoKey('financiero')` ya no devuelve un nicho financiero —
cae en `carrera`, igual que cualquier otro valor desconocido.

Los textos que quedaban bajo la clave (marca de la maqueta, categorías,
`coachSing`/`coachCap`/`coachLow`, `medLabel`, etiquetas de la agenda) **no eran
sólo demo**: `mcApplyNiche` y `DET()` se ejecutan también en modo REAL, así que
una red Life de verdad habría visto «Asesores» en el menú, «Asignar asesor» en
los atajos, las áreas «Ahorro & deuda / Inversión» y «Reunión de asesores» en la
agenda. Por eso se adaptó el contenido del bloque completo, no sólo la clave.

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

> **Adjuntos: preview únicamente; storage persistente pendiente de decisión.**


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

1. **Ninguna migración.** El esquema ya está en producción (`mc_programas`,
   `mc_programa_coaches`). `0112` se retiró; `0102`, `0110` y `007` **no se
   aplican**.
2. **Edge functions** — redesplegar las que cambiaron:
   `supabase functions deploy mi-red --no-verify-jwt`
   `supabase functions deploy add-coach-to-org --no-verify-jwt`
   `supabase functions deploy editar-cliente-red --no-verify-jwt`
   (**`mi-red` es la urgente**: hoy, desplegada, deja a los dueños sin clientes.)
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

---

## 9. P2 aparcado — página pública, slug, dominio y white-label (fase 2)

Estado REAL a septiembre de 2026, sin implementar nada:

| Pieza | Hoy | Falta |
|---|---|---|
| UI de página pública | Existe (`Configuración → Perfil`: activar, nombre, slug, título, descripción) | — |
| Persistencia | Guarda en `organizaciones.marca` (jsonb) | — |
| URL pública `/g/<slug>` | **La UI la promete y nadie la sirve** | Servir la ruta |
| Columna `organizaciones.slug` | Existe, vacía | Rellenarla desde `marca.slug` |
| Columna `organizaciones.dominio` | Existe, vacía y sin consumidores | Todo |
| White-label de marca | **Funciona**: color, color2, tipografía, logo y recursos se aplican al cargar la red | — |
| Dominio propio por organización | No existe | Todo |

Decisión tomada: queda como **P2**. Cuando se retome, definir en este orden —
página pública de la organización, slug, dominio, white-label y flujo del
cliente. **No convertirlo en una landing comercial de Pathway**: la página
pública de MultiCoach es la de la ORGANIZACIÓN cliente, no la de Pathway.

⚠️ Mientras tanto la UI sigue enseñando `pathwaycareercoach.com/g/<slug>` como
si funcionara. Es lo único deshonesto que queda en Configuración.

## 10. Estados de suscripción de una organización (fase 2)

Lo que el webhook de Stripe puede escribir en `organizaciones`:

| Estado en Stripe | `estado_sub` | `activo` |
|---|---|---|
| `trialing`, `incomplete` | `prueba` | `true` |
| `active`, **`past_due`** | `activa` | `true` |
| `canceled` | `cancelada` | `false` |
| `unpaid`, `incomplete_expired` | `vencida` | `false` |

**El período de gracia ya existe y no hace falta DDL**: `past_due` (Stripe
reintentando el cobro) se mapea a `activa`+`activo=true`. El estado terminal es
`unpaid` → `vencida`+`activo=false`.

Lo que **no** existe: nadie fuera de MultiCoach lee `organizaciones.activo` /
`estado_sub`. El coach y el cliente siguen operando con la organización
bloqueada. La policy `org_coach_select` YA permite que un coach lea la fila de
SU organización por `auth.uid()`, así que el aviso y el corte del coach no
necesitan tabla, columna ni policy nueva. Para el **cliente** sí hay hueco: lee
`candidatos`, no `organizaciones`.

⚠️ Dato real: **4 de 6 organizaciones no tienen `fecha_fin_prueba`**, y una está
vencida desde el 12-08-2026 con `activo=true`. Sin esa fecha,
`_mcPaywallCheck()` no avisa ni corta: hoy están en prueba indefinida.
