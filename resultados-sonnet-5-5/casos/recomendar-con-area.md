# recomendar-con-area · `recomendar-coach`

## Petición (sintética)

```json
{
  "objetivo": "Quiero mejorar mi perfil de LinkedIn para conseguir entrevistas en tecnología",
  "area": "carrera",
  "pais": "Argentina"
}
```

## sonnet-4-5 · main · repetición 1

HTTP 200 · API 2032 ms · tokens 507→116 · $0.0033 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "recomendados": [
    {
      "slug": "coach-carrera-cuatro",
      "nombre": "Coach Carrera Cuatro",
      "titulo": "Especialista en LinkedIn",
      "foto": null,
      "razon": "Se especializa en optimizar perfiles de LinkedIn para perfiles técnicos, justo lo que necesitas."
    },
    {
      "slug": "coach-carrera-uno",
      "nombre": "Coach Carrera Uno",
      "titulo": "Coach de carrera",
      "foto": null,
      "razon": "Te ayuda con transiciones profesionales en tecnología y preparación de entrevistas."
    }
  ]
}
```

## sonnet-4-5 · main · repetición 2

HTTP 200 · API 2272 ms · tokens 507→126 · $0.0034 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "recomendados": [
    {
      "slug": "coach-carrera-cuatro",
      "nombre": "Coach Carrera Cuatro",
      "titulo": "Especialista en LinkedIn",
      "foto": null,
      "razon": "Se especializa en optimizar perfiles de LinkedIn específicamente para perfiles técnicos como el tuyo."
    },
    {
      "slug": "coach-carrera-uno",
      "nombre": "Coach Carrera Uno",
      "titulo": "Coach de carrera",
      "foto": null,
      "razon": "Te ayuda a preparar entrevistas y acompaña transiciones en tecnología, complementando tu búsqueda laboral."
    }
  ]
}
```

## sonnet-5-5 · migrada · repetición 1

HTTP 200 · API 1700 ms · tokens 729→157 · $0.0030 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "recomendados": [
    {
      "slug": "coach-carrera-cuatro",
      "nombre": "Coach Carrera Cuatro",
      "titulo": "Especialista en LinkedIn",
      "foto": null,
      "razon": "Se especializa en optimizar perfiles de LinkedIn para perfiles técnicos, justo lo que necesitas para conseguir entrevistas en tecnología."
    },
    {
      "slug": "coach-carrera-uno",
      "nombre": "Coach Carrera Uno",
      "titulo": "Coach de carrera",
      "foto": null,
      "razon": "Acompaña transiciones profesionales en tecnología y te ayuda a preparar las entrevistas que tu perfil empiece a generar."
    }
  ]
}
```

## sonnet-5-5 · migrada · repetición 2

HTTP 200 · API 1835 ms · tokens 729→167 · $0.0031 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "recomendados": [
    {
      "slug": "coach-carrera-cuatro",
      "nombre": "Coach Carrera Cuatro",
      "titulo": "Especialista en LinkedIn",
      "foto": null,
      "razon": "Se especializa en optimizar perfiles de LinkedIn para perfiles técnicos, justo lo que buscas para conseguir entrevistas en tecnología."
    },
    {
      "slug": "coach-carrera-uno",
      "nombre": "Coach Carrera Uno",
      "titulo": "Coach de carrera",
      "foto": null,
      "razon": "Acompaña transiciones profesionales en tecnología y te ayuda a preparar entrevistas, un buen complemento cuando tu perfil empiece a generar contactos."
    }
  ]
}
```
