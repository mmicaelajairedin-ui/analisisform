# Changelog — Event Bus · Nivel 0 (Foundation) + eventos de activación

**Fecha:** 2026-07-27
**Fase:** Pathway OS Core · Nivel 0
**Rama:** `claude/n8n-business-workflow`

Primera fase de la arquitectura basada en eventos (ver `docs/adr/0001-arquitectura-basada-en-eventos.md`).
Todo aditivo y best-effort: no cambia ningún flujo existente.

## Agregado

### Cimiento (event store + emisor + contrato)
- **`supabase/migrations/eventos.sql`** — tabla `eventos` (event store). RLS igual
  que `client_errors`: `anon` solo INSERT, nadie lee con la anon key. Índices por
  `ts`, `tipo`, `dominio`, `actor_email`, `(entidad_tipo, entidad_id)`.
- **`pw-events.js`** — emisor del cliente: define `window.pwEmit(tipo, opts)`.
  Best-effort a prueba de fallos (patrón de `pw-observe.js`). Incluir el script no
  emite nada por sí solo; los eventos se llaman explícitamente desde el código.
- **`docs/domain-events.md`** — el contrato: qué evento emite cada dominio y quién
  lo escucha, más cómo/dónde cablear cada uno.

### Eventos de activación cableados (4)
| Evento | Archivo · punto | Dispara cuando |
|--------|-----------------|----------------|
| `ClientInvited` | `panel-v2.html` · `alta-invitar` | el coach da de alta un cliente (éxito) |
| `ClientAccepted` | `cliente.html` · `done()` consentimiento | el cliente acepta y entra por 1ª vez |
| `SessionCompleted` | `panel-v2.html` · `ses-add` | el coach registra una sesión |
| `ProfileCompleted` | `panel-v2.html` · `doSave()` | guarda perfil con nombre + bio/título |

Incluye `pw-events.js` en `panel-v2.html` y `cliente.html`.

### Tests de regresión
- 6 reglas nuevas en **`scripts/check-guardrails.js`** que blindan el emisor, los
  includes y los 4 emits: si alguien borra uno por accidente, el CI falla y frena
  el merge.

## Validado
- **`ClientInvited` — validado end-to-end en producción** (fila real en la tabla
  `eventos`: `Coaching / admin / <email cliente> / source=client`).
- Los otros 3 usan el mismo mecanismo exacto (mismo `pw-events.js`, mismo camino
  anon → RLS → tabla), verificados a nivel de código en su punto de cableado.
- Las 4 verificaciones de CI (syntax, smoke, guardrails, parity) pasan.

## Requiere acción manual (una vez)
- Aplicar `supabase/migrations/eventos.sql` en el SQL Editor de Supabase.

## Pendiente (próximas fases)
- **Nivel 0 (server):** helper `emit()` para edge functions → `TrialStarted`,
  `PaymentSucceeded`, `MarketplaceSold`.
- **Nivel 1 (Activation):** Activation Engine, Health Score, embudos y Dashboard
  CEO — leen estos eventos con service role.

## Notas
- Al mergear a `main`, se detectó que la rama estaba desactualizada respecto de
  `main` (trabajo nuevo: planes multicoach mensual/anual, login idempotente al
  convertir cliente, `coach-self-save`, etc.). Se resolvió trayendo `main` a la
  rama (merge limpio, sin conflictos) antes de desplegar, para no perder nada.
