# Testing Coverage Matrix — QA Capability Coverage

**Estado:** Fase 1 (Agosto 2026)

Matriz que muestra qué detecta cada check, qué NO detecta, nivel de análisis, si es blocker, riesgo de falsos positivos, y tipo de evidencia que proporciona.

## Coverage Matrix

| Check | Detecta | NO Detecta | Nivel | Blocker | FP Risk | Evidencia |
|-------|---------|-----------|-------|---------|---------|-----------|
| **check-syntax.js** | JS parse errors, sintaxis rota | Lógica errónea, runtime errors | STATIC | ✅ Sí | Muy bajo | Parse tree |
| **check-smoke.js** | Handlers no existen, assets rotos | Handlers mal implementados | STATIC | No | Bajo | Regex match en HTML |
| **check-guardrails.js** | Bugs conocidos (253 reglas) | Bugs nuevos, patterns desconocidos | STATIC | ✅ Sí | Bajo-Alto (por regla) | Pattern match |
| **check-parity.js** | Cableado faltante entre pantallas | Cableado mal implementado | STATIC | ✅ Sí | Bajo | Regex + function body |
| **check-icons.js** | Icon system violations | Icon rendering real | STATIC | No | Muy bajo | Regex match |
| **check-error-scope.js** | Error clasificado incorrecto | Root cause real del error | STATIC | ✅ Sí | Bajo | Metadata parse |
| **error-triage.js** | Test fail clasificado | Fail causa real | STATIC | ✅ Sí | Medio | Pattern match vs registry |
| **check-async-patterns.js** (NEW) | Async/timing patterns sospechosos | Timing real, race conditions runtime | STATIC | No | Medio | Regex + AST |
| **(Unit tests)** | Funciones aisladas | Integración, UI | UNIT | No | Muy bajo | Assert pass/fail |
| **(Integration tests)** | Edge Func + Supabase mocks | Timing real, escala | INTEGRATION | No | Bajo | Mock response match |
| **(E2E tests)** | Flujos usuario completos | Escala, datos producción | E2E | No | Muy bajo | Browser automation |
| **(Email mock)** | Email contenido, estructura | Delivery real, rendering | INTEGRATION | No | Bajo | Interceptor capture |
| **(Realtime test)** | Subscription + update | Performance, múltiples usuarios | INTEGRATION | No | Bajo | Websocket listen |
| **(Prod monitoring)** | Errors en vivo, telemetría | Silent issues, UX problems | HEALTH | No | Muy bajo | Log aggregation |

## QA Capability Coverage Progression

- **Fase 1 (Hoy):** 68% — STATIC checks (código + patterns)
  - Detecta: syntax, known bugs, cableado, async patterns
  - No detecta: unit/integration/E2E/timing real/scaling

- **Fase 2 (Propuesto):** 85% — + Unit + Integration + Email mock
  - Agrega: funciones aisladas, Edge Func, Supabase mocks, notificaciones

- **Fase 3 (Full):** 95%+ — + E2E + Realtime + Prod monitoring
  - Agrega: browser automation, Calendly/Zoom real, live telemetry

## Nivel de Análisis

- **STATIC:** Código fuente solo (parsing, regex, AST)
- **UNIT:** Función aislada (test framework)
- **INTEGRATION:** Componentes + mocks (API, BD, servicios)
- **E2E:** Usuario real + navegador + datos/servicios reales
- **HEALTH:** Producción en vivo (telemetría, logs)

## Nota sobre "coverage %"

Estas cifras son **QA capability coverage** (% de capacidades de detección del sistema), NO "code coverage" (líneas de código testadas). Un porcentaje alto de code coverage no garantiza detección de bugs; este sistema mide "¿qué tipos de errores podemos detectar HOY?"
