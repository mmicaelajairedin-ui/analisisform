# Changelog — Nivel 1 · `metricas` + Health Score en el tab Analíticas

**Fecha:** 2026-07-27
**Fase:** Pathway OS · Nivel 1 (Activation)
**Rama:** `claude/n8n-business-workflow`
**Spec:** `docs/metricas-spec.md`

Primer motor de métricas de negocio, event-hybrid. Read-only y **aditivo**: no
cambia flujos existentes. Regla de oro de esta fase: **ENRIQUECER, no reescribir**
— el tab de Analíticas del panel ya tiene datos reales; se le SUMA una tarjeta,
no se lo reemplaza ni se lo marca Legacy.

## Agregado

### Backend — edge function `metricas` (única fuente de verdad)
- **`supabase/functions/metricas/index.ts`** — READ-ONLY, gate de admin por JWT
  (patrón de `admin-coach-op`). Nadie lee `eventos`/tablas con la anon key.
- Lee `eventos` + `usuarios` + `candidatos` (service role). **Híbrido transitorio**:
  eventos donde ya se emiten, tablas base donde falta (funciona hoy con datos
  reales; ej. cliente que entró = `candidatos.consent_at`).
- Calcula: **embudo de 11 fases** (event-native), **activación** (perfil + invitó
  + cliente entró, session-agnostic), **Health Score por dimensiones**
  (Activación 40 / Uso 30 / Clientes 20 / Recencia 10, configurable), **MRR**
  (precio configurable), y los KPIs de las preguntas de negocio.
- Cada coach del array `coaches[]` ahora incluye **`id`** (`usuarios.id`) para que
  el front pueda abrir su ficha con el drill-down que ya existe.
- **Cada KPI declara su fuente + estado de migración** (🔴/🟡/🟢) + array
  `fuentes` con la tabla de migración → el híbrido nunca se vuelve permanente.
- Métricas temporales (TTV, etc.): **contrato reservado, sin calcular** (pragmático).

### Frontend — tarjeta "Health Score por coach" DENTRO del tab Analíticas
- El sub-tab admin **Coaches → Analíticas** conserva TODO lo que ya tenía
  (KPIs de estado, Embudo de implementación con drill-down, Historial de
  ingresos, Coaches por estado, Clientes). **Nada se elimina ni se marca Legacy.**
- Se le **agrega una sola tarjeta**: **"Health Score por coach"** (0–100 por
  dimensión), al final del tab. Contenedor lazy `#ceo-dash` que carga recién
  cuando la vista lo pinta.
- `_ceoLoad()` / `_ceoRender()`: **consumidor puro** de `metricas` (JWT de admin).
  **Cero cálculo de negocio en el front** — solo renderiza la respuesta. Reusa los
  componentes del panel (`cp-card`, barras) y el **drill-down `coach-view`** que ya
  existía: tocar un coach abre su ficha (no se duplica ninguna vista).
- Botón **↻ Actualizar** y reintento ante error. El Health Score es un índice
  0–100 (Activación·40% + Uso·30% + Clientes·20% + Recencia·10%), **no un %** —
  aclarado en la propia tarjeta.

### Tests de regresión
- `scripts/check-guardrails.js`:
  - `metricas` conserva el gate de admin **y** el `id` por coach.
  - La tarjeta de Health Score está cableada, consume `metricas`, reusa el
    drill-down `coach-view`, y **el Embudo de implementación sigue vivo** (prueba
    de que fue ENRIQUECER, no reescribir).

## Roles (diseño, no todo implementado)
- **Admin (global):** la tarjeta de Health Score (esta fase). ✅
- **Coach (su negocio):** ya existe ("Mi negocio" en Resumen) — se reusan
  componentes; a futuro, su propio Health Score con `scope=coach` en `metricas`.
- **Owner (sus coaches):** futuro, con `scope=owner`.

## Requiere acción manual
- Deploy: `supabase functions deploy metricas --no-verify-jwt` (al mergear, lo
  hace `deploy-functions.yml`).
- La tabla `eventos` ya está aplicada.

## Validación
- 4 checks de CI en verde (163 reglas de guardrails).
- TS de `metricas` revisado a mano (deno/tsc no están en el entorno; se transpila
  con esbuild al desplegar).
- **Validación visual (datos reales): en el panel, tras el deploy** — la tarjeta
  consume la función viva + la sesión admin.

## Pendiente (próximas iteraciones)
- Deltas semana a semana (necesitan histórico → rollup) y el resto de KPIs de la
  lámina Pathway OS (churn, LTV/CAC, etc.) cuando haya datos.
- Vistas Coach/Owner con `scope`.
- Migrar cada KPI de `mixto`/`base_temporal` → `eventos` según la tabla `fuentes`.
