# Gamificación de Pathway — plan unificado (puntos · medallas · badges)

Objetivo: que **puntos, medallas y badges** formen UN solo sistema con sentido,
que **no moleste** en el día a día (vive en el perfil) pero que **aparezca en la
revista Novedades** cuando el coach logra algo, y que se **vaya acumulando**.

## Las 3 capas (cómo se relacionan)

### 1) Puntos / XP — la moneda
Se ganan haciendo cosas reales en la plataforma. Suben el **nivel** y (a futuro)
se canjean por **premios**.

| Acción | XP | ¿Ya existe el dato? |
|---|---|---|
| Activar un cliente nuevo | +50 | Sí (candidatos) |
| Completar el reto semanal | +50 | 🔧 construir |
| Dejar una reseña | +100 | 🔧 sistema de reseñas |
| Recomendar un coach que paga | +150 | 🔧 referidos (Stripe) |
| Mantener la racha semanal | +X | 🔧 construir |
| Jugar a la cabra | ya suma (game_pts) | Sí |

### 2) Medallas (bronce / plata / oro) — el "nivel de un vistazo"
Ya existen en el portal del cliente. Propuesta: son el **resumen rápido** del
avance (se ven chiquitas en el sidebar/perfil). Se derivan del XP o de la
cantidad de badges:
- 🥉 **Bronce**: nivel inicial
- 🥈 **Plata**: nivel intermedio
- 🥇 **Oro**: nivel alto

### 3) Badges (los 10 acuarela) — la colección
`assets/badges/`. Dos tipos:

**a. Badges de NIVEL (por XP acumulado):**
- `nivel-1` — ¡Comenzaste tu camino! (al arrancar)
- `coach-pro` — Vas en camino al siguiente nivel (intermedio)
- `leyenda` — Máximo nivel alcanzado (tope)

**b. Badges de LOGRO (por una acción concreta):**
- `early-adopter` — Usás Pathway hace 60 días
- `explorador` — Probaste funciones nuevas
- `enfocado` — Constancia (racha)
- `productivo` — Eficiencia / ahorrás tiempo
- `comunidad` — Participás (encuestas, reacciones)
- `embajador` — Recomendaste / referiste
- `top-coach` — Entraste al ranking del mes

## Dónde se ve cada cosa (para que NO moleste)
- **Perfil del coach** (al pinchar su avatar): XP total + medalla + **colección
  de badges** (desbloqueados a color, pendientes en gris con candado).
- **Panel día a día**: nada. Limpio.

## Cómo aparece en la revista Novedades (el "gancho")
La revista es donde los logros **se anuncian** y después se suman al perfil:
1. **Reto / Desafío semanal** (card de la revista) → completarlo da XP y, si
   corresponde, un badge. Es el motor para ganar puntos.
2. **"Has desbloqueado un logro"** (card Logro) → aparece cuando desbloquea un
   badge, con el badge grande + XP. De ahí queda guardado en el perfil.
3. Ejemplos del flujo que pediste:
   - Dejar una reseña → badge **Embajador** (o **Comunidad**) + XP.
   - Llegar a la semana 1 → badge **Nivel 1**.
   - 60 días activo → badge **Early Adopter**.

## Qué falta construir (backend) para que sea real
1. **Datos** en `usuarios`: `xp INT`, `badges JSONB` (array de ids
   desbloqueados), `nivel` (derivado de XP).
2. **Triggers de XP**: sumar en las acciones reales (cliente nuevo, reseña,
   referido pagado, racha).
3. **Reglas de desbloqueo**: por XP (niveles) o por evento (logros).
4. **Vista de perfil**: la colección de badges (color vs gris).
5. **Enganche con la revista**: cuando se desbloquea, mostrar la card Logro.

## Pendiente de diseño
- 4 badges tienen **voseo** grabado en la imagen (`top-coach` "Sos",
  `comunidad` "Conectás", `productivo` "Hacés", `embajador` "Recomendás").
  Si querés español neutro en toda la plataforma, conviene regenerarlos.

## Estado hoy
- ✅ 10 badges en `assets/badges/`.
- ✅ Card Logro (revista) usando el badge real Early Adopter + XP.
- ✅ Card Reto / Desafío (revista) maquetadas.
- 🔧 Todo lo de backend (XP, triggers, perfil, desbloqueo) — a construir cuando
  se dé el OK.
