# Changelog — Loop cerrado · efectividad de los nudges

**Fecha:** 2026-07-27
**Fase:** Pathway OS · Nivel 2 (Automation) — medición
**Rama:** `claude/n8n-business-workflow`

Cierra el loop de Workflow Intelligence: **nudge → evento → ¿avanzó?**. No basta
con mandar el empujón; ahora medimos si el coach **dio el paso después** de recibirlo.

## Cómo se mide (event-native)
Por cada nudge de etapa enviado (`coach_nudges.plantilla_id` = `stage_*`, con su
`sent_at`), se busca si el coach emitió el **evento del paso con `ts > sent_at`**:

| Nudge | Paso cumplido = evento |
|-------|------------------------|
| `stage_perfil` | `ProfileCompleted` |
| `stage_stripe` | `StripeConnected` |
| `stage_invitar` | `ClientInvited` |
| `stage_cliente` | cliente entró (`candidatos.consent_at > sent_at`) |

Atribución limpia: solo cuenta el avance **posterior** al nudge. Solo coaches
vivos (el índice por id excluye suspendidos/eliminados, igual que el resto).

## Agregado
- **`metricas`**: lee `coach_nudges`, calcula `nudges: [{paso, evento, enviados,
  avanzaron, pct, fuente:"eventos", estado}]`. Reusa los eventos que ya lee.
- **Panel** (tab Analíticas): tarjeta **"Efectividad de los nudges"** — por paso,
  `enviados → avanzaron (pct%)` con barra. Consumidor puro de `metricas`, cero
  cálculo en el front. Empty-state honesto si aún no se envió ninguno.
- Spec + guardrail (metricas devuelve `nudges`, el panel muestra la tarjeta).

## Validación
- 4 checks CI en verde (174 reglas).
- Los números reales aparecen a medida que el cron mande nudges y los coaches
  avancen (o no) — la tarjeta arranca vacía y se llena sola.

## Para leer el resultado
- **pct alto** (verde) → ese empujón funciona: la gente lo recibe y avanza.
- **pct bajo** (rojo) → el empujón no mueve; ahí conviene iterar el copy/timing
  o revisar si el paso tiene fricción real.
