# Fase 2 · cierre de seguridad — 2026-09-16

Todo lo de aquí está **medido contra producción en solo lectura** el 2026-09-16.
Cero escrituras: ni una política, ni un privilegio, ni una fila tocada desde la
sesión que lo escribió. Lo que cambia son ficheros de este repositorio.

---

## ⛔ ANTES DE MERGEAR: el push de migraciones NO va a poder aplicar esto

`.github/workflows/supabase-migrations.yml` dispara en cada push a `main` que
toque `supabase/migrations/**`, y aplica **todas** las migraciones versionadas
que no figuren en el historial remoto. Medido hoy contra `schema_migrations`:

| Fichero versionado del repo | ¿registrado? |
|---|---|
| `20260803_identity_platform_core.sql` | **NO** |
| `20260831103005_g2_pw_franjas_ocupadas.sql` | sí |
| `20260831110641_g2a_pw_sala_coach.sql` | sí |
| `20260831110653_g2c_pw_cita_meet_link.sql` | sí |
| `20260901154255_c2a_cv_express_borrado_solo_admin.sql` | **NO** — pero **ya aplicada a mano** |
| `20260902104446_p0_usuarios_publicos_solo_lectura.sql` | **NO** — pero **ya aplicada a mano** |
| `20260916120000_privilegios_anon_minimos.sql` | nueva, esta entrega |
| `20260916120100_pw_tiene_pass_solo_authenticated.sql` | nueva, esta entrega |

**`20260803_identity_platform_core.sql` reventaría el push.** Crea ocho tablas
de una plataforma de identidad, con índices SIN `IF NOT EXISTS`, y en su línea
273 hace `ALTER TABLE user_capacidades ADD COLUMN …`. Medido: **`user_capacidades`
no existe en producción**, y de sus nueve tablas solo existe una
(`organization_branding`). O sea que ese fichero falla, el push aborta, y **las
dos migraciones de esta entrega no llegan a aplicarse**. Es R-69 otra vez: una
migración no está aplicada porque alguien la haya mergeado.

**No se "arregla" ese fichero aquí**: son ocho tablas y una funcionalidad entera
que nadie ha pedido en esta tarea, y tocarla sería ampliar el alcance por la
puerta de atrás. Lo que hay que hacer, y es lo que dice la cabecera del propio
workflow, es **reparar el historial antes**, una sola vez.

El project ref es el público de siempre, el que ya va en el frontend:
`ddxnrsnjdvtqhxunxnwj`.

```bash
supabase link --project-ref <PROJECT_REF>

# Ya aplicadas a mano → se marcan como aplicadas.
# COMPROBADO HOY contra el catálogo, no supuesto:
#   cv_express/anon        = INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,UPDATE
#                            (sin DELETE y sin TRUNCATE → C-2a está aplicada)
#   usuarios_publicos/anon = SELECT y nada más  → el P0 está aplicado
supabase migration repair --status applied 20260901154255
supabase migration repair --status applied 20260902104446

# Nunca aplicada, y su precondición NO existe en producción (user_capacidades).
# DECISIÓN DE MICAELA, no automática: marcarla revertida para que el push la
# salte, o rescatarla aparte como el frente que es.
supabase migration repair --status reverted 20260803
```

Y **después** del merge, comprobar que se aplicó de verdad contra el catálogo y
no contra la conclusión del workflow:

```bash
psql "$DATABASE_URL" -f scripts/verificar-fase2-seguridad.sql   # OK 9/9
```

Este repositorio se sirve por **GitHub Pages desde `main`**, así que mergear
además **despliega** los cambios de HTML y de `robots.txt` en el mismo acto.
`supabase/functions/**` no se toca, así que **ninguna Edge Function se
redespliega** (la lección de INC-077, comprobada antes y no supuesta).

---

## 1 · R-55 · privilegios sobrantes de `anon` y `authenticated`

**La pregunta era si existe exposición real. La respuesta es NO, y se demuestra
así**, no leyendo el ACL:

1. PostgREST solo emite `SELECT/INSERT/UPDATE/DELETE` sobre tablas y vistas y
   `SELECT`/`CALL` sobre funciones. **No expone el verbo.**
2. Ninguna función de **ningún** esquema no-sistema lo ejecuta por dentro: se
   recorrió `pg_proc` entero (`prokind='f'`) buscando el verbo como palabra en
   `prosrc`. **0 funciones.**
3. Las únicas funciones con SQL dinámico invocables por `anon` son de stock de
   Supabase (`extensions`, `realtime`, `storage`); **ninguna es SECURITY DEFINER**
   y ninguna vive en un esquema que PostgREST exponga.

O sea: **es defensa en profundidad que falta, no una puerta abierta.** Se cierra
igual, porque se vuelve una puerta el día que alguien escriba una función
`SECURITY DEFINER` con SQL dinámico.

**Y no eran ocho tablas.** La auditoría previa (INC-085) nombró ocho porque son
las que se miraron. Sobre las 59 tablas de `public`:

| privilegio | `anon` | `authenticated` |
|---|---|---|
| el que la RLS no evalúa | 49 / 59 | 52 / 59 |
| `REFERENCES` | 53 / 59 | 54 / 59 |
| `TRIGGER` | 53 / 59 | 54 / 59 |
| `MAINTAIN` | 54 / 59 | 55 / 59 |

**424 pares (tabla, rol, privilegio) vivos, sobre 55 tablas.** Una migración con
las ocho de la lista se habría leído como completa dejando 41 tablas igual. Por
eso va **por esquema**: es a la vez menos código y más cobertura.

`SELECT`, `INSERT`, `UPDATE` y `DELETE` **no se tocan**. De ellos cuelgan el
formulario de intake, el logger de errores y el alta de leads, y quien acota qué
fila ve cada uno es la RLS, no el privilegio.

**Causa raíz, medida y medio cerrada:** el `pg_default_acl` de `postgres` sobre
`public` para tablas ya es `SELECT` y nada más (endurecimiento E1 del 02-09,
verificado hoy), así que una tabla nueva ya no hereda esto. El de
`supabase_admin` conserva la baraja entera y `postgres` no puede alterarlo:
**residuo declarado**, R-55 por cuarta vez.

→ `supabase/migrations/20260916120000_privilegios_anon_minimos.sql`

---

## 2 · `pw_tiene_pass(email)` · el oráculo de enumeración

**Sí lo permitía, y sí era el único.** `SECURITY DEFINER`, sin ninguna guarda,
en `public` —o sea expuesta como `POST /rest/v1/rpc/pw_tiene_pass`— y con
`EXECUTE` concedido a `anon`. Para cualquier email contesta si hay cuenta con
contraseña. Revela **existencia**, no contenido.

**Lo que decide la reparación, y no era obvio:** `registro.html:484` y
`activar-empleado.html:106` hacen además un `GET /rest/v1/usuarios?email=eq.X`
con la clave anónima, que parecía un oráculo más rico —devolvería `id`, `rol`,
`nombre` y `configuracion`—. **No lo es**, por partida doble:

* `anon` **no tiene el privilegio `SELECT`** sobre `usuarios`
  (`has_table_privilege('anon','public.usuarios','SELECT') = false`);
* y aunque lo tuviera, `usuarios` lleva RLS activa y las dos únicas políticas de
  `SELECT` que le alcanzan son `USING (auth_id = auth.uid())` y
  `USING (email = auth.jwt()->>'email')`, que **sin JWT valen NULL**.

De ahí sale el hallazgo que hace barata la reparación: **las tres llamadas que
hacen las páginas anónimas están DENTRO de la rama que exige que ese GET haya
devuelto filas**, así que hoy son **código inalcanzable**.

| dónde | rol | ¿la ejecuta? |
|---|---|---|
| `registro.html:492` | `anon` | no — dentro de `if (existing.length > 0)` |
| `registro-en.html:491` | `anon` | no — idem |
| `activar-empleado.html:113` | `anon` | no — tras `if (!rows.length) return` |
| `panel-v2.html:14429` | **`authenticated`** (llama con `_hdr()`) | **sí** |

**Reparación mínima: retirarle el `EXECUTE` a `anon` y a nadie más.** Que es
literalmente la línea de ROLLBACK que su propia migración dejó escrita
(`usuarios_pw_tiene_pass_anon.sql:17`). No rompe ningún flujo legítimo, y
`authenticated` lo conserva.

**No es INC-006:** ninguna de las 11 políticas de `usuarios` invoca la función,
así que revocar no deja ninguna política sin poder evaluarse.

**Residuo declarado:** un usuario **autenticado** sigue pudiendo enumerar.
Población mucho menor —exige cuenta— y quitárselo rompería `panel-v2.html`.

**La prueba de que la enumeración ya no funciona** es la comprobación 1 de
`scripts/verificar-fase2-seguridad.sql`, que mide **estado efectivo**
(`has_function_privilege`) y **falla cerrado**. Rojo antes / verde después
(R-49): hoy, sin la migración, esa comprobación falla sola.

→ `supabase/migrations/20260916120100_pw_tiene_pass_solo_authenticated.sql`

---

## 3 · `/c/<token>` · conversación privada por link mágico

**La protección de datos aguanta y NO se toca** (INC-085): `solicitudes` tiene
RLS activa, **una** política `{authenticated}` acotada a
`coach_id = pw_coach_id() OR pw_is_admin()`, y **`anon` no tiene ninguna**. El
token es `crypto.randomUUID()` —122 bits— y lo valida una Edge Function con
`service_role`: el navegador no toca la tabla.

Lo que faltaba era la indexación, y ahí las dos medidas tiran en sentidos
contrarios:

* **`noindex` en `c.html`: AÑADIDO.** Es lo único que funciona con los bots de
  vista previa de enlaces, que es por donde viaja un token (correo, WhatsApp).
* **`Disallow: /c/` en `robots.txt`: NO se añade, a propósito.** Un `Disallow`
  impide *rastrear*, no *indexar*, y además impide que el buscador **lea** el
  `noindex`. El resultado sería la URL —o sea **el token**— publicada en los
  resultados sin contenido. Se deja rastreable para que el buscador lea el
  `noindex` y la tire. Quien "endurezca" esto añadiendo el `Disallow` lo
  empeora, y está escrito en los dos ficheros.

**Ninguna URL tokenizada aparece en una superficie indexable**, comprobado: solo
las emiten `supabase/functions/contacto-coach/index.ts:111` (va por correo) y
`panel-v2.html:12362`, que es `noindex, nofollow` **y** `Disallow`. `sitemap.xml`
no contiene ni `/c/` ni ningún token.

---

## 4 · Las otras cuatro superficies privadas

| superficie | qué es | antes | ahora |
|---|---|---|---|
| `owner-coach-detail.html` | "Perfil Coach — MultiCoach", panel interno | **ni `noindex` ni `Disallow`** | `noindex, nofollow` + `Disallow` |
| `app.html` | aplicación tras login | `Disallow` sin `noindex` | las dos |
| `pathway-fit-cliente.html` | portal del cliente Fit | `Disallow` sin `noindex` | las dos |
| `pathway-life-cliente.html` | portal del cliente Life | `Disallow` sin `noindex` | las dos |

`Disallow` y `noindex` **no son lo mismo** y por eso van los dos: el primero para
el rastreador que lo respeta, el segundo para el que entra igual. Ninguna de las
cuatro renderiza nada sin sesión, así que el flujo legítimo no cambia.

### Y un agujero que no se buscaba: los veinte bots de IA tenían barra libre

`robots.txt` tenía un grupo por bot con `Allow: /` **y ninguna línea
`Disallow`**. Un bot obedece **un solo grupo** —el más específico que casa con su
nombre— y deja de mirar el de `*`: los veinte tenían permiso explícito sobre
`/panel-v2.html`, `/cliente.html`, los portales de cliente, `/leads/` y
`/supabase/`. Los 26 `Disallow` de arriba **no les aplicaban**.

Ahora van en un grupo único con la misma lista. Son dos copias y `robots.txt` no
tiene forma de evitarlo, así que hay un guardarraíl que compara los dos conjuntos
y se pone rojo si divergen (R-61).

---

## Qué lo vigila

Tres reglas nuevas en `scripts/check-guardrails.js` (**303 reglas, todas en
verde**), con **mutación comprobada**: cinco mutaciones, cada una roja por **su
propia** aserción, y el árbol revertido en verde.

| mutación | regla que se pone roja |
|---|---|
| quitar el `noindex` de `app.html` | superficies privadas |
| quitar un `Disallow` del grupo de IA | robots.txt: las dos listas a la par |
| borrar la migración del revoke | `pw_tiene_pass` |
| borrar el verificador | `pw_tiene_pass` |
| una migración **posterior** que reconceda | `pw_tiene_pass` |

Y las puertas propias del repositorio, ejecutadas antes de commitear:
`check-syntax`, `check-smoke`, `check-parity`, `check-icons` y
`check-async-patterns` en exit 0. `verify.js` sale 7/8 con "Error Scope" en rojo:
**es pre-existente**, y se demostró en vez de afirmarse — la salida de
`check-error-scope.js` es **byte a byte idéntica** en esta rama y en `origin/main`.

## Lo que se miró y NO se tocó

* **`get_proxima_cita(p_email)`** tiene una firma alarmante y está **bien
  guardada**: exige sesión o admin, y que el email pedido sea el tuyo o el de un
  cliente tuyo como coach. Queda escrito para que nadie la "arregle" y la rompa.
* Ninguna política de RLS, ningún privilegio y ninguna fila de producción.
