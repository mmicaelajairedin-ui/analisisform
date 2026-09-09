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

## 4. `pathway-handoff` — conservada, sin uso

`login.html` mandaba al dueño a `pathwayplatforms.com` con un código de un solo
uso emitido por `pathway-handoff`. Ese dominio nunca se activó
(`docs/PATHWAYPLATFORMS_SETUP.md` lo marca PENDING), así que el dueño acababa
fuera del producto. Ahora la entrada es `/multicoach.html`, mismo origen, y el
handoff no hace falta: la sesión viaja sola.

La función **sigue desplegada y sin tocar**. Si algún día se activa el dominio
propio, se vuelve a ella cambiando el bloque del login — y actualizando a la vez
el guardrail `multicoach: el dueño logueado ve su RED REAL`, que hoy exige el
destino único.
