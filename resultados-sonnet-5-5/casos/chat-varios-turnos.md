# chat-varios-turnos · `ia-pathway`

## Petición (sintética)

```json
{
  "mode": "cliente",
  "messages": [
    {
      "role": "user",
      "content": "Hola, ¿dónde veo mi CV?"
    },
    {
      "role": "assistant",
      "content": "Lo encontrás en tu portal, en la sección de documentos."
    },
    {
      "role": "user",
      "content": "Gracias. ¿Y cómo agendo una sesión?"
    }
  ]
}
```

## sonnet-4-5 · main · repetición 1

HTTP 200 · API 1428 ms · tokens 851→38 · $0.0031 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "reply": "Usá el link de reservas/calendario que te compartió tu coach. Si no lo tenés a mano, pedíselo por el chat del portal.",
  "escalate": false
}
```

## sonnet-4-5 · main · repetición 2

HTTP 200 · API 1562 ms · tokens 851→41 · $0.0032 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "reply": "Usa el link de reservas o calendario que te dejó tu coach en el portal. Si no lo ves, escríbele por el chat y te lo pasa.",
  "escalate": false
}
```

## sonnet-5-5 · migrada · repetición 1

HTTP 200 · API 1331 ms · tokens 1151→63 · $0.0029 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "reply": "Para agendar una sesión usas el link de reservas o calendario que te dejó tu coach. Si no lo encuentras a mano, escríbele por el chat y te lo reenvía.",
  "escalate": false
}
```

## sonnet-5-5 · migrada · repetición 2

HTTP 200 · API 1595 ms · tokens 1151→86 · $0.0032 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "reply": "Para agendar una sesión, usa el link de reservas o calendario que te dejó tu coach. Ahí eliges el horario que mejor te acomode. Si no encuentras ese link, escríbele a tu coach por el chat y te lo reenvía.",
  "escalate": false
}
```
