# PRODUCT BIBLE — MultiCoach by Pathway
**Última actualización:** 2026-08-01  
**Versión:** 2.2  
**Estado:** Sprint 1 ✅ COMPLETE & LOCKED — Sprint 2 🚧 IN PROGRESS (EPIC 1 ✅)

---

## 📖 Fuente Única de Verdad

Este documento es la autoridad máxima del producto. Contiene:
- Filosofía de diseño
- Design tokens
- Componentes oficiales
- Arquitectura de navegación
- Roles y permisos
- Decisiones de UX aprobadas
- Qué está congelado
- Roadmap por sprints

**Regla:** Si está aquí, no se discute. Si no está, se consulta a Mica.

---

## 🎨 FILOSOFÍA DE DISEÑO

### Principios Centrales
1. **Premium SaaS** — No prototipo. Producto real.
2. **Referencias:** Apple, Notion, Linear, Stripe, Raycast
3. **Copiar principios, no estilos**
4. **Mucho aire** — Espaciado generoso
5. **Jerarquía clara** — Qué importa, qué no
6. **Consistencia** — Componentes reutilizables
7. **Animaciones discretas** — Nada de ruido
8. **Sin CSS específico** — Todo es Design System

### Resultado Esperado
Cada pantalla debe parecer diseñada por un Product Designer, no un desarrollador.

---

## 🎯 DESIGN TOKENS

### Colores
```
Sidebar (fijo, neutro):
--side: #f6f4ef
--bg: #fbfaf8
--divider: #E8DFD4
--border: #E8DFD4

Texto:
--carbon: #1F2120
--soft: #A39A8F
--muted: #9A9591

Marca (Pathway):
--brand: #1B4332 (verde bosque)
--sendero: #F8CA45 (amarillo)

Smart Branding (preparado para Sprint 2):
--brand-50: rgba(27, 67, 50, 0.05)
--brand-100: rgba(27, 67, 50, 0.1)
--brand-200: rgba(27, 67, 50, 0.2)
```

### Espaciado
```
xs: 4px
sm: 8px
md: 12px
lg: 16px
xl: 20px
2xl: 24px
3xl: 28px
4xl: 32px
```

### Tipografía
```
Font primaria: Inter (sans)
Font display: Fraunces (serif)

Tamaños:
11px — Labels, categor&iacute;as
12px — Captions, hints
13px — Body, nav items
14px — Subheadings
16px — Titles
20px — Page titles
24px — H1

Pesos: 400, 500, 600, 700
```

### Radios
```
xs: 4px
sm: 6px
md: 8px
lg: 12px
```

### Sombras
```
sm: 0 2px 8px rgba(31,42,35,.08)
md: 0 4px 12px rgba(31,42,35,.12)
lg: 0 8px 24px rgba(31,42,35,.15)
xl: 0 14px 38px rgba(31,42,35,.20)
```

### Transiciones
```
Rápido: 0.15s
Normal: 0.22s
Lento: 0.35s
Easing: cubic-bezier(.4,0,.2,1)
```

---

## 🧩 COMPONENTES OFICIALES

### ✅ CONGELADOS (No modificar sin orden de Mica)

#### **SidebarLogo** (v2.0 — Aprobado Sprint 1)
```
- Logo Container: 120px min-height, 80px max-width
- Padding: 20px top, 24px bottom
- Centrado perfecto, object-fit: contain
- Soporta PNG, SVG, JPG, transparentes
- Preparado para Smart Branding
```

#### **SidebarSection** (v2.0 — Aprobado Sprint 1)
```
- 11px, 600 weight, letter-spacing .12em
- Color soft gray (#a39a8f)
- Padding: 28px top, 12px bottom
- Sin hover, sin cursor pointer
- Etiqueta visual, no opción
```

#### **SidebarItem** (v2.0 — Aprobado Sprint 1)
```
- 13px, 500 weight
- Padding: 10px 16px, margin: 0 8px
- Min-height: 40px
- Transición: 0.15s
- Estado activo: borde izquierdo 3px brand + fondo suave
- Icono: oscuro en estado activo, soft en hover
```

#### **SidebarFooter** (v2.0 — Aprobado Sprint 1)
```
- Margin-top: auto
- Padding: 20px 8px 16px
- Border-top: 1px solid border
- "¿Necesitas ayuda?" button
```

#### **SidebarCollapsed** (v2.0 — Aprobado Sprint 1)
```
- Ancho: 72px
- Logo: 72×72px
- Tooltips instantáneos (opacity .15s)
- Perfecto centrado
- Sin cambios de posición
```

### 🚧 EN DESARROLLO (Sprint 2)

#### **Header** (Epic 1 — Sprint 2)
```
Contiene:
- SearchBar (global)
- QuickAction (++)
- NotificationButton
- ChatButton
- UserSwitcher
```

#### **MetricCard** (componente base)
```
- Padding: 16px
- Border-radius: 8px
- Border: 1px solid border
- Altura mínima: 100px
- Shadow: md
- Tipografía: consistente
```

#### **EmptyState** (componente base)
```
- Icono centrado
- Titulo + descripción
- CTA button
- Padding: 40px 32px
- Color soft (--muted)
```

---

## 🏗️ ARQUITECTURA DE NAVEGACIÓN

### Estructura Principal
```
MULTICOACH
├── Sidebar (CONGELADO v2.0)
├── Header (Sprint 2)
├── Main Content
│   ├── Dashboard (Sprint 2 ✅)
│   ├── Personas
│   │   ├── Equipo (Sprint 4)
│   │   └── Clientes
│   ├── Operación
│   │   ├── Agenda
│   │   ├── Programas
│   │   └── Comunidad
│   ├── Negocio
│   │   ├── Analytics
│   │   └── Cobros
│   └── Configuración
└── Community Sidebar (futura)
```

### Roles y Permisos (Arquitectura, no implementado)
```
OWNER (dueño de la red):
- Ver red completa (coaches, clientes, colaboradores)
- Asignar clientes a coaches
- Editar configuración de la red
- Ver analytics
- Gestionar cobros

COACH (de la red):
- Ver solo sus clientes asignados
- Ver recursos de la empresa
- No agregar clientes
- No editar configuración de la empresa
- Ver su propia agenda

COLABORADOR (facilitador):
- Ver clientes asignados
- Facilitar sesiones
- No editar configuración

CLIENTE (de la red):
- Ver su coach
- Ver recursos de la empresa
- Ver comunidad de la empresa
- Hacer sesiones
```

---

## ✅ DECISIONES DE UX APROBADAS

### Sidebar (Sprint 1 ✅ CONGELADO)
- ✅ Logo máximo 80px, contenedor 120px
- ✅ Spacing rhythm: 28px / 12px / 8px
- ✅ Títulos como etiquetas, no opciones
- ✅ Active state: borde izquierdo + fondo suave
- ✅ Collapsed: 72px con tooltips
- ✅ Mobile: bottom nav respetando jerarquía

### Header (Sprint 2 — ✅ COMPLETE)
- ⏳ Search global (clientes, coaches, colaboradores, programas)
- ⏳ Quick Action (+) — arquitectura lista, sin implementar
- ⏳ Notificaciones
- ⏳ Chat
- ⏳ User Switcher

### Dashboard (Sprint 2 — Pendiente de aprobación)
- ⏳ Orden: Header → Título → Resumen → Acciones → Actividad → Agenda → Ranking → Estado
- ⏳ MetricCard reutilizable
- ⏳ EmptyState en todo módulo
- ⏳ Sin KPIs duplicados
- ⏳ Responsive (desktop / tablet / mobile)

---

## 🔐 CONGELADO (No Tocar)

### Sprint 1 ✅ APROBADO Y CONGELADO
**Archivo:** `multicoach.html` (líneas 50-320, CSS sidebar)

**Componentes:**
- `.app` (grid layout 240px/72px)
- `.side` (sidebar container)
- `.logo` (logo container system)
- `.nav-category` (section titles)
- `.nav a` (nav items)
- `.mc-foot` (footer)
- `.side.rail-collapsed` (collapsed state)
- `.side.rail-collapsed .logo`
- `.side.rail-collapsed .nav a`
- Tooltips en collapsed

**Regla:** Si hay bug, arreglar. Si hay mejora sin bug, NO. Consultar a Mica primero.

---

## 🚫 PROHIBIDO

- ❌ Modificar Sidebar sin orden explícita
- ❌ CSS específico para una pantalla (todo es Design System)
- ❌ Colores hardcodeados (usar tokens)
- ❌ Duplicar componentes existentes
- ❌ Tocar panel-v2.html ni cliente.html
- ❌ Componentes temporales (todo es definitivo)

---

## 📋 ROADMAP POR SPRINTS

### Sprint 1 ✅ APROBADO & MERGED (Sidebar v3.0 — Premium SaaS Quality)
- ✅ Logo Container System (120px min-height, 110px max-width × 90px height)
- ✅ Spacing Rhythm (28/32/28/12/8px exactos)
- ✅ Section Titles como etiquetas (11px, 600, #A39A8F)
- ✅ Items 44px altura, 15px font, 20px icons, 10px radius
- ✅ Active State elegante (3px border, rgba bg .55, weight 600)
- ✅ Hover sutil (rgba 0,0,0,.03)
- ✅ Collapsed State (72px, centrado perfecto)
- ✅ Mobile bottom nav (72px height)
- ✅ Sin líneas innecesarias (NO dividers, clean aesthetic)
- ✅ Configuración en nav (no en footer)
- ✅ Help button: 10px font, 400 weight, 32px height, minimal styling
- ✅ Footer border removed (whitespace only)

**Estado:** CONGELADO & MERGED a main (Commit a6ff81fb)
**Aprobación:** Micaela ✅
**Fecha:** 2026-08-01
**Visual Validation:** ✅ Screenshots captured (expanded/collapsed/mobile)

### Sprint 2 🚧 LISTO PARA COMENZAR
**Prerequisito:** Sprint 1 (Sidebar) APROBADO ✅

**Epic 1: Header**
- SearchBar global (búsqueda clientes, coaches, programas)
- QuickAction (+) — arquitectura lista
- Notifications (con indicador)
- Chat del equipo
- UserSwitcher

**Epic 2: Dashboard Foundation**
- Estructura base (3-col grid)
- MetricCard component (KPIs)
- EmptyState component (cero datos)
- Responsive (desktop/tablet/mobile)

**Epic 3: MetricCard Component**
- Tarjetas reutilizables
- Shadow + border
- Responsive grid
- Loading states

**Epic 4: EmptyState System**
- Ícono centrado
- Título + descripción
- CTA button
- Aplicable a todo módulo

**Epic 5: Smart Branding Preparation**
- Arquitectura lista (no implementación)
- Logo analysis (proporción, contraste)
- Color detection

**Epic 6: Role Architecture**
- Owner vs Coach vs Colaborador vs Cliente
- RLS en Supabase
- Data filtering por rol

**Epic 7: Visual Quality**
- Checklist de calidad
- Validación contra referencias
- Iteración visual

**NO hacer en Sprint 2:**
- Analytics (Sprint 4)
- Branding Engine automático (Sprint 3)
- Cobros/Pagos (Sprint 5)

### Sprint 3 🔮 FUTURO
- Smart Branding Engine
- Logo analysis (proporción, fondo, contraste)
- Automatic token generation
- Color proposal system

### Sprint 4 🔮 FUTURO
- Analytics section
- KPI cards
- Charts
- Trends

### Sprint 5+ 🔮 FUTURO
- Cobros (payments)
- Community features
- Recursos
- Asignación avanzada

---

## 📐 CALIDAD VISUAL

Checklist antes de aprobar un Sprint:

- [ ] Alineaciones perfectas (3px grid)
- [ ] Padding consistente (4px base)
- [ ] Espacios deliberados (ritmo)
- [ ] Jerarquía clara (qué importa)
- [ ] Ritmo visual (repetición con variación)
- [ ] Consistencia de componentes (mismo style)
- [ ] Tipografía escala establecida
- [ ] Colores tokens, no hardcodeados
- [ ] Animaciones discretas (.15s / .22s)
- [ ] Responsive probado (desktop/tablet/mobile)
- [ ] Sin ruido visual
- [ ] Parece diseño profesional, no desarrollo

---

## 🔄 FLUJO DE TRABAJO OBLIGATORIO

Todos los Sprints:

1. **Leer especificación** → PRODUCT_BIBLE.md + especificación del Sprint
2. **Explicar en 5 líneas** → Qué vas a hacer exactamente
3. **Implementar** → Código limpio, componentes reutilizables
4. **Validar visualmente** → Capturas vs referencias (Notion/Linear/Apple)
5. **Crear commit** → Mensaje claro, referencia a Sprint/Epic
6. **Push** → Rama de Sprint
7. **Esperar aprobación** → Mica valida visualmente
8. **Si aprobado:** Merge a main → Bloquear Sprint → No volver a tocar
9. **Si no aprobado:** Iterar hasta aprobación

---

## 📞 PREGUNTAS FRECUENTES

**P: ¿Puedo agregar un nuevo color?**
A: No. Usa tokens. Si ningún token sirve, consulta a Mica.

**P: ¿Puedo hacer el Sidebar un poco diferente en mobile?**
A: No. Respeta exactamente el Design System. Si no cabe, reorganiza, no cambies.

**P: ¿Puedo modificar el Sidebar si encontré un bug?**
A: Sí, solo si es un bug real. No es mejora. Consulta primero si no estás 100% seguro.

**P: ¿Necesito usar componentes de otra librería?**
A: No. CSS puro. Design System. Componentes reutilizables en HTML/CSS/JS vanilla.

**P: ¿Qué pasa si termino Sprint 2 temprano?**
A: Espera aprobación. No avances a Sprint 3. No empieces con otra cosa.

---

## 🎯 OBJETIVO FINAL

Al terminar Sprint 10, MultiCoach debe ser un producto real que:

- Se vea como Notion/Linear/Stripe
- Funcione perfecto con Sidebar abierto y cerrado
- Responsive en desktop/tablet/mobile
- Sin ruido visual
- Componentes reutilizables
- Design System consistente
- Listo para producción

No es una maqueta. Es el producto.

---

## 🔒 LOCKED DECISIONS

Componentes congelados que nunca se modifican salvo orden explícita de Mica.

### Sprint 1 ✅ LOCKED & MERGED
- **Sidebar Design System v3.0** — Premium SaaS Quality
  - Status: **MERGED a main & CONGELADO**
  - Commit: a6ff81fb (Merge branch 'claude/multicoach-product-spec-m269gc')
  - Ubicación: `multicoach.html` (líneas 50-450)
  - Especificación: Premium (Apple/Notion/Linear/Stripe)
  - **Regla:** CERO cambios sin aprobación explícita de Mica
  - **Cambios permitidos:** Solo bugs reales (no mejoras)
  
**Especificación Bloqueada (FINAL):**
- Logo: 120px container, 110px max-width × 90px height, object-fit: contain
- Ancho: 240px expandido, 72px colapsado
- Items: 44px altura, 12px padding horizontal, 10px radius, 15px font, 20px icons
- Espaciado: 28px logo→Dashboard, 32px Dashboard→PERSONAS, 28px categorías, 12px título→item, 8px items
- Categorías: 11px, 600, uppercase, #A39A8F
- Active state: 3px left border verde, rgba(232,223,212,.55) bg, 600 weight
- Hover: rgba(0,0,0,.03) only
- Dividers: NONE (whitespace only, no border lines)
- Footer: Margin-top auto, border-top: none, solo "¿Necesitas ayuda?"
- Help button: 10px font, 400 weight, 32px height, 16px icon
- Configuración: En nav (después de Cobros), NO en footer
- Niche switcher: Hidden
- Game button: Hidden
- Mobile: Bottom nav 100% width, 72px height

### 🚀 SINGLE COACH EXPERIENCE (Sprint 4+ — ⏳ BLOQUEADO)
**Regla Arquitectónica Fundamental — NO SE PUEDE MODIFICAR**

Existe un único panel de coach: `panel-v2.html`

**ESTÁ PROHIBIDO:**
- ❌ Crear `panel-v3.html`, `coach-panel.html`, `panel-empresa.html`, `coach-enterprise.html`
- ❌ Crear variantes del panel para empresas
- ❌ Crear otro panel para ningún modelo de negocio
- ❌ Modificar la experiencia base del coach

**MultiCoach es SOLO:**
- Asignar clientes a coaches
- Mostrar métricas agregadas
- Gestionar permisos
- Administrar coaches y colaboradores
- Invitar personas

**El trabajo diario del coach SIEMPRE ocurre en el mismo panel**, independientemente de:
- Si trabaja solo o en empresa
- Si es empresa pequeña o multinacional
- Qué permisos tiene

**Lo único que cambia es el CONTEXTO:**
- Branding (Pathway vs marca empresa)
- Datos (clientes propios vs asignados)
- Permisos (qué puede hacer)
- Funcionalidades habilitadas (qué ve)

**Flujo de Autenticación (INMUTABLE):**
```
Login → panel-v2.html
```

Da igual si es coach independiente, coach en empresa, o admin.

**Si el Owner quiere ver información de un coach:**
No entra al panel.
Abre una Ficha Administrativa dentro de MultiCoach (no navega, no cambia de app).

**Responsabilidad de cada módulo:**
- **MultiCoach:** UI administrativa (gestión, asignaciones, permisos)
- **panel-v2.html:** UI operativa (trabajo diario del coach)

**Esta decisión está BLOQUEADA y no podrá modificarse salvo orden expresa de Product Owner.**

---

### Sprint 2 🚧 EN CONSTRUCCIÓN
- **Epic 1: Header** — Status: ✅ COMPLETE (User menu restructured with role-based visibility)
- **Epic 2: Dashboard Foundation** — Status: En desarrollo
- **Epic 3: MetricCard Component** — Status: En desarrollo
- **Epic 4: EmptyState System** — Status: En desarrollo
- **Epic 5: Smart Branding Architecture** — Status: Preparación
- **Epic 6: Role Architecture** — Status: Preparación
- **Epic 7: Visual Quality** — Status: Validación continua

### Sprint 4 🚧 EN CONSTRUCCIÓN
- **Epic 1: Gestión de Equipo** — Status: Especificación ✅
  - Módulo: Personas → Equipo (Coaches + Colaboradores)
  - Especificación: Panel único para gestión de equipo
  - Arquitectura: Reutilización total de componentes panel-v2
  - Regla bloqueada: Single Coach Experience (ver arriba)
  - Regla Sprint 4.2: Continuidad visual con Dashboard

### Sprint 3+ 🔮 FUTURO
(Se agregarán conforme se completen)

---

**Última actualización:** 2026-08-01  
**Próxima revisión:** Fin de Sprint 2

