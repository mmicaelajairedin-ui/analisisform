# ADR-0001 — Arquitectura basada en eventos (Event Bus)

- **Estado:** Aceptada
- **Fecha:** 2026-07-27
- **Ámbito:** Pathway OS Core · Nivel 0 (Foundation)

## Contexto

Pathway venía creciendo como un conjunto de pantallas y tablas acopladas entre
sí. Cada capacidad nueva (emails, analytics, health score, customer success)
obligaba a tocar varios flujos a la vez, y la expansión multi-nicho
(carrera / fitness / finanzas) multiplicaba ese acoplamiento.

Además había un vacío de datos: no existía una **fuente de verdad de "qué pasó"**
en el producto. Sin eso no se podía medir la **activación** (el indicador que más
predice conversión y retención en un SaaS de este tipo), ni detectar cuentas en
riesgo, ni alimentar automatizaciones inteligentes.

## Decisión

Adoptar una **arquitectura basada en eventos**. Toda acción de negocio emite un
**evento de dominio** a un **Event Store**; cualquier módulo puede reaccionar a
ese evento **sin acoplarse** al que lo emitió. Esta es la primera pieza del
"Pathway OS Core".

Piezas del Nivel 0:
- **Event Store** — tabla `eventos` (`supabase/migrations/eventos.sql`). Reusa el
  patrón probado de `client_errors`: RLS con `anon INSERT`, nadie lee con la anon
  key; la lectura para métricas se hará con service role.
- **Emit (cliente)** — `pw-events.js` (`window.pwEmit`), best-effort y a prueba de
  fallos (mismo patrón que `pw-observe.js`): nunca rompe ni bloquea un flujo.
- **Contrato** — `docs/domain-events.md`: qué evento emite cada dominio y quién lo
  escucha. Es el documento del que cuelga toda la plataforma.

## Por qué estos cuatro eventos primero

Se cablearon primero `ClientInvited`, `ClientAccepted`, `SessionCompleted` y
`ProfileCompleted` porque:

1. **Son los de activación** — la señal que más mueve la aguja (un coach que
   invita a un cliente y genera interacción entiende el valor y paga; el que no,
   cancela). Medir esto es la prioridad #1.
2. **No tocan la plata** — a diferencia de `PaymentSucceeded`, no pasan cerca de
   Stripe. Menor superficie de riesgo para estrenar la arquitectura.
3. **Sus puntos de cableado ya existían** — se emiten desde acciones que el código
   ya ejecutaba (alta de cliente, consentimiento, registro de sesión, guardado de
   perfil), agregando solo una llamada best-effort en el camino de éxito.

## Alternativas consideradas

- **Herramienta externa de automatización (n8n u similar).** Descartada para el
  core: obligaría a que un sistema externo guarde las llaves de Stripe y Supabase
  → una **nueva superficie de fuga**, justo lo contrario de lo que se busca. Queda
  como posible capa visual futura, no como fuente de verdad.
- **Seguir con automatizaciones puntuales hardcodeadas** (como hoy:
  `recordatorios-citas`, `coach-lifecycle`). No escala, duplica código y no deja
  datos para medir embudos.

## Consecuencias

**A favor**
- Desacople: agregar un módulo nuevo = suscribirse a un evento, sin tocar a los
  demás.
- Medición: los embudos, el health score y el dashboard CEO se derivan del Event
  Store.
- Base multi-nicho: el mismo evento (`SessionCompleted`) sirve para carrera,
  fitness o finanzas; solo cambia la reacción.
- Moat: habilita el futuro motor de reglas ("SI ocurre X, hacer Z").

**En contra / costos**
- Cada evento hay que cablearlo a mano en su punto exacto. **Mitigación:** cada
  emit tiene una regla en `scripts/check-guardrails.js` que impide borrarlo por
  accidente.

## Principios de implementación (invariantes)

- **Aditivo:** nunca cambia un flujo existente.
- **Best-effort:** el emit jamás bloquea ni tira un throw; si falla, la acción
  real sigue igual.
- **RLS estricto:** `anon` solo puede INSERT; nadie lee con la anon key.
- **Nombres** en PascalCase y en pasado (ya ocurrió).
- **El contrato manda:** un evento se agrega a `docs/domain-events.md` antes de
  cablearse.
- **Blindado:** cada emit cableado suma una regla de regresión en el guardián.
