# INC-B · `sesiones_registro` — la tabla que se cerró con un lector dentro

**Fecha:** 1-sep-2026 · **Rama:** `claude/agent-closure-reconciliation-qa9hg1`

---

## 1. Qué pasó

El 27-ago-2026, la migración `20260827130248_f2_3_cierre_sesiones_registro`
encendió la RLS de `public.sesiones_registro` y **no dejó ninguna policy**,
razonando en su propia cabecera:

> "Ninguna edge function ni pantalla la lee."

Era falso. La tabla tenía tres lectores, y uno de ellos sí estaba sujeto a RLS.

| Lector | Rol con el que consulta | ¿Le aplicaba la RLS? |
|---|---|---|
| `supabase/functions/dashboard/index.ts:107` | `SUPABASE_ANON_KEY` + `Authorization` del llamante → **`authenticated`** | **Sí — el afectado** |
| `supabase/functions/fetch-coach-detail/index.ts:104` | `SUPABASE_SERVICE_ROLE_KEY` | No |
| `supabase/functions/coach-metrics-daily/index.ts:109` | `SUPABASE_SERVICE_ROLE_KEY` | No |

La migración **no tiene `.sql` en el repositorio** (`git log --diff-filter=A --
'supabase/migrations/*f2_3*'` no devuelve nada): solo existe aplicada en la base.
El commit que la ratificó después, `63e4695`, la dio por buena mirando **solo al
escritor**:

> "sesiones_registro NO se toca: la cerró f2_3_cierre_sesiones_registro. Su único
> escritor vive tras USE_NEW_SCHEDULER=false, última fila del 04-ago, sin errores
> de cliente: no rompe nada."

Cierto sobre el escritor, y sin una sola línea sobre los lectores. Ese es el
*drift*: una migración que vive en producción sin fichero en el repositorio, y una
revisión posterior que comprueba la mitad del contrato.

**Drift cerrado:** el fichero se ha reconstruido en el repositorio como
`supabase/migrations/20260827130248_f2_3_cierre_sesiones_registro.sql`, copiado
de `supabase_migrations.schema_migrations` **sin añadirle nada** —ni siquiera una
cabecera— para que siga siendo byte a byte lo aplicado. Verificado:
`md5 = 299f1fbaa191625d60b596b59f6cb815` en la base y en el fichero. La migración
de INC-B, igual: `md5 = c793d8bb2fcedc615ae49b8fdd2bc607` en las dos, y el
fichero lleva el nombre de la versión real que le asignó el servidor
(`20260901104533`), no uno inventado.

## 2. Por qué nadie se enteró

Porque el **GRANT** de `SELECT` a `authenticated` siguió vivo. Es la distinción
que hace silencioso a todo este incidente:

* **Falta el GRANT** → PostgREST responde **403**. Ruidoso.
* **Está el GRANT y la RLS filtra** → PostgREST responde **200 con `[]`**. Mudo.

Con 200 y `[]`, el `if (todayError) throw todayError` de `index.ts:113` nunca se
disparó, y `processTodayStats(todayStats || [])` calculó tan tranquilo
`total_sessions: 0`. El dashboard de red no se rompió: **mintió**, y dijo "0
sesiones hoy" con la misma cara con la que habría dicho la verdad.

## 3. Medición (antes del cambio)

Impersonando identidades reales (`SET LOCAL ROLE authenticated` +
`request.jwt.claims`), con 14 filas en la tabla:

| Identidad | Filas que veía |
|---|---|
| `bot-coach@…` — **owner** de la org dueña de las 14 | **0** |
| `bot-gym@…` — **coach** de esa misma org (8 filas suyas) | **0** |
| `gus@axonimpact.com` — owner de **otra** org | 0 |
| `anon` | 0 |

## 4. Qué se hizo

Migración `20260901104533_incb_sesiones_registro_rls_lectura_minima.sql`:

1. **`pw_org_admin_id()`** — `SECURITY DEFINER`, `search_path` fijado. Devuelve
   la organización del llamante **solo si** es `owner`/`admin` de ella; para
   cualquier otro, `NULL`.
2. **`sesiones_registro_coach_select`** — `TO authenticated`,
   `USING (coach_id = pw_coach_id())`.
3. **`sesiones_registro_org_admin_select`** — `TO authenticated`,
   `USING (org_id = pw_org_admin_id())`.
4. **`REVOKE SELECT … FROM anon`** — no le quedaba ningún consumidor.

### Por qué no `USING (true)`

La tabla guarda `titulo`, `descripcion`, `participantes` y `metadata` de sesiones
con clientes: son **notas de sesión**, no un contador. Abrirla a `authenticated`
dejaría a cualquier coach de cualquier organización leer las notas de los
clientes ajenos. Una policy da acceso a la **fila entera**, no a las dos columnas
que el dashboard selecciona.

### Por qué no se copió la policy de `citas` tal cual

Se compararon las columnas **antes** de reutilizar el patrón:

| Columna | `citas` | `agenda_bloques` | `sesiones_registro` | ¿Equivalente? |
|---|---|---|---|---|
| `org_id` | uuid | uuid | uuid | ✔ sí |
| `coach_id` | **text** | **text** | **uuid** | ✘ no |

Por eso la mitad de organización replica `agenda_bloques_owner_org`, pero la del
coach compara `coach_id = pw_coach_id()` **sin** el `::text` que llevan las otras.

### Por qué una función auxiliar nueva

`agenda_bloques_owner_org` resuelve la organización con un subselect a `usuarios`
que, dentro de la policy, se ejecuta **con la RLS del llamante**. Hoy funciona
porque existe `user_self_select`; si esa policy se endurece, la de aquí se vuelve
a vaciar en silencio — exactamente el fallo que INC-B está cerrando.
`pw_org_admin_id()` es `SECURITY DEFINER` y no depende de esa RLS.

### Alcance deliberado

Un **coach raso no ve** las sesiones del resto de su organización. Es coherente
con `rls_citas_coach_network`, donde un coach tampoco ve las citas individuales
de sus compañeros. Consecuencia asumida: si un coach abre el panel de red, el KPI
"sesiones hoy" cuenta solo las suyas; para el owner/admin —que es quien mira ese
panel— es completo.

## 5. Verificación (después del cambio)

| # | Caso | Filas | Esperado |
|---|---|---|---|
| A | owner de la org dueña | **14** de 14 | todas las de su org ✔ |
| B | coach raso de esa org | **8** (las suyas) · 0 ajenas | solo las suyas ✔ |
| C | owner de otra org | **0** | 0 ✔ |
| D | coach de otra org | **0** | 0 ✔ |
| E | cliente autenticado | **0** | 0 ✔ |
| F | autenticado sin fila en `usuarios` | **0** | 0 ✔ |
| G | `anon` | **`42501 permission denied`** | 403, no `[]` ✔ |

**Aislamiento con dos organizaciones a la vez** (canario insertado y revertido en
transacción; 15 filas, 14 de una org y 1 de otra):

* owner org A → ve 14, **0 del canario**
* owner org B → ve **1**, 0 de las 14 ajenas
* la consulta *exacta* del dashboard (`select fecha,estado` + `eq org` + rango de
  fecha), como owner de B → devuelve la fila ✔
* canarios residuales tras el `ROLLBACK`: **0**

## 6. El consumidor: dos bugs más, del mismo tipo

Al comprobar que el dashboard "recibe y no descarta filas" aparecieron dos
defectos que habrían dejado el KPI mintiendo aunque la RLS se arreglara:

1. **`estado === "cancelada"` nunca acierta.** El vocabulario de esta tabla es
   inglés (`DEFAULT 'scheduled'`; el escritor guarda `cancelled`/`confirmed`,
   `pw-scheduler.js:663` y `:668`). Los valores reales en producción son
   `confirmed`, `completed`, `scheduled`. `"cancelada"` es el vocabulario de
   **`citas`**, que es otra tabla. Efecto: `cancelled` siempre 0 y
   `completion_rate` clavado en **100 %**.
2. **`upcoming_2h` siempre 0.** `new Date(s.fecha)` con un DATE sin hora sitúa
   toda sesión de hoy a medianoche UTC, siempre en el pasado. La columna `hora`
   ni siquiera se pedía en el `select`.

Ambos corregidos en `dashboard/index.ts`: el `select` pide ahora
`fecha, hora, estado`; la hora se interpreta como UTC, la misma convención del
único escritor (`pw-scheduler.js:535`); y `cancelled` acepta las dos formas.

## 7. Blindaje

* **`scripts/check-guardrails.js`** — regla *"sesiones_registro: no puede
  quedarse sin lectura mientras el dashboard la lea (INC-B)"*. Vigila el
  **acoplamiento**, no la historia: si el lector desaparece, la regla se apaga
  sola; mientras exista, exige que existan las policies, que la migración no
  contenga `USING (true)`, que ninguna migración posterior quite la lectura sin
  reponerla, y que el consumidor siga pidiendo `hora` y no vuelva a comparar
  contra `"cancelada"`. Probada con 4 canarios: los 4 la hacen fallar.
* **`tests/inc-b-dashboard-today-stats.mjs`** — no reimplementa la lógica:
  **extrae `processTodayStats` del fuente real** y la ejecuta. Contra el código
  viejo falla en 4 comprobaciones; contra el nuevo pasa las 9.

## 8. Lo que queda pendiente y no depende de INC-B

* **La edge function `dashboard` no se ha redesplegado** (está en la versión 15,
  con el `select` viejo). La mitad de RLS ya está viva en producción; la mitad de
  consumo vive solo en el repo hasta que alguien con autorización de despliegue
  corra `supabase functions deploy dashboard --no-verify-jwt`.
* **`fetch-coach-detail/index.ts:104` pide columnas que no existen**
  (`duracion`, `nps_coach`; las reales son `duracion_minutos` y ninguna de NPS).
  Es un bug distinto, anterior, y fuera del alcance de INC-B: se reporta, no se
  toca.
