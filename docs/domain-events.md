# Domain Events — el contrato de Pathway OS

> **Fuente de verdad del event bus.** Define qué evento emite cada dominio y
> quién lo escucha. Todo el Pathway OS Core (activación, health score, embudos,
> reglas) se conecta a través de esta tabla. Si agregás un evento, va acá primero.

## Qué es y qué NO es (todavía)

Nivel 0 · Foundation del plan de construcción. Es **aditivo e inerte**: la
infraestructura existe, pero **nadie emite eventos hasta que se cablea, a mano,
uno por uno**. Cablear un evento nunca cambia el flujo existente (es best-effort,
igual que `pw-observe.js`).

Piezas de este nivel (ya creadas):
- **Event Store** — tabla `eventos` (`supabase/migrations/eventos.sql`). Aplicar
  una vez en Supabase. Copia el patrón de `client_errors`: anon INSERT, nadie lee
  con la anon key.
- **Emit (cliente)** — `pw-events.js` define `window.pwEmit(tipo, opts)`. Incluir
  el script no hace nada solo; hay que llamar a `pwEmit()` desde el código.
- **Este contrato** — `docs/domain-events.md`.

Pendiente (siguientes pasos, en orden):
1. Cablear los primeros eventos (los de **activación**, ver más abajo).
2. Helper `emit()` server-side para edge functions (service role).
3. Nivel 1: leer estos eventos → activación, health score, embudos, dashboard CEO
   (con una edge function que use service role, nunca la anon key).

## El contrato — eventos, quién emite, quién escucha

Nombre en **PascalCase, en pasado** (ya ocurrió). El "escuchan" es el objetivo:
todavía no hay suscriptores; se construyen en el Nivel 1–2.

| Evento | Lo emite (dominio) | Lo escuchan | Cuándo |
|--------|--------------------|-------------|--------|
| `LeadCreated` | Commercial | Analytics · Commercial | entra un lead (landing, chat, alta manual) |
| `TrialStarted` | Commercial | Analytics · Activation · Notifications | el coach arranca su prueba de 14 días |
| `ProfileCompleted` | Activation | Activation · Analytics | el coach completa perfil + branding |
| `StripeConnected` | Billing | Activation · Analytics | el coach conecta su cobro (Connect) |
| `ClientInvited` | Coaching | Client · Activation · Analytics | el coach invita a su primer/otro cliente |
| `ClientAccepted` | Client | Coaching · Activation · Analytics · Notifications | el cliente acepta la invitación |
| `SessionCompleted` | Coaching | AI · Analytics · HealthScore · Notifications · Marketplace | se realiza/registra una sesión |
| `TaskCompleted` | Client | Coaching · Analytics · Automation | el cliente marca una tarea hecha |
| `WowReached` | Activation | Analytics · Commercial | hubo interacción real (momento WOW) |
| `PaymentSucceeded` | Billing | Marketplace · Ledger · Analytics · Commercial | entra un pago (coach o cliente) |
| `ProgramFinished` | Coaching | Renovación · AI · Analytics · Notifications | termina un programa (4 semanas) |
| `CoachInactive` | HealthScore | CustomerSuccess · Notifications · Admin | el coach baja su actividad (riesgo) |
| `ClientInactive` | HealthScore | Coaching · Notifications | el cliente deja de entrar |
| `ReferralWon` | Commercial | Ledger · Analytics | un referido paga |
| `MarketplaceSold` | Marketplace | Billing · Ledger · Analytics | se vende un servicio del marketplace |

## Cómo emitir

### Desde el navegador (cliente)
Incluir `pw-events.js` en la página y llamar cuando ocurre la acción:

```js
pwEmit("ClientInvited", {
  dominio: "Coaching",
  entidad_tipo: "cliente",
  entidad_id: email,        // opcional
  payload: { via: "panel" } // opcional
});
```

Reglas: nunca bloquear el flujo con esto (es best-effort). Emitir **después** de
que la acción real tuvo éxito (p. ej. después de que el guardado a Supabase
respondió ok), no antes.

### Desde una edge function (server, service role)
Insertar directo en `eventos` con el service role (ignora RLS). Patrón:

```ts
async function emit(tipo: string, e: Record<string, unknown>) {
  try {
    await fetch(`${SB_URL}/rest/v1/eventos`, {
      method: "POST",
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ tipo, source: "server:mi-funcion", ...e }),
    });
  } catch (_e) { /* best-effort: nunca romper el flujo por un evento */ }
}
```

## Dónde se van a cablear (mapa a puntos que YA existen)

Para el siguiente paso, sin inventar nada nuevo — solo **agregar** una llamada
`emit`/`pwEmit` en el punto donde la acción ya ocurre hoy:

| Evento | Punto de cableado existente |
|--------|-----------------------------|
| `TrialStarted` | `stripe-webhook` (status `trialing`) · `crear-coach` · `coach-lifecycle` |
| `PaymentSucceeded` | `stripe-webhook` (`becameActive` / `handleClientPayment`) |
| `ClientInvited` / `ClientAccepted` | `panel-v2.html` (asignar/crear cliente) · `guardar-intake` |
| `SessionCompleted` | donde se registra la sesión (`sesiones_registro`) |
| `ProgramFinished` | cierre de semana/programa en el panel |
| `MarketplaceSold` | `connect-checkout` (accept) · `stripe-webhook` (solicitud) |

**Empezar por los de activación** (`TrialStarted`, `ProfileCompleted`,
`ClientInvited`, `ClientAccepted`, `WowReached`): son la prioridad #1 y no tocan
la plata.

## Reglas para no enredarlo

- Un evento nuevo se agrega **acá primero**, después se cablea.
- Emitir es **best-effort**: si falla, el flujo real sigue igual. Nunca poner un
  `await` que pueda bloquear un guardado, ni tirar un throw.
- Nadie lee `eventos` con la anon key. La lectura (embudos, health, dashboard)
  siempre por service role desde una edge function.
- Nombre PascalCase en pasado.
