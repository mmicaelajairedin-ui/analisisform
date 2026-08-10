# Testing System Audit — Pathway

**Objetivo:** Determinar qué tiene el sistema actualmente, qué detecta, qué falta, qué implementar primero.

---

## AUDITORÍA RÁPIDA: QUÉ DETECTA CADA SCRIPT

### ✅ check-syntax.js (30 líneas)

**Detecta:** JavaScript roto en scripts inline  
**Método:** `vm.Script()` — parsing JS puro  
**Coverage:** 11 HTML files, ~1500 líneas script inline  
**Resultado:** PASS/FAIL (blocker si falla)

**NO detecta:**
- Lógica incorrecta
- Tipos incorrectos
- Parámetros malos
- Async issues

---

### ✅ check-smoke.js (160 líneas)

**Detecta:**
- Handlers (`onclick`, `onchange`, etc.) llaman a funciones que existen
- Assets (JS, CSS, images) existen en repo
- Referencias locales no rotas

**Método:** Regex + pattern matching en onclick, src=, href  
**Coverage:** Todas las pantallas  
**Resultado:** PASS/FAIL (no blocker)

**NO detecta:**
- Qué hace la función realmente
- Si la función recibe argumentos correctos
- Si el handler tiene lógica correcta
- Si la función funciona en runtime

---

### ✅ check-guardrails.js (5038 líneas)

**Detecta:** 30+ reglas específicas de bugs ya arreglados

**Ejemplos:**
- Chat color system (burbujas nunca con color de marca)
- Agenda icon picker (no mete SVG en atributo)
- Deduplicación de reservas (no duplicadas en lista/KPIs/agenda)
- Notificaciones (se descartan al clickear)
- Configuración (query rota no blanquea el panel)
- Review prompt (no se pide de nuevo si ya la dejó)
- etc.

**Método:** Regex + pattern matching en archivos fuente  
**Coverage:** panel-v2.html, cliente.html, multicoach.html, varios CSS  
**Resultado:** PASS/FAIL (blocker si falla)

**NO detecta:**
- Bugs nuevos (solo conocidos)
- Reglas sin patron (ej. "servidor devuelve 403")
- Comportamiento runtime
- Timing/async issues

---

### ✅ check-parity.js (271 líneas)

**Detecta:** Consistencia entre familias de pantallas

**Familias:**
- **Portales cliente:** cliente.html, pathway-fit-cliente.html, pathway-fin-cliente.html
- **Paneles coach:** panel-v2.html, panel-empresa.html
- **Formularios:** formulario.html, pathway-fit-form.html, pathway-fin-form.html
- **Editores:** cv.html, carta.html, cv-express.html, cv-ats.html

**Piezas verificadas:**
- Chat (notas_coach)
- Gate suscripción (pwSubGate)
- Presencia (pwBeat, last_seen)
- Auth (pw-auth.js)
- Aislamiento (candFilter, coach_id=eq)

**Invariantes (enforce):**
- Chat merge-safe (re-lee antes de escribir)
- Chat escape (anti-XSS)
- Auth expiry (401/403 → login)
- Chat dedup (clave canónica from|text|ts)

**Método:** Regex en archivo + extracción de funciones + validación  
**Coverage:** Todas las pantallas  
**Resultado:** PASS/FAIL (blocker si falla)

**NO detecta:**
- Si la pieza funciona realmente
- Bugs dentro de la pieza
- Comportamiento en runtime
- Performance/UX

---

### ✅ check-icons.js (160 líneas)

**Detecta:**
- Icon system (solo Lucide, no otra librería)
- Spec Lucide (color #1F4030, size 20px/18px, stroke 2px)
- PWI.IC mapa no duplicado
- emoji gris (`.cp-emo` class)

**Método:** Grep para patrones de iconos  
**Coverage:** panel-v2.html, pw-icons.js, pw-icons.css  
**Resultado:** PASS/FAIL (no blocker)

**NO detecta:**
- Icons faltantes en una pantalla nueva
- Si el icono se renderiza correctamente
- Semantic correctness (icono correcto para concepto)

---

### ✅ check-error-scope.js (281 líneas)

**Detecta:** Clasifica errores por rama

**Reglas:**
1. `UNDEFINED scope` → requiere review
2. `VERIFIED/TRIAGED` sin CORE_INFRASTRUCTURE → permite continuar
3. `CORE_INFRASTRUCTURE` → siempre blocker
4. `MODULE_SPECIFIC` scope_belongs_to==rama actual → blocker
5. `MODULE_SPECIFIC` scope_belongs_to!=rama actual → out of scope
6. `CROSS_MODULE` affecting current → blocker
7. `CROSS_MODULE` affecting other → out of scope

**Entrada:** ERROR_REGISTRY.md (scope metadata)  
**Salida:** BLOCKER / OUT_OF_SCOPE / REVIEW_REQUIRED

**NO detecta:**
- Si el error existe realmente
- Si el root cause es correcto
- Si la rama propietaria puede arreglarlo

---

### ✅ error-triage.js (266 líneas)

**Detecta:** Clasifica test failures

**Clasificación:**
- `KNOWN_ERROR` — patrón en ERROR_REGISTRY.md
- `REGRESSION` — 404/500/403/permission/denied/failed/timeout
- `ENVIRONMENT_ERROR` — SUPABASE_URL, .env, secrets
- `NEW_ERROR` — no en registry

**Método:** Pattern matching en error text contra KNOWN_ERRORS dict  
**Entrada:** test-results.json (Playwright/Mocha output)  
**Salida:** triaged-errors.json con error_id, type, severity, autonomy_level

**NO detecta:**
- Errores no en el pattern dict
- Root cause real (solo síntoma)
- Si el test es válido o falso positivo

---

### ✅ verify.js (135 líneas)

**Orquestador:** Ejecuta todos los checks en secuencia

**Orden:**
1. Syntax (blocker)
2. Smoke (no blocker)
3. Guardrails (blocker)
4. Error Scope (blocker)
5. Parity (no blocker)
6. Icons (no blocker)
7. Triage (blocker)

**Exit code:**
- Exit 1 si hay blocker
- Exit 0 si solo warnings

---

## TESTING MATRIX — QUÉ FALTA

| Nivel | Detecta | NO detecta | Status | Costo |
|-------|---------|-----------|--------|-------|
| **1. Syntax** | JS parse | Lógica, tipos, parámetros | ✅ Existe | Bajo |
| **2. Unit** | Funciones aisladas | Integración, side effects | ❌ NO | Medio |
| **3. Integration** | Edge Func + Supabase mocks | Runtime real, API timing | ❌ NO | Alto |
| **4. Runtime** | Logs, network traces, DB state | Timing precisas, user perception | ❌ PARCIAL | Muy alto |
| **5. E2E** | Flujo completo usuario→resultado | Datos reales producción, scale | ❌ NO | Muy alto |
| **6. Regression** | Bugs conocidos no vuelven | Bugs nuevos | ✅ Existe | Bajo |
| **7. Health** | Production monitoring | Problemas silenciosos | ❌ PARCIAL | Alto |

---

## ERROR ISOLATION PROTOCOL

### Tipos de Error (categorías)

```
FRONTEND
  ├─ DOM/Rendering
  ├─ Event handling
  ├─ State management
  ├─ JavaScript logic
  └─ CSS/Layout

BACKEND
  ├─ Edge Function
  ├─ API endpoint
  ├─ Business logic
  └─ Error handling

DATABASE
  ├─ Schema
  ├─ Query
  ├─ Migration
  └─ Data

RLS/AUTH
  ├─ Policy
  ├─ Grant
  ├─ JWT
  └─ Session

ASYNC/TIMING
  ├─ Race condition
  ├─ Fire-and-forget
  ├─ Await ignorado
  ├─ Polling/timing gap
  └─ Realtime missing

INTEGRATION
  ├─ Google Calendar
  ├─ EmailJS
  ├─ Uploadcare
  ├─ Supabase Auth
  └─ External API

CONFIGURATION
  ├─ Environment
  ├─ Secrets
  ├─ Project ref
  └─ Feature flag

DEPLOYMENT
  ├─ CI/CD
  ├─ Function deploy
  ├─ Cloudflare
  └─ Database migration
```

### Aislamiento por Rama

| Error type | Propietario | Bloquea | Nota |
|----------|---|---|---|
| FRONTEND panel-v2 | (TBD) | Esa rama | Chrome del coach |
| FRONTEND cliente | (TBD) | Esa rama | Portal cliente |
| Edge Function crear-cita-red | multicoach | multicoach | Lógica MultiCoach |
| Edge Function sync-cita-to-gcal | core/agenda | todas | Agenda (aún no rama) |
| RLS policies | core | todas | CORE_INFRASTRUCTURE |
| Schema migration | core | todas | CORE_INFRASTRUCTURE |
| CI/CD workflow | core | todas | CORE_INFRASTRUCTURE |
| Project ref | core | todas | CORE_INFRASTRUCTURE |

---

## AGENDA CASE STUDY

### ERR-AGENDA-001: State/UI Decoupling (Timing Gap)

**Tipo:** ASYNC/TIMING + FRONTEND  
**Detectabilidad:**
- ✅ STATIC: Timing gap visible (T0 INSERT vs T0+1300ms render)
- ✅ STATIC: Realtime `.on('postgres_changes'` ausente en cliente.html
- ❓ RUNTIME: Logs de timing real (no capturados hoy)
- ❓ E2E: Usuario ve delay (requiere browser automation)

**Qué test lo detectaría:**
- TEST E2E: Coach crea cita → esperar → cliente abre → medir tiempo hasta botón
- TEST REALTIME: Suscribir cliente.html a citas, PATCH en BD, verificar re-render <1s

**Cómo detectarlo HOYCON EL SISTEMA ACTUAL:**
- ✅ Grep `on('postgres_changes'` en cliente.html (falta)
- ✅ Guardrail: "si cliente.html fetch citas pero no se suscribe, warning"
- ❌ No hay timing test actualmente

---

### ERR-AGENDA-002: Email Sin URL (MultiCoach Path)

**Tipo:** ASYNC/TIMING + BACKEND  
**Detectabilidad:**
- ✅ STATIC: `await fetch(sync)` ignorando resultado (line 146)
- ✅ STATIC: Variable local `cita.meet_link` no actualizada (line 156)
- ❓ RUNTIME: Email interceptado sin URL (requiere mock EmailJS)
- ❓ E2E: Usuario recibe email, verifica contenido

**Qué test lo detectaría:**
- TEST INTEGRATION: Mockear EmailJS, crear cita, verificar email contiene URL
- TEST E2E: Coach crea cita → cliente recibe email → verifica contenido

**Cómo detectarlo HOY CON EL SISTEMA ACTUAL:**
- ✅ Guardrail: "await fetch ignora resultado" (no existe hoy)
- ✅ check-async-patterns.js (propuesto)
- ❌ No hay email testing actualmente

---

### ERR-AGENDA-003: RCFG.zoom_url Never Used

**Tipo:** CONFIGURATION + INTEGRATION  
**Detectabilidad:**
- ✅ STATIC: Grep `zoom_url` — 1 save + 1 read for UI, 0 en creation logic
- ✅ STATIC: Feature half-built pattern
- ✅ RUNTIME: Email check confirma nunca enviado
- ✅ E2E: Coach configura, cita se crea, zoom_url not in email

**Qué test lo detectaría:**
- TEST STATIC: Grep `zoom_url` usage en crear-cita-red, sync-cita-to-gcal, cliente.html
- TEST E2E: Coach configura Zoom → crea cita → verificar email

**Cómo detectarlo HOY:**
- ✅ Grep (manual, no automatizado)
- ✅ Guardrail: "si zoom_url guardado, debe usarse en creation" (no existe)
- ❌ No hay integración test

---

## ASYNC/RACE CONDITIONS AUDIT

### Patrones Detectables Estáticamente

| Patrón | Detecta | Prevalencia | Riesgo | Detector |
|--------|---------|-------------|--------|----------|
| **Fire-and-forget** `fetch(url)` | ✅ Grep `fetch.*[^\w]$` | Alta (crear-cita-red) | Alto | Regex |
| **Await ignorado** `await fn(); var=old;` | ✅ Grep `await.*=` + check var | Alta | Alto | AST (complejo) |
| **Polling** `while(sleep)` | ✅ Grep `while.*sleep` | Media (panel-v2 polling) | Medio | Regex |
| **Realtime missing** no `.on()` | ✅ Grep `-on\(.*postgres` | Alta | Medio-Alto | Regex |
| **Timing comment** `T0+500ms` | ✅ Grep comentarios | Baja (agenda tiene) | Bajo | Regex |
| **Best-effort silenced** `.catch(){}` | ✅ Grep `.catch\(\s*\{\s*\}` | Alta | Alto | Regex |
| **Retry lógica absent** no retry | ⚠️ Debe estar documentado | Alta | Medio | Manual |

---

## RELEASE GATE

### Propuesta: Qué Bloquea Release

**BLOCKER (no se puede desplegar):**
- [ ] Syntax check falla
- [ ] Guardrails falla
- [ ] Error Scope detecta blocker en-scope
- [ ] CORE_INFRASTRUCTURE error DETECTED
- [ ] Test E2E CRITICAL falla
- [ ] Production health check falla (CDN down, DB unreachable)

**REVIEW REQUIRED (puede desplegar con aprobación manual):**
- [ ] Error Scope requiere review (scope undefined)
- [ ] Test E2E HIGH falla (pero workaround existe)
- [ ] Performance regresión <10%

**ALLOWED (proceder sin bloqueo):**
- [ ] Warning (no blocker)
- [ ] Test MEDIUM falla pero conocido
- [ ] Guardrails report (futura regla, no enforce aún)

---

## GAPS ACTUALES

### Qué Falta

| Gap | Impacto | Costo | Prioridad |
|-----|---------|-------|-----------|
| **Unit tests** | Funciones críticas sin cobertura | Medio | P1 |
| **Integration tests** | Edge Func + Supabase no testeados | Alto | P1 |
| **E2E tests** | Flujos reales no validados | Alto | P1 |
| **check-async-patterns.js** | Fire-and-forget no detectado | Bajo | P1 |
| **Email mocking** | Email no testeado | Medio | P2 |
| **Realtime test** | Suscripción no testeada | Medio | P2 |
| **Performance baseline** | Regresos de perf no detectados | Medio | P2 |
| **Production monitoring** | Errores en prod desapercibidos | Bajo | P3 |

---

## IMPLEMENTACIÓN RECOMENDADA

### FASE 1 (Semana 1): Detectores STATIC

**1. check-async-patterns.js** (~150 líneas)
```
Detecta:
  ✓ fire-and-forget: fetch(...)[^;\n]*[;\n]
  ✓ await ignorado: await \w+\(...\); var=...
  ✓ polling: while.*sleep
  ✓ realtime missing: -on\('postgres_changes
  ✓ best-effort swallowed: .catch()\s*{}
```
**Por qué:** Agenda necesita esto (ERR-AGENDA-002/003 se detectarían)  
**Esfuerzo:** 2 horas  
**Blocker:** No (report only)

**2. Expandir check-guardrails.js** (~50 líneas)
```
Agregar reglas:
  ✓ crear-cita-red: await sync pero resultado ignorado
  ✓ cliente.html: si fetch citas, debe suscribirse a postgres_changes
  ✓ RCFG.zoom_url: si guardado, debe usarse en algún lado
```
**Por qué:** Blindar agenda errors  
**Esfuerzo:** 3 horas  
**Blocker:** Sí (si queremos evitar regresos)

**3. Completar ERROR_REGISTRY.md**
```
Para cada error DETECTED:
  ✓ scope_type
  ✓ scope_belongs_to
  ✓ blocking_scope
  ✓ Verdadero root cause (no hipótesis)
```
**Por qué:** Necesario para error-scope.js funcione correctamente  
**Esfuerzo:** 4 horas  
**Blocker:** Sí (check-error-scope.js no puede clasificar sin esto)

### FASE 2 (Semana 2-3): Tests de Ejecución

**4. tests/unit/** (~500 líneas, Jest)
```
Funciones críticas:
  - Email template rendering
  - CV parsing y validation
  - Gamification logic
  - Date calculations
  - URL generation
```
**Esfuerzo:** 10 horas  
**Blocker:** No

**5. tests/integration/** (~500 líneas, Playwright + Supabase)
```
Edge Functions:
  - crear-cita-red (sin MultiCoach)
  - sync-cita-to-gcal
  - send-email
  - generar-informe

Supabase:
  - RLS policies (coach_id filtering)
  - Auth expiry (401→login)
  - Chat merge-safe
```
**Esfuerzo:** 15 horas  
**Blocker:** No

**6. tests/e2e/** (~300 líneas, Playwright)
```
TEST A: Crear cita (Panel)
TEST B: Google Calendar sync timing
TEST C: Email contiene URL
TEST G: Cita presencial (no video)
TEST H: Citas antiguas
```
**Esfuerzo:** 8 horas  
**Blocker:** No (pero resultados criteriosos)

### FASE 3 (Semana 4+): Automatización

**7. CI/CD pipeline**
```
npm run verify (ya existe)
npm run test (jest + playwright)
Artifact collection (coverage reports, screenshots)
```

**8. Production health checks**
```
Cloudflare Analytics (ya existe)
client_errors telemetry (ya existe)
Email delivery monitoring (NO existe)
```

---

## ORDEN DE IMPLEMENTACIÓN (CONCRETO)

### Hoy (Esta rama)

1. ✅ **Crear check-async-patterns.js** (2 h)
   - Detecta fire-and-forget, await ignorado, polling, realtime missing
   - Agrega a verify.js como check no-blocker
   - **POR QUÉ:** Agenda necesita esto para detectarse; reutilizable en otras branches

2. ✅ **Expandir check-guardrails.js** (3 h)
   - 3 nuevas reglas: crear-cita-red await, cliente.html realtime, zoom_url usage
   - **POR QUÉ:** Bloquea regresos de agenda; cero impacto en funcionalidad

3. ✅ **Completar ERROR_REGISTRY.md** (4 h)
   - Scope metadata correcta para DETECTED errors
   - **POR QUÉ:** error-scope.js no funciona sin esto; es prerequisito para Fase 2

### Próxima semana (otra rama o esta)

4. tests/unit/ (10 h)
5. tests/integration/ (15 h)
6. tests/e2e/ (8 h)

---

## VALIDACIÓN: ¿HABRÍA DETECTADO AGENDA?

### ERR-AGENDA-001 (Timing Gap)

**Hoy:** ❓ Realtime missing se detectaría solo con nuevo guardrail  
**Con Fase 1:** ✅ check-async-patterns.js + nuevo guardrail → detecta

### ERR-AGENDA-002 (Email sin URL)

**Hoy:** ❌ No se detecta  
**Con Fase 1:** ✅ check-async-patterns.js → detecta "await ignorado"  
**Requiere Fase 2:** ✅ tests/integration + email mock → verifica email real

### ERR-AGENDA-003 (zoom_url never used)

**Hoy:** ❌ No se detecta  
**Con Fase 1:** ✅ nuevo guardrail → detecta "configurado pero no usado"

---

**Conclusión:** Fase 1 es crítica. Sin ella, el sistema sigue sin detectar async patterns (la categoría de error más peligrosa). Fase 2 es validación (E2E proof).

