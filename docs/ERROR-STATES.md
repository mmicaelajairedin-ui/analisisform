# Error State Machine — Formal States and Transitions

**Principio:** STATIC ≠ RUNTIME ≠ E2E ≠ VERIFIED

Una causa puede estar confirmada estáticamente (código la demuestra) y seguir sin estar verificada funcionalmente (test pasa, comportamiento comprobado). Cada transición exige evidencia mínima.

---

## States

```
DETECTED
    ↓ (análisis inicial)
SUSPECTED
    ↓ (análisis estático O ejecución)
    ├─→ ROOT_CAUSE_CONFIRMED_STATIC
    │   (código fuente demuestra)
    └─→ ROOT_CAUSE_CONFIRMED_RUNTIME
        (logs/traces demuestran)
    ↓
FIXED (código cambiado)
    ↓ (test + 48h producción)
VERIFIED (listo para "No regresión")
    ↓ (posible regresión)
REGRESSION (error VERIFIED reaparece)

(Salida lateral en cualquier punto)
├─→ BLOCKED (depende de otro trabajo)
└─→ OUT_OF_SCOPE (pertenece a otra rama)
```

---

## State Definitions

### DETECTED
**Definición:** Error identificado, síntoma reportado, contexto inicial documentado.

**Cuándo:** Tester reporta, log muestra error, test falla, usuario se queja.

**Información mínima:**
- Síntoma claro (qué salió mal)
- Contexto (pantalla, usuario, acción)
- Fecha/hora de detección
- Evidencia inicial (screenshot, log line, test error)

**Ejemplo:**
```
ERR-AGENDA-001: "Próxima sesión" muestra botón de zoom 1300ms después.
Context: Cliente accede a dashboard, agenda se carga, botón tarda.
Evidence: Screenshot ts=2026-08-10T14:23:45Z
```

### SUSPECTED
**Definición:** Análisis inicial sugiere causa raíz probable.

**Cuándo:** Después de DETECTED, se investiga el código/logs.

**Información mínima:**
- Hipótesis de causa raíz (por qué)
- Archivos/líneas candidatas
- Severidad estimada (LOW/MEDIUM/HIGH/CRITICAL)
- Módulo afectado

**Ejemplo:**
```
Hipótesis: fetch(citas) tiene .on('postgres_changes')?
Archivos: cliente.html:4100, pw-realtime.js
Severity: MEDIUM (UX delayed, no data loss)
Module: Portal del cliente
```

### ROOT_CAUSE_CONFIRMED_STATIC
**Definición:** Análisis estático (código fuente) confirma la causa.

**Cuándo:** Grep/AST/regex encuentra el patrón exacto en el código.

**Información mínima:**
- Archivo + línea exacta
- Código fuente (snippet)
- Explicación: por qué ese código causa el síntoma
- Pattern: qué cambio lo arreglará

**Evidencia:**
```
✅ STATIC CONFIRMED
  archivo: cliente.html
  línea: 4100
  código: fetch(sbGet(...)).then(...) — SIN .on('postgres_changes')
  causa: Realtime subscription falta → actualizaciones solo al refresh
  fix: Agregar .on('postgres_changes', callback)
```

### ROOT_CAUSE_CONFIRMED_RUNTIME
**Definición:** Logs/traces de ejecución confirman la causa.

**Cuándo:** Instrumentación, logs producción, browser DevTools, o test con tracing.

**Información mínima:**
- Log lines con timestamps
- Variable snapshots (before/after)
- Network trace (request/response)
- Reproducción paso a paso

**Evidencia:**
```
✅ RUNTIME CONFIRMED
  Logs:
    14:23:45 fetch(citas) start
    14:23:45 realtime.subscribe() → FALSE (not called)
    14:25:15 fetch(citas) success, data loaded
    14:25:15 UI update (botón aparece)
  Gap: 90 segundos sin realtime
  Causa: Subscribe call ausente, solo polling
```

### FIXED
**Definición:** Código ha sido modificado para arreglar el error.

**Cuándo:** Commit pushed con la solución.

**Información mínima:**
- Commit hash
- Archivos modificados
- Breve descripción del cambio
- Estado: En revisar, mergeado

**Ejemplo:**
```
✅ FIXED (commit 7a2ba42ff)
  Files: cliente.html
  Change: Line 4100: agregado .on('postgres_changes', () => reDraw())
  Status: Mergeado a main
```

### VERIFIED
**Definición:** Error arreglado, test pasa, cero regresiones en 48h producción.

**Cuándo:** (1) Test automatizado reproduce error (pre-fix FAIL, post-fix PASS), (2) Guardrail agregado, (3) 48h sin reportes.

**Información mínima (3 cosas):**

1. **Test automatizado:**
   - Reproduce error: pre-fix FAIL
   - Verifica fix: post-fix PASS
   - Archivo de test

2. **Guardrail agregado:**
   - Regla en check-guardrails.js
   - Detecta si vuelve el patrón
   - Test de guardrail PASS

3. **Production soak:**
   - 48h en producción
   - Cero regresiones en client_errors
   - Cero reportes de usuario

**Ejemplo:**
```
✅ VERIFIED
  Test: tests/agenda-realtime.js (PASS)
  Guardrail: check-guardrails.js "cliente realtime subscription presente" (PASS)
  Soak: 48h en prod, 2026-08-10 to 2026-08-12, zero client_errors
  Status: "No regresión" → listo para escalado
```

### REGRESSION
**Definición:** Error que fue VERIFIED reaparece (falló el guardrail o test).

**Cuándo:** Test anteriormente PASS vuelve a FAIL, o guardrail detecta el patrón nuevamente.

**Investigación:**
- Qué commit lo causó (git bisect)
- Revertir o arreglar de nuevo
- Actualizar guardrail si es insuficiente
- Luego VERIFIED nuevamente

### BLOCKED
**Definición:** No puede arreglarse sin trabajo previo (otra feature, infraestructura, etc).

**Cuándo:** Causa raíz depende de otra cosa que no existe o está in-progress.

**Ejemplo:**
```
BLOCKED (ERR-AGENDA-001)
Razón: Requiere Realtime subscriptions en cliente.html, que está en Fase 2.
Desbloqueador: Implementar pw-realtime.js.
Revisitar: 2026-09-01
```

### OUT_OF_SCOPE
**Definición:** Error pertenece a otra rama/sprint/módulo congelado.

**Cuándo:** Problema es en MultiCoach, Agenda (no autorizado), o módulo congelado sin aprobación.

**Ejemplo:**
```
OUT_OF_SCOPE (MultiCoach visual bug)
Razón: MultiCoach está congelado hasta Sprint 5.
Revisitar: Cuando se desbloquee MultiCoach
```

---

## Transition Requirements

### DETECTED → SUSPECTED
**Blocker?** No. Apenas hay contexto inicial.

**Datos mínimos:**
- ✅ Síntoma documentado
- ✅ Contexto (pantalla, usuario)
- ✅ Fecha/hora

### SUSPECTED → ROOT_CAUSE_CONFIRMED_STATIC
**Blocker?** No. Estático no es definitivo (asume que el análisis de código es correcto).

**Datos mínimos:**
- ✅ Archivo + línea exacta
- ✅ Código fuente (snippet)
- ✅ Explicación de causa

**Riesgo:** Falso positivo ~ 10-30% (análisis estático puede estar equivocado).

### SUSPECTED → ROOT_CAUSE_CONFIRMED_RUNTIME
**Blocker?** No. Runtime confirma "qué pasó", no necesariamente "por qué el código".

**Datos mínimos:**
- ✅ Logs con timestamps
- ✅ Snapshots BD o network trace
- ✅ Reproducción paso a paso

**Riesgo:** Bajo ~ 5% (logs no mienten, pero pueden ser síntoma de otra cosa).

### ROOT_CAUSE_CONFIRMED_* → FIXED
**Blocker?** No. Código modificado, pero no testado.

**Datos mínimos:**
- ✅ Commit hash
- ✅ Archivos modificados
- ✅ Descripción del cambio

### FIXED → VERIFIED
**Blocker?** SÍ. Este es el gate para "ready to ship".

**Datos mínimos (3 cosas, todas requeridas):**

1. **Test automatizado:**
   - Pre-fix: FAIL (reproduce error)
   - Post-fix: PASS (verifica fix)
   - Archivo: tests/*.js

2. **Guardrail en check-guardrails.js:**
   - Regla que detecta si vuelve
   - Test de la regla: PASS

3. **Production soak:**
   - 48h sin regresión en client_errors
   - Cero reportes de usuario
   - Fecha de deployment

**Riesgo:** Si faltan los 3, el error puede reaparecer (REGRESSION).

---

## Key Rules

1. **STATIC ≠ RUNTIME ≠ E2E ≠ VERIFIED**
   - No asumir que una transición implica las siguientes.
   - ROOT_CAUSE_CONFIRMED_STATIC puede estar equivocado.
   - ROOT_CAUSE_CONFIRMED_RUNTIME puede no coincidir con el código.
   - FIXED puede no actualizar UI (E2E falla).
   - No es VERIFIED hasta pasar test + guardrail + 48h.

2. **Cada transición requiere evidencia nueva**
   - No "heredar" evidencia de antes.
   - Cada nivel comprueba algo distinto.

3. **VERIFIED es el único estado para "no regresión"**
   - FIXED solo significa "código cambió", no "bug desapareció".
   - Deployment de FIXED sin VERIFIED = riesgo de REGRESSION.

4. **Guardrails son las defensas**
   - Sin guardrail, REGRESSION es probable.
   - Guardrail = automatización de la causa.
