# Release Gate Criteria — What is "Ready to Deploy"?

**Estado:** Fase 1 (Agosto 2026)

Define qué criterios debe cumplir un cambio ANTES de deployar a producción. La cascada de gates filtra progresivamente hasta "seguro de poner en vivo".

---

## Gate Hierarchy

```
CODE HEALTH (today)
    ↓ (todos los checks pasan)
FUNCTIONAL HEALTH (manual, post-CODE HEALTH)
    ↓ (feature probado en navegador)
INTEGRATION HEALTH (Fase 2, mocks)
    ↓ (edge functions + Supabase + APIs)
E2E HEALTH (Fase 2, browser automation)
    ↓ (usuario real + datos reales)
PRODUCTION READY
```

---

## Gate 1: CODE HEALTH (via `npm run verify`)

**Definición:** Código está libre de errores syntax, handlers rotos, bugs conocidos, y violaciones de contrato.

**Criterio:** `npm run verify` PASS

```
✓ check-syntax OK          (sin JS parse errors)
✓ check-smoke OK           (handlers/assets existen)
✓ check-guardrails OK      (sin bugs conocidos reapare
✓ check-parity OK          (cableado entre pantallas OK)
✓ check-icons OK           (icon system íntegro)
✓ check-error-scope OK     (errores clasificados OK)
✓ error-triage OK          (test fails triageados)
✓ check-async-patterns OK  (report: sin sorpresas críticas)
```

**Blocker errors:**
- ✅ check-syntax FAIL → bloquea siempre
- ✅ check-guardrails FAIL → bloquea siempre
- ✅ check-error-scope FAIL → si error es CORE_INFRASTRUCTURE o in-scope BLOCKER
- ✅ error-triage FAIL → si detecta NEW_ERROR o REGRESSION

**Non-blocking (warnings):**
- check-smoke FAIL → revisar, pero no bloquea (puede ser false positive)
- check-parity FAIL (report level) → revisar, no bloquea
- check-icons FAIL (report level) → revisar, no bloquea
- check-async-patterns REPORT → informar al dev, nunca bloquea

**Qué verifica:**
- ✅ Código no tiene errores obvios
- ✅ Bugs conocidos no volvieron
- ✅ Cableado entre pantallas está íntegro

**Qué NO verifica:**
- ❌ Feature funciona
- ❌ Feature es rápida
- ❌ Feature integra con otros sistemas
- ❌ No hay bugs nuevos

**Comando:**
```bash
npm run verify
```

---

## Gate 2: FUNCTIONAL HEALTH (Manual, Post-CODE HEALTH)

**Definición:** Feature funciona en el navegador, sin regressions visuales, accesible.

**Requerimientos:**

1. **Happy path comprobado:**
   - ✅ Feature principal funciona como se espera
   - ✅ Sin errores en console
   - ✅ Sin network errors

2. **Edge cases (mínimo 3):**
   - ✅ Input vacío
   - ✅ Input muy largo
   - ✅ Red lenta (DevTools throttle)

3. **No visual regressions:**
   - ✅ Pantallas existentes se ven igual
   - ✅ Colores, tipografía, espaciado OK
   - ✅ Responsive (desktop, tablet, mobile)

4. **Accesibilidad:**
   - ✅ Labels en inputs
   - ✅ Aria-labels en botones solo-icono
   - ✅ Keyboard navigation (Tab, Enter, Esc)
   - ✅ Font size ≥ 10px
   - ✅ Color contrast WCAG AA

**Blocker:** Requerido ANTES de canary deploy.

**No es automatizado todavía** (Fase 2 será con E2E).

---

## Gate 3: INTEGRATION HEALTH (Fase 2, with mocks)

**Definición:** Feature integra correctamente con Edge Functions, Supabase, y APIs externas.

**Requerimientos:**

```bash
npm run test:integration PASS
```

- ✅ Edge Functions mocked
- ✅ Supabase queries y RLS policies enforced
- ✅ Email generation validated (EmailJS mock)
- ✅ External API mocks (Stripe, Calendly, Google Cal) responden OK
- ✅ Error handling: 500, 403, 404, timeout comportan bien

**Blocker:** Requerido ANTES de general availability (GA).

**Implementación:** Fase 2 (octubre 2026 estimado).

---

## Gate 4: E2E HEALTH (Fase 2, browser automation)

**Definición:** Usuario real (browser automation) puede completar el flujo sin errores.

**Requerimientos:**

```bash
npm run test:e2e PASS
```

- ✅ Flujos usuario clave pasan (signin → feature → data saved)
- ✅ Datos reales (test users, fixtures)
- ✅ 48h soak en producción (cero errors telemetría)
- ✅ Cero reportes de usuario
- ✅ Performance (Core Web Vitals dentro de spec)

**Blocker:** Requerido ANTES de general availability (GA).

**Implementación:** Fase 2-3 (octubre-noviembre 2026 estimado).

---

## Current Release Workflow (Fase 1)

```
1. Developer cambios código
   ↓
2. npm run verify (CODE HEALTH)
   ├─ FAIL → arreglar y retry
   └─ PASS → continuar
   ↓
3. Manual FUNCTIONAL HEALTH check (developer + reviewer)
   ├─ FAIL → arreglar y retry
   └─ PASS → continuar
   ↓
4. Pull Request review + approval
   ↓
5. Deploy a canary/preview
   ├─ Manual testing en preview
   └─ If OK → continuar
   ↓
6. Merge a main
   ↓
7. Auto-deploy a producción (Cloudflare Pages)
   ↓
8. 48h production soak
   ├─ Zero client_errors telemetría
   ├─ Zero user reports
   └─ → Transición a VERIFIED
```

---

## What Blocks a Release?

**Blocker (deploy blocked):**
- `npm run verify` FAIL (check-syntax, check-guardrails, check-error-scope BLOCKER, error-triage NEW/REGRESSION)
- Manual FUNCTIONAL HEALTH check FAIL
- Reviewer rejection
- Production telemetry RED (E2E HEALTH gate, cuando exista)

**Non-blocker (proceed with caution):**
- check-smoke FAIL (puede ser false positive)
- check-parity FAIL (report level)
- check-icons FAIL (report level)
- check-async-patterns REPORT (nunca bloquea)

---

## Future Evolution (Fase 3)

Cuando E2E + integración tests estén implementados:

1. **PR CI pipeline** → CODE HEALTH + INTEGRATION HEALTH + E2E HEALTH
   - Deploy solo si todo PASS
   - Feedback inmediato al developer

2. **Production monitoring** → telemetría en vivo
   - client_errors, performance, UX metrics
   - Auto-rollback si detecta REGRESSION crítica

3. **Staged rollout:**
   - Canary (1% usuarios) → 24h soak
   - Beta (10% usuarios) → 48h soak
   - GA (100% usuarios) → VERIFIED oficial

---

## Relation to Error States

| Error State | Gate | Action |
|-------------|------|--------|
| DETECTED | Pre-CODE HEALTH | Reportar, no bloquea |
| SUSPECTED | Pre-CODE HEALTH | Investigar, no bloquea |
| ROOT_CAUSE_CONFIRMED_STATIC/RUNTIME | Pre-CODE HEALTH | Arreglar |
| FIXED | Pre-FUNCTIONAL HEALTH | Test + guardrail |
| VERIFIED | Post-FUNCTIONAL HEALTH | Safe to deploy |
| REGRESSION | Deploy blocked | Revertir o re-arreglar |

---

## Notes

- **No hay "deploy sin CODE HEALTH"** — esto es no-negotiable.
- **CODE HEALTH ≠ functionally correct** — solo significa "sin errores obvios".
- **FUNCTIONAL HEALTH es manual hoy** — Fase 2 será E2E automation.
- **48h soak es obligatorio para VERIFIED** — la telemetría es la fuente de verdad.
