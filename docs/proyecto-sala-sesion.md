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
Pathway trae (marketplace/landing/chatbot)  →  PRIMERA LLAMADA / DEMO  →  se convierte en…
                                                    (la Sala)               ├─ CLIENTE → comisión escalonada
                                                                            └─ COACH / multicoach → suscripción
                                                                                    │
                              el coach nuevo trae/atiende más clientes Pathway ─────┘  (vuelve a empezar)
```

La Sala es el mismo cascarón (video JaaS embebido); lo que cambia es el **panel
al costado** y el **botón de cierre**, según el `kind`:

| kind (del sistema, fijo) | label (el coach lo renombra) | Modo | Cierre |
|---|---|---|---|
| `sesion` | "Sesión", "Entreno"… | Sesión (cliente adentro) | Cerrar en 1 clic: resumen IA + tareas + próxima cita |
| `primera_llamada` | "Primera llamada gratis" | Conversión cliente | Dar acceso + (después) cobrar servicio → comisión |
| `demo_pathway` | "Demo Pathway" | Conversión coach | Convertir en coach / multicoach → suscripción |
| `personal` | libre | Solo agenda | (sin Sala) |

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

**Acceso ≠ pago:** "dar acceso" crea el cliente + portal (gratis); la comisión
recién sale cuando el coach le **cobra su servicio** vía connect-checkout.

## 6. El hilo del lead (lo que cierra el círculo)

Falta un **registro único del lead con su `origen`** que viaje
lead → demo → conversión → comisión/suscripción → funnel. Hoy está fragmentado:
`contactos_chat`, `leads_pricing`, `citas.origen`, `candidatos`, `usuarios`. Sin
ese hilo **no se atribuye la comisión** ni se ve el funnel. El **nicho** también
viaja en el lead (busca coach de carrera/fitness/finanzas), no solo en la sesión.

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
