# Proyecto — Sala de sesión + círculo de clientes Pathway

> **Idea central:** la **llamada/demo es la única puerta** por donde Pathway
> convierte todo lo que trae. Una sola **Sala** (video embebido dentro de
> Pathway) con **3 modos** según el `kind` de la reserva. Todo lo demás de
> Pathway se **entrelaza** con esto — no es una feature aparte, es el pegamento.
>
> Estado: **documento de proyecto** para validar ANTES de tocar código.
> Regla: aditivo, por fases reversibles, detrás de interruptor hasta aprobar.

---

## 1. El modelo — una Sala, tres modos, un círculo

```
NUEVO de afuera (origen=pathway)  →  PRIMERA LLAMADA / DEMO  →  se convierte en…
  marketplace/landing/chatbot          (Sala, modo conversión)   ├─ CLIENTE Pathway → comisión escalonada
                                                                  └─ COACH / multicoach → suscripción
                                                                          │
        más COACHES = más oferta que atiende y ATRAE más leads ──────────┘  (crece la OFERTA, no el cliente)

YA ADENTRO (origen=propio: cliente del coach o que ya pagó)  →  entra DIRECTO a su panel
  NO viene de afuera · 0% comisión · no se convierte              con sesiones + historia → Modo Sesión
```

**Clave:** lo que recircula y cierra el círculo es la **oferta** (más demos → más
coaches → más capacidad para atraer/atender leads), **no los clientes**. Un
cliente que ya está adentro (propio del coach, o que ya pagó) **no vuelve a la
puerta de conversión**: entra directo a su panel con su historia y va al Modo
Sesión. La puerta (primera llamada/demo) es **solo para lo nuevo que viene de
afuera** (`origen=pathway`).

### El lado de la oferta en detalle — cómo crece el coach

```
CLIENTE PATHWAY ──comisión escalonada──▶ (Pathway cobra) ─── lo atiende un ───▶ COACH / equipo de coach
                                                                                        │
                                                        ┌───────────────────────────────┴──────────────┐
                                                     VA BIEN                                          VA MAL
                                                        │                                                │
                                          ┌─────────────┴─────────────┐                        retención / soporte
                                    + NUEVO MULTICOACH          + NUEVO COACH (referido)         (coach-lifecycle)
                                    (convertir-multicoach)      (registrar-coach.referred_by)
                                                        │
                                    TRAE SUS clientes (origen=propio) ──▶ 0% comisión ──▶ más oferta ↺
```

- **Coach que VA BIEN** → se **multiplica**: crece a **multicoach**
  (`convertir-multicoach`) o **refiere un coach nuevo** (`referred_by`, ya existe).
- Ese coach/multicoach nuevo **trae SUS propios clientes** → `origen=propio` →
  **0% comisión** (no pasa por la puerta de conversión).
- **Coach que VA MAL** → **retención/soporte** (`coach-lifecycle` ya avisa
  vencimientos y renovación). *(confirmar el destino de esta rama)*.

Así: **Pathway cobra comisión solo de lo que TRAE (`origen=pathway`); lo que el
coach trae es 0%. El círculo crece porque los coaches exitosos se multiplican.**

La Sala es el mismo cascarón (video JaaS embebido); lo que cambia es el **panel
al costado** y el **botón de cierre**, según el `kind`:

| kind (fijo) | Quién lo usa | label (renombrable) | Modo | Cierre |
|---|---|---|---|---|
| `sesion` | **Coach** | "Sesión", "Entreno"… | Sesión (cliente adentro, 0%) | Cerrar en 1 clic: resumen IA + tareas + próxima cita |
| `primera_llamada` | **Coach** | "Primera llamada gratis" | Conversión cliente (**puede salir cliente nuevo o no**) | Dar acceso → (después) cobrar servicio → comisión |
| `demo_pathway` | **SOLO admin / empleado** (Micaela, Gonzalo) | "Demo Pathway" | Conversión **coach** | Agregar coach / multicoach → suscripción |
| `personal` | Cualquiera | libre | Solo agenda | (sin Sala) |

> **Cada nivel tiene su puerta** (modelo de 3 niveles Pathway → Coach → Cliente):
> - **Pathway (admin/empleado)** corre la *Demo* → suma **coaches**. `demo_pathway`
>   solo se muestra si `rol ∈ {admin, empleado}` (Gonzalo = empleado comercial).
> - **Coach** corre *Primera llamada* → suma **clientes** (o no convierte) · y
>   *Sesión* → atiende a los que ya tiene (0%, con su historia).
> El resultado de la *primera llamada* se registra: **convirtió** (cliente nuevo →
> comisión al cobrar) **o no** — dato que alimenta el funnel.

### El punto de ENTRADA define qué tipo se ofrece (y la sala)

La misma acción (agendar) genera un tipo/modo/sala distinto según **de dónde
entra** la persona:

| Dónde se agenda | Quién es | Tipo → modo | `origen` |
|---|---|---|---|
| **Landing pública** / **link para compartir** del coach | persona **nueva de afuera** | `primera_llamada` ("cliente Pathway") → conversión cliente | `pathway` |
| **Portal del cliente** (ya con acceso) | **cliente existente** del coach | `sesion` → sesión (0%, con historia) | `propio` |
| Link que comparte **admin/empleado** | prospecto de **coach** | `demo_pathway` → conversión coach | (lado coach) |

- En lo **público** (landing + link del coach) se ofrece **`primera_llamada`**
  porque es alguien de afuera a quien **Pathway le da acceso** → posible cliente
  nuevo (`origen=pathway`).
- El **cliente que ya está adentro** agenda **`sesion`** desde su portal
  (`origen=propio`, 0%).
- La **`demo_pathway`** solo aparece en el link/flujo de **admin/empleado**.

Implica: `reservar.html` filtra los `event_types` ofrecidos **según el contexto**
(público → primera_llamada · portal cliente → sesion · admin/empleado → demo),
no muestra todos a todos.

### El coach NO crea tipos de llamada (blindaje de atribución)

**Riesgo:** si el `origen` dependiera del tipo que elige el coach, un coach podría
mandar un link de "Sesión" a un desconocido y quedaría como `propio` (0%) cuando
debería ser cliente Pathway. Por eso:

1. **El `kind` y el `origen` los decide el SISTEMA**, no el coach:
   - Agenda alguien que **ya es cliente** del coach (está en el sistema) →
     `sesion`, `origen=propio`.
   - Agenda alguien **nuevo desde lo público** → `primera_llamada`,
     `origen=pathway`.
   - Aunque el coach mande "el link de sesión" a un desconocido, el sistema ve que
     **no es cliente conocido** → lo trata como primera llamada. **No se puede
     reclasificar para esquivar comisión.**
2. **El coach NO crea tipos de llamada nuevos.** Los bookables (que generan
   link/reserva) son **canónicos** (`sesion`, `primera_llamada`; `demo_pathway`
   solo admin/empleado).
3. De los canónicos, el coach **edita solo lo cosmético**: **duración, ícono,
   color, nombre** — **nunca el link ni el `kind`**.
4. El coach **sí** puede agregar **"categorías" sin link de llamada** (etiquetas
   para organizar lo suyo; no agendan, no generan sala).

## 2. Tipos de evento CANÓNICOS (no texto libre)

Hoy `usuarios.configuracion.event_types` es texto libre → dos coaches escriben
"Llamada inicial" vs "Primera charla" y el sistema no sabe que son lo mismo → la
Sala no puede elegir modo. **Fix:** cada event type lleva un **`kind` del
sistema** (los 4 de arriba). El coach **renombra el label**, el `kind` es fijo.
Pathway los trae **predefinidos** (no se crean duplicados).

- Migración: `event_types` pasa de `[{label,color,icon}]` a
  `[{kind,label,color,icon,dur}]`. Backfill: los existentes → `kind:'sesion'`.

## 3. Sala única por cita (no compartida)

El **tipo es canónico**, la **sala es única por reserva**: `Pathway-<coach_id>-<cita_id>`
(determinística → coach y cliente arman la misma; única → dos clientes nunca
colisionan; notas/grabación quedan por-sesión). La "sala fija" (Meet/Zoom
personal, ya en `configuracion.sala_video`) queda como **fallback** para quien no
use JaaS.

## 4. El video: JaaS (8x8) embebido

- **App ID** = `vpaas-magic-cookie-…` (público, va en el navegador).
- **JWT firmado en el servidor** → edge function nueva **`jaas-token`** (RS256 con
  la clave privada de JaaS como secret en Supabase; NUNCA en el navegador).
- Coach entra como **moderador**; el cliente entra con **JWT de invitado** (o sala
  con lobby). Grabar/transcribir = features **premium** (cuestan) → sub-proyecto
  "notas IA de la llamada".
- Google Meet NO se puede embeber; por eso JaaS. (El Meet automático nativo sigue
  siendo Fase 4 de la agenda, OAuth de Google, trabado.)

## 4b. El cierre de cada modo — conversión + pago (qué sale en la Sala)

El pago y la conversión **salen desde la misma Sala**, como botón de cierre:

| Modo | Botón de cierre | Qué hace | Función | Plata |
|---|---|---|---|---|
| **Demo** (admin/empleado) | **Convertir en coach / multicoach** | crea cuenta + manda al Stripe de suscripción | `crear-coach` / `crear-multicoach` + `stripe-webhook` | coach paga su **plan** (suscripción) |
| **Primera llamada** (coach) | **Dar acceso** + **Cobrar servicio** | crea cliente + portal · cobra servicio | `guardar-intake` + `connect-checkout` | cliente paga → **comisión escalonada** (con hold) |
| **Sesión** (coach) | **Cerrar en 1 clic** (resumen + tareas + próxima cita) | cierra la sesión, sin conversión | `generar-informe` + `sesiones_registro` | **0%** (propio, ya adentro) |

### Resultado de una llamada de conversión (no es sí/no)

Una **primera llamada** o **demo** no cierra siempre en esa sesión. Tres salidas
(para que el embudo NO gotee):

| Salida | Qué pasa | Con qué |
|---|---|---|
| ✅ **Convirtió** | cliente/coach nuevo | dar acceso / cobrar · o crear coach |
| 🟡 **Todavía no** ("va mal" de la llamada) | **reagendar** + marcar **en seguimiento** (la lead sigue caliente) | agenda (`citas`) + estado del lead + recordatorio (`notificaciones`/`recordatorios-citas`) + chat |
| ⚪ **Perdido** | descartar | estado del lead = `perdido` |

La lead lleva un **estado**: `nuevo → llamada → convirtió | en_seguimiento | perdido`.
Esto alimenta el funnel y el seguimiento no se pierde. *(Ojo: este "va mal" es de
la LLAMADA — distinto del "va mal" del COACH de la sección de oferta, que es
retención/soporte.)*

**Confirmación de DOS LADOS (coach + cliente) — evita duplicar.** El resultado no
lo decide solo el coach: después de la llamada **ambos dicen cómo fue**.
- **Match = ambos confirman que fue bien** → se crea la relación **UNA sola vez**
  (por eso "no duplica").
- Si no es mutuo → feedback + seguimiento.

Qué le sale a cada uno al terminar:
- **Cliente (primera llamada):** *Cómo fue* (feedback/reseña — reusa el sistema de
  reseñas que ya existe) · *Buscar otro coach* del nicho (rematch) · o *escribir
  cómo fue + "que me hablen más adelante"* (seguimiento).
- **Prospecto (demo):** *Iniciar prueba ahora* · *Ver planes* · *Reagendar*. Match
  = coach y prospecto confirman → alta (sin duplicar).

- **Acceso ≠ pago:** "Dar acceso" crea el cliente gratis; el **cobro** es un botón
  aparte (cuando el coach le vende un servicio). Puede haber acceso sin pago.
- 🔴 **HALLAZGO CONFIRMADO en `connect-checkout` (plata real):** hoy la comisión se
  aplica a **TODO** cliente que paga, **sin distinguir propio vs pathway**:
  - Línea ~184: cuenta `candidatos?coach_id=eq.X&pago_recibido=eq.true` → **todos
    los pagos, sin filtro de `origen`**.
  - Línea ~189-190: `fee = monto * tierRate(nPrev+1)` → comisión a **todo** servicio.
  - **Consecuencias:** (1) un cliente **propio** pagaría comisión (debería ser 0%);
    (2) los propios **inflan `nPrev`** → tramo más alto también para los pathway.
  - **Causa raíz:** `candidatos` **no tiene campo `origen`** (gap del hilo). No puede
    distinguir. Hoy solo "zafa" si Connect se usa únicamente para el marketplace —
    nada lo garantiza; en la Sala (cobrar a un propio) se rompe.
  - **Fix (con la fase del hilo):** agregar `origen` a `candidatos` → en
    connect-checkout `fee=0` si `origen=propio`, y contar **solo `origen=pathway`**
    para el tramo.

## 5. La plata — DOS carriles distintos (no mezclar)

1. **Cliente paga al coach → comisión de Pathway**: Stripe **Connect**
   (`connect-checkout`/`connect-onboard`). Comisión **ESCALONADA** por clientes
   pagos previos del coach vía Pathway (`tierRate`):

   | Clientes pagos vía Pathway | Comisión |
   |---|---|
   | 1–5 | 5% |
   | 6–15 | 10% |
   | 16–30 | 15% |
   | 31+ | 18% |

   Se cobra en **cada compra** (`application_fee_amount`); en suscripciones, **cada
   ciclo** (`application_fee_percent`). Cobro con **hold**: primera llamada gratis
   → servicio con retención → se captura al aceptar.
   > **Corregir:** `pathway-coaches-PLAN.md` dice "20% solo la primera vez" — está
   > VIEJO. La fuente de verdad es `tierRate` en `connect-checkout`.

2. **Coach paga a Pathway (suscripción)**: `crear-coach`/`crear-multicoach` +
   `stripe-webhook`. Es el cierre de la **demo**. Carril aparte.

3. **Comisión comercial del EMPLEADO (Gonzalo) — carril interno, NO romper.**
   Cada **lead que gestiona un empleado y se convierte en COACH** (alta) se le
   **atribuye** para su comisión. Tabla `leads` (`leads_empleados.sql`, campo de
   atribución lead→coach), medido en la vista `v_empleado_metricas`. Es por
   **altas de coaches**, no por Stripe.
   > ⚠️ **Al construir el cierre de la Demo** (`convertir en coach` → `crear-coach`),
   > **preservar el vínculo lead→coach** (la atribución del empleado). Si se pierde,
   > Gonzalo pierde su comisión. La Demo la corren admin/empleado → el lead ya tiene
   > `empleado_id`; el alta debe escribir el coach resultante en la atribución del lead.

**Acceso ≠ pago:** "dar acceso" crea el cliente + portal (gratis); la comisión
recién sale cuando el coach le **cobra su servicio** vía connect-checkout.

## 6. El hilo del lead (lo que cierra el círculo)

Falta un **registro único del lead con su `origen`** que viaje
lead → demo → conversión → comisión/suscripción → funnel. Hoy está fragmentado:
`contactos_chat`, `leads_pricing`, `citas.origen`, `candidatos`, `usuarios`. Sin
ese hilo **no se atribuye la comisión** ni se ve el funnel. El **nicho** también
viaja en el lead (busca coach de carrera/fitness/finanzas), no solo en la sesión.

**El marketplace es OPT-IN (perfil público).** Un coach, por defecto, solo agrega
**sus** clientes → `origen=propio`, **0% siempre**. Recién **si prende su perfil
público** (aparece en el directorio, `listar-coaches-publicos`/`slug`) Pathway
puede **traerle leads** → esos son `origen=pathway` → comisión. O sea: **"clientes
Pathway" solo existen para coaches con perfil público ON.**

**El cliente Pathway es del MARKETPLACE, no de un coach fijo → rematch.** Como
Pathway hace el **match**, puede ofrecerle **otros coaches del mismo nicho**
(`listar-coaches-publicos` filtra por nicho; el nicho viaja en el lead). Por eso:
(a) Pathway cobra comisión (provee la oferta y el match); (b) **el lead no se va
del funnel** aunque una primera llamada no cierre → se le ofrece **otro coach del
nicho** (otra salida del "no convirtió"). El cliente **propio** es del coach, **sin
rematch**.

**Backfill de `origen` (decisión tomada):** los clientes que ya existen se marcan
**`propio` por defecto** (nadie es `pathway` hasta que el marketplace se lo trajo).
Es lo seguro: no cobra comisión de más. Los `pathway` viejos, si los hay, se
ajustan a mano.

## 7. Mapa: cada función de Pathway → su rol en el modelo

| Función / pieza (existe) | Qué hace hoy | Rol en la Sala / el círculo |
|---|---|---|
| `listar-coaches-publicos`, `obtener-perfil-coach` | directorio marketplace | **ORIGEN**: de acá salen los leads "clientes Pathway" |
| `contacto-coach` + `contactos_chat` | leads del chatbot/contacto | **ORIGEN**: lead entra con su nicho |
| `leads_pricing` | funnel trial/pago del coach | **ORIGEN (lado coach)**: prospecto de demo |
| `reservar.html` + `citas` (`tipo`,`origen`) | agenda nativa, reserva | **AGENDA**: crea la cita con `kind`+`origen` → dispara la Sala |
| `calendar`, `gcal`, `gcal-connect`, `gcal-refresh` | lee/escribe Google Calendar | **AGENDA**: sync; Meet auto = Fase 4 (OAuth) |
| `jaas-token` (NUEVO) | firma JWT de JaaS | **SALA**: auth del video embebido |
| `_prepSesionHtml`, `ia-pathway`, `generar-informe` | prep IA + informes | **Modo Sesión**: prep antes + resumen al cerrar |
| `sesiones_registro` + tareas (`acciones`/`tareas_done`) | registro de sesión | **Modo Sesión**: notas/tareas/objetivos, niche-aware |
| `guardar-intake` | intake del cliente | **Modo Primera llamada**: "dar acceso" crea/activa cliente |
| `connect-checkout`, `connect-onboard` | cobro cliente→coach + comisión | **Cierre Primera llamada**: servicio → comisión escalonada |
| `crear-coach`, `crear-multicoach` + `stripe-webhook` | alta + suscripción | **Cierre Demo**: convertir lead en coach/multicoach |
| `asignar-cliente`, `mi-red`, `agregar-*-red` | red multicoach (`org_id`) | si el coach es de una red, el cliente entra con `org_id` |
| `notificaciones` (NUEVO) + `send-push` + `notif-*` | avisos | "llamar/agendar" avisan; el cierre avisa al cliente |
| `send-email`, `send-queued-emails` | emails (Brevo) | confirmación de cita, acceso, resumen |
| `recordatorios-citas` | recordatorio de citas | avisa antes de la Sala |
| `coach-lifecycle` | vencimiento/renovación coach | retención del coach (lado suscripción) |
| chat (`notas_coach`) | chat coach↔cliente/lead | **RAMPA**: botones "llamar ahora" / "agendar" |
| `analytics-weekly` + `leads_pricing` | funnel semanal | **Cierra el círculo**: mide leads→demos→conversiones |
| medallas / gamificación | logros del cliente | Modo Sesión: las tareas del coach son sus logros |

## 8. Huecos / decisiones pendientes

- [ ] `jaas-token` + auth del cliente (invitado vs lobby) + moderador.
- [ ] Grabar/transcribir para "notas IA de la llamada" (costo JaaS) — sub-proyecto.
- [ ] "Llamar ahora" con **ring en vivo** → presencia (Supabase Realtime +
      `cliente_last_seen`). MVP: abre sala + notifica.
- [ ] Ciclo de vida: cancelar/reprogramar (`gestionar-cita` ya existe) → sala
      muerta; estado **no-show**.
- [ ] El **hilo del lead** (tabla/campos de `origen` + estado) — el más importante
      para el círculo.
- [ ] Costo de JaaS a escala (free tier → pago por minutos).

## 9. Fases (prioridad = crecer "clientes Pathway", no retención primero)

| # | Fase | Entrega | Riesgo |
|---|------|---------|--------|
| 0 | Este doc + mock aprobado | plan | nulo |
| 1 | **Tipos canónicos (`kind`)** + sala única por cita + `jaas-token` + Sala base embebida | la Sala funciona con video real | medio |
| 2 | **Modo Demo** → convertir en coach/multicoach (rail suscripción) | cierra el lado coach del círculo | medio |
| 3 | **Modo Primera llamada** → dar acceso + cobrar (rail Connect, comisión escalonada, hold) + **hilo de origen** | cierra el lado cliente del círculo | alto |
| 4 | **Chat**: botones "llamar ahora" / "agendar" (rampa) | entrada al embudo | bajo |
| 5 | **Modo Sesión** niche-aware + prep IA + cerrar en 1 clic | retención | medio |
| 6 | Notas IA de la llamada (grabar/transcribir JaaS) | diferencial | alto |

> El **video embebido (JaaS)** es el mismo shell en los 3 modos; lo que cambia es
> el panel y el cierre. Por eso Fase 1 lo monta una vez y las 2/3/5 lo reusan.

## 10. Qué necesito de vos

- **JaaS**: la **API Key** (clave privada) + **Key ID** de la consola de 8x8
  (jaas.8x8.vc → API Keys). La privada va como secret en Supabase.
- Confirmar el **orden de fases** (arranco por 1, después el lado conversión 2/3).
