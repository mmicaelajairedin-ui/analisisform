# Especificación — edge function `metricas` (Dashboard CEO · Nivel 1)

> **Estado:** aprobada con ajustes (v2). Base para revisar `metricas` y construir el
> Dashboard CEO (que será **solo un consumidor** de esta API, sin lógica de negocio).
> **Principios:** una sola fuente backend; cero cálculo en el front; **híbrido SOLO
> transitorio**; cada KPI declara fuente + plan de migración + **estado**; embudo
> redefinido al workflow real de Pathway OS; Health Score por dimensiones.

## 0. Regla anti-híbrido-permanente

Ningún KPI puede quedarse indefinidamente en `base_temporal`. **Cada KPI tiene un
plan de migración a eventos con un estado explícito:**

- 🔴 **no computable aún** — falta cablear el/los eventos.
- 🟡 **híbrido/temporal** — hoy se calcula de tablas base o mixto.
- 🟢 **migrado** — se calcula 100% de eventos.

"Migración terminada" = **todos los KPIs en 🟢**. Ahí se borra el código de fallback
base y el híbrido desaparece.

## 1. Contrato de la API

- **Método:** `POST /functions/v1/metricas`
- **Auth:** JWT de admin (`usuarios.rol='admin'` por email o auth_id, gate de
  `admin-coach-op`). Sin admin → `403`. Nadie lee con anon key.
- **Body (opcional):** `{ "dias": number }` — ventana (default 30, 1–365).
- **Respuesta:** `200` con el JSON del §2.

## 2. JSON Schema de la respuesta

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["ok","generado_at","ventana_dias","config","kpis","embudo","coaches","tiempos","resumen","fuentes"],
  "properties": {
    "ok": { "type": "boolean" },
    "generado_at": { "type": "string", "format": "date-time" },
    "ventana_dias": { "type": "integer", "minimum": 1, "maximum": 365 },

    "config": {
      "type": "object",
      "description": "Configuración viva (nunca hardcodeada en el front).",
      "properties": {
        "activado_requiere": { "type": "array", "items": { "type": "string" } },
        "health": {
          "type": "object",
          "description": "Health Score por DIMENSIONES. Cada dimensión tiene un peso global y pesos internos de sus señales. Cambiar una dimensión no toca las demás.",
          "properties": {
            "dimensiones": {
              "type": "object",
              "properties": {
                "activacion": { "$ref": "#/definitions/dimension" },
                "uso":        { "$ref": "#/definitions/dimension" },
                "clientes":   { "$ref": "#/definitions/dimension" },
                "recencia":   { "$ref": "#/definitions/dimension" }
              }
            }
          }
        }
      }
    },

    "kpis": {
      "type": "object",
      "description": "Mapa abierto. Cada KPI declara valor + fuente + objetivo + condición + estado.",
      "additionalProperties": { "$ref": "#/definitions/kpi" }
    },

    "embudo": {
      "type": "array",
      "description": "Embudo de activación de Pathway OS (event-native), en orden.",
      "items": {
        "type": "object",
        "required": ["fase","label","valor","fuente","estado"],
        "properties": {
          "fase":             { "type": "string" },
          "label":            { "type": "string" },
          "evento":           { "type": ["string","null"], "description": "evento de dominio que la representa" },
          "valor":            { "type": "integer" },
          "pct_del_total":    { "type": ["number","null"] },
          "pct_del_anterior": { "type": ["number","null"] },
          "fuente":           { "type": "string", "enum": ["eventos","base_temporal","mixto"] },
          "estado":           { "type": "string", "enum": ["🔴","🟡","🟢"] }
        }
      }
    },

    "coaches": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["email","activado","health_score","health_dim","estado","velocidad","fuente"],
        "properties": {
          "email":              { "type": "string" },
          "nombre":             { "type": ["string","null"] },
          "perfil":             { "type": "boolean" },
          "invitados":          { "type": "integer" },
          "clientes_entraron":  { "type": "integer" },
          "activado":           { "type": "boolean" },
          "eventos_14d":        { "type": "integer" },
          "dias_sin_actividad": { "type": "integer" },
          "health_score":       { "type": "integer", "minimum": 0, "maximum": 100 },
          "health_dim":         {
            "type": "object",
            "description": "Score 0-100 por dimensión (breakdown), para ver POR QUÉ un coach está en riesgo.",
            "properties": {
              "activacion": { "type": "number" }, "uso": { "type": "number" },
              "clientes":   { "type": "number" }, "recencia": { "type": "number" }
            }
          },
          "estado":             { "type": "string", "enum": ["verde","medio","riesgo"] },
          "velocidad":          { "type": ["string","null"], "enum": ["<1d","1-3d","4-7d",">7d","nunca",null], "description": "Activation Velocity: qué tan rápido se activó" },
          "ttv_horas":          { "type": ["number","null"], "description": "Time To Value: horas desde alta hasta WOW. null si no computable." },
          "ttfc_horas":         { "type": ["number","null"], "description": "Time to First Client." },
          "ttfs_horas":         { "type": ["number","null"], "description": "Time to First Session." },
          "ttfp_horas":         { "type": ["number","null"], "description": "Time to First Payment (reservado)." },
          "fuente":             { "type": "string", "enum": ["eventos","base_temporal","mixto"] },
          "_reservado_v2": {
            "type": "object",
            "description": "RESERVADO para Activation Engine y Health Score v2. Hoy null.",
            "properties": {
              "activation_stage": { "type": ["string","null"] },
              "wow_at":           { "type": ["string","null"], "format": "date-time" },
              "tendencia":        { "type": ["string","null"] },
              "segmento":         { "type": ["string","null"] }
            }
          }
        }
      }
    },

    "tiempos": {
      "type": "object",
      "description": "Métricas temporales agregadas (medianas). null/🔴 si aún no computables.",
      "properties": {
        "ttv":               { "$ref": "#/definitions/kpi" },
        "time_first_client": { "$ref": "#/definitions/kpi" },
        "time_first_session":{ "$ref": "#/definitions/kpi" },
        "time_first_payment":{ "$ref": "#/definitions/kpi" },
        "activation_velocity": {
          "type": "object",
          "description": "Distribución de la velocidad de activación.",
          "properties": {
            "buckets": { "type": "object", "description": "{ '<1d': n, '1-3d': n, '4-7d': n, '>7d': n, 'nunca': n }" },
            "fuente":  { "type": "string" }, "estado": { "type": "string" }
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
      "description": "Tabla de migración con ESTADO. Viaja en la respuesta para que el dashboard la muestre.",
      "items": {
        "type": "object",
        "required": ["kpi","fuente_actual","fuente_objetivo","condicion","estado"],
        "properties": {
          "kpi":             { "type": "string" },
          "fuente_actual":   { "type": "string", "enum": ["eventos","base_temporal","mixto"] },
          "fuente_objetivo": { "type": "string", "enum": ["eventos"] },
          "condicion":       { "type": "string" },
          "estado":          { "type": "string", "enum": ["🔴","🟡","🟢"] }
        }
      }
    }
  },

  "definitions": {
    "kpi": {
      "type": "object",
      "required": ["valor","unidad","fuente","objetivo","migrar_cuando","estado"],
      "properties": {
        "valor":         { "type": ["number","string","null"] },
        "unidad":        { "type": "string", "enum": ["count","pct","eur","horas","texto"] },
        "label":         { "type": "string" },
        "fuente":        { "type": "string", "enum": ["eventos","base_temporal","mixto"] },
        "objetivo":      { "type": "string", "enum": ["eventos"] },
        "migrar_cuando": { "type": "string" },
        "estado":        { "type": "string", "enum": ["🔴","🟡","🟢"] }
      }
    },
    "dimension": {
      "type": "object",
      "properties": {
        "peso":    { "type": "number", "description": "peso de la dimensión en el total (los 4 suman 100)" },
        "señales": { "type": "object", "description": "pesos internos configurables de las señales de la dimensión" }
      }
    }
  }
}
```

## 3. Embudo de activación redefinido (Pathway OS, event-native)

No copiamos el embudo histórico. Medimos el **proceso real de activación**. Cada
fase mapea a un evento de dominio; hoy algunas se calculan de tablas base y migran
a eventos según el estado.

| # | Fase | Evento | Fuente hoy | Estado |
|---|------|--------|-----------|--------|
| 1 | Lead | `LeadCreated` | base (contactos_chat/leads) | 🔴→🟡 |
| 2 | Demo | cita `demo_pathway` | base (`citas`) | 🟡 |
| 3 | Trial Started | `TrialStarted` | base (`usuarios`) | 🔴 |
| 4 | Profile Completed | `ProfileCompleted` | eventos (+ base fallback) | 🟡 |
| 5 | Stripe Connected | `StripeConnected` | base (`configuracion.stripe_account_id`) | 🔴 |
| 6 | First Client Invited | `ClientInvited` | eventos | 🟡→🟢 |
| 7 | First Client Accepted | `ClientAccepted` | eventos | 🟢 |
| 8 | First Session OR Task | `SessionCompleted`∨`TaskCompleted` | eventos (session) | 🟡 |
| 9 | WOW Reached | derivado (cliente entró + interacción) | eventos | 🟡 |
| 10 | Subscription Paid | `PaymentSucceeded` | base (`estado_sub`) | 🔴 |
| 11 | Retained (30 d) | actividad a +30 d del pago | base | 🔴 |

## 4. KPIs y las 8 preguntas de negocio

| KPI (key) | Pregunta | Fórmula | Fuente / Estado |
|-----------|----------|---------|-----------------|
| `trials_semana` | ¿coaches que empezaron trial esta semana? | conteo fase 3 en la ventana | base 🔴 |
| `wow_semana` | ¿cuántos llegaron al WOW? | conteo fase 9 en la ventana | eventos 🟡 |
| `atascados_onboarding` | ¿cuántos atascados en onboarding? | en trial, fase ≥3 pero < WOW | mixto 🟡 |
| `pct_perfil` | ¿% completa el perfil? | fase4 ÷ fase3 | mixto 🟡 |
| `pct_primer_cliente` | ¿% invita al primer cliente? | fase6 ÷ fase3 | eventos 🟡 |
| `pct_trial_pago` | ¿% convierte trial en pago? | fase10 ÷ fase3 | base 🔴 |
| `activacion_pct` | (núcleo) activados ÷ total | — | mixto 🟡 |
| `coaches_riesgo` | ¿coaches con mayor riesgo? | `coaches` estado=riesgo, health asc | mixto 🟡 |
| `mayor_fuga` | ¿mayor fuga del embudo? | fase con mayor caída % vs anterior | mixto 🟡 |

## 5. Health Score por dimensiones (configurable)

`score = Σ dimensión_score(0-100) · peso/100`. Pesos por defecto (todos editables):

| Dimensión | Peso | Score 0-100 (con señales internas configurables) |
|-----------|:----:|--------------------------------------------------|
| **Activación** | 40 | `perfil·40 + (invitó>0)·30 + (cliente-entró>0)·30` |
| **Uso** | 30 | `min(100, eventos_14d · K_uso)` (K_uso configurable) |
| **Clientes** | 20 | `min(100, clientes_entraron · K_cli)` |
| **Recencia** | 10 | `≤7d→100 · ≤14d→50 · resto→0` (umbrales configurables) |

`estado = score≥70 verde · <40 riesgo · resto medio`. Se devuelve también el
**breakdown por dimensión** (`health_dim`) para ver POR QUÉ un coach está en riesgo.
Cambiar una dimensión entera (peso o señales) no toca las otras. Config en la
función (v2: tabla `metricas_config`).

## 6. Métricas temporales (oro para optimizar onboarding)

Todas parten del **alta del coach** (`usuarios.created_at`, base) hasta un evento.
**Sólo son fiables para cohortes posteriores al event bus** (un coach viejo tiene
`created_at` antiguo y su primer evento es reciente → tiempo inflado). Por eso hoy
son 🟡/🔴: se computan donde tiene sentido, y se dejan los campos reservados.

| Métrica | Definición | Fuente / Estado |
|---------|-----------|-----------------|
| **Time To Value (TTV)** | alta → WOW (fase 9) | mixto 🟡 (created_at + evento WOW) |
| **Time to First Client** | alta → `ClientInvited` | mixto 🟡 |
| **Time to First Session** | alta → `SessionCompleted` | mixto 🟡 |
| **Time to First Payment** | alta → `PaymentSucceeded` | 🔴 (falta el evento; campo reservado) |
| **Activation Velocity** | por coach: alta → activado, en buckets `<1d / 1-3d / 4-7d / >7d / nunca` | mixto 🟡 |

Objetivo de todas: cuando `TrialStarted`/`PaymentSucceeded` estén cableados, el
origen del tiempo pasa del alta al `TrialStarted` (más preciso) → 🟢.

## 7. Índices recomendados en `eventos`

Ya: `ts DESC`, `tipo`, `dominio`, `actor_email`, `(entidad_tipo,entidad_id)`.
Agregar al escalar: **`(tipo, ts DESC)`** (embudo) y **`(actor_email, ts DESC)`**
(health/tiempos por coach). A futuro: BRIN en `ts`, partición por mes.

## 8. Coste y caché

- **v1 (trae filas):** hasta ~20k filas/365d, agrega en JS. Sirve hasta **~50k
  eventos** o **p95 > 800 ms**. Después: **agregar en SQL** (vistas/RPC con
  `GROUP BY`, `count=exact` con HEAD para conteos base) y **rollup diario**
  (`metricas_diarias`, cron) → función O(1). El contrato NO cambia.
- **Caché:** Fase 1 → cliente con TTL ~10 min. Fase 2 → rollup nocturno. Los KPIs
  toleran minutos/horas de retraso; no hace falta invalidación por evento.

## 9. Campos reservados (contrato a prueba de futuro)

- `config.health.dimensiones` — dimensional y configurable; v2 → tabla config.
- `kpis` y `tiempos` — mapas/objetos abiertos; agregar no rompe consumidores.
- `coaches[]._reservado_v2` — `activation_stage`, `wow_at`, `tendencia`, `segmento`.
- Campos temporales por coach (`ttv_horas`, `ttfc_horas`, `ttfs_horas`,
  `ttfp_horas`) — hoy null donde no computable, ya en el contrato.
- `eventos.payload` (JSONB) — señales de Health v2 (TaskCompleted, logins, chat)
  sin migración de esquema.

## 10. Tabla de migración (con estado) — resumen

| KPI | Fuente actual | Objetivo | Condición | Estado |
|-----|---------------|----------|-----------|:------:|
| WOW / First Client Accepted | eventos | eventos | — | 🟢 |
| Activación | mixto | eventos | todos los eventos de fase implementados + 8 sem | 🟡 |
| % perfil / % primer cliente | mixto | eventos | cobertura ≥90% | 🟡 |
| Health Score | mixto | eventos | Health v2 (sesiones/tareas/logins como eventos) | 🟡 |
| Embudo (fases 1,3,5,10,11) | base_temporal | eventos | cablear `LeadCreated`/`TrialStarted`/`StripeConnected`/`PaymentSucceeded` | 🔴 |
| Trial → Pago | base_temporal | eventos | `TrialStarted`+`PaymentSucceeded` + 90 días de datos | 🟡 |
| TTV / TtFClient / TtFSession | mixto | eventos | origen desde `TrialStarted` + cohorte post-bus | 🟡 |
| Time to First Payment | — | eventos | cablear `PaymentSucceeded` | 🔴 |

## 11. Qué se retira (Legacy)

- Sub-tab **"Coaches → Analíticas"** de `panel-v2.html` (embudo + health en el
  navegador) → marcar **Legacy** al construir el nuevo dashboard, retirar cuando
  esté validado. **Una sola lógica, en el backend.**
- KPIs de pricing sobre `leads_pricing` (deprecado/vacío) → no portar.
