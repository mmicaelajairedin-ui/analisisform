# Gamificación de Pathway — plan unificado (puntos · medallas · badges · revista)

Objetivo: que **puntos, medallas, badges y la revista Novedades** sean UN solo
sistema. La revista **rota sola cada semana** (8 ediciones) y es donde el logro
**se anuncia**; el perfil es donde **se acumula**. Cuando el coach gana algo
individual, esa semana su revista lo muestra y **viaja con una animación hasta
su perfil**.

---

## 1) Las 3 monedas y de dónde salen los puntos

Hay **una sola cuenta de puntos (XP)** por coach. Suma de tres fuentes reales:

| Fuente | Cuánto | ¿El dato ya existe? |
|---|---|---|
| 🐐 **Jugar a la cabra** (mini-juego) | lo que ya da `game_pts` | ✅ Sí (ya se guarda) |
| ✅ **Cumplir cosas** (activar cliente, generar informe, publicar CV…) | +50 cliente · +30 informe · +20 CV | ⚠️ el dato existe, falta sumarlo a XP |
| 🎯 **Reto / desafío semanal** (card de la revista) | +50 (reto) · doble en semana de desafío | 🔧 construir |
| ⭐ **Reseña** | +100 | 🔧 sistema de reseñas |
| 🤝 **Referir un coach que paga** | +150 (o +15 días) | 🔧 referidos (Stripe) |

> **Importante (lo que pediste):** el ranking y el total del perfil **incluyen
> los puntos de la cabra + los de cumplir cosas + los del reto**. Es UNA sola
> barra, no cuentas separadas.

### Medallas (bronce / plata / oro) — el "nivel de un vistazo"
Ya existen en el portal del cliente. Son el **resumen rápido** del avance
(círculos en el perfil). Cinco categorías, cada una sube de nivel con su métrica:

| Medalla | Sube con | Nivel de ejemplo |
|---|---|---|
| **Constancia** | semanas activo | Nivel 3 |
| **Racha** | días seguidos usando Pathway | 5 días |
| **Comunidad** | reacciones/encuestas/ideas | Nivel 2 |
| **Enfoque** | retos/desafíos completados | Nivel 4 |
| **Impacto** | clientes activados / informes | Nivel 1 |

### Badges (los 10 acuarela) — la colección coleccionable
`assets/badges/`. **No se gana uno por semana** — se ganan **por evento**.
- **De nivel (por XP):** `nivel-1`, `coach-pro`, `leyenda`.
- **De logro (por acción):** `early-adopter` (60 días), `explorador`,
  `enfocado`, `productivo`, `comunidad`, `embajador`, `top-coach`.

---

## 2) Calendario semanal — qué ve el coach cada semana

La revista tiene **8 ediciones que rotan** (`isoWeek() % 8`). Cada semana =
2-3 cards. Los puntos/medallas/badges se **integran** así:

| Sem | Cards de la revista | Puntos que aparecen | ¿Badge? | Medalla que toca |
|----|---------------------|---------------------|---------|------------------|
| **1** | Portada · Frase · **Reto** | **+50 XP** al completar el reto | — | Enfoque (al cerrar reto) |
| **2** | Calendario · ¿Sabías? · **Badge** | — | 🏅 **Explorador** (probó el calendario) | — |
| **3** | ¿Sabías? · **Desafío** | **Doble puntos** esa semana | — | Enfoque / Impacto |
| **4** | Saludo · Sorteo · **Tu resumen** | Muestra tu progreso (incl. cabra) | — | Impacto |
| **5** | **Ranking** · Tu voz | Tu **total de puntos** y posición | — | Comunidad (al votar/idear) |
| **6** | IA Pathway · **Reseña** | **+100 XP** al dejar reseña | 🏅 **Embajador** (al reseñar) | Comunidad |
| **7** | Sorteo · **Referido** | **+15 días / +150 XP** al referir | 🏅 **Embajador** (al referir) | — |
| **8** | **¡Logro!** · Encuesta | — | 🏅 el que corresponda | según logro |

> **El badge NO lleva puntos.** Ganar el badge **ES el premio** — es
> coleccionable, no una moneda. Los puntos (XP) salen del reto, la reseña, el
> referido, cumplir cosas y la cabra; los badges son aparte.

**Lectura honesta:** tienen badge las semanas **2, 6, 7 y 8**, y **solo si el
coach hace la acción** (probar el calendario, dejar reseña, referir, cumplir el
logro). Las demás semanas son contenido o puntos, sin badge. Nada promete un
badge que no se pueda ganar.

---

## 3) Lo individual — cuando "le toca" (con animación al perfil)

Aparte de la rotación fija, hay premios que se disparan **por lo que hace cada
coach**. Cuando pasa, **esa semana** (sin importar cuál sea) su revista inserta
una card arriba de todo y **el badge/medalla vuela hasta su avatar/perfil**:

| Evento del coach | Card que aparece | Qué viaja al perfil |
|---|---|---|
| Desbloquea un badge | **¡Has desbloqueado un logro!** (badge + XP) | el badge → colección |
| Sube una medalla de nivel | **¡Subiste de nivel!** (medalla + antes/después) | la medalla → perfil |
| Cruza un umbral de puntos | **¡Nuevo nivel de coach!** (Nivel N + escudo) | el nivel → perfil |

**Animación (a construir):** al abrir la card, el badge/medalla se agranda,
brilla, y hace un "fly-to" hasta el avatar del coach (arriba a la izq.), donde
queda con un pulso. Reusa el confetti que ya tiene la card Logro.

---

## 4) Niveles de coach (umbrales por defecto — ajustables)

| Nivel | Puntos | Título | Badge de nivel |
|---|---|---|---|
| 1–3 | 0–499 | Coach | `nivel-1` |
| 4–7 | 500–1.399 | **Coach Pro** | `coach-pro` |
| 8+ | 1.400+ | **Coach Elite** | — |
| tope | máx. | **Leyenda** | `leyenda` |

(El perfil de ejemplo muestra Nivel 7 · Coach Pro con 1.240 pts → faltan 160
para Coach Elite.)

---

## 5) Qué falta para lanzar la semana que viene ✅/🔧

### Frontend (revista + perfil) — casi listo
- ✅ 8 revistas maquetadas y rotando (`novedades-preview.html`).
- ✅ Perfil del coach con puntos, nivel, medallas, badges (`perfil-preview.html`).
- ✅ 10 badges en `assets/badges/` + cabra-trofeo en `assets/cabra/`.
- 🔧 **Cablear ambos previews dentro de `panel-v2.html`** (drawer lateral real).
- 🔧 Que **todos los botones/links de las cards** abran lo real (ver §6).
- 🔧 Animación "fly-to-perfil" de badge/medalla.

### Backend (para que los puntos sean reales) — lo que falta de verdad
- 🔧 En `usuarios`: `xp INT`, `badges JSONB`, `nivel` (derivado), `game_pts` ya existe.
- 🔧 **Sumar XP en las acciones reales** (cliente nuevo, informe, CV, reseña,
  referido) — hoy solo la cabra suma.
- 🔧 Reglas de desbloqueo de badge (por XP y por evento).
- 🔧 Reglas de medalla (subir nivel por su métrica).
- 🔧 Guardar reacciones/ideas/encuesta de la revista (para Comunidad).

> **Para arrancar la semana que viene sin backend completo:** se puede lanzar la
> revista **como contenido + la cabra** (que ya suma), y mostrar el perfil con
> los puntos de la cabra reales. Los badges/medallas de acción se van
> encendiendo a medida que se cablea cada trigger. Así nada miente: lo que se ve
> premiado es lo que ya se puede ganar.

---

## 6) Links de las cards — que TODOS anden (checklist)

| Card | Botón | Debe abrir |
|---|---|---|
| Portada | Explorar | scroll a la 1ª novedad (o nada) |
| Frase | Reacciones ♥🔥💪 | guardar reacción (Comunidad) |
| Reto / Desafío | Ver mi progreso | vista de progreso/perfil |
| Sorteo | Quiero participar | anotarse al sorteo (guardar) |
| Tu resumen | Ver mis estadísticas | dashboard del panel |
| Ranking | (ver total) | perfil / ranking real |
| Tu voz | Enviar idea | guardar idea en Supabase |
| IA Pathway | (CTA) | sección IA del panel |
| Reseña | Escribir reseña | form de reseña |
| Referido | Copiar link | link real de referido del coach |
| Encuesta | opciones | guardar voto |
| Logro | (auto) | +XP y fly-to-perfil |

> Antes de lanzar: cada botón de arriba tiene que llamar a una función que
> **existe** (lo verifica `check-smoke.js`) y hacer algo real, no un toast.

---

## Estado hoy
- ✅ Revista (8 ediciones) + perfil maquetados y aprobados en preview.
- ✅ Calendario integrado (este doc).
- ✅ La cabra ya suma puntos reales (`game_pts`).
- 🔧 Backend de XP/badges/medallas y cableado de links → a construir con tu OK.
- 🔧 4 badges tienen **voseo** grabado en la imagen (`top-coach` "Sos",
  `comunidad` "Conectás", `productivo` "Hacés", `embajador` "Recomendás") — si
  querés neutro total, regenerarlos.
