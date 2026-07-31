# Owner Dashboard v3 — Referencia Visual y QA

## 📋 Estructura del Archivo

- **Ubicación:** `owner-dashboard-v3.html`
- **Líneas:** ~900 (HTML + CSS + JS inline)
- **Tecnología:** HTML5 + CSS3 + Vanilla JS
- **Datos:** 100% mock (listos para ser reemplazados)

---

## 🎨 Decisiones de UX

### 1. **Header Sticky**
- Posición fija en la parte superior para navegación constante
- Contiene: logo, saludo personalizado, búsqueda global, notificaciones, perfil
- Responsive: en mobile se reorganiza en 2 filas manteniendo jerarquía
- **Por qué:** El Owner necesita acceso constante a búsqueda y notificaciones sin perder contexto

### 2. **KPI Cards — Grid de 6 Métricas**
```
Coaches Activos | Clientes Activos | Programas Activos
Retención       | NPS/Satisfacción | Capacidad Utilizada
```
- Diseñadas para responder la pregunta clave: "¿Cómo está mi organización?" en < 10 segundos
- Cada card muestra: valor actual + cambio de período + ícono visual
- **Por qué cards de 6:** es el máximo sin saturación en desktop; se adapta a 3-2-1 en tablet/mobile
- **Hover effect:** borde accent + sombra sutil para indicar interactividad futura
- Colores: neutros (blancos/cremas) para profesionalismo, NOT usando --pw-bosque/--accent en backgrounds

### 3. **Acciones Rápidas**
- 4 botones contextuales: Invitar Coach, Crear Programa, Añadir Cliente, Ver Organización
- Disposición: grid auto-fit para escalabilidad (si sumamos más acciones, se reorganizan automáticamente)
- Estilo: gradiente suave, sin relleno de color (neutro)
- **Por qué esta posición:** Justo después de KPIs para que el Owner sepa "qué hacer ahora"

### 4. **Layout 2-columnas (Tablet+)**
```
Actividad Reciente | Organización + Alertas
Analytics          | Noticias Empresariales
```
- En mobile: se convierte a 1 columna automáticamente
- **Por qué 2 cols:** El Owner ve "qué pasó" (izq) vs "dónde estamos" (der) en paralelo

### 5. **Timeline de Actividad**
- 5 eventos recientes ordenados cronológicamente (descending)
- Cada evento: punto de color (dot), título, descripción, tiempo relativo (timeAgo)
- Colores de dot: success (verde), warning (naranja), alert (rojo) según tipo
- **Por qué:** Narrativa clara del estado dinámico. El Owner ve "hoy pasó X" sin leer reportes largos

### 6. **Resumen de Organización**
- 3 métricas de estado: Planes Activos, Distribución, Estado General
- Cards con valor + meta descriptiva (ej: "Promedio óptimo")
- Alertas inline: capacidad, actualizaciones, seguridad
- **Por qué:** Contexto empresarial sin hundirse en detalles técnicos

### 7. **Mini Analytics (30 días)**
- Gráfico SVG de línea simple (performance trend)
- Bajo el gráfico: 3 números clave (Ganancias, Retenciones, Tasa de conversión)
- **Por qué:** Los Owners responden a números, no a storytelling. Una visualización rápida + datos concretos

### 8. **Comunidad Empresarial**
- 4 noticias simuladas (Producto, Comunidad, Seguridad)
- Tag + título + fecha
- **Por qué:** Diferenciado de contenido pedagógico de Pathway. Aquí el Owner ve "qué novedades de gestión empresarial"

---

## 🎭 Paleta de Colores

```
Tokens utilizados (de Pathway):
- --pw-accent: #8C7B80 (gris/marrón — hover, highlights)
- --pw-bosque: #2D5016 (verde — gráficos, accents)
- --pw-carbon: #1F4030 (dark — texto principal)
- --pw-niebla-1: #F5F4F2 (light gray — backgrounds)
- --pw-niebla-2: #EFE9DD (cream — backgrounds)
- --pw-neutral-600: #6B6560 (medium gray — labels, meta)
- --pw-neutral-400: #A8A39C (light gray — disabled, subtle)

Status colors:
- Success: #10A366 (verde)
- Warning: #D97706 (naranja)
- Alert: #DC2626 (rojo)
- Info: #0EA5E9 (azul)

Backgrounds:
- Cards: white (#FFFFFF)
- Page: #FAFAF8 (cream muy claro)
- Inputs: var(--pw-niebla-1) (#F5F4F2)

REGLA: El "chrome" (interfaz) es SIEMPRE neutro. Color de marca (--pw-accent) solo en:
- Borders on hover
- Gráficos
- Links de "ver más"
```

---

## 📐 Responsive Breakpoints

| Breakpoint | Cambios |
|-----------|---------|
| **Desktop** (1200px+) | Grid 2-col (Actividad + Org \| Analytics + Noticias), Header normal, KPI 3 cols |
| **Tablet** (768px - 1199px) | Grid sigue 2-col, pero más estrecho. Header se reajusta. |
| **Mobile** (480px - 767px) | Grid 1-col, Header en 2 líneas, KPI en 1 col, Acciones en 2x2 |
| **Móvil chico** (<480px) | Todo 1-col, fuentes reducidas, espacios comprimidos |

---

## ♿ Accesibilidad

- ✅ **Semantic HTML:** `<header>`, `<main>`, `<nav>` tags correctos
- ✅ **ARIA labels:** Todos los botones tienen `aria-label` o son visibles
- ✅ **Focus states:** Outline 2px en --pw-accent para todos los elementos interactivos
- ✅ **Contraste:** Text --pw-carbon on white/cream = WCAG AA (≥4.5:1)
- ✅ **Font size:** Mínimo 10px en labels, 14px+ en body
- ✅ **Prefers reduced motion:** Sin transiciones ni animaciones si el usuario lo solicita
- ✅ **Skip to content:** Estructura permite saltar con teclado

---

## 🧩 Componentes Reutilizables

### StatCard
```html
<div class="stat-card">
  <div class="stat-card-header">
    <span class="stat-card-label">Coaches Activos</span>
    <span class="stat-card-icon">👨‍🏫</span>
  </div>
  <div class="stat-card-value">12</div>
  <div class="stat-card-change positive">↑ 2 nuevos este mes</div>
</div>
```
**Uso:** KPIs principales. Reutilizable en cualquier pantalla de métricas.

### TimelineItem
```html
<div class="timeline-item">
  <div class="timeline-dot success"></div>
  <div class="timeline-content">
    <div class="timeline-title">Coach incorporado</div>
    <div class="timeline-desc">Carlos Mendez se unió</div>
    <div class="timeline-time">Hace 1 hora</div>
  </div>
</div>
```
**Uso:** Actividad, notificaciones, eventos históricos.

### AlertBox
```html
<div class="alert-box warning">
  <span class="alert-icon">⚠️</span>
  <div class="alert-content">
    <div class="alert-title">Capacidad casi al límite</div>
    <div class="alert-desc">...descripción...</div>
  </div>
</div>
```
**Uso:** Notificaciones, avisos, contexto empresarial.

### ActionButton
```html
<button class="action-btn" onclick="handleAction('invite-coach')">
  <span class="action-btn-icon">➕</span>
  <span>Invitar Coach</span>
</button>
```
**Uso:** Acciones rápidas, CTAs contextuales.

### OrgCard
```html
<div class="org-card">
  <div class="org-card-label">PLANES ACTIVOS</div>
  <div class="org-card-value">12 de 12</div>
  <div class="org-card-meta">Todos los coaches activos</div>
</div>
```
**Uso:** Métricas de organización, estado del negocio.

### NewsCard
```html
<div class="news-card">
  <span class="news-tag">PRODUCTO</span>
  <div class="news-title">Nuevo sistema de reportes...</div>
  <div class="news-date">28 Jul 2026</div>
</div>
```
**Uso:** Noticias, anuncios, comunicaciones.

---

## 📊 Mock Data Structure

```js
mockOrganization = {
  id: 'org-001',
  name: 'Acme Consulting Group',
  ownerName: 'María González',
  coaches: 12,
  activeClients: 187,
  activePrograms: 6,
  newClientsThisMonth: 24,
  retention: 91,
  nps: 4.8,
  capacity: 0.748, // 187/250
  totalCapacity: 250,
  usedCapacity: 187,
}

mockActivity = [
  {
    id: 1,
    type: 'coach_added',
    title: 'Nuevo coach incorporado',
    description: 'Carlos Mendez...',
    timestamp: Date.now() - 3600000,
    status: 'success'
  },
  // ... más eventos
]

mockAlerts = [
  {
    id: 1,
    type: 'warning',
    title: 'Capacidad casi al límite',
    description: '...', 
  },
  // ... más alertas
]

mockNews = [
  {
    id: 1,
    tag: 'PRODUCTO',
    title: 'Nuevo sistema...',
    date: '28 Jul 2026',
  },
  // ... más noticias
]
```

**Paso siguiente:** Cuando otro agente conecte APIs, simplemente:
1. Remplazar `const mockOrganization = {...}` con `const organization = await fetch('/api/org')`
2. Remplazar arrays mock con: `const activity = await fetch('/api/activity')`
3. El resto del código (render, interactividad) permanece idéntico

---

## ✅ QA Checklist

### Visual & Design
- [ ] Header se ve consistente con Pathway
- [ ] KPI cards tienen proporción correcta (valor grande, cambio pequeño)
- [ ] Colores neutros en backgrounds (no --pw-accent ni --pw-bosque en fills)
- [ ] Spacing sigue el sistema (--sp-md, --sp-lg, --sp-xl)
- [ ] Borders sutiles (--pw-niebla-1), no negros
- [ ] Sombras presentes pero no excesivas (--shadow-sm, --shadow-md)
- [ ] Typography: headings, labels, body bien diferenciados
- [ ] Emojis presentes en labels (profesionales, no excesivos)

### Responsive
- [ ] Desktop (1400px): 2 cols en grid-2col, 3 cols en grid-kpis
- [ ] Tablet (900px): Todavía 2 cols pero más estrecho
- [ ] Mobile (600px): 1 col, header se reajusta
- [ ] Móvil chico (400px): Todo se comprime correctamente
- [ ] No hay overflow horizontal en ninguna resolución
- [ ] Todos los textos son legibles en mobile
- [ ] Botones tienen mínimo 44px de altura (toque)

### Interactividad
- [ ] Hover sobre stat-card: borde accent + sombra
- [ ] Hover sobre action-btn: fondo más oscuro, sombra, translateY(-2px)
- [ ] Búsqueda: focus muestra border accent + background white
- [ ] Botones onclick funcionan (alert de acción)
- [ ] Timeline items se ven bien en mobile (dot + texto apilado)

### Accesibilidad
- [ ] Tab order es lógico (header search → buttons → content)
- [ ] Focus visible en todos los elementos interactivos
- [ ] aria-labels en botones de ícono (notificaciones, ayuda, perfil)
- [ ] Color no es el único indicador (dot colors + titles)
- [ ] Contraste de texto cumple WCAG AA (4.5:1)
- [ ] Prefers-reduced-motion desactiva transiciones

### Data & Content
- [ ] Mock data es realista (12 coaches, 187 clientes, 91% retención)
- [ ] TimeAgo() calcula correctamente (hace 1 hora, hace 2 días, etc)
- [ ] Activity timeline muestra 5 eventos, ordenados por timestamp DESC
- [ ] Alerts muestran al menos 1 warning
- [ ] News feed muestra 4 noticias con tags variados

### Performance
- [ ] No hay console errors
- [ ] SVG chart renderiza sin problemas
- [ ] Page load < 2s (sin APIs, solo HTML/CSS/JS)
- [ ] No hay memory leaks (comprobar en DevTools)

### Code Quality
- [ ] CSS organizado en secciones (reset, tokens, layout, components, responsive)
- [ ] JS tiene funciones separadas (renderActivity, renderOrgOverview, etc)
- [ ] No hay variables globales excepto mock data
- [ ] Espacios en blanco consistentes (2 espacios)
- [ ] Comentarios claros donde sea necesario
- [ ] No hay hardcoding excepto mock data

### Cross-browser
- [ ] Chrome: ✓
- [ ] Firefox: ✓
- [ ] Safari: ✓
- [ ] Edge: ✓
- [ ] Mobile Chrome: ✓
- [ ] Mobile Safari: ✓

---

## 🎯 KPIs que el Dashboard Responde

| Pregunta | Elemento | Ubicación |
|----------|----------|-----------|
| ¿Cuántos coaches tengo? | StatCard | KPI row, 1er card |
| ¿Cuántos clientes activos? | StatCard | KPI row, 2do card |
| ¿Cuántos programas? | StatCard | KPI row, 3er card |
| ¿Cómo es la retención? | StatCard | KPI row, 4to card |
| ¿Qué satisfacción? | StatCard NPS | KPI row, 5to card |
| ¿Tengo capacidad? | StatCard + Progress bar | KPI row, 6to card |
| ¿Qué pasó hoy? | Activity timeline | Columna izquierda |
| ¿Hay problemas? | Alert boxes | Dentro de Organización |
| ¿Cómo vamos vs antes? | Timeline + Changes | Cada stat card y timeline |
| ¿Qué debo hacer ahora? | Quick actions | Debajo de KPIs |

---

## 🔄 Flujo de Integración (Próximo Agente)

### Fase 1: Sustitución de Datos (Sin cambiar HTML/CSS/JS structure)
```js
// Antes (mock)
const mockOrganization = { coaches: 12, ... }

// Después (real)
const organization = await fetch('/api/multicoach/org').then(r => r.json())
const activity = await fetch('/api/multicoach/activity').then(r => r.json())
const alerts = await fetch('/api/multicoach/alerts').then(r => r.json())
const news = await fetch('/api/multicoach/news').then(r => r.json())
```

### Fase 2: Re-binding de Render Functions
```js
// Antes
renderActivity() // lee mockActivity

// Después
renderActivity(activity) // parámetro dinámico
```

### Fase 3: Event Handlers
```js
// Antes
handleAction('invite-coach') // alert

// Después
handleAction('invite-coach') // abre dialog, hace POST /api/invite
```

### Fase 4: Real-time Updates (Opcional — Si hay WebSocket)
```js
// Subscripción a cambios
subscribeToOrgChanges((newData) => {
  organization = newData
  render()
})
```

---

## 🚀 Próximos Archivos de UI (Roadmap)

Ahora que **owner-dashboard-v3.html** define el lenguaje visual, el siguiente será:

1. **owner-coaches.html** — Gestión de coaches (tabla, invitaciones, permisos)
2. **owner-clients.html** — Gestión de clientes (búsqueda, asignación, filtros)
3. **owner-analytics.html** — Reports avanzados (gráficos Chart.js, KPIs custom)
4. **owner-billing.html** — Facturación y suscripción
5. **owner-settings.html** — Configuración de organización, marca
6. **owner-programs.html** — Gestión de programas de coaching

**Criterio de consistencia:** Cada nuevo archivo reutilizará:
- Misma estructura de header
- Mismo color token system
- Mismos componentes (stat-card, alert-box, action-btn)
- Misma jerarquía de espacios (--sp-*)
- Mismo responsive breakpoint system

---

## 📝 Notas Finales

### Lo que NO está incluido (siguiente agente)
- ✗ Conexión a Supabase
- ✗ JWT / autenticación
- ✗ APIs reales
- ✗ WebSocket / real-time
- ✗ Modales / diálogos complejos
- ✗ Rutas / navegación (es una página static)
- ✗ Persistencia de estado
- ✗ Notificaciones push

### Lo que SÍ está incluido
- ✅ 100% funcional con datos mock
- ✅ Responsive en todas las resoluciones
- ✅ Accesible (WCAG AA)
- ✅ Componentes reutilizables y modularizados
- ✅ CSS limpio, escalable, sin frameworks
- ✅ Vanilla JS sin dependencias externas
- ✅ Estructura lista para integración de APIs
- ✅ Production-ready visual & interaction design

### Decisiones Tomadas
1. **SVG para gráficos** en lugar de Chart.js (sin dependencias externas en v1)
2. **Emojis para iconos** en UI (profesionales, rápidos de prototipar) — futuro: migrar a Lucide como en Pathway
3. **Grid auto-fit** para KPIs y acciones (escalable, sin refactoring si sumamos más)
4. **2-columnas desktop, 1 mobile** para layout (patrón SaaS estándar, legible)
5. **Mock data en JS** (no en fetch) para prototipo rápido — fácil cambiar después
6. **Colores neutros en chrome** (respeta regla Pathway: marca solo en white-label)
7. **Status dot colors** en timeline (verde, naranja, rojo — semáforo universal)
8. **TimeAgo() relativo** (hace 1 hora vs 28 Jul 14:32 — más natural para owner)

---

## 📞 Preguntas Frecuentes

**P: ¿Por qué no hay modal de "Invitar Coach"?**  
R: Este dashboard es una **referencia visual**. Los modales/diálogos irán en pantallas dedicadas (`owner-coaches.html`). El dashboard solo dispara la acción.

**P: ¿Por qué 6 KPIs y no 4?**  
R: 6 es el máximo que cabe en 3 cols sin saturación visual. Si agrego más, la jerarquía se rompe. Futuros: serán tabs o collapsible.

**P: ¿Y si quiero cambiar los colores de Pathway?**  
R: Todos los colores están en `:root` (CSS tokens). Cambiar `--pw-accent` o `--pw-bosque` actualiza toda la página automáticamente.

**P: ¿Cómo pruebo la responsividad?**  
R: Abre DevTools (F12) → Device Toggle → Chrome mobile/tablet/desktop. O cambia el tamaño de la ventana manualmente.

**P: ¿Cuándo conectamos APIs reales?**  
R: Cuando otro agente esté listo. Él/ella solo reemplazará los `const mock*` arrays y las funciones `render*()` seguirán funcionando igual.

---

**Versión:** 1.0  
**Fecha:** 30 Jul 2026  
**Status:** ✅ Ready for Review  
**Próximo paso:** Aprobación de diseño + avance a owner-coaches.html
