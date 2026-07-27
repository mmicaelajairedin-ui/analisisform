# Especificación — edge function `metricas` (Dashboard CEO · Nivel 1)

> **Estado:** propuesta para aprobación (antes de construir la UI).
> **Principios (aprobados):** el Dashboard CEO consume **solo** `metricas`; cero
> cálculo de negocio en el frontend; toda la lógica en el backend; **modo híbrido
> como transición, NO permanente**; cada KPI declara su **fuente** y su **plan de
> migración** a event sourcing puro.

## 0. Contexto y decisión

Hoy el panel calcula el embudo de activación y el health **en el navegador** desde
tablas base (`usuarios`, `candidatos`, `informes`). La tabla `eventos` recién
arranca (4 emisores). Decisión: `metricas` se vuelve la **única fuente backend**;
hoy lee **tablas base (temporal)** donde no hay eventos y **eventos** donde sí; a
medida que el histórico de eventos madura, cada KPI migra a eventos. El sub-tab
"Analíticas" actual queda marcado **Legacy** y se retira cuando el nuevo dashboard
esté validado. **Nunca dos dashboards manteniendo la misma lógica.**

Regla de oro anti-híbrido-permanente: **cada KPI viaja con su metadata de fuente**
(`fuente`, `objetivo`, `migrar_cuando`). Mientras exista un solo KPI con
`fuente != "eventos"`, la migración no terminó.

## 1. Contrato de la API

- **Método:** `POST /functions/v1/metricas`
- **Auth:** JWT de admin en `Authorization: Bearer <token>`. Se valida contra
  `usuarios.rol='admin'` (email o auth_id), mismo gate que `admin-coach-op`. Sin
  admin → `403`. Nadie lee `eventos`/tablas con la anon key: la lectura vive solo
  acá, con service role.
- **Body (opcional):** `{ "dias": number }` — ventana del embudo/semana (default 30, 1–365).
- **Respuesta:** `200` con el JSON del §2. Errores: `403` (no admin), `502`
  (lectura falló), `500` (env).

## 2. JSON Schema de la respuesta

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["ok", "generado_at", "ventana_dias", "config", "kpis", "embudo", "coaches", "resumen", "fuentes"],
  "properties": {
    "ok": { "type": "boolean" },
    "generado_at": { "type": "string", "format": "date-time" },
    "ventana_dias": { "type": "integer", "minimum": 1, "maximum": 365 },

    "config": {
      "type": "object",
      "description": "Configuración viva (no hardcodeada en el front). Pesos del health score y regla de activación.",
      "required": ["health_weights", "activado_requiere"],
      "properties": {
        "health_weights": {
          "type": "object",
          "properties": {
            "activado":        { "type": "number" },
            "actividad_14d":   { "type": "number" },
            "actividad_max":   { "type": "number" },
            "cliente_entrado": { "type": "number" },
            "cliente_max":     { "type": "number" },
            "recencia_7d":     { "type": "number" },
            "recencia_14d":    { "type": "number" }
          }
        },
        "activado_requiere": { "type": "array", "items": { "type": "string" } }
      }
    },

    "kpis": {
      "type": "object",
      "description": "Mapa abierto de KPIs. Cada KPI declara su fuente y plan de migración. Agregar KPIs no rompe el contrato.",
      "additionalProperties": {
        "type": "object",
        "required": ["valor", "unidad", "fuente", "objetivo", "migrar_cuando"],
        "properties": {
          "valor":        { "type": ["number", "string", "null"] },
          "unidad":       { "type": "string", "enum": ["count", "pct", "eur", "texto"] },
          "label":        { "type": "string" },
          "fuente":       { "type": "string", "enum": ["eventos", "base_temporal", "mixto"] },
          "objetivo":     { "type": "string", "enum": ["eventos"] },
          "migrar_cuando":{ "type": "string" }
        }
      }
    },

    "embudo": {
      "type": "array",
      "description": "Fases del embudo de activación del coach, en orden. Cada fase con su fuente.",
      "items": {
        "type": "object",
        "required": ["fase", "label", "valor", "fuente"],
        "properties": {
          "fase":            { "type": "string" },
          "label":           { "type": "string" },
          "valor":           { "type": "integer" },
          "pct_del_total":   { "type": ["number", "null"] },
          "pct_del_anterior":{ "type": ["number", "null"] },
          "fuente":          { "type": "string", "enum": ["eventos", "base_temporal", "mixto"] }
        }
      }
    },

    "coaches": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["email", "activado", "health_score", "estado", "fuente"],
        "properties": {
          "email":               { "type": "string" },
          "nombre":              { "type": ["string", "null"] },
          "perfil":              { "type": "boolean" },
          "invitados":           { "type": "integer" },
          "clientes_entraron":   { "type": "integer" },
          "activado":            { "type": "boolean" },
          "eventos_14d":         { "type": "integer" },
          "dias_sin_actividad":  { "type": "integer" },
          "health_score":        { "type": "integer", "minimum": 0, "maximum": 100 },
          "estado":              { "type": "string", "enum": ["verde", "medio", "riesgo"] },
          "fuente":              { "type": "string", "enum": ["eventos", "base_temporal", "mixto"] },

          "_reservado_v2": {
            "type": "object",
            "description": "Campos RESERVADOS para Activation Engine y Health Score v2. Hoy null; agregarlos no rompe el contrato.",
            "properties": {
              "activation_stage": { "type": ["string", "null"] },
              "wow_at":           { "type": ["string", "null"], "format": "date-time" },
              "health_breakdown": { "type": ["object", "null"] },
              "tendencia":        { "type": ["string", "null"] },
              "segmento":         { "type": ["string", "null"] }
            }
          }
        }
      }
    },

    "resumen": {
      "type": "object",
      "properties": {
        "coaches_total":     { "type": "integer" },
        "coaches_activados": { "type": "integer" },
        "coaches_en_riesgo": { "type": "integer" },
        "clientes_entraron": { "type": "integer" },
        "eventos_leidos":    { "type": "integer" }
      }
    },

    "fuentes": {
      "type": "array",
      "description": "Tabla de migración: por cada KPI, fuente actual, fuente objetivo y condición para migrar.",
      "items": {
        "type": "object",
        "required": ["kpi", "fuente_actual", "fuente_objetivo", "condicion"],
        "properties": {
          "kpi":            { "type": "string" },
          "fuente_actual":  { "type": "string", "enum": ["eventos", "base_temporal", "mixto"] },
          "fuente_objetivo":{ "type": "string", "enum": ["eventos"] },
          "condicion":      { "type": "string" }
        }
      }
    }
  }
}
```

## 3. KPIs, fórmulas y las 8 preguntas de negocio

Cada KPI responde una pregunta y declara su fuente. `[BASE]` = tabla base
(temporal), `[EVENTO]` = event store, `[MIXTO]` = combina.

| KPI (key) | Pregunta de negocio | Fórmula | Fuente hoy |
|-----------|---------------------|---------|-----------|
| `trials_semana` | ¿Cuántos coaches empezaron trial esta semana? | coaches con inicio de prueba en la ventana | `[BASE]` `usuarios` (`created_at`/`fecha_fin_prueba`) → objetivo `[EVENTO]` `TrialStarted` |
| `wow_semana` / `wow_total` | ¿Cuántos llegaron al Momento WOW? | coaches con ≥1 cliente que hizo `ClientAccepted` | `[EVENTO]` `ClientAccepted` |
| `atascados_onboarding` | ¿Cuántos se quedaron atascados en onboarding? | en prueba activa, arrancaron pero NO activados (perfil∧invitó∧cliente-entró) | `[MIXTO]` |
| `pct_perfil` | ¿Qué % completa el perfil? | coaches con `ProfileCompleted` ÷ total (fallback base: `configuracion` con nombre+bio) | `[MIXTO]` → `[EVENTO]` |
| `pct_primer_cliente` | ¿Qué % invita al primer cliente? | coaches con ≥1 `ClientInvited` ÷ total (fallback base: `candidatos` count>0) | `[MIXTO]` → `[EVENTO]` |
| `pct_trial_pago` | ¿Qué % convierte trial en pago? | coaches pagando ÷ coaches que tuvieron prueba | `[BASE]` `usuarios.configuracion.estado_sub` → objetivo `[EVENTO]` `TrialStarted`+`PaymentSucceeded` |
| `activacion_pct` | (métrica núcleo) | coaches activados ÷ total | `[MIXTO]` → `[EVENTO]` |
| `coaches_riesgo` | ¿Qué coaches tienen mayor riesgo de abandono? | `coaches` con `estado='riesgo'`, orden health asc | `[MIXTO]` |
| `mayor_fuga` | ¿Dónde está la mayor fuga del embudo? | fase del `embudo` con mayor caída % respecto de la anterior | `[BASE]` → `[EVENTO]` |

**Embudo (8 fases, reusa la lógica del panel actual, movida al backend):**
`Activó cuenta → Perfil+foto → Calendly → Stripe → Publicó link → Primer cliente
→ Primer informe IA → Uso recurrente`. Hoy `[BASE]` (deriva de `usuarios.configuracion`
+ `candidatos` + `informes`). Objetivo `[EVENTO]` a medida que se cableen
`ProfileCompleted`, `StripeConnected`, `ClientInvited`, etc.

**Activación (session-agnostic, aprobada):** `ProfileCompleted ∧ ≥1 ClientInvited
∧ ≥1 de esos clientes ClientAccepted`. Fuente hoy `[MIXTO]` (eventos donde hay,
base donde falta). No exige sesiones.

**Health Score (configurable, 0–100):** suma ponderada con los pesos de
`config.health_weights` (NO hardcodeados en el front; viven en un objeto de config
en la función, y migran a tabla `metricas_config` en v2):
```
score = w.activado·(activado?1:0)
      + min(w.actividad_max, eventos_14d · w.actividad_14d)
      + min(w.cliente_max,   clientes_entraron · w.cliente_entrado)
      + (dias_sin_actividad ≤ 7 ? w.recencia_7d : dias_sin_actividad ≤ 14 ? w.recencia_14d : 0)
```
`estado = score≥70 verde · <40 riesgo · resto medio`. Fuente hoy `[MIXTO]`
(actividad reciente de eventos + señales base); objetivo `[EVENTO]` cuando estén
cableados sesiones/tareas/logins.

## 4. Índices recomendados en `eventos`

Ya creados (`eventos.sql`): `ts DESC`, `tipo`, `dominio`, `actor_email`,
`(entidad_tipo, entidad_id)`. Para escalar a cientos de miles / millones:

| Índice | Para qué | Prioridad |
|--------|----------|-----------|
| `(tipo, ts DESC)` | embudo por tipo dentro de ventana (query más caliente) | **alta** — agregar |
| `(actor_email, ts DESC)` | actividad/health por coach | **alta** — agregar |
| `entidad_id` | vincular cliente→coach (ClientInvited/Accepted) | media |
| BRIN en `ts` | rangos de fecha en tablas enormes (barato) | a futuro |

Además: cuando la tabla crezca, **particionar por mes** (`ts`) y/o mover a
agregados (§6). Migración aditiva `eventos_indices_scale.sql` cuando se apruebe.

## 5. Coste aproximado de las consultas

**Implementación actual (v1, fetch de filas):** trae hasta 20.000 filas (365 d) y
agrega en JS. Coste ≈ O(N) transferencia + O(N) memoria. Con ~20k filas son pocos
MB — aceptable **al inicio**. **No escala**: a millones de eventos no se pueden
traer todas las filas a la función.

**Optimizaciones (en orden de cuándo aplicarlas):**
1. **Agregar en SQL, no en JS.** Reemplazar el `SELECT *` por vistas/RPC que hagan
   `GROUP BY tipo`, counts por coach, etc. → devuelven agregados chicos, no filas.
   (Ej. `count=exact` con `HEAD` para los conteos base — barato.)
2. **Rollup diario** (`metricas_diarias`, cron nocturno): la función lee el rollup
   en O(1) en vez de recomputar. Patrón simple, sin dependencias nuevas.
3. **Partición + índices `(tipo, ts)`** para las pocas queries en vivo que queden.

Umbral sugerido para pasar de v1 a agregados SQL: **~50k eventos** o **p95 de la
función > 800 ms**.

## 6. Estrategia de caché

Los KPIs **no necesitan tiempo real** (un dashboard de CEO se mira cada tanto).

- **Fase 1 (ahora):** cálculo on-demand + **caché en el cliente** (el dashboard
  guarda la respuesta en `localStorage` con TTL ~10 min). Simple, sin backend
  extra. La función puede además mandar `Cache-Control` corto.
- **Fase 2 (escala):** **rollup diario** en `metricas_diarias` (cron). La función
  lee el rollup → respuesta O(1). El dashboard sigue consumiendo `metricas` igual
  (el contrato no cambia).
- **Invalidación:** el TTL del cliente + el refresco nocturno del rollup alcanzan.
  No hace falta invalidación por evento (los números toleran minutos/horas de
  retraso).

## 7. Campos reservados (para no romper el contrato al crecer)

- **`config.health_weights`** — los pesos ya son configurables. v2: moverlos a
  tabla `metricas_config` leída en runtime (el shape no cambia).
- **`kpis` es un mapa abierto** — agregar KPIs nuevos no rompe consumidores.
- **`coaches[]._reservado_v2`** — `activation_stage`, `wow_at`, `health_breakdown`
  (score por componente), `tendencia`, `segmento`. Hoy `null`; el dashboard lee
  solo lo que existe.
- **`eventos.payload` (JSONB)** — punto de extensión para señales de Health Score
  v2 (TaskCompleted, logins, chat) **sin migración de esquema**.
- **Nuevos tipos de evento** se agregan en `docs/domain-events.md` primero.

## 8. Tabla de migración — KPI → fuente actual → fuente futura → condición

Esta tabla también viaja en la respuesta (`fuentes[]`), para que el dashboard la
muestre y nadie olvide que el híbrido es temporal.

| KPI | Fuente actual | Fuente objetivo | Condición para migrar |
|-----|---------------|-----------------|-----------------------|
| Activación | `base_temporal` (usuarios/candidatos) | eventos | ≥8 semanas de eventos **y** cobertura ≥90% de coaches con `ProfileCompleted`/`ClientInvited` reales |
| Trial iniciado | `base_temporal` (usuarios) | eventos `TrialStarted` | `TrialStarted` cableado server-side + 4 semanas de histórico |
| WOW | `eventos` (`ClientAccepted`) | eventos | ✅ ya es eventos |
| Embudo implementación | `base_temporal` | eventos | cuando cada fase tenga su evento cableado y ≥8 semanas |
| Health Score | `mixto` | eventos | cuando sesiones/tareas/logins se emitan como eventos |
| Trial→Pago | `base_temporal` (estado_sub) | eventos (`TrialStarted`+`PaymentSucceeded`) | ambos cableados + 4 semanas |
| % perfil / % primer cliente | `mixto` | eventos | cobertura ≥90% |
| Mayor fuga | `base_temporal` | eventos | cuando el embudo sea 100% eventos |

**Definición de "migración terminada":** cero KPIs con `fuente != "eventos"`. Ahí
se puede borrar el código de fallback base y el híbrido desaparece.

## 9. Qué se retira (Legacy)

- El sub-tab **"Coaches → Analíticas"** de `panel-v2.html` (embudo + health
  calculados en el navegador) → marcar **Legacy** al construir el nuevo dashboard,
  retirar cuando esté validado. Una sola lógica.
- KPIs de pricing que leen `leads_pricing` (deprecado/vacío) → no portar.
