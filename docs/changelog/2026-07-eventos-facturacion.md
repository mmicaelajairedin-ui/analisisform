# Changelog — Nivel 1 · Eventos de facturación (embudo event-native)

**Fecha:** 2026-07-27
**Fase:** Pathway OS · Nivel 1 (Activation) — cierre del embudo
**Rama:** `claude/n8n-business-workflow`
**Ref:** `docs/domain-events.md`, `docs/metricas-spec.md`

Cablea los **3 eventos server-side** que le faltaban al embudo (`TrialStarted`,
`StripeConnected`, `PaymentSucceeded`). Antes esas fases se estimaban solo desde
las tablas base (🔴); ahora **emiten evento propio** → pasan a `mixto` 🟡 y quedan
listas para migrar a 100% event-native cuando haya cohorte. **Aditivo y
best-effort**: si un evento falla, el flujo real (alta, pago, Connect) no se toca.

## Agregado

### Eventos (cada edge function con su helper `emitEvento()`, best-effort)
- **`TrialStarted`** — `dominio: Billing`. Se emite al **arrancar la prueba**:
  - `crear-coach` (alta por admin/empleado, `mode: created`).
  - `registrar-coach` (auto-registro desde la web, `mode: created`). **NO** en el
    path `activated` (ese coach fue invitado y `crear-coach` ya lo contó → evitar
    doble conteo).
- **`StripeConnected`** — `dominio: Billing`. Se emite en `connect-onboard`
  (action `status`) la **primera vez** que la cuenta Connect queda operativa
  (`charges_enabled && payouts_enabled`). **Dedup** por `cfg.stripe_connected_at`
  → una sola vez, aunque el panel consulte el status muchas veces.
- **`PaymentSucceeded`** — `dominio: Billing`. Se emite en `stripe-webhook`
  dentro de `handleCoachSubscription`, guardado por **`becameActive`** → **una vez
  por transición a pago** (primer pago o reactivación tras prueba vencida), **no**
  en cada cobro mensual.

### `metricas` — embudo actualizado
- Las fases **Trial / Stripe / Pago** pasan de `base_temporal` 🔴 → `mixto` 🟡.
  El **conteo** se sigue derivando de las tablas base (un coach viejo no tiene
  evento retroactivo); el evento aporta precisión temporal y la base para el
  conteo 100% event-native de las cohortes nuevas.
- La tabla `fuentes` (plan de migración) refleja el nuevo estado 🟡.

### Deploy
- **`deploy-functions.yml`**: se agregan `metricas` y `registrar-coach`, que
  **no estaban** en el pipeline (bug latente: `metricas` se mergeaba pero nunca se
  desplegaba). Ahora ambos se despliegan solos al mergear a `main`.

### Tests de regresión (`scripts/check-guardrails.js`)
- 4 reglas nuevas: los 3 emits siguen presentes (con su dedup / guarda de
  `becameActive`), y `metricas`+`registrar-coach` siguen en el workflow de deploy.
  Total: 171 reglas.

## Requiere acción manual
- Nada de SQL nuevo: la tabla `eventos` ya está aplicada.
- Deploy automático al mergear (lo hace `deploy-functions.yml`): `crear-coach`,
  `registrar-coach`, `connect-onboard`, `stripe-webhook`, `metricas`.

## Validación
- 4 checks de CI en verde (171 reglas).
- TS de las funciones revisado a mano (deno/tsc no están en el entorno; se
  transpila con esbuild al desplegar). Los helpers `emitEvento` son best-effort
  (try/catch), no cambian ningún return existente.

## Cómo verificar en vivo (tras deploy)
```sql
-- Deberían empezar a aparecer al: dar de alta un coach, conectar Stripe, pagar.
SELECT ts, tipo, actor_email, page, payload
FROM eventos
WHERE tipo IN ('TrialStarted','StripeConnected','PaymentSucceeded')
ORDER BY ts DESC LIMIT 50;
```

## Pendiente (próximas iteraciones)
- `WowReached`, `ProgramFinished`, `MarketplaceSold` (marketplace/renovación).
- Cuando haya ~90 días de cohorte con eventos: mover el **conteo** del embudo de
  `mixto` 🟡 → `eventos` 🟢 y apagar el fallback base.
