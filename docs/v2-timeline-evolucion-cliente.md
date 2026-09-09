# V2 — Ficha / Timeline de evolución del cliente (NO IMPLEMENTADO)

> **Estado: RESERVADO PARA V2. No hay nada de esto en el código.**
> Documento escrito en el cierre de la reconversión del nicho Finanzas → **Life**
> (septiembre 2026) para dejar la idea registrada sin abrir trabajo nuevo.
> Nadie debe empezar esto sin que el Product Owner lo priorice explícitamente.

## Qué sería

Una vista única, por cliente, que cuenta su recorrido completo en orden
cronológico — no una lista de secciones sueltas, sino **una sola línea de tiempo**:

```
Inicio → Objetivo → Sesión → Insight → Acción → Seguimiento → Nueva sesión → Evolución
```

Hoy esos datos YA existen, pero repartidos en cuatro sitios distintos del portal
y del panel. La V2 no inventaría datos nuevos: los uniría en una sola vista.

## Por qué NO se hizo ahora

1. El MVP de Life ya cubre el ciclo completo (objetivos → próximos pasos →
   sesiones → seguimiento). El timeline es **valor añadido, no funcionalidad
   faltante**: sin él el nicho es usable de punta a punta.
2. Construirlo bien exige un modelo de eventos propio (`proc_eventos` o similar)
   y decisiones de producto que todavía no están tomadas.
3. La regla del sprint era **cerrar**, no ampliar el alcance.

## De dónde saldrían los datos (todo ya existe)

| Hito del timeline | Fuente actual | Estado |
|---|---|---|
| Inicio | `candidatos.created_at` + intake (`objetivo`, `situacion`) | ✅ existe |
| Objetivo | `candidatos.proc_objetivos[].nombre` + `.porque` | ✅ existe |
| Sesión | `candidatos.sesiones_registro[]` (`fecha`, `trabajado`, `acordado`) | ✅ existe |
| Insight | — | ❌ **no existe**: hoy no hay dónde registrar un insight |
| Acción | `proc_objetivos[].pasos[]` (`txt`, `done`) | ✅ existe |
| Seguimiento | `candidatos.proc_seguimiento[]` (`fecha`, `texto`, `hecho`) | ✅ existe |
| Evolución | derivable del histórico de `pasos` completados y `estado` | ⚠️ derivable, no persistido |

**El único hueco real es "Insight"** y el hecho de que hoy no se guarda *cuándo*
cambió cada cosa (los `pasos` guardan `done`, no la fecha en que se marcó).

## Qué haría falta (estimación, NO un plan aprobado)

1. **Un modelo de eventos con fecha.** Sin timestamps no hay timeline: hoy
   `pasos[].done` es un booleano sin fecha. Mínimo: añadir `done_at` al marcar
   un paso, y persistir `insight` por sesión en `sesiones_registro`.
2. **Una vista de timeline** en el portal del cliente y en la ficha del panel,
   reusando los estilos `.tl-item` que ya existen.
3. **Recién entonces, la capa de IA**, que es lo que le daría el valor
   diferencial:
   - resumir la evolución del cliente en lenguaje natural,
   - detectar temas recurrentes entre sesiones,
   - preparar la próxima sesión (qué revisar, qué quedó abierto),
   - sugerir el siguiente seguimiento.

   La infraestructura para esto ya está: `generar-informe` (Edge Function) y el
   chat `pw-ia-chat.js` con `PW_IA_CFG.context`. Sería un prompt nuevo, no una
   arquitectura nueva.

## Riesgo a tener presente

Es un nicho de **acompañamiento personal**: un resumen automático de la evolución
de una persona es material sensible. Antes de implementarlo hay que decidir
quién lo ve (¿solo el coach? ¿también el cliente?) y dejarlo cubierto en el
consentimiento del intake, que hoy no lo contempla.
