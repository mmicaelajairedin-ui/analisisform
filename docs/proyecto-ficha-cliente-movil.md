# Proyecto — Ficha del cliente en móvil (app del coach)

> **Alcance:** rediseño de la **ficha del cliente** dentro del panel del coach
> (`panel-v2.html`) **solo para pantallas angostas (móvil)**. En desktop la ficha
> no cambia. Es la vista que se abre al tocar un cliente en la pantalla "Clientes".
>
> **Estado:** documento de proyecto para evaluar ANTES de tocar el panel real.
> Complementa a `docs/rediseno-ficha.md` (rediseño general); este se enfoca en móvil.
>
> **Regla de oro:** la ficha es **multi-nicho** (Carrera · Fitness · Financiero) y
> cada nicho tiene secciones distintas. Cualquier diseño móvil tiene que funcionar
> para los tres sin mezclarlos.

---

## 1. Por qué este proyecto

Hoy, en móvil, la ficha del cliente:
- Esconde el sidebar y apila **todo en una sola columna**.
- El menú de tabs (que en desktop está a la izquierda) pasa a una **fila horizontal
  de botones debajo del header** que se desborda y obliga a hacer scroll lateral.
- El riel derecho ("Proceso" + medalla + acciones rápidas) cae **al final del
  scroll**, así que para mandar un WhatsApp o activar/desactivar al cliente hay que
  bajar toda la página.
- No hay barra de navegación fija: se navega scrolleando, y es fácil perderse.

La coach trabaja **mucho desde el celular** (habla con leads, prepara demos, revisa
clientes sobre la marcha). La ficha tiene que sentirse como una **app**, no como una
página de escritorio apretada.

### Objetivo
Que desde el celular la coach pueda, en pocos toques y sin perderse:
1. Entender **quién es** el cliente y **en qué punto** del proceso está.
2. Saber **cuál es el próximo paso** con ese cliente.
3. Hacer lo más frecuente sin scrollear: **escribir por WhatsApp / mandar plantilla**.
4. Entrar a cualquier sección (Análisis, Documentos, Sesiones, las del nicho) y ver
   **solo el contenido de esa sección**, limpio.

### Fuera de alcance (por ahora)
- El portal del cliente (`cliente.html`, `pathway-fit-cliente.html`, etc.).
- La versión desktop de la ficha.
- Convertir la plataforma en PWA instalable (proyecto aparte, ver `PENDIENTE`).
- Cambios de datos / Supabase: este proyecto es **solo de UI/UX**, no toca columnas.

---

## 2. Principios de diseño (móvil)

1. **Una cosa por pantalla.** Cada sección muestra solo su contenido. El "Proceso /
   medalla / score" vive **solo en Perfil**, no en todas las pantallas.
2. **Lo urgente, siempre a mano.** Header fijo con foto + nombre + acceso a WhatsApp.
   Barra de navegación fija abajo (no scroll lateral de tabs).
3. **Próximo paso visible.** En Perfil, un bloque "Próximo paso" que dice la única
   acción urgente con ese cliente (ej. "Generá el informe", "Agendá la 1ª sesión").
4. **Jerarquía de botones.** Verde sólido solo para lo urgente; el resto, suave.
5. **On-brand.** Verde bosque Pathway, tipografías del sistema (Fraunces + Inter),
   emojis de la interfaz **en gris** (`.cp-emo`), salvo los de contenido (💪⭐🍎,
   banderas, medallas) que van a color.
6. **Sin romper desktop.** Todo el rediseño vive detrás de `@media (max-width:900px)`
   (o el breakpoint que ya usa el panel). Desktop queda idéntico.

---

## 3. Arquitectura de navegación en móvil

```
┌─────────────────────────────┐
│  HEADER FIJO (sticky top)   │  ‹ Clientes · foto · Nombre · 📲 WhatsApp
├─────────────────────────────┤
│                             │
│   CONTENIDO DE LA SECCIÓN   │  ← scrolleable, una sección a la vez
│   (cambia según la tab)     │
│                             │
├─────────────────────────────┤
│  BOTTOM NAV FIJA (sticky)   │  ← tabs del NICHO (3 a 6 según nicho)
└─────────────────────────────┘
```

### 3.1 Header fijo
- `‹ Clientes` (volver a la lista) — `data-act="cli-back"`.
- Foto del cliente + Nombre.
- Ícono **📲 WhatsApp** (acceso directo al chat con ese cliente).
- (Opcional) menú "⋯" con: Ver su portal, Mensajes/plantillas, Activar/Desactivar.

### 3.2 Bottom nav (depende del nicho)
Los tabs son los que ya define `_cliTabs(tipo)`. En móvil se muestran como barra fija
con emoji gris + label corto.

| Nicho | Tabs en la bottom nav |
|-------|------------------------|
| **Carrera** | 👤 Perfil · 📋 Análisis · ✅ Acciones · 📄 Docs · 📅 Sesiones |
| **Fitness** | 👤 Perfil · 📋 Análisis · 🏋️ Gym · 📏 Antrop. · 🥗 Nutrición · 📅 Sesiones |
| **Financiero** | 👤 Perfil · 📋 Análisis · 💶 Finanzas · 📅 Sesiones · ⚙️ Gestión |

> **Problema a resolver:** Fitness tiene 6 tabs — demasiados para una bottom nav
> cómoda. **Decisión propuesta:** mostrar 5 fijos y agrupar el menos usado en un "⋯ Más",
> o usar scroll horizontal SOLO en la bottom nav (con indicadores). A validar en el mockup.

### 3.3 Acciones que NO son tabs
- **WhatsApp** → ícono fijo en el header.
- **Mensajes / plantillas** → se abre como **hoja inferior (bottom sheet)** desde el
  header o desde Perfil, no ocupa una tab.
- **Ver su portal** → botón en Perfil + en el menú "⋯".

---

## 4. Pantalla por pantalla (con la info real)

> Notación: `candidatos.raw.*` = campos del formulario guardados en la tabla
> `candidatos`. `informes.data` = JSON del informe IA. `cv_publicados` = CV. Todo esto
> ya existe; el proyecto solo redibuja cómo se ve en móvil.

### 4.1 PERFIL (todos los nichos) — la pantalla "home" del cliente

Es la única pantalla que muestra el **estado del proceso**. Estructura de arriba a abajo:

1. **Tarjeta "Proceso"** (lo que hoy está en el riel derecho):
   - Medalla actual (Bronce/Plata/Oro) + barra de progreso a la siguiente.
   - Estado CV / Informe (Publicado · A revisar · Falta).
   - Semana/Mes activo (ej. "Semana 3 de 4").
   - Fuente: `c.medal`, `c.cvState`, `c.reportState`, `c.week`.

2. **Bloque "Próximo paso"** *(nuevo)* — una sola acción urgente, calculada del estado:
   - Sin informe → "Generá el diagnóstico".
   - Informe listo, sin CV → "Generá el CV".
   - Sin sesiones → "Agendá la primera sesión".
   - Todo al día → "Mandá la plantilla de nueva semana".

3. **Datos del cliente** (varían por nicho):

   **Carrera** — `candidatos` / `raw`:
   - Nombre, Email, WhatsApp, LinkedIn
   - Rol/Cargo actual, Rol que busca, Sector, Experiencia
   - Situación, Urgencia, Ciudad, Modalidad
   - Educación, Idiomas
   - Objetivo, Logro destacado, Algo importante fuera del CV, Obstáculos

   **Fitness** — `raw`:
   - Nombre, WhatsApp, Edad
   - Objetivo principal, Nivel, Días/semana, Dónde entrena, Equipamiento
   - Altura, Peso inicial
   - Lesiones, Medicación, Restricciones, Nutrición actual, Obstáculos

   **Financiero** — `raw`:
   - Nombre, WhatsApp, Edad
   - Objetivo principal, Plazo
   - Ingresos mensuales, Gastos mensuales, Deuda total
   - Ahorro actual, Meta de ahorro
   - Obstáculos, Extra

4. **Acciones rápidas** (botones suaves al pie): Ver su portal · Mensajes ·
   Activar/Desactivar cliente (`cli-reactivate`/`cli-deactivate`).

5. **(Solo Fitness)** Calendario del mes (`_coachCalHtml`): días con gym 💪 / hábitos ⭐
   / nutrición 🍎 y marcas de medición. + comparativa de los últimos 4 meses.
   → En móvil va **después** de los datos, no compite con el header.

---

### 4.2 ANÁLISIS (todos los nichos) — el diagnóstico IA

Fuente: `informes.data` (`c.inf.d`).

- **Resumen ejecutivo** (`resumen_ejecutivo`).
- **Scorecard**: puntajes 0–100 por categoría (chips/barras).
- Contenido según nicho:
  - **Carrera:** acciones por categoría (CV, LinkedIn, Networking, Preguntas).
  - **Fitness:** diagnóstico de forma física + recomendaciones de entrenamiento.
  - **Financiero:** diagnóstico financiero + presupuesto recomendado.
- **Si no hay informe** → estado vacío con botón **"Generar"** (abre hoja inferior para
  pegar el material — `genmat:*`). Nada de placeholders grises.

---

### 4.3 ACCIONES / AVANCE (solo Carrera) — `_avanceHtml`

- Progreso "X/Y acciones completadas".
- Lista de acciones con checkboxes (el cliente las ve como sus tareas/logros).
- Opcional: agrupar por etapas; nombres de etapa editables por el coach.
- Chip para cambiar la etapa actual.
- Fuente: `informes.data.*_acciones`, `candidatos.raw.acciones_progreso`,
  `candidatos.raw.etapas`, `state.cliWeek`.
- Acciones: agregar/quitar acción, marcar checkbox, guardar etapas, guardar avance.

---

### 4.4 DOCUMENTOS (solo Carrera)

Tres tarjetas (CV · Carta · LinkedIn), cada una con:
- Estado (Publicado / A revisar / Borrador) — `c.cvState`, `c.reportState`,
  existencia de `raw.linkedin_analisis`.
- Botón **Generar** (`genmat:cv|carta|linkedin`).
- **Abrir editor** (nueva pestaña a `/cv.html?email=` · `/carta.html?email=`).
- **Ver en portal** (LinkedIn).
- Switch **Visible / Oculto** por documento (`clivis:{key}`, lee `raw.visibilidad`).
- + Recursos: switch Visible/Oculto por semana.

> En móvil: una tarjeta por documento, apiladas, con el switch de visibilidad bien claro.

---

### 4.5 Secciones de FITNESS

**🏋️ Gym (`fit_rutina`)** — `raw.fit_rutina`:
- Rutina agrupada por Semana → Día → ejercicios (nombre, series×reps, peso, foto).
- Por ejercicio: Editar / Quitar / subir foto. Por semana: Duplicar a la siguiente.
- Formulario "Agregar ejercicio" con autocompletado.
- Switch "El cliente lo ve".

**📏 Antropometría (`fit_antro`)** — `raw.fit_antro`:
- Historial de mediciones por fecha: Peso, % grasa, músculo, ósea, Σ pliegues, IMO.
- Formulario para cargar medición nueva; borrar medición.

**🥗 Nutrición (`fit_nutri`)** — `raw.fit_nutricion`:
- Plan día a día (Lun–Dom) con comidas (Desayuno/Almuerzo/Merienda/Cena).
- Pautas generales (macros, calorías, agua, horarios, qué evitar).
- Guardar.

> En móvil estos tres son **tablas/formularios densos** — el reto es que se editen
> cómodo con el pulgar. Propuesta: filas apiladas tipo tarjeta, inputs grandes, y el
> formulario "agregar" como hoja inferior en vez de inline.

---

### 4.6 Secciones de FINANCIERO

**💶 Finanzas (`fin_pres`)** — varios JSON en `raw`:
- Presupuesto recomendado (Vivienda, Alimentación, Ocio, Ahorro) — `fin_pres`.
- Objetivos financieros (Viaje, Ahorro, Emprendimiento, Casa, Otro: valor + plazo) — `fin_objetivos`.
- Patrimonio / activos (inversiones, propiedades, efectivo, total) — `fin_patrimonio`.
- Deudas (bola de nieve: nombre, monto, cuota/mes, estado) — `fin_deudas`.
- Diagnóstico (salud, control del gasto, deuda, ahorro: 0–100) — `fin_diagnostico`.
- Categorizar gastos con IA (subir PDF del banco → vuelca al presupuesto).

**⚙️ Gestión (Fitness y Financiero):**
- Toggles de visibilidad de lo que ve el cliente (presupuesto/avance/sesiones; gym/antro/nutri/sesiones).
- Control del mes/semana actual + nombres de fases editables.

---

### 4.7 SESIONES (todos los nichos) — `candidatos.sesiones_registro`

- Hero "Próxima sesión" + botón **Agendar** (Calendly del coach, `RCFG.calendly_url`).
- Historial de sesiones (fecha DESC). Cada una:
  - Fecha · Hora · Tema/qué se trabajó · Acordado/próximos pasos.
  - Tareas del cliente con checkboxes ("X/Y hechas").
  - Documento adjunto (link descargable) si existe.
- Formulario "Agregar sesión" (fecha, hora, tema, acordado, tareas, archivo).
- Switch "El cliente las ve" (`clivis:sesiones`).

> En móvil: cada sesión como tarjeta colapsable; el formulario "agregar" como hoja inferior.

---

### 4.8 MENSAJES / PLANTILLAS (hoja inferior, no es tab)

6 plantillas por nicho (editables antes de enviar). Variables: `{fn}` nombre del
cliente, `{cn}` nombre del coach, link al portal, link de reset de contraseña.

| # | Carrera | Fitness | Financiero |
|---|---------|---------|------------|
| 1 | Bienvenida | Bienvenida | Bienvenida |
| 2 | Tu acceso al portal | Tu acceso al portal | Tu acceso al portal |
| 3 | Tu CV está listo | Tu rutina está lista | Tu plan está listo |
| 4 | Recordatorio de sesión | Recordatorio de sesión | Recordatorio de sesión |
| 5 | Nueva semana | Nueva semana | Nuevo mes |
| 6 | Tu informe está listo | Tus mediciones están listas | Tu diagnóstico está listo |

Por plantilla: **Enviar email** (Pro, vía Brevo) · **WhatsApp** · **Email manual**
(mailto) · **Copiar**. Basic ve un modal de "Upgrade".

---

## 5. Estados que hay que diseñar (no olvidar)

- **Vacío** (sin informe, sin CV, sin sesiones, sin rutina): mensaje claro + CTA, nunca
  cajas grises de relleno.
- **Cargando**: skeletons (ya hay patrón `skelCards`).
- **Sin conexión / error al guardar**: feedback "Sin conexión — guardado localmente"
  (ya existe el patrón en el portal).
- **Cliente inactivo**: banner sutil + acción para reactivar.

---

## 6. Fases de implementación (chicas y reversibles)

> Todo detrás del **interruptor** ya descripto en `docs/rediseno-ficha.md` (solo lo ve
> Micaela/admin hasta aprobar). Solo afecta `@media (max-width:900px)`; desktop intacto.

| # | Fase | Qué toca | Riesgo |
|---|------|----------|--------|
| 0 | ✅ Mockup aprobado + este doc (decisiones en §8.1) | nada de prod | nulo |
| 1 | Header fijo + bottom nav (Carrera) | CSS/JS móvil de la ficha | bajo |
| 2 | Perfil móvil: Proceso + Próximo paso + datos + acciones rápidas | UI Perfil | bajo |
| 3 | Resto de secciones Carrera (Análisis, Acciones, Docs, Sesiones) en móvil | UI | bajo |
| 4 | Mensajes como hoja inferior | UI | bajo |
| 5 | Nichos Fitness y Financiero (tabs + secciones densas) | UI | medio |
| 6 | QA en celular real + pulido + prender interruptor | — | bajo |

Cada fase: correr `node scripts/check-syntax.js && node scripts/check-smoke.js &&
node scripts/check-guardrails.js` antes de commitear.

---

## 7. QA (tildar antes de prender)

- [ ] En celular, el header y la bottom nav quedan **fijos** (no se van con el scroll).
- [ ] Cada sección muestra **solo su contenido**; el Proceso/score solo en Perfil.
- [ ] WhatsApp y "Ver su portal" se alcanzan **sin scrollear**.
- [ ] Los **3 nichos** se ven y se editan bien en móvil (sin scroll lateral roto).
- [ ] Formularios densos (Gym, Finanzas) editables cómodo con el pulgar.
- [ ] **Desktop no cambió** en nada (comparar antes/después).
- [ ] Otro coach (no Micaela) ve el panel **sin cambios** (interruptor apagado).
- [ ] `check-syntax` + `check-smoke` + `check-guardrails` en verde.
- [ ] `client_errors` sin errores nuevos tras el deploy.

---

## 8. Decisiones a validar con la coach

> **Estado: RESUELTAS en el mockup de alta fidelidad (junio 2026).** Ver §8.1.

1. **Bottom nav en Fitness (6 tabs):** ¿"⋯ Más" para el menos usado, o scroll
   horizontal en la barra? (recomendado: 5 fijos + "Más").
2. **WhatsApp en el header** vs. solo dentro de Perfil.
3. **"Próximo paso":** ¿lo querés como bloque destacado en Perfil, o más discreto?
4. **Mensajes/plantillas:** ¿hoja inferior (recomendado) o que siga siendo una pantalla?
5. **Calendario fitness en Perfil:** ¿se queda en Perfil o va a su propia sección?

---

## 8.1 Decisiones resueltas en el mockup (junio 2026)

El mockup clickeable (`mockup-ficha-cliente-movil.html`, gitignoreado — es un preview
descartable) se iteró con la coach hasta aprobarlo. Decisiones finales:

1. **Estilo = copia exacta del panel.** Se reusan las clases reales (`cp-card`,
   `cp-card-hd`/`cp-card-title` con punto verde `.dot`, `cp-btn`/`cp-btn-primary`/
   `cp-btn-ghost`, `cp-form-row*`/`cp-form-input`/`cp-form-textarea`, `cp-chip`,
   `cp-client-pill`, `cp-eyebrow`) y los tokens `:root` del panel. Los **datos del
   cliente se muestran como campos de formulario editables** (label + input), no como
   filas de lectura. Nada de gradientes ni adornos inventados.

2. **Medalla SOBRE la foto.** Se elimina la tarjeta "Proceso" aparte. La medalla va
   como **badge circular sobre el avatar** del header (patrón `.cp-side-medal-badge`
   del panel, con `medalla-<nivel>-sm.webp`). El estado CV/Informe se ve en la pestaña
   **Docs** (pill por documento); la semana/mes puede ir como chip discreto. **No** se
   incluye el bloque "Próximo paso" (decisión 3 → descartado, era un adorno).

3. **Acciones: barra fina persistente, no tarjeta.** En vez de la tarjeta "Acciones
   rápidas" (que se repetiría por pestaña), una **barra delgada fija debajo del header**
   con **WhatsApp · Mensajes · Portal**, visible en todas las pestañas y una sola vez.
   **"Desactivar cliente"** no es acción frecuente: baja al **pie del Perfil** como
   botón discreto (`cli-deactivate`/`cli-reactivate`).

4. **Mensajes/plantillas = hoja inferior (bottom sheet).** Confirmado. Se abre desde el
   botón "Mensajes" de la barra fina. Selector de plantilla con `cp-chip`.

5. **Refrescar = pull-to-refresh.** Se **elimina el botón "Actualizar"** de la barra
   global (queda **Salir + Chat**). Refrescar se hace **deslizando hacia abajo desde el
   tope** (spinner verde → "Soltá para actualizar" → llama a `loadReal()` → toast
   "Actualizado ✓"). Solo en móvil, solo cuando el scroll está en el tope.

6. **Barra global (Salir · Chat) arriba a la derecha.** El header de la ficha cede ese
   espacio (contenido alineado a la izquierda: ‹ Volver · foto+medalla · nombre) para
   que las burbujas globales `#pw-app-actions` no se choquen con él.

7. **Bottom nav.** Tabs del nicho con emoji **gris** (`.cp-emo`) + label corto; activa
   en verde (`cp-fmenu-item.is-on`: fondo `success-bg` + texto bosque). Fitness (6 tabs)
   se resolvió con **scroll horizontal** en la barra; a re-confirmar en celular real
   (alternativa: 5 + "Más").

8. **Calendario fitness:** queda en **Perfil**, después de los datos.

> Estas decisiones son la fuente de verdad para las fases de §6. El mockup muestra los
> 3 nichos (Carrera/Fitness/Financiero) con datos de ejemplo (cliente María, etc.).

---

## 9. Próximo entregable

Con este proyecto aprobado (y las decisiones de §8 resueltas), el siguiente paso es un
**mockup clickeable de alta fidelidad** con **datos de ejemplo reales** (cliente María),
una pantalla por sección y los 3 nichos — para evaluar en el celular antes de tocar
`panel-v2.html`.
