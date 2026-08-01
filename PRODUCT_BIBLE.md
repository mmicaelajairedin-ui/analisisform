# PRODUCT BIBLE — MultiCoach by Pathway
**Última actualización:** 2026-08-01  
**Versión:** 2.0  
**Estado:** En construcción — Sprint 2

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
│   ├── Dashboard (Sprint 2)
│   ├── Personas
│   │   ├── Coaches
│   │   ├── Colaboradores
│   ├── Clientes
│   ├── Operación
│   │   ├── Agenda
│   │   ├── Programas
│   │   ├── Comunidad
│   ├── Negocio
│   │   ├── Analytics
│   │   ├── Cobros
│   ├── Configuración
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

### Header (Sprint 2 — Pendiente de aprobación)
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

### Sprint 1 ✅ COMPLETO (Sidebar v2.0)
- ✅ Logo Container System (80px, adaptativo)
- ✅ Spacing Rhythm (28/12/8px)
- ✅ Section Titles como etiquetas
- ✅ Active State elegante (borde + fondo)
- ✅ Collapsed State (72px, tooltips)
- ✅ Mobile hierarchy

**Estado:** CONGELADO en main

### Sprint 2 🚧 EN DESARROLLO
**Epic 1: Header**
- SearchBar global
- QuickAction architecture
- Notifications
- Chat
- UserSwitcher

**Epic 2: Dashboard Foundation**
- Estructura base
- MetricCard component
- EmptyState component
- Responsive layouts

**NO hacer en Sprint 2:**
- Analytics (Sprint 4)
- Branding Engine (Sprint 3)
- Cobros (Sprint 5)

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

### Sprint 1 ✅ LOCKED
- **Sidebar Design System v2.0** — Logo Container (80px), Spacing Rhythm, Section Titles, Active State, Collapsed (72px), Mobile hierarchy
  - Status: **CONGELADO en main**
  - Commit: 9fb478ac
  - Ubicación: `multicoach.html` (líneas 50-320)
  - Regla: 0 cambios sin aprobación explícita

### Sprint 2 🚧 EN CONSTRUCCIÓN
- **Epic 1: Header** — Status: En desarrollo
- **Epic 2: Dashboard Foundation** — Status: En desarrollo
- **Epic 3: MetricCard Component** — Status: En desarrollo
- **Epic 4: EmptyState System** — Status: En desarrollo
- **Epic 5: Smart Branding Architecture** — Status: Preparación
- **Epic 6: Role Architecture** — Status: Preparación
- **Epic 7: Visual Quality** — Status: Validación continua

### Sprint 3+ 🔮 FUTURO
(Se agregarán conforme se completen)

---

**Última actualización:** 2026-08-01  
**Próxima revisión:** Fin de Sprint 2

