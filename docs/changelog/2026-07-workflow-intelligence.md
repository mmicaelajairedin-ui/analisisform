# Changelog — Workflow Intelligence · nudges por ETAPA (estado real, no días)

**Fecha:** 2026-07-27
**Fase:** Pathway OS · Nivel 2 (Automation) — primer paso
**Rama:** `claude/n8n-business-workflow`
**Filosofía:** *"¿Qué necesita este coach para avanzar HOY?"* — no una plataforma
que manda recordatorios, sino una que ayuda a dar el **próximo paso**.

## Qué cambia

`coach-lifecycle` (el cron diario que ya existía) ahora manda el onboarding
**según el estado real del coach**, no solo por días desde el alta. Antes un coach
que ya había completado su perfil igual recibía *"completá tu perfil"* el día 3.
Ahora el motor mira lo que YA hizo y ayuda **solo con el próximo paso pendiente**.

**Regla de oro:** nunca empujar un paso que el coach ya dio.

### 5 reglas (no 40)
1. **TrialStarted** → pasan 2 días sin perfil → recordar completar el perfil.
2. **ProfileCompleted** → falta conectar Stripe → explicar por qué hacerlo.
3. **StripeConnected** (o no necesita cobro) → no invitó cliente → *"suma tu primer cliente."*
4. **ClientInvited** → el cliente no aceptó en 3 días → recordatorio al coach.
5. **ClientAccepted** → onboarding al cliente — **ya lo cubre la invitación**
   (crea la cuenta y manda el acceso), no se duplica.

## Lo que se REUSA (no se recreó nada)
- **El cron, el anti-spam (`coach_nudges`) y los emails/push** que ya existían.
- **La plantilla `emailHtml()`** existente — `stageEmail()` la reusa, no crea una nueva.
- **Las MISMAS señales de "hecho" que la guía del panel** (`panel-v2.html ·
  computeSteps`): perfil (slug/bio/título/foto), Stripe, cliente. Así el email
  nunca contradice lo que el coach ve en la guía (la cabra).
- **El botón lleva al panel**, donde la guía in-app sigue el paso → el email es el
  empujón, la guía existente es el destino. No se recreó la guía.

## El matiz que evita meter la pata
**Stripe solo se empuja si la coach aceptó clientes de Pathway** (`pathway_optin`).
Con clientes propios cobra directo (0% comisión) y **no necesita** Connect — igual
que `optPw` en `computeSteps`. Mandarle "conectá Stripe" a todas habría sido molesto
y equivocado.

## Prioridad y seguridad
- Prioridad: **renovación > nudge por etapa > onboarding por tiempo (nurture) >
  retención.** El nurture (bienvenida/referidos/review) se conserva; cae cuando no
  hay paso pendiente.
- **Solo coaches nuevos** (`altaTs >= ONBOARDING_FROM_TS`, 2026-07-12): no se toca
  a los coaches viejos (no retroactivo).
- **1 empujón por coach cada 3 días** (anti-spam existente) y **cada paso 1 sola vez**.
- Respeta opt-out (`notifs.lifecycle === false`), baja al pie, admin/pro-vitalicio skip.

## Preview antes de activar
`POST {test_email:"tu@correo"}` ahora también manda los **4 nuevos emails de etapa**
(además de los de onboarding y reactivación) a esa casilla, sin tocar coaches
reales ni el anti-spam. Para revisarlos en tu bandeja antes de que salgan.

## Validación
- 4 checks de CI en verde (172 reglas). +1 guardrail: las 4 reglas existen, Stripe
  respeta `pathway_optin`, `stageEmail` reusa `emailHtml`, y el nudge por etapa
  tiene prioridad sobre el onboarding por días.
- TS revisado a mano (deno/tsc no están en el entorno; esbuild al desplegar).
- Deploy automático al mergear (`coach-lifecycle` ya está en `deploy-functions.yml`).

## Pendiente (próximas iteraciones)
- Medir conversión por paso (cuántos avanzan tras cada nudge) con los eventos ya
  cableados — cerrar el loop "nudge → evento → ¿avanzó?".
- Los pasos in-app extra (servicios, primer informe, plantillas) si se quieren
  también por email.
