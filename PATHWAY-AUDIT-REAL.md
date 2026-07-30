# Pathway Brand — Audit de Realidad
## Lo que panel-v2.html USA AHORA

**No es propuesta. No es potencial. Es lo que existe.**

---

## 1. PALETA DE COLORES (Realidad)

### Tokens definidos en panel-v2.html

```css
--pw-bosque: #2D6A4F          /* Verde Pathway — botones, acciones */
--pw-sendero: #9DB2A5         /* Verde suave — acentos, líneas */
--pw-carbon: #1F2E26          /* Texto negro (no #000) */
--pw-text: (heredado)          /* Párrafos */
--pw-text-soft: #6E746F        /* Secundario */
--pw-text-muted: #A8ADA7       /* Metadata pequeña */
--pw-border: #D8D4CA           /* Bordes, separadores */
--pw-niebla: #F6F4EF           /* Hover suave */
--pw-niebla-2: #EFE9DD         /* Cards, paneles */
--pw-niebla-3: #E4DCD0         /* Bordes más fuertes */
--pw-danger: #B23B3B           /* Rojo solo peligro real */
--pw-danger-bg: rgba(...)      /* Rojo suave background */
--pw-warning-bg: (warning)      /* Amarillo suave */
--pw-success-bg: (verde suave)  /* Verde éxito suave */
--pw-amanecer: (naranja suave)  /* Badge plan */
```

**Realidad:** Panel usa CASI PURO neutro. Verde solo en:
- `.cp-btn-primary` (botones verdes)
- `.cp-hd-chev` (chevron verde hover)
- `.pw-um-item:hover` (hover verde)
- Cards de éxito, badges

---

## 2. TIPOGRAFÍA (Realidad)

### Headers (Fraunces serif)

| Donde | Font | Weight | Size | Spacing | Ejemplo real |
|-------|------|--------|------|---------|--------------|
| `.cp-h1` | Fraunces | 600 | 32px | -1.4px | Resumen / Clientes |
| `.cp-card-title` | Fraunces | 600 | 18px | -0.3px | "Tus clientes." |
| `.cp-side-coach-name` | Fraunces | 600 | 16px | -0.2px | "Micaela J." |
| `.cp-greet-h1` | Fraunces | 600 | 30px | -1.2px | "Buenos días, Micaela." |

### Body (Inter sans)

| Donde | Font | Weight | Size | Uso |
|-------|------|--------|------|-----|
| Body default | Inter | 400 | 13–14px | Párrafos, descripciones |
| `.cp-eyebrow` | Inter | 700 | 10–11px | Labels pequeños (UPPERCASE) |
| `.cp-side-nav-item` | Inter | 500 | 13px | Nav sidebar |

**Realidad:** Sin Open Sans. Puro Fraunces (serif headlines) + Inter (sans body).

---

## 3. COMPONENTES (Realidad)

### Card

```css
.cp-card {
  background: #fff;
  border: 1px solid var(--pw-border);  /* #D8D4CA */
  border-radius: 14px;
  box-shadow: var(--pw-shadow-sm);
  transition: box-shadow 0.2s, transform 0.2s;
}
.cp-card:hover {
  box-shadow: var(--pw-shadow-md);
  transform: translateY(-2px);
}
```

**Realidad:** Card es siempre blanca + borde neutro. Color SOLO en el contenido (botón, badge).

### Botón Primario

```css
.cp-btn-primary {
  background: var(--pw-bosque);     /* #2D6A4F */
  color: #fff;
  box-shadow: 0 3px 0 rgba(27,67,50,.45), 0 5px 10px rgba(31,42,35,.15);
  border-radius: 10px;
  padding: 0 14px;
  height: 38px;
  font-size: 13px;
  font-weight: 600;
}
.cp-btn-primary:hover {
  background: #2f7254;  /* Verde más oscuro */
}
.cp-btn-primary:active {
  transform: translateY(3px);
  box-shadow: 0 0 0 var(--pw-bosque-dark), 0 1px 3px rgba(31,42,35,.2);
}
```

**Realidad:** Botón verde con sombra 3D. Sin degradados.

### Sidebar

```css
.cp-side {
  background: #FFFFFF;
  color: var(--pw-carbon);  /* #1F2E26 */
  border-right: 1px solid var(--pw-border);
  padding: 18px 14px;
  width: 240px;  /* (puede ser 74px rail mode) */
}
```

**Realidad:** Sidebar blanco, borde sutil. Nunca verde.

---

## 4. MICRO-INTERACCIONES (Realidad)

### Animaciones definidas

```css
@keyframes pwSecIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
.pw-sec-in { animation: pwSecIn 0.34s cubic-bezier(.16,1,.3,1); }

@keyframes pwDD {
  from { opacity: 0; transform: translateY(-6px) scale(.97); }
  to { opacity: 1; transform: none; }
}
#pw-notif-panel, #pw-usermenu-panel {
  transform-origin: top right;
  animation: pwDD 0.17s cubic-bezier(.16,1,.3,1);
}

@keyframes pwMsgIn {
  from { opacity: 0; transform: translateY(9px); }
  to { opacity: 1; transform: none; }
}
.pw-msgs-in > * { animation: pwMsgIn 0.32s cubic-bezier(.16,1,.3,1) both; }

@keyframes pwShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.pw-skel {
  background: linear-gradient(90deg, var(--pw-niebla-2) 25%, #EEF1EE 37%, var(--pw-niebla-2) 63%);
  background-size: 200% 100%;
  animation: pwShimmer 1.3s linear infinite;
}
```

**Realidad:** Fade suave (0.34s), dropdowns rápidos (0.17s), skeleton shimmer. Sin bounces.

---

## 5. ICON SYSTEM (Realidad)

### Sistema actual

```javascript
// pw-icons.js
window.PWI.IC = {
  user: "...",
  users: "...",
  calendar: "...",
  chat: "...",
  settings: "...",
  dumbbell: "...",
  /* etc */
}

// Uso
PWI.svg('calendar', {sm:true})   // Retorna <svg>
<i data-ic="calendar" data-sm></i>  // CSS convierte a SVG
```

### Especificación

```css
.pw-ic {
  width: 20px;
  height: 20px;
  stroke: 2px;
  color: #1F4030;  /* --pw-icon */
}

.pw-ic-sm {
  width: 18px;
  height: 18px;
}
```

**Realidad:** Lucide outline, 20px/18px, stroke 2px, color gris oscuro (#1F4030).

---

## 6. MICROCOPY (Realidad)

### Títulos principales

| Pantalla | Title |
|----------|-------|
| Resumen | `"Resumen"` (después "Buenos días") |
| Clientes | `"Clientes"` |
| Documentos | `"Documentos"` |
| Sesiones | `"Sesiones"` |

### Descripciones

```javascript
// Línea 3108 (viewResumen)
var _greetSub = _facts.length 
  ? ("Hoy tienes " + _facts.join(" · "))  // "1 sesión · 2 seguimientos · 1 informe"
  : (_nx ? _nxTxt : "Todo al día ✓");

// Línea 3087
"<div class='cp-todo-meta'>" + esc(stTxt) + "</div>"
// "Sin actividad" | "Coach acompañante" | (last.txt)
```

### Labels de acción urgente

```javascript
// Línea 1891
{ 
  level:"danger", 
  icon:"insStale",
  title:"Clientes sin actividad",
  desc:"Revisa quién no entra hace días y mándales un mensaje.",
  go:"clientes"
}
```

**Realidad:** Tono actual es funcional, no emotivo. "Clientes sin actividad" no "Quién te espera".

---

## 7. CABRA (Realidad — Donde EXISTE)

### 1. Juego overlay (.pw-juego)
```javascript
// Minijuego interactivo en overlay modal
// Sidebar tiene botón "Jugar" (.cp-side-juego)
.cp-side-juego {
  display: flex;
  gap: 10px;
  padding: 4px 6px;
  cursor: pointer;
}
```

### 2. Sidebar sticker
```css
.cp-side-juego b { font-size: 12.5px; color: var(--pw-carbon); }
.cp-side-juego small { font-size: 10.5px; color: var(--pw-text-soft); }
```

### 3. FAB móvil
```css
.cp-mobjuego { display: none; }  /* Oculto en desktop */
/* Aparece solo @media (max-width:900px) */
```

### 4. Sendero (coachPath)
```javascript
// Escena visual en Resumen si el coach NO completó los 3 pasos
// (Perfil → Cliente → Sesión)
// Desaparece al completar
```

**Realidad:** Cabra existe pero es OPCIONAL, solo en ciertos contextos. No es protagonista.

---

## 8. ESPACIADO (Realidad)

```css
/* Sidebar */
.cp-side { padding: 18px 14px; gap: 16px; }

/* Cards */
.cp-card-pad { padding: 14px 18px; }
.cp-card-hd { padding: 10px 20px; gap: 16px; }

/* Main scroll */
.cp-scroll { padding: 56px 36px 88px; }

/* Mobile */
@media (max-width:900px) {
  .cp-scroll .cp-card { margin-bottom: 12px !important; }
  @media (max-width:760px) {
    .cp-scroll .cp-card { margin-bottom: 9px !important; }
  }
}
```

**Realidad:** Generoso (14–20px padding), coherente. Menos apretado en desktop que móvil.

---

## 9. SOMBRAS (Realidad)

```css
/* Definidas como variables (en pw-design-tokens.css) */
--pw-shadow-sm: (sombra pequeña, hover) 
--pw-shadow-md: (sombra mediana, card hover)
--pw-shadow-xs: (sombra mínima)

/* Ejemplos reales */
.cp-side-medal-badge { box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.pw-juego-box { box-shadow: 0 22px 60px rgba(0,0,0,.55); }
.cp-btn-primary { box-shadow: 0 3px 0 rgba(27,67,50,.45), 0 5px 10px rgba(31,42,35,.15); }
```

**Realidad:** Sombras suaves, nunca drásticas. 3D solo en botones.

---

## 10. RESPONSIVE (Realidad)

```css
/* Desktop default: 240px sidebar + 1fr main */
.cp-app { grid-template-columns: var(--pw-sidebar-width) 1fr; }

/* Rail mode (≥901px) */
@media (min-width:901px) {
  .cp-app.rail { grid-template-columns: 74px 1fr; }
}

/* Tablet/Mobile (≤900px) */
@media (max-width:900px) {
  .cp-side.rail { display: none; }
  /* Todo collapsa a móvil */
}

/* Móvil portrait (≤760px) */
@media (max-width:760px) {
  .cp-scroll { padding: 56px 18px 88px; }  /* Menos ancho */
  .cp-card { margin-bottom: 9px; }  /* Más compacto */
}
```

**Realidad:** Mobile-first logic, pero optimizado para desktop. Sidebar es sticky.

---

## 11. LENGUAJE (Realidad)

### Lo que panel-v2 SÍ dice:

```
"Resumen", "Clientes", "Documentos", "Sesiones", "Gestion"
"Tus clientes"
"Próxima sesión"
"Última actividad"
"Semana N de 4"
"Clientes sin actividad"
"Revisar informe de [Nombre]"
"Aprobar CV de [Nombre]"
"Seguimiento de [Nombre]"
"Este semana" / "Hoy" / "Próximamente"
```

### Lo que panel-v2 NO dice:

- ❌ Emojis en chrome (solo en logros/contenido)
- ❌ "Dashboard", "User", "Status"
- ❌ Tono gamificado en texto
- ❌ Diminutivos ("Coquita", "Mande")
- ❌ Exclamaciones innecesarias
- ❌ Corporativo extremo ("Solicitud autorizada")

**Realidad:** Tono es neutro-profesional. Ni frío, ni casual. Funcional.

---

## 12. LO QUE NO EXISTE (Importante)

```
❌ Temas (light/dark mode completo)
❌ Animaciones cuando se agregan/eliminas cards
❌ Notificaciones push personalizadas
❌ Historial de actividad visual
❌ Breadcrumbs en fichas anidadas
❌ Drag-and-drop
❌ Filtros guardados por usuario
❌ Atajos de teclado documentados
❌ Búsqueda en tiempo real del lado de canvas
```

**Realidad:** Panel-v2 es funcional pero no es ultra-interactivo. Es un panel, no una app SPA completa.

---

## RESUMEN: Pathway IS THIS

```
Paleta:  Neutro 90% + Verde Pathway 10%
Tipografía: Fraunces serif (headers) + Inter sans (body)
Componentes: Card blanca, botón verde, sidebar blanco
Iconos: Lucide 20px, 2px stroke, gris oscuro
Espaciado: 14–20px, generoso
Sombras: Suave (nunca drástica)
Animaciones: 0.17s–0.34s, fade suave
Microcopy: Funcional, neutro-profesional
Cabra: Existe, pero marginal (solo juego + sidebar + email)
Responsive: Mobile-first, optimizado desktop
Lenguaje: Sin emojis en chrome, sin gamificación forzada
```

---

**Para MultiCoach: COPIA ESTO EXACTO. No inventes nada nuevo.**
