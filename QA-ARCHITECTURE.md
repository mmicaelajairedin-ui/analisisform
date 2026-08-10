# QA Architecture — Pathway Platform

**Versión:** 1.0  
**Fecha:** 2026-08-10  
**Basado en:** Investigación exhaustiva de agenda + auditoría de sistema de testing actual  
**Estado:** Diseño (no implementado aún)

---

## 📋 TABLA DE CONTENIDOS

1. [Estado actual del testing](#estado-actual)
2. [Qué detecta `npm run verify`](#que-detecta-verify)
3. [Qué NO detecta](#que-no-detecta)
4. [ERROR ISOLATION SYSTEM](#error-isolation-system)
5. [Niveles de evidencia](#niveles-de-evidencia)
6. [Detección de async/timing](#deteccion-async-timing)
7. [Mapeo error → owner](#mapeo-error-owner)
8. [Test Pyramid](#test-pyramid)
9. [Agenda como caso de estudio](#agenda-caso-estudio)
10. [Criterios de VERIFIED](#criterios-verified)
11. [Recomendaciones de implementación](#recomendaciones)

---

## ESTADO ACTUAL

### Sistema de Verificación Existente

El proyecto tiene **6 checks automáticos** organizados por `verify.js`:

| Check | Script | Qué hace | Resultado |
|-------|--------|----------|-----------|
| **Syntax** | check-syntax.js | Valida sintaxis JS en scripts inline | PASS/FAIL (blocker) |
| **Smoke** | check-smoke.js | Verifica handlers y assets existen | PASS/FAIL (no blocker) |
| **Guardrails** | check-guardrails.js | Reglas de regresión | PASS/FAIL (blocker) |
| **Error Scope** | check-error-scope.js | Clasifica errores por rama | PASS/FAIL (blocker) |
| **Parity** | check-parity.js | Consistencia cross-file | PASS/FAIL (no blocker) |
| **Icons** | check-icons.js | Icon system (Lucide) | PASS/FAIL (no blocker) |
| **Triage** | error-triage.js | Clasifica test failures | PASS/FAIL (blocker) |

**Blockers:** Si cualquiera falla → exit(1) → bloquea commit

### Sistema de Registro de Errores

**ERROR_REGISTRY.md** — archivo único que documenta:
- Error ID, módulo, severidad, estado
- Síntoma, categoría, root cause
- Evidencia (commits, archivos, tests)
- Cómo evitar regresión (guardrail específico)

**Estados actuales en registry:**
- ✅ **TRIAGED** (3): ERR-UPLOAD-001/002/003 (fixes verificados)
- ❌ **DETECTED** (7): ERR-ENV-001, ERR-APP-004, ERR-MULTICOACH-001, ERR-ADMIN-001, ERR-DEPLOY-001, ERR-MC-SYNTAX-001, ERR-EMAIL-RECORDATORIO

### Arquitectura de Error Scope

**check-error-scope.js** — mapea errores a ramas:

| Rama | Módulos responsables |
|------|----------------------|
| `claude/pathway-app-store-review-fy5y15` | `ios_auth`, `email_template` |
| `multicoach` | `multicoach` |
| `core` | `ci_cd`, `environment`, `rls`, `core_security` |
| `uploads` | `uploads` |

**Reglas de clasificación:**
- `CORE_INFRASTRUCTURE` → siempre blocker, afecta todas las ramas
- `MODULE_SPECIFIC` → blocker solo si pertenece a rama actual
- `CROSS_MODULE` → blocker si afecta rama actual o core
- `scope_belongs_to` determina rama propietaria

---

## QUÉ DETECTA VERIFY

### ✅ Detecta hoy

| Tipo de error | Check | Cómo |
|---------------|-------|-----|
| **JavaScript roto** | Syntax | `vm.Script()` valida sintaxis |
| **Handlers inexistentes** | Smoke | Extrae `onclick`/`onchange` y verifica función existe |
| **Assets faltando** | Smoke | Verifica que archivos `.js`, `.css`, imagenes existen |
| **Regresiones de bugs arreglados** | Guardrails | Reglas pattern-matching para síntomas conocidos |
| **Errores de scope** | Error Scope | Lee ERROR_REGISTRY.md, clasifica blocker/out-of-scope |
| **Icon system violations** | Icons | Verifica que solo se usa Lucide, spec correcto (#1F4030, 20px, 2px) |
| **Test failures** | Triage | Cross-referencia con ERROR_REGISTRY.md, clasifica KNOWN/REGRESSION/NEW |
| **Cross-file consistency** | Parity | Verifica invariantes (chat merge-safe, anti-XSS, etc.) |

### ❌ NO detecta

| Tipo de error | Por qué | Nota |
|---------------|---------|------|
| **Supabase RLS incorrecto** | No hay ejecución de BD | Requiere E2E en Supabase |
| **Edge Functions no deployed** | Solo chequea repo, no deployment | ERR-DEPLOY-001 lo detectó manualmente |
| **Realtime subscriptions roto** | No hay runtime browser | Requiere browser automation |
| **Async/await sin manejar resultado** | No hay análisis AST profundo | Requiere static analyzer especializado |
| **Timing/race conditions** | No medible estáticamente | Requiere E2E con logs |
| **Estado local ≠ BD** | Requiere runtime + snapshots | Requiere ejecución + comparación |
| **Email sin URL** | No hay interceción de email | Requiere EmailJS mock o E2E real |
| **URLs incorrectas en cliente** | No hay rendering HTML real | Requiere browser + DOM inspection |
| **Permisos (403/401)** | No hay llamadas reales a API | Requiere E2E contra Supabase |
| **Google Calendar API timeout** | No hay llamadas externas | Requiere E2E con servicios externos |

### Gap Principal: No hay validación RUNTIME

**Actualmente todo es STATIC.** No hay:
- Tests browser automatizados
- Mocks de Edge Functions
- Interceción de requests/responses
- Captura de estado BD
- Email mocking
- API externas (Google Calendar, EmailJS)
- Realtime subscription testing

---

## ERROR ISOLATION SYSTEM

### Metadatos Obligatorios por Error

```markdown
## ERR-<CATEGORY>-<NNN>: [Descripción corta]

**Estado:** [DETECTED|SUSPECTED|ROOT_CAUSE_CONFIRMED|FIXED|VERIFIED|REGRESSION|BLOCKED|OUT_OF_SCOPE]
**Fecha detectado:** YYYY-MM-DD
**Severity:** [CRITICAL|HIGH|MEDIUM|LOW]

### Scope Metadata
- **Module:** [Módulo afectado]
- **Feature:** [Feature específica]
- **Scope Type:** [MODULE_SPECIFIC|CROSS_MODULE|CORE_INFRASTRUCTURE]
- **Scope Belongs To:** [rama responsable]
- **Blocking Scope:** [current|core|other]
- **Blocks Current Branch:** [Yes|No]

### Flujo Afectado
[Descripción del flujo del usuario → sistema → resultado]

### Síntoma
[Qué ve el usuario]

### Categoría
[Clasificación interna: FRONTEND_ERROR, BACKEND_ERROR, DATABASE_ERROR, INTEGRATION_ERROR, CONFIGURATION_ERROR, DEPLOYMENT_ERROR]

### Root Cause
[Punto exacto en el código o proceso donde diverge el comportamiento esperado]

### Evidencia
- **Estática:** Archivos, líneas, commits donde se ve el código
- **Runtime:** Logs, network traces, console errors (si se ejecutó)
- **E2E:** Pasos para reproducir, steps del test, resultado esperado vs observado

### Reproducción
[Cómo reproducir el problema: precondiciones → acciones → resultado]

### Verificación
[Qué test confirma que está solucionado]

### FIX_OWNER
[Rama responsable de arreglarlo]

### Regression Risk
[Qué otras funcionalidades podrían romperse con el fix]
```

### Estados y Transiciones

```
DETECTED
  ↓ (after analysis)
SUSPECTED | ROOT_CAUSE_CONFIRMED
  ↓ (after code change)
FIXED
  ↓ (after test passes)
VERIFIED (or REGRESSION if test fails)
  ↓ (after 48h in production)
VERIFIED (final)

BLOCKED (can't fix without other work)
OUT_OF_SCOPE (belongs to another branch)
```

**Regla crítica:** NO saltarse states. Flujo es lineal, nunca backward.

---

## NIVELES DE EVIDENCIA

### STATIC (Código Estático)

**Qué es:** Análisis del código fuente sin ejecutarlo

**Herramientas:**
- `grep` — búsqueda de patrones
- `node --check` — sintaxis JS
- AST parsing (no implementado aún)
- Line-by-line tracing de lógica

**Qué PUEDE confirmar:**
- ✅ Función A llama a función B (o no)
- ✅ Variable X se inicializa a `null`
- ✅ `await` está presente (o ausente)
- ✅ Patrón de fire-and-forget `fetch(...) // sin await`
- ✅ RLS policy existe (o no)
- ✅ SQL column existe (o no)

**Qué NO PUEDE confirmar:**
- ❌ Cuándo se ejecuta el código
- ❌ Qué valor real recibe una variable en runtime
- ❌ Si una async operation completa antes/después de otra
- ❌ Si un Realtime listener está subscrito
- ❌ Si un email se envía realmente
- ❌ Qué ve el usuario en el navegador

**Ejemplo — Agenda ERR-AGENDA-002:**
- ✅ STATIC: `notificarCita(..., cita.meet_link || "")` donde `cita.meet_link` fue inicializado a NULL
- ❌ STATIC: Saber si el email realmente se envía sin URL

### RUNTIME (Ejecución sin Usuario)

**Qué es:** Observar el sistema mientras se ejecuta (logs, traces, state snapshots)

**Herramientas:**
- Browser console logs
- Network inspector (DevTools)
- Supabase logs/metrics
- Edge Function logs
- Database query logs
- Email service logs

**Qué PUEDE confirmar:**
- ✅ Función A fue llamada con argumentos X, Y, Z
- ✅ Variable X cambió de NULL a "https://..." en T0+500ms
- ✅ Request HTTP fue enviado a endpoint Y
- ✅ SQL query fue ejecutada, retornó N filas
- ✅ Email fue interceptado con body Z

**Qué NO PUEDE confirmar:**
- ❌ Que el usuario OBSERVÓ algo (solo que se renderizó)
- ❌ Que el usuario HIZO algo (solo que se registró un evento)
- ❌ Comportamiento en condiciones de red pobre
- ❌ Comportamiento con datos edge-case reales

**Ejemplo — Agenda ERR-AGENDA-002:**
- ✅ RUNTIME: Capturar el email HTML enviado, parsearlo, verificar si contiene "Google Meet" URL o placeholder
- ✅ RUNTIME: Logs de crear-cita-red Edge Function mostrando que `notificarCita` fue llamada con meet_link=""

### E2E (End-to-End Usuario Real)

**Qué es:** Flujo completo: usuario interactúa → frontend → backend → BD → integraciones → resultado visible en UI

**Herramientas:**
- Playwright (browser automation)
- Manual testing (persona real)
- Production monitoring

**Qué PUEDE confirmar:**
- ✅ Usuario hace click en botón
- ✅ Coach ve UI feedback "Cita agendada"
- ✅ Cliente recibe email con/sin URL
- ✅ Cliente ve botón "Unirme" con/sin URL
- ✅ Google Calendar event fue creado
- ✅ URL en email == URL en botón == URL en BD
- ✅ Flujo funciona en condiciones normales de red
- ✅ Flujo funciona en red lenta (simulated delay)

**Qué NO PUEDE confirmar:**
- ❌ Qué pasará en 6 meses (datos históricos)
- ❌ Comportamiento con millones de usuarios simultáneos
- ❌ Comportamiento con datos rotos en producción

**Ejemplo — Agenda ERR-AGENDA-002:**
```
TEST A-H: Crear cita (MultiCoach path)
  → T0+10ms: INSERT en BD
  → T0+1300ms: Email enviado
  → Capturar: ¿Email contiene URL de Google Meet?
```

---

## DETECCIÓN DE ASYNC/TIMING

### Categoría Especial: Async/Race Conditions

**Patrón 1: Fire-and-Forget sin await**
```javascript
// 🔴 DANGEROUS
fetch(url); // no await, no .catch()

// ✅ SAFER
await fetch(url);
```
**Riesgo:** Error silencioso, falta de manejo de fallos  
**Detector:** Grep para `fetch\([^)]+\)[^;]*[;\\n]` sin await  
**Ejemplo:** crear-cita-red línea 146 (sync-cita-to-gcal se llama pero no se maneja respuesta)

**Patrón 2: Await que ignora resultado**
```javascript
// 🟡 PROBLEMATIC
await syncFn(); // espera, pero ignora valor retornado
doSomethingWith(localVar); // localVar todavía tiene valor antiguo

// ✅ CORRECT
const result = await syncFn();
doSomethingWith(result);
```
**Riesgo:** Estado BD actualizado, variable local no  
**Detector:** Detectar await seguido de referencia a variable no refresheada  
**Ejemplo:** crear-cita-red línea 156 (await sync-cita-to-gcal, pero notificarCita usa cita.meet_link local)

**Patrón 3: Polling temporal**
```javascript
// 🟡 WORKAROUND (funciona pero no es escalable)
while (!ready) {
  const val = await fetchFromDB();
  if (val) { doSomething(val); break; }
  await sleep(200);
}

// ✅ BETTER
.on('postgres_changes', () => { doSomething(val); })
```
**Riesgo:** Timing impredecible, consume CPU, falla con edge cases  
**Detector:** Grep para while loops + sleep  
**Ejemplo:** panel-v2.html línea 11272 (_sendAgEmailDelayed polling)

**Patrón 4: Realtime subscriptions no implementadas**
```javascript
// 🔴 MISSING
// No hay .on('postgres_changes', ...) para citas table

// ✅ SHOULD EXIST
supabase
  .channel('citas')
  .on('postgres_changes', { event: 'UPDATE' }, (payload) => {
    rerenderCitas();
  })
  .subscribe();
```
**Riesgo:** Cliente solo ve datos al refresh, no en tiempo real  
**Detector:** Buscar .on('postgres_changes') en cliente.html  
**Ejemplo:** cliente.html — ¿existe subscription a citas?

**Patrón 5: Timing gap entre operaciones**
```javascript
// 🟡 TIMING GAP
T0+0ms:   INSERT cita → meet_link = NULL
T0+0ms:   SEND_EMAIL_IMMEDIATELY → "Mirá Google Calendar"
T0+500ms: SYNC_GOOGLE_CALENDAR → meet_link populated

// ✅ CORRECT
T0+0ms:   INSERT cita → meet_link = NULL
T0+0ms:   SYNC_GOOGLE_CALENDAR async
T0+500ms: poll for meet_link, THEN SEND_EMAIL
```
**Riesgo:** Email enviado sin URL antes de que esté disponible  
**Detector:** Timing analysis (static si hay comentarios, runtime si hay logs)  
**Ejemplo:** crear-cita-red MultiCoach path

### Detector Automático Propuesto (Fase 2)

```bash
node scripts/check-async-patterns.js
```

Buscaría:
1. `fetch(...)[^;\n]*[;\n]` sin await
2. `await \w+\([^)]*\)[^;]*;` seguido de variable sin refresh
3. `while.*sleep` loops
4. Falta de `.on('postgres_changes'`
5. Timing comments T0+Xms vs datos reales

---

## MAPEO ERROR → OWNER

### Matriz de Módulos vs Ramas

| Módulo | Rama propietaria | Otros usuarios | Blocker en |
|--------|------------------|---|---|
| **ios_auth** | `claude/pathway-app-store-review-fy5y15` | N/A | `claude/pathway-app-store-review-fy5y15` |
| **email_template** | `core` | todas | todas (cross-module) |
| **multicoach** | `multicoach` | N/A | `multicoach` |
| **uploads** | `uploads` | panel-v2, cliente | `uploads` |
| **ci_cd** | `core` | N/A | todas (CORE_INFRASTRUCTURE) |
| **environment** | `core` | todas | todas (CORE_INFRASTRUCTURE) |
| **rls** | `core` | todas | todas (CORE_INFRASTRUCTURE) |
| **core_security** | `core` | todas | todas (CORE_INFRASTRUCTURE) |
| **admin** | `multicoach` | core | `multicoach` |
| **dashboard** | N/A (frozen) | todas | N/A (locked) |
| **agenda** | N/A (pending design) | panel-v2, cliente | N/A |

### Regla de Clasificación

**Si error en módulo X y rama actual es Y:**
1. Buscar `Scope Belongs To` en ERROR_REGISTRY.md
2. Si `Scope Belongs To == Y` → **BLOCKER** (tu responsabilidad)
3. Si `Scope Belongs To != Y` → **OUT_OF_SCOPE** (documenta, no arregles)
4. Si `scope_type == CORE_INFRASTRUCTURE` → siempre **BLOCKER** (afecta todas)

**Decisión de rama:**
- Errores en módulo X siempre van a rama X (o rama que adoptó X)
- Si módulo X no tiene rama dedicada → ir a `core` o `main`
- Si error toca múltiples módulos → evaluación caso a caso

---

## TEST PYRAMID

### Estructura Propuesta

```
                      ▲
                     /  \
                    / E2E \
                   /________\          Tests browser full → fljo usuario real
                  /  Integ  /
                 /___E2E___/           Edge Func + Supabase mocks
                / Unit     /
               /___Tests__/            Funciones aisladas
              / Smoke     /
             /___Checks__/             Handlers, assets, imports
            / Syntax    /
           /__Checks__/                JS parsing, linting
```

### Level 1: Syntax Checks ✅ (existe)

**Script:** `check-syntax.js`
**Qué valida:**
- JS inline sintácticamente correcto
- No hay parse errors

**Coverage:** 11 HTML files, ~1500 líneas de script inline

### Level 2: Smoke Checks ✅ (existe)

**Script:** `check-smoke.js`
**Qué valida:**
- Handlers (`onclick`, etc.) llaman a funciones que existen
- Assets (JS, CSS, images) existen en repo
- Referencias locales no rotas

**Coverage:** Cubre mayormente panel-v2.html, cliente.html

### Level 3: Unit Tests ❌ (NO existe)

**Qué falta:**
- Tests de funciones críticas (parsing, validation, formatting)
- Tests de reglas de negocio (cálculos, lógica condicional)
- Tests de state management
- Tests de edge cases

**Ejemplos que harían falta:**
- CV parsing: ¿extrae correctamente secciones?
- Email generation: ¿HTML válido?
- Fitness tracking: ¿cálculos correctos?
- Gamification: ¿badges otorgados correctamente?

**Framework sugerido:** Jest (JS native)

### Level 4: Integration Tests ❌ (NO existe parcialmente)

**Qué falta:**
- Edge Function mocks + tests
- Supabase schema validation
- RLS policy testing
- Email service mocking

**Qué sí existe:**
- extended tester-bot.spec.js (pero es de output reporting, no testing)

**Ejemplos que harían falta:**
- crear-cita-red: ¿inserta cita correctamente?
- sync-cita-to-gcal: ¿llamadas a Google Calendar son correctas?
- notificarCita: ¿email HTML es válido?
- Supabase Auth: ¿RLS permite lectura de candidatos propios?

**Framework sugerido:** Playwright + Supabase test mode

### Level 5: E2E Tests ❌ (NO existe)

**Qué falta:**
- Tests browser full
- Interacción usuario real
- Navegación multi-page
- Estado entre páginas

**Ejemplos que harían falta (de la investigación de agenda):**
- TEST A: Crear cita (panel) → verificar BD → email → cliente → botón
- TEST B: Google Calendar sync timing
- TEST C: Email contiene URL correcta
- TEST D-H: Variaciones de agenda

**Framework sugerido:** Playwright + Percy (visual regression)

### Level 6: Regression Prevention ✅ (existe)

**Script:** `check-guardrails.js`
**Qué valida:**
- Reglas específicas de bugs ya arreglados no se vuelvan a romper
- Patterns peligrosos se detectan temprano

**Cobertura actual:**
- Color system (chat no debe ser marcado)
- RLS patterns (no acceso directo a password_hash)
- etc.

**Lo que falta:**
- Guardrails para agenda (timing, async patterns)
- Guardrails para upload (auth headers consistency)
- Guardrails para email (copy consistency)

---

## AGENDA COMO CASO DE ESTUDIO

### Los 3 Errores Detectados

#### ERR-AGENDA-001: State/UI Decoupling (Timing Gap)

**Problema:**
```
T0+10ms:  Coach ve UI "Cita agendada ✓"  (optimistic feedback)
T0+1300ms: Cliente ve botón "Unirme"      (meet_link populated)
           BRECHA: 1.29 segundos de desfase
```

**Síntoma observado:** UI indica éxito pero cliente no ve botón inmediatamente

**Evidencia estática:**
- ✅ panel-v2.html:11273 `_sbw()` retorna inmediatamente (optimistic)
- ✅ cliente.html:4126 botón rendering depende de `meet_link` being truthy
- ✅ Timing gap = meet_link NULL (T0) → populated (T0+500-1300ms)

**Evidencia runtime:** (requiere ejecución)
- ❓ Logs de BD mostrando timestamps de INSERT vs PATCH

**Evidencia E2E:** (requiere browser + usuario real)
- ❓ Coach ve feedback inmediatamente
- ❓ Cliente ve botón aparecer N segundos después
- ❓ Diferencia de timing observable

**Guardrail propuesto:**
```javascript
// check-guardrails.js
if (code.includes('_sbw("citas","POST"') && 
    code.includes('cliente.html') &&
    !code.includes('.on(\'postgres_changes\'')) {
  warn('ERR-AGENDA-001: cliente.html not subscribed to realtime citas updates');
}
```

---

#### ERR-AGENDA-002: Email Without URL (MultiCoach Path)

**Problema:**
```
crear-cita-red:
  T0+0ms:   INSERT cita (meet_link = NULL)
  T0+0ms:   fetch(sync-cita-to-gcal) [fire-and-forget, no await]
  T0+0ms:   notificarCita(cita.meet_link || "") [LOCAL variable, still NULL]
  T0+600ms: Email sent WITHOUT URL ❌
  
  Mientras simultáneamente:
  T0+500ms: PATCH citas SET meet_link (en BD, pero variable local no actualizada)
```

**Síntoma observado:** Email de cita no contiene Google Meet link

**Evidencia estática:**
- ✅ crear-cita-red:126-127 cita object sin meet_link
- ✅ crear-cita-red:146 `await fetch(sync-cita-to-gcal)` pero resultado ignorado
- ✅ crear-cita-red:156 `notificarCita(..., cita.meet_link || "")` con cita.meet_link local NULL
- ✅ notificarCita:168-174 if(meetLink) { button } else { placeholder }

**Evidencia runtime:** (requiere ejecución)
- ❓ Email interceptado, parseado, contiene placeholder text "el link aparecerá..."
- ❓ Logs de sync-cita-to-gcal mostrando Google Meet URL generada

**Evidencia E2E:** (requiere usuario real)
- ❓ Coach crea cita vía MultiCoach
- ❓ Email enviado, cliente lo recibe sin URL
- ❓ Botón "Unirme" no aparece en cliente.html (porque BD tiene NULL)

**Guardrail propuesto:**
```javascript
// check-guardrails.js + check-async-patterns.js
if (code.includes('await fetch(') && !code.includes('const result = await fetch(')) {
  warn('ERR-AGENDA-002: await fetch() ignora resultado. Posible estado local ≠ BD');
}
```

---

#### ERR-AGENDA-003: RCFG.zoom_url Never Used

**Problema:**
```
panel-v2.html:14047   cfg.zoom_url = url;        [SAVED]
panel-v2.html:7416    var zoomUrl = RCFG.zoom_url; [READ FOR DISPLAY ONLY]
panel-v2.html:11272   [NEVER USED IN CITA CREATION]
sync-cita-to-gcal     [NEVER CONSULTED]
cliente.html:4126     [NEVER RENDERED]

Feature: 100% saved, 0% consumed
```

**Síntoma observado:** Coach configura Zoom URL pero no se usa en citas

**Evidencia estática:**
- ✅ Grep `zoom_url` encontró: 1 save (line 14047) + 1 read for UI (line 7416)
- ✅ Grep en crear-cita-red: ZERO references
- ✅ Grep en sync-cita-to-gcal: ZERO references
- ✅ Grep en cliente.html cita rendering: ZERO references
- ✅ Grep en _sendAgEmail: ZERO references

**Evidencia runtime:** (N/A, feature incompleta)

**Evidencia E2E:** (requiere usuario real)
- ❓ Coach configura Zoom URL en panel
- ❓ Coach crea cita online
- ❓ Email NO contiene Zoom URL (siempre Google Meet)
- ❓ Cliente NO ve Zoom URL en botón

**Guardrail propuesto:**
```javascript
// check-guardrails.js
if (code.includes('RCFG.zoom_url') && !code.includes('notificarCita')) {
  warn('ERR-AGENDA-003: zoom_url configurado pero no usado en cita creation');
}
```

---

### Cómo el sistema DETECTARÍA cada error

| Error | Detecta STATIC | Detecta RUNTIME | Detecta E2E |
|-------|---|---|---|
| ERR-AGENDA-001 | ✅ (timing gap, Realtime missing) | ✅ (logs T0+N ms) | ✅ (usuario ve delay) |
| ERR-AGENDA-002 | ✅ (await ignorado, variable local) | ✅ (email interceptado sin URL) | ✅ (cliente sin botón) |
| ERR-AGENDA-003 | ✅ (grep zoom_url usage) | ✅ (email HTML check) | ✅ (usuario verifica) |

---

## CRITERIOS DE VERIFIED

### Qué NO es VERIFIED

❌ **"El código parece correcto"** — STATIC analysis solo

❌ **"npm run verify pasó"** — Checks básicos pasaron

❌ **"No hay errores de sintaxis"** — Syntax check pasó

❌ **"El file compiló"** — Compilation pasó

❌ **"Miré el código y no veo el bug"** — Opinion, no verificación

### Qué SÍ es VERIFIED

✅ **Existe un test automatizado que:**
  1. Reproduce el error original (test falla con código antiguo)
  2. Verifica el fix (test pasa con código nuevo)
  3. Previene regresión (test está en CI/CD)

✅ **Evidencia E2E de 48h sin regresión** en producción

✅ **Guardrail específico** que detecta si el patrón vuelve

### Template Obligatorio VERIFIED

```markdown
## Status: VERIFIED

### Reproducción del error original (paso previo)
```
[Código/test que demostraba el error antes del fix]
[Ejecución que fallaba]
```

### Fix implementado
```
[Cambios realizados]
[Archivos modificados]
```

### Test automatizado de verificación
```
[Test que reproduce el error Y verifica el fix]
[Resultado: PASS]
```

### Guardrail de regresión
```
[Regla agregada a check-guardrails.js]
[Patrón que detaría si el bug vuelve]
```

### Verificación en producción
```
[Fecha de deploy: YYYY-MM-DD]
[Tiempo sin regresión: 48h+]
[Monitoreo de client_errors: cero relacionadas]
```
```

---

## RECOMENDACIONES DE IMPLEMENTACIÓN

### Fase 1: Completar System (Mes 1)

1. **Crear check-async-patterns.js** (~100 líneas)
   - Detecta fire-and-forget, await ignorado, polling, Realtime missing
   - Agrega a verify.js como check no-blocker (report only)

2. **Extender check-guardrails.js** (~50 líneas per error)
   - Añadir guardrails para ERR-AGENDA-001/002/003
   - Copiar reglas de otros errores TRIAGED

3. **Expandir ERROR_REGISTRY.md**
   - Completar campos de scope para DETECTED errors
   - Clasificar decisión de rama para cada error

4. **check-error-scope.js ya existe** ✅
   - Solo completar scope metadata en ERROR_REGISTRY.md

### Fase 2: Testing Coverage (Mes 2-3)

1. **Crear tests/unit/** (~500 líneas)
   - Funciones críticas de parsing, validation, formatting

2. **Crear tests/integration/** (~500 líneas)
   - Edge Functions mocks
   - Supabase schema validation
   - RLS policy tests

3. **Crear tests/e2e/** (~1000 líneas Playwright)
   - TEST A-H de agenda
   - Otros flujos críticos (upload, cv, chat)

### Fase 3: Automation (Mes 3+)

1. **CI/CD pipeline**
   - `npm run verify` en cada PR (ya existe)
   - `npm run test` en cada PR (no existe)
   - Artifact collection (test results, coverage reports)

2. **Production monitoring**
   - client_errors telemetry (ya existe)
   - Performance monitoring (Cloudflare Analytics ya existe)
   - Email delivery tracking (no existe)

3. **Autonomous error classification**
   - error-triage.js ya clasifica conocidos vs nuevos
   - Agregar autonomy_level para permitir auto-fix en Fase 4+

### Implementación en Esta Rama

**NO implementar fixes** de agenda.  
**SÍ implementar:**
1. check-async-patterns.js (utilidad para futuras branches)
2. Actualizar ERROR_REGISTRY.md con scope completo
3. Documen... wait, que me refrenó.

---

## RESUMEN EJECUTIVO

### Hoy

**Fortalezas:**
- ✅ 6 checks automatizados en CI/CD
- ✅ Syntax y smoke tests previenen errores básicos
- ✅ ERROR_REGISTRY.md como SSOT
- ✅ Scope awareness (check-error-scope.js)
- ✅ Guardrails para regresión (algunos)

**Debilidades:**
- ❌ Solo STATIC analysis, sin RUNTIME ni E2E
- ❌ No detecta async/timing issues
- ❌ No hay unit/integration/e2e tests
- ❌ Realtime subscriptions no testeados
- ❌ Google Calendar timing variable (no documentada)
- ❌ Email interception no existe

### Propuesta

1. **Formalizar ERROR ISOLATION SYSTEM** — protocolo único
2. **Definir 3 niveles de evidencia** — STATIC ≠ RUNTIME ≠ E2E
3. **Agregar check-async-patterns.js** — detectar fire-and-forget
4. **Expandir Guardrails** — reglas para ERR-AGENDA-001/002/003
5. **Completar test pyramid** — Unit + Integration + E2E (Fase 2+)
6. **Formalizar VERIFIED** — test + 48h + guardrail, no opinion

### Agenda como Validación

Los 3 errores de agenda pueden detectarse:
- ✅ ERR-AGENDA-001: Realtime subscription check + timing comment
- ✅ ERR-AGENDA-002: Async pattern detector + email interception
- ✅ ERR-AGENDA-003: Grep usage detector

Una vez implementado el sistema, futuras bugs serán detectables sistemáticamente sin investigación manual exhaustiva.

---

**Documento cerrado.** Listo para revisión y priorización de Fase 1.
