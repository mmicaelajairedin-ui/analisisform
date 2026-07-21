# Guía + cascada del coach — la base (no recrear, extender)

> Este documento deja **asentadas las bases** del sistema de guía y de la
> aparición escalonada de la interfaz, para que cuando se termine de construir
> se **extienda sobre esto** y no se rearme de cero (ni otra sesión ni una
> futura). Cada pieza dice **dónde vive en el código** y **qué guardrail la
> cuida**. Todo vive en `panel-v2.html` (panel único de los 3 nichos).

## La idea en una frase

El coach tiene que sentir que **él mueve el panel, no que el panel actúa solo**.
Cada cosa aparece **porque hizo algo antes**. Empezar simple, dar sensación de
completo, crecer sin romper.

## Tres reglas que gobiernan todo

1. **Reveal, nunca remove.** Se suma, casi nunca se saca. Lo que no se sacó no se
   puede romper.
2. **Se revela por una acción, no por un reloj ni un algoritmo.** El coach genera
   el diagnóstico → *eso* enciende el paso siguiente. El panel no se adelanta solo.
3. **Candado:** nunca ocultar algo que ya tiene datos. Ante la duda o un error de
   señal, **mostrar** (fail-safe). Así no se rompe a los coaches que ya trabajan.

## Arranque del coach (configurar → conectar → cliente)

Orden que sigue la guía: **1) configurar la cuenta** (foto, logo, nombre) →
**2) conectar todo** (Stripe, calendario) → **3) el cliente** (sumar, cargar
datos mientras llena el formulario, pegar el CV…).

- **Pasos base (medallas):** `STEPS` (7 pasos) + `coachPhaseData()` (3 fases:
  Perfil → Cliente → Sesión, cada una = medalla bronce/plata/oro). Derivan de
  datos reales (`computeSteps`, `coachPhaseData`).
- **La burbuja guía del sidebar:** `viewSidebar()` calcula `_gStep` (primera fase
  incompleta) y pega `.cp-guide-bubble` sobre el botón destino. Se **desactiva
  sola** al completar cada fase. La × la oculta (`pw_guide_off`).
- **La cabra (sendero gamificado):** `coachPath()` — misma 3 fases, ilustrado en
  el Resumen, con confeti al completar.

## Guía por cliente que se mueve sola (dentro de la ficha)

Después del arranque, la guía **sigue acompañando al coach con cada cliente**.

- **`_cliNextStep(c, tipo)`** → próximo paso con ese cliente, completo en los 3
  nichos (sigue el mismo dominó que `_CLI_CASCADE`):
  · carrera: diagnóstico (Análisis) → CV (Documentos).
  · fitness: análisis → rutina (Gym) → medición (Antropometría) → nutrición.
  · finanzas: análisis → plan (Finanzas) → meses (Gestión).
- En `viewClienteDetalle`: hint **`.cp-cli-next`** ("👉 Próximo paso: …") arriba
  de las pestañas + la pestaña destino **"respira"** (`_beacon()` → clase
  `.cp-guide-here`, latido dorado tipo Arcade), tanto en los chips como en el
  menú vertical.
- **Es aditivo**: solo resalta, no oculta nada.
- **Guardrail:** *"ficha del cliente: guía del próximo paso que se mueve sola"*.

## Cascada de pestañas (dominó — aparecen de a una, en orden)

Las pestañas del cliente aparecen **de a una** a medida que avanza (menos abrumo).

- **`_CLI_CASCADE`** = config por nicho: `base` (siempre visibles) + `chain`
  (orden de aparición, cada eslabón con su señal de datos real).
- **`_cliVisibleTabs(c, tipo, allTabs)`** = motor. El hito "Análisis publicado"
  abre el primer eslabón; cada siguiente se abre cuando el anterior **ya tiene
  datos**. Candado: `if(open || has) shown[tab]=true` → una pestaña con datos se
  muestra siempre. Ejemplos/demo: todas.
- Se aplica en la ficha (`viewClienteDetalle`) y en la barra móvil
  (`viewSidebar`). Si la pestaña activa quedó fuera → vuelve a Perfil.

| Nicho | Base (siempre) | Cadena (aparecen de a una) | Señal de datos de cada una |
|---|---|---|---|
| Carrera | Perfil · Análisis · Sesiones | Documentos → Acciones | `cvState==='published'`/`carta_presentacion` · `raw.etapas` |
| Fitness | Perfil · Análisis · Sesiones | Gym → Antropometría → Nutrición | `raw.fit_rutina` · `raw.fit_antro` · `raw.fit_nutricion`/`fit_nutri_log` |
| Finanzas | Perfil · Análisis · Sesiones | Finanzas → Gestión | `raw.fin_pres`/`fin_objetivos`/`fin_patrimonio`/`fin_deudas`/`fin_diagnostico`/`etapas` |

- **Señal de "vacío":** `reportState`/`cvState === 'pending'` = **vacío** (no cuenta
  como avance); solo `'published'` avanza.
- **No aplica a `multicoach.html`** (no tiene fichas de cliente con pestañas).
- **Guardrail:** *"ficha del cliente: pestañas en cascada dominó … en los 3 nichos"*
  (verifica `_CLI_CASCADE`, el candado `if(open || has)` y que cubra los 3 nichos).

## Convenciones que NO se tocan al extender

- **Español neutro (0 voseo)** en todo el copy visible (ej. "aquí", no "acá";
  "Genera", no "Generá"). Los comentarios de código no cuentan.
- **Número de KPI de "Mi negocio":** 32px / peso 700 (intermedio "por ahora"),
  igual en `panel-v2` (`_tile`) y `multicoach` (`.kpi .n`). Guardrail:
  *"número de KPI del panel en tamaño INTERMEDIO"*.
- **"Mi negocio" no muestra ceros:** cada KPI aparece solo si tiene valor; si
  todos son 0, no se muestra la tarjeta (`_tiles`).
- **Solicitudes vive DENTRO de Clientes** (misma página), no como vista aparte
  (`viewSolicitudes(embedded)`).
- **Orden de pestañas — Sesiones última en los 3 nichos.** Finanzas:
  Perfil · Análisis · Finanzas · Gestión · Sesiones (Gestión —fases/meses `etapas`
  + qué ve el cliente— va junto a Finanzas).
- **Emojis del panel en gris** (`.cp-emo`) — ver CLAUDE.md.

## Estado

**Hecho:**
- Arranque con burbuja guía + cabra (medallas).
- Guía por cliente que se mueve sola (`_cliNextStep`) — completa en los 3 nichos.
- Cascada de pestañas dominó en los 3 nichos (`_CLI_CASCADE`), con candado.
- Orden de finanzas (Gestión junto a Finanzas; Sesiones última en los 3 nichos).
- Ajuste demo: la foto que sube el coach en la cuenta demo se mantiene durante la
  sesión (solo en pantalla, sin guardar). Handler `#cfp-foto`, rama demo.
- "Mi negocio" sin ceros; Solicitudes dentro de Clientes; copy en neutro.
- **"+ Agregar paso" (finanzas · Gestión):** el coach arma SUS fases desde cero.
  Un cliente nuevo no muestra ninguna fase — solo "+ Agregar paso"; cada una que
  suma aparece (guardadas en `etapas`; `state.faseAdd` cuenta las filas agregadas
  sin guardar, por cliente; se resetea al abrir/guardar). Se quitó el esqueleto
  fijo de 4 (`Math.max(4,_gWk)`). Handlers: `fase-add`, `cli-savefases` (trima
  fases vacías del final). Guardrail: *"'+ Agregar paso' arma las fases desde cero"*.

**Pendiente (extender SOBRE esta base, no recrear):**
- **Replicar "+ Agregar paso" en carrera (pestaña Acciones/`_avanceHtml`) y en
  fitness (semanas de rutina):** hoy siguen usando su propio editor de fases con
  mínimo fijo. Mismo patrón que finanzas (arrancar vacío + `fase-add`), reusando
  `etapas`; no inventar UI nueva.

## Cómo extender sin recrear

1. Buscá primero la función/clase de la tabla de arriba: casi todo se hace
   **sumando a `_CLI_CASCADE`, `_cliNextStep` o `coachPhaseData`**, no con UI nueva.
2. Toda pieza nueva de guía/cascada suma su **regla de guardián** (convención del
   proyecto) para que no se pierda en un refactor ni la recree otra sesión.
3. Correr antes de commitear:
   `node scripts/check-syntax.js && node scripts/check-smoke.js && node scripts/check-guardrails.js && node scripts/check-parity.js`
