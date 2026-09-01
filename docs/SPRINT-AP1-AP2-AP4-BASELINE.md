# Sprint AP1 + AP2 + AP4 — Baseline y criterios de aceptación

> **Alcance aprobado:** AP1, AP2, AP4. **Fuera de alcance: P0/RLS, AP3 y AP5–AP10.**
>
> **P0 SE RETIRÓ DE ESTE LOTE (2026-08-28).** No se entrega. Ver «P0 retirado» abajo.
> Este documento se escribe ANTES de modificar código. Los números de abajo son
> el punto de comparación; cualquier afirmación de "mejoró" se mide contra ellos.

## Base de trabajo

```
Rama:              claude/pathway-strategy-review-rs2b71
Basada en commit:  535f170 (main tras rebase, 2026-08-28)
Diferencia:        0 commits (rebase limpio, sin conflictos)
Módulos que SÍ toco:   reservar.html · pw-events.js · panel-v2.html (alta de
                       cliente, ficha, config) · cliente.html (semana) ·
                       supabase/functions/notif-coach ·
                       supabase/migrations/ap1_programa_reloj.sql
Módulos que NO toco:   Equipo (multicoach.html — LOCKED) · Dashboard ·
                       Clientes (grid) · Agenda · Sala · Admin · Web Analytics ·
                       portales fit/fin salvo la lectura de la semana
```

**Despliegue:** migraciones y edge functions se aplican a producción **solo al
mergear a `main`** (`supabase-migrations.yml`, `deploy-functions.yml`). Push a
esta rama no despliega nada. El punto de no retorno es el merge.

---

## Baseline técnico — el gate ya está en rojo antes de empezar

`npm run verify` **falla en `main` limpio** (commit `d02474c`), 2 de 8 checks:

| Check | Estado en main | Detalle |
|---|---|---|
| Syntax | ✅ | |
| Smoke | ✅ | |
| **Guardrails** | ❌ | 5 regresiones preexistentes |
| Parity | ✅ | |
| Icons | ✅ | |
| Triage | ✅ | |
| **Error Scope** | ❌ | ERR-ENV-001 (CORE_INFRASTRUCTURE bloquea siempre) |
| Async patterns | ✅ | |

Las 5 regresiones de guardrails preexistentes:

1. `reservas: el cliente puede cancelar/reprogramar (token + página)`
2. `admin: crear coach pasa por la edge function crear-coach`
3. `multicoach: el dueño logueado ve su RED REAL (no la maqueta)`
4. `recordatorio de cita: lleva el link de la Sala y NO dice Google Meet`
5. `agenda: modalidad Presencial NO manda link de video`

**Ninguna de las 5 bloquea AP1/AP2/AP4** (filtro aplicado abajo). No se
tocan. El hook de pre-commit (`.husky/pre-commit`) solo corre
`validate-supabase-config.js`, que **sí pasa** (exit 0), así que commitear es
posible.

> **Criterio de gate para este sprint:** como `npm run verify` no puede pasar en
> verde por causas ajenas, el criterio es **"no empeora el baseline"**: mismos 5
> guardrails fallando, mismo blocker de scope, cero fallos nuevos. Se verifica
> comparando la salida de cada check antes y después.

### ERR-ENV-001 — por qué no se arregla

Hay 7 apariciones de project refs incorrectos (`...bwj`, `...bnw`), **todas en
tooling, tests y docs**: `scripts/error-triage.js`, `tests/tester-bot.spec.js`,
`docs/INFRASTRUCTURE_URLS.md`, `CLAUDE.md`, y las listas negras de
`check-guardrails.js` y `validate-supabase-config.js` (donde el uso es
correcto). **Cero apariciones en código de producción.**

Filtro: no bloquea ninguna apuesta aprobada — ningún camino de código de
usuario depende de ello. Es una inconsistencia de triage. **Queda documentada,
no se toca.**

---

## Baseline de producto — 2026-08-27

| Métrica | Valor |
|---|---|
| *(contexto, fuera de lote)* · tablas sin RLS | `organizaciones`, `ranking_mensual`, `sesiones_registro` |
| **DIAG** · clientes sin `coach_id` | 20 |
| **DIAG** · clientes sin `org_id` | 41 |
| **MED** · eventos totales | 3.646 |
| **MED** · eventos `CallRequested` | 3.564 (97,5%) desde 10 actores distintos |
| **AP1** · clientes con `semana_activa = 1` | 58 de 73 |
| **AP1** · clientes activos | 55 |
| **AP1** · clientes con `proxima_sesion` | 0 |
| **AP2** · coaches con `notifs` configurado | 1 de 49 |
| **AP2** · coaches activos | 41 |
| **AP2** · notificaciones últimos 30 días | 45 |
| **AP4** · clientes con `cv_url` | 3 de 73 |
| **AP4** · clientes con cuenta de portal | 28 de 73 |
| **AP4** · clientes que entraron alguna vez | 14 de 73 |
| **AP4** · coaches con ≥1 informe | 6 de 49 |

---

## Reducciones de alcance descubiertas al leer el código

El filtro de dependencias funcionó en las dos direcciones: **AP2 y AP4 son más
pequeñas de lo que decía la propuesta**, porque parte ya estaba construida.

### AP2 — de "tres avisos" a uno

| Aviso | Estado real en el código | Acción |
|---|---|---|
| Recordatorio de sesión | `recordatorios-citas` envía **sin** consultar preferencias | Ninguna — ya funciona |
| Cliente nuevo | `notif-new-client` usa `notifs.newClient !== false` → **ya es opt-out** | Ninguna — ya funciona (el comentario del archivo está desactualizado y dice `=== true`) |
| **Resumen semanal** | `notif-coach` usa `notifs.weeklyReport !== true` → **opt-in**, y el panel **ya no tiene UI** para activarlo | **Este es el único cambio de AP2** |

Por eso hay 0 coaches con resumen semanal: no es que no lo activen, es que no
hay dónde activarlo.

### AP4 — la cuenta ya se crea sola

`doCreate()` en `panel-v2.html` ya crea la fila en `usuarios` con `rol=cliente`
y genera el enlace de contraseña. Lo que falta es que **el email salga solo**:
hoy se abre un modal y el coach tiene que copiarlo a Gmail, porque "Enviar
email" está detrás del plan Pro. AP4 no construye el alta: la termina.

---

## Criterios de aceptación

Cada criterio es verificable. Los que dependen de comportamiento de usuarios
reales se miden a los 30 días; los de comportamiento del sistema, al terminar.

### P0 — Integridad y seguridad ❌ RETIRADO ÍNTEGRAMENTE del lote (2026-08-28)

No se entrega ningún criterio P0. La migración RLS se sacó de la rama y **no hay
sustitución**. Ver «P0 retirado del lote» más abajo.

### MED — Dependencia transversal de medición (AP1 · AP2 · AP4)

> **No es P0 ni una apuesta propia: es la condición para poder medir las tres
> aprobadas.** `CallRequested` supone 3.564 de los 3.646 eventos de la tabla,
> emitidos por 10 personas recargando una página. Con esa contaminación, los
> criterios AP1-F, AP2-F y AP4-G —los tres que se miden a 30 días sobre datos de
> uso— no se pueden evaluar. Es código puro: no toca RLS, ni migraciones, ni
> producción, y no abre una ventana de trabajo nueva.

| # | Criterio | Cómo se verifica |
|---|---|---|
| MED-1 | `CallRequested` deja de emitirse en cada carga de página | Recarga de `reservar.html?c=X` 5 veces → 1 solo evento nuevo |
| MED-2 | La deduplicación **no cambia** el comportamiento de ningún otro emisor | `pwEmit` sin la opción nueva se comporta exactamente igual (opt-in) |

### DIAG — Diagnóstico documental, sin ejecución

| # | Criterio | Cómo se verifica |
|---|---|---|
| DIAG-1 | Los 20 clientes sin coach quedan **diagnosticados**, no reasignados | `docs/P0-clientes-huerfanos.md`; su SQL vive fuera de `supabase/migrations/` y **no se ejecuta** |

> **DIAG-1 es deliberadamente conservador.** Asignar un cliente al coach
> equivocado es peor que dejarlo huérfano: le da a alguien acceso a datos de
> otro. El diagnóstico es autónomo; la decisión no. **No se reasigna a nadie.**

### AP1 — El reloj del programa

| # | Criterio | Cómo se verifica |
|---|---|---|
| AP1-A | La semana mostrada se **deriva** de una fecha de inicio, no de un campo manual | Cambiar la fecha de inicio → la semana cambia sin tocar `semana_activa` |
| AP1-B | **Ningún cliente existente ve un salto de semana el día del despliegue** | Backfill `programa_inicio = hoy − (semana_activa−1)×7` → la semana calculada es idéntica a la actual para los 73 |
| AP1-C | El coach puede pausar y corregir a mano | Pausar congela la semana; corregir la fija |
| AP1-D | La semana no supera la duración del programa | Cliente con inicio hace 6 meses y programa de 4 semanas → muestra "programa terminado", no "semana 26" |
| AP1-E | Coach y cliente ven **la misma** semana | Comparar panel y portal para el mismo cliente |
| AP1-F | A los 30 días, la distribución de semanas ya no está concentrada en 1 | Repetir la consulta del baseline (58/73 en semana 1) |

> **AP1-B es el criterio que manda.** El protocolo del proyecto exige que un
> sprint no cambie lo que se ve fuera de su alcance. Un backfill ingenuo
> (`inicio = created_at`) mandaría a decenas de clientes a "programa terminado"
> de golpe. El backfill conserva el estado visible actual y arranca el reloj
> desde ahí.

### AP2 — El canal de vuelta 🟢 CERRADO (2026-09-01)

> Verificado en producción con el run #16. El detalle, abajo:
> **"AP2 — cierre definitivo"**.

| # | Criterio | Cómo se verifica |
|---|---|---|
| AP2-A | El resumen semanal sale por defecto a los coaches activos | `notifs.weeklyReport !== false` en `notif-coach` |
| AP2-B | Existe una forma visible de darse de baja | Enlace de baja en el email + toggle en el panel |
| AP2-C | Un coach que ya lo desactivó explícitamente **sigue** desactivado | `weeklyReport === false` se respeta |
| AP2-D | No se envía a coaches inactivos ni a cuentas de prueba | Filtro por `activo` en la función |
| AP2-E | El primer envío real es una decisión humana, no un efecto del merge | El cron ya existe (lunes 07:00 UTC); se avisa antes de mergear |
| AP2-F | A los 30 días, ≥1 envío semanal registrado y tasa de baja < 20% | `coach_nudges` / logs de la función |

> **AP2-E es una salvaguarda.** Este cambio hace que un cron existente empiece
> a escribirle a 41 personas reales. El código puede estar listo de forma
> autónoma; el primer envío no debería ocurrir por sorpresa al mergear.

### AP4 — El arranque sin peaje

| # | Criterio | Cómo se verifica |
|---|---|---|
| AP4-A | Al dar de alta un cliente, el email de invitación **sale solo** | Alta de prueba → email recibido sin intervención del coach |
| AP4-B | Funciona para coaches **sin** plan Pro | El envío automático no pasa por el gate de `isProV()` |
| AP4-C | El modal de copiar/pegar sigue existiendo como salida de emergencia | No se elimina, deja de ser el camino obligatorio |
| AP4-D | El coach puede subir el CV en PDF y el texto llega a la IA | Subir un PDF → el textarea se rellena con su texto |
| AP4-E | El campo de pegado manual **sigue funcionando** | Pegar texto a mano da el mismo resultado que antes |
| AP4-F | Si la extracción del PDF falla, el flujo no se rompe | PDF corrupto o escaneado → mensaje claro + campo de pegado disponible |
| AP4-G | A los 30 días, sube el nº de clientes que entran al portal | Baseline: 14 de 73 entraron alguna vez |

---

## Checklist de regresión (obligatorio antes del push)

Según el protocolo del proyecto, verificado en navegador:

- [ ] Dashboard del coach: sin cambios
- [ ] Equipo (multicoach): sin cambios — módulo LOCKED
- [ ] Clientes (grid y filtros): sin cambios
- [ ] Agenda / Reservas: sin cambios salvo la deduplicación del evento
- [ ] Portal del cliente: la semana mostrada es la misma que antes del deploy
- [ ] `npm run verify`: mismos 2 fallos que en el baseline, ni uno más

---

---

## Resultado — qué se entregó

| Criterio | Estado | Evidencia |
|---|---|---|
| ~~P0-A~~ | ❌ **RETIRADO** | Migración fuera del lote; `organizaciones` ya endurecida por otra vía. Sin sustitución |
| ~~P0-B~~ | ❌ **RETIRADO** | Sin migración RLS no hay nada que preservar |
| MED-1 | ✅ | Test: 5 recargas → 1 evento; coach distinto → sí emite; 25 h después → vuelve a emitir |
| MED-2 | ✅ | Test: 5 emisiones sin `once` → 5 eventos (sin cambio); `localStorage` bloqueado → no pierde el evento |
| DIAG-1 | ✅ | `docs/P0-clientes-huerfanos.md`: solo diagnóstico. Cero escrituras, SQL fuera de auto-apply, ningún cliente reasignado |
| AP1-A | ✅ | `PWPROG.semana()` deriva de `programa_inicio`; test 21/21 |
| AP1-B | ✅ | **Verificado contra los 73 clientes reales: 73/73 misma semana, 0 regresiones, 0 marcados "terminado"** |
| AP1-C | ✅ | Pausa congela; corregir re-ancla (`_progPatch`) |
| AP1-D | ✅ | 6 meses con programa de 4 semanas → semana 4 + `terminado`, no semana 26 |
| AP1-E | ✅ | Panel y portal llaman a la misma función de `pw-programa.js`; guardrail lo blinda |
| AP1-F | ⏳ | Se mide a los 30 días (baseline: 58/73 en semana 1) |
| AP2-A | ✅ | `notif-coach`: `=== false` en vez de `!== true` |
| AP2-B | ✅ | Enlace de baja en el pie + toggle en Configuración › Notificaciones |
| AP2-C | ✅ | `weeklyReport === false` se respeta; `unsubscribe` escribe el flag correcto vía `k=` |
| AP2-D | ✅ | Ya filtraba `activo=true`; se añadió excluir `cuenta_test` y `demo` |
| AP2-E | ⏳ | **Requiere decisión humana antes del merge** (ver abajo) |
| AP2-F | ⏳ | Se mide tras el primer envío |
| AP4-A | ✅ | `_invitarCliente()` envía por `send-email` al crear |
| AP4-B | ✅ | No pasa por `isProV()`; guardrail lo blinda |
| AP4-C | ✅ | El modal sigue existiendo y se abre solo si el envío falla |
| AP4-D | ✅ | `pw-pdf-text.js` + botón "Subir un PDF" en el modal de generación |
| AP4-E | ✅ | El textarea sigue siendo la fuente que leen los handlers `gen-*` |
| AP4-F | ✅ | 6 mensajes de error distintos; el campo de pegado nunca se bloquea |
| AP4-G | ⏳ | Se mide a los 30 días (baseline: 14 de 73 entraron) |

**Gate:** `npm run verify` da 6/8 con los mismos 2 fallos del baseline
(Guardrails ×5 preexistentes, Error Scope/ERR-ENV-001). Cero fallos nuevos.
Se sumaron **4 reglas de guardrail** que blindan lo entregado, y las 4 pasan.

## P0 retirado del lote (2026-08-28)

`p0_rls_tablas_abiertas.sql` **se ha eliminado de esta rama**. Motivo: mientras
corría el gate previo al merge, `main` avanzó 11 commits y otra vía endureció
`organizaciones` por completo (RLS on; anon sin SELECT/UPDATE/DELETE; migración
remota `20260827135025 f2_3b_owner_policies_solo_authenticated`). Además,
`landing.html` pasó a pedir la organización por `org_publica(slug)` y
`cliente.html` la marca por `org_marca_propia()`, así que la premisa de aquella
migración —que tres pantallas necesitaban lectura anónima— dejó de ser cierta.
Su política `organizaciones_select_anon USING (true)` habría sido un retroceso.

**Queda como remediación RLS pendiente, FUERA de este lote:**

- **`ranking_mensual`** — RLS off y `anon` con UPDATE: el podio es reescribible
  con la clave pública. Riesgo real, sin dueño en esta rama.
- **`sala.html`** — sigue leyendo `organizaciones?id=eq.` con la clave anónima y
  no usa los RPCs nuevos. Con `anon` ya sin SELECT, esa lectura debería estar
  fallando. Es trabajo en curso de otra rama.
- **`sesiones_registro`** — RLS ON con 0 políticas, cerrada por
  `f2_3_cierre_sesiones_registro` el 2026-08-27. **No la toca esta rama.**
  Verificado que no rompe nada: su único escritor
  (`SupabaseProvider.createEvent`) vive tras `USE_NEW_SCHEDULER=false`
  (`panel-v2.html:1453`), la última fila es del 2026-08-04 y no hay errores de
  cliente que la mencionen.

## El workflow de migraciones está roto (problema independiente)

`supabase db push` **nunca ha aplicado una migración**: los 81 runs de
`supabase-migrations.yml` terminan en `failure`. El log muestra las dos causas:

1. Salta los 126 ficheros sin prefijo `<timestamp>_` — entre ellos
   `ap1_programa_reloj.sql`.
2. Aborta con `Remote migration versions not found in local migrations
   directory` porque ~20 versiones del historial remoto no tienen fichero local.

**Consecuencia para AP1:** las tres columnas del reloj NO se crearán al mergear.
Sin ellas, `pw-programa.js` cae al comportamiento anterior (`semana_activa`) sin
error visible — degradación limpia, pero AP1 no surtiría efecto.

Reconciliar el historial (`migration repair`) es una operación aparte, con su
propia certificación. **No se intenta desde esta rama.**

## `ap1_programa_reloj.sql` — PREPARADA, NO APLICADA

Estado a 2026-08-28: **las tres columnas NO existen en producción**
(`programa_inicio`, `programa_semanas`, `programa_pausado` → 0 de 3 en
`information_schema.columns`). La migración viaja en la rama como artefacto
preparado y documentado; **no se ha ejecutado por ninguna vía** (ni SQL Editor,
ni MCP, ni workflow), por decisión expresa.

Queda pendiente de una vía de despliegue de migraciones segura. Mientras no se
aplique, `pw-programa.js` cae al comportamiento anterior (`semana_activa`) sin
error visible: degradación limpia, pero **AP1 no surte efecto**.

## AP2 — cierre definitivo (2026-09-01) 🟢

**Cerrado por el objetivo, no por el `success` del workflow:** los destinatarios
elegibles reciben el digest.

### Los dos runs que lo demuestran

Se conservan ambos como evidencia. **No re-ejecutar el workflow.**

| | **#15** — evidencia del defecto | **#16** — evidencia de la corrección |
|---|---|---|
| Cuándo | 2026-08-31 14:38 UTC (`schedule`) | 2026-09-01 09:37 UTC (`workflow_dispatch`) |
| Commit | `146b2dd` (AP2 sin la corrección) | `28c0b26` (con la corrección) |
| Conclusión | success | success |
| Duración del envío | 33 s | 67 s (≈34 s = la única espera) |
| coaches | 40 | 40 |
| **enviados** | **30** | **38** |
| saltados | 2 | 2 |
| **errores** | **8 × RateLimitError** | **0** |
| reintentos | — (no existía) | **1** |

Run #15: https://github.com/mmicaelajairedin-ui/analisisform/actions/runs/33403776745
Run #16: https://github.com/mmicaelajairedin-ui/analisisform/actions/runs/33493172040

### El defecto (run #15)

```
{"coaches":40,"enviados":30,"saltados":2,"errores":[8 x RateLimitError]}

ftcharlie95@gmail.com: RateLimitError: Rate limit exceeded for trace
01a058418a9b7703883af5768f6a6b93. Retry after 32872ms.
```

Las ocho comparten el mismo `trace`, y ese texto **no lo produce `send-email`**
(devuelve 502 con `{ok:false,status,error}`, nunca "RateLimitError"): es
`String(e)` de un `fetch` que LANZÓ. Quien cortaba no era Brevo sino la
plataforma de Supabase, limitando las invocaciones anidadas
`notif-coach → send-email`. El bucle las hacía seguidas y sin pausa; al llegar
a ~30 se topaba con el límite y descartaba el resto. El error decía cuánto
esperar y nadie lo leía: **8 de 40 coaches se quedaron sin su resumen.**

Salió en `success`: por eso el criterio de cierre no puede ser el estado del
workflow.

### La corrección (`28c0b26`)

`supabase/functions/notif-coach/enviar.ts` — reintento acotado que respeta el
`Retry after` del proveedor (2 reintentos máx., 30 s de reserva, techo de 45 s
por espera, presupuesto de 120 s para no agotar el `curl --max-time 200` del
workflow). Alcance: sólo `notif-coach`, su test y el guardrail.

**Por qué no puede duplicar un email:** sólo se reintenta un rechazo EXPLÍCITO
por límite de tasa, que es el único fallo del que consta que el proveedor **no
aceptó** el mensaje — la petición se corta en la puerta y nunca llega a Brevo.
Un corte de red, un timeout, una respuesta perdida o un 5xx son ambiguos y
**no** se reintentan. Es una garantía estructural, no un candado añadido.

### Verificación en producción (run #16)

- **38 de 38 destinatarios elegibles** recibieron el digest. Los 8 del #15 —
  `ftcharlie95`, `hola@ninateucilide.com`, `soyelcandidatoperfecto`,
  `ajairedin`, `jrbrembilla.taxes`, `abrilfitch.consultoria`, `rbrembilla42`,
  `gonzaloalcalde97` — siguen activos, sin opt-out ni test/demo, y entraron.
- **Los 2 saltados son los justificables, y sólo esos:**
  `demo.coach@pathway.com` (`demo:true` + opt-out) y
  `bot-gym@pathwaycareercoach.com` (`cuenta_test:true`). Cero sin email.
- **`reintentos: 1`** es la prueba de que el límite se tocó igual que ayer y se
  absorbió: un solo destinatario esperó, y esa espera recargó el cupo para los
  demás. Lo corrobora el tiempo (67 s vs 33 s).
- **Sin duplicados:** 39 intentos para 38 envíos. Un duplicado exigiría que el
  primer intento entregara *y* devolviera un rechazo por límite de tasa a la vez.
- `notificaciones` 0 y `coach_nudges` 0 — correcto: el digest sólo manda email
  por `send-email`, y los nudges los escribe `coach-lifecycle`.
- `client_errors` del día: 3, **ninguno** relacionado con el digest.
- Desplegado: **`notif-coach` v39 · ACTIVE** (deploy `#205`, success 09:17:13).

### Trayectoria de la apuesta

**0 de 49** coaches recibían el resumen antes de AP2 → **30 de 40** con AP2 →
**38 de 38** con la corrección.

### Blindaje

- `tests/ap2-reintento-rate-limit.mjs` — 44 casos, con el error literal del
  run #15 como fixture.
- Guardrail *"avisos: el resumen semanal sobrevive al límite de tasa"*.
- Guardrail *"avisos: el resumen semanal sale por defecto (opt-out, no opt-in)"*.

---

## Frentes abiertos — NO tocar sin autorización explícita

Cuatro trabajos separados, deliberadamente fuera de AP2. Ninguno se rozó al
cerrarlo.

| Frente | Estado |
|---|---|
| **AP1 — el reloj del programa** | Migración `ap1_programa_reloj.sql` **preparada, NO aplicada**: 0 de 3 columnas en producción (`programa_inicio`, `programa_semanas`, `programa_pausado`). El código convive con su ausencia (`PWPROG` cae al comportamiento histórico). Al aplicarla hay que repetir la validación 73/73. |
| **Historial de migraciones de Supabase** | `supabase db push` aborta: hay versiones remotas sin fichero local. Ninguna migración del repo llega a aplicarse. Ver *"El workflow de migraciones está roto"*. |
| **RLS pendiente** | `ranking_mensual` (RLS desactivada, UPDATE anónimo abierto) y la lectura anónima de `organizaciones` que le queda a `sala.html`. |
| **Google Calendar** | 3 `client_errors` observados el 2026-09-01 09:19 UTC en `panel-v2.html`: 2× `http_502` en `gcal-refresh` (`{error=refresh_failed}`) y 1× `neterror` en `/functions/v1/calendar`. Detectados durante el post-deploy de AP2, **ajenos a AP2**. Sin investigar. |

---

## Lo que este sprint NO hace

Registrado para que no se cuele por la puerta de atrás:

- **No** toca `acciones_progreso` ni `etapas` (eso es AP5, fuera de alcance),
  aunque AP1 pasa por al lado.
- **No** activa push web ni nativa (no bloquea AP2; los avisos salen por email).
- **No** construye centro de preferencias de notificaciones (un toggle basta).
- **No** arregla las 5 regresiones de guardrails preexistentes.
- **No** arregla ERR-ENV-001 ni limpia tablas muertas.
- **No** toca RLS, políticas ni grants de ninguna tabla (P0 retirado).
- **No** arregla el workflow de migraciones ni reconcilia el historial remoto.
- **No** aplica las columnas de AP1 a mano en producción.
- **No** aplica las 13 migraciones diseñadas sin aplicar.
- **No** reasigna clientes huérfanos automáticamente.
- **No** toca la Sala, el desenlace de sesión ni la asistencia (AP3).
- **No** hace parser de CV propio ni scraping de LinkedIn.
