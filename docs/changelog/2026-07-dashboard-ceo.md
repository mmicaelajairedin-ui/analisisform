# Changelog — Nivel 1 · Dashboard CEO (Activation) + `metricas`

**Fecha:** 2026-07-27
**Fase:** Pathway OS · Nivel 1 (Activation)
**Rama:** `claude/n8n-business-workflow`
**Spec:** `docs/metricas-spec.md`

Primer dashboard de negocio, event-hybrid. Read-only y aditivo: no cambia flujos
existentes. El tab de analytics viejo queda **Legacy** (no se elimina aún).

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
- **Cada KPI declara su fuente + estado de migración** (🔴/🟡/🟢) + array
  `fuentes` con la tabla de migración → el híbrido nunca se vuelve permanente.
- Métricas temporales (TTV, etc.): **contrato reservado, sin calcular** (pragmático).

### Frontend — Dashboard CEO en `panel-v2.html`
- Nuevo sub-tab admin **"Dashboard CEO"** (junto a "Analíticas · Legacy").
- `_ceoLoad()` / `_ceoRender()`: **consumidor puro** — llama a `metricas` con el
  JWT de admin y SOLO renderiza la respuesta. **Cero cálculo de negocio en el
  front.** Reusa los componentes del panel (`cp-card`, tiles, barras).
- Muestra los **8 KPIs v1** (coaches en trial, activos de pago, conversión
  trial→pago, MRR, activación, en riesgo), el **embudo** con badge de fuente por
  fase + mayor fuga, y **coaches por Health Score 0–100** con breakdown por
  dimensión. Botón ↻ Actualizar.

### Legacy
- El sub-tab **"Coaches → Analíticas"** quedó marcado **Legacy** (etiqueta +
  comentario). Calcula en el front desde tablas base. **Se retira cuando el
  Dashboard CEO esté validado con datos reales** (no antes — no dos dashboards).

### Tests de regresión
- 3 reglas nuevas en `scripts/check-guardrails.js`: el sub-tab + contenedor
  existen, el dashboard sigue siendo consumidor de `metricas`, y `metricas`
  conserva el gate de admin.

## Roles (diseño, no todo implementado)
- **Admin (global):** el Dashboard CEO (esta fase). ✅
- **Coach (su negocio):** ya existe ("Mi negocio" en Resumen) — se reusan componentes.
- **Owner (sus coaches):** futuro, con `scope=owner` en `metricas`.

## Requiere acción manual
- Deploy: `supabase functions deploy metricas --no-verify-jwt` (al mergear, lo
  hace `deploy-functions.yml`).
- La tabla `eventos` ya está aplicada.

## Validación
- 4 checks de CI en verde. TS de `metricas` revisado a mano (deno/tsc no están en
  el entorno; se transpila con esbuild al desplegar).
- **Validación real (datos + capturas): después del merge** — el dashboard
  consume la función viva + la sesión admin, así que solo se puede ver desplegado.

## Pendiente (próximas iteraciones)
- Drill-down por coach (abrir ficha desde la lista de health) — reusar el patrón
  de drill-down del embudo Legacy.
- Deltas semana a semana (necesitan histórico → rollup) y el resto de KPIs de la
  lámina Pathway OS (churn, LTV/CAC, etc.) cuando haya datos.
- Vistas Coach/Owner con `scope`.
