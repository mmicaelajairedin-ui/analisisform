# Sonnet 4.5 (main) contra Sonnet 5.5 (migrada)

Fecha: 2026-11-07T23:16:52.749Z · referencia: `b39f024` · repeticiones: 1

| Brazo | Llamadas | Estructura OK | ≠200 | Rechazos | Cortadas | Latencia p50 | p90 | Coste |
|---|---|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 2 | 0 | 1 | 0 | 0 | null ms | null ms | $0.0000 |
| sonnet-5-5 · migrada | 2 | 0 | 1 | 0 | 0 | null ms | null ms | $0.0000 |

## Caso por caso

### informe-carrera · `generar-informe`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 500 | ✗ status 500 | - | - | - |
| sonnet-5-5 · migrada | 1 | 500 | ✗ status 500 | - | - | - |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "error": "Error: Claude API 599: {\"error\":{\"type\":\"omitida_por_presupuesto\"}}"
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "error": "Error: Claude API 599: {\"error\":{\"type\":\"omitida_por_presupuesto\"}}"
}
```
</details>

### chat-coach · `ia-pathway`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✗ reply = respaldo de error; error: Error: claude_599: {"error":{"type":"omitida_por_presupuesto"}} | - | - | - |
| sonnet-5-5 · migrada | 1 | 200 | ✗ reply = respaldo de error; error: Error: claude_599: {"error":{"type":"omitida_por_presupuesto"}} | - | - | - |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "reply": "Ahora mismo no puedo responderte.",
  "escalate": true,
  "error": "Error: claude_599: {\"error\":{\"type\":\"omitida_por_presupuesto\"}}"
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "reply": "Ahora mismo no puedo responderte.",
  "escalate": true,
  "error": "Error: claude_599: {\"error\":{\"type\":\"omitida_por_presupuesto\"}}"
}
```
</details>
