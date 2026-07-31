# MultiCoach — Sistema de Componentes Oficial

**Versión:** 1.0  
**Estado:** 🔒 MASTER REFERENCE — Fuente única de verdad  
**Última actualización:** 30 Jul 2026  
**Política:** Todos los componentes nuevos en pantallas (Coaches, Clientes, Programas, Analytics, Facturación, Configuración) DEBEN reutilizar estos 8 componentes base. NO se permiten variantes propias sin revisión.

---

## 📋 Índice de Componentes

1. **KPI Cards**
2. **Alert Banner**
3. **Quick Actions**
4. **Data Tables**
5. **Activity Feed**
6. **Charts**
7. **Organization Health Cards**
8. **Community Cards**

---

## 1️⃣ KPI Cards

**Propósito:** Mostrar métricas principales en el dashboard y secciones de administración.

**Variantes:**

### A. KPI Primary (Hero)
```
Clientes Activos
187
↑ 24 este mes
```
- **Tamaño:** 2.5fr en grid (ancho)
- **Fondo:** Gradiente verde (--pw-bosque → #1a3a0c)
- **Texto:** Blanco
- **Tipografía:** Valor 4rem bold, label 1rem, change 0.875rem
- **Padding:** var(--sp-xl)
- **Border:** Ninguno
- **Sombra:** var(--shadow-md)
- **Uso:** Dashboard (1 por página máximo, siempre como primer KPI)

### B. KPI Secondary (Cards)
```
Coaches
👨‍🏫
12
↑ 2 nuevos
```
- **Tamaño:** 1fr en grid
- **Fondo:** Blanco
- **Borde:** 1px solid --pw-niebla-1
- **Tipografía:** Valor 1.75rem bold, label 0.75rem uppercase, change 0.8rem
- **Padding:** var(--sp-lg)
- **Hover:** Borde --pw-accent, sombra var(--shadow-md)
- **Transición:** 0.2s ease
- **Uso:** Dashboard + Analytics + Coaches (múltiples en grid)

**CSS Base:**
```css
.kpi-card {
  background: white;
  border: 1px solid var(--pw-niebla-1);
  border-radius: var(--radius-lg);
  padding: var(--sp-lg);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.kpi-card:hover {
  border-color: var(--pw-accent);
  box-shadow: var(--shadow-md);
}

.kpi-card-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--pw-carbon);
  line-height: 1;
  margin-bottom: var(--sp-xs);
}
```

**Dónde aparece:**
- Dashboard (6 KPIs: 1 primary + 2 secondary)
- Coaches (1-2 secondary)
- Clients (1-2 secondary)
- Analytics (múltiples)
- Facturación (plan info)

---

## 2️⃣ Alert Banner

**Propósito:** Alertas visuales de problemas críticos o información importante.

**Variantes:**

### A. Alert Warning (Principal)
```
⚠️ Atención — 3 problemas
• 2 coaches sin clientes
• 1 factura pendiente
• 3 clientes inactivos
```
- **Fondo:** Gradiente amarillo (#FEF3C7 → #FEE8C3)
- **Borde:** 1px #FBBF24
- **Icono:** 1.75rem
- **Tipografía:** Title 1rem bold, items 0.875rem
- **Padding:** var(--sp-lg)
- **Display:** flex horizontal
- **Margin-bottom:** var(--sp-xl)
- **Uso:** Dashboard (1 máximo, arriba de todo)

### B. Alert Info
```
ℹ️ Información importante
Contenido del mensaje
```
- **Fondo:** Gradiente azul (#DBEAFE → #BFDBFE)
- **Borde:** 1px #3B82F6
- **Mismo layout que Warning**

### C. Alert Success
```
✅ Cambios guardados
El operación fue exitosa
```
- **Fondo:** Gradiente verde (#DCFCE7 → #BBF7D0)
- **Borde:** 1px #22C55E

**CSS Base:**
```css
.alert-card {
  background: linear-gradient(135deg, #FEF3C7, #FEE8C3);
  border: 1px solid #FBBF24;
  border-radius: var(--radius-lg);
  padding: var(--sp-lg);
  margin-bottom: var(--sp-xl);
  display: flex;
  gap: var(--sp-lg);
}

.alert-card-icon {
  font-size: 1.75rem;
  flex-shrink: 0;
}

.alert-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--pw-carbon);
  margin-bottom: var(--sp-sm);
}
```

**Dónde aparece:**
- Dashboard (1 warning principal)
- Coaches (info/success después de acciones)
- Clients (warning si hay problemas)
- Todos lados (feedback de operaciones)

---

## 3️⃣ Quick Actions

**Propósito:** CTAs contextuales para acciones principales en cada pantalla.

**Formato:**
```
┌─────────────────┐
│      ➕        │
│  Invitar Coach  │
└─────────────────┘
```

**Especificación:**
- **Grid:** repeat(4, 1fr) en desktop, responsive a 2 cols en tablet
- **Fondo:** Gradiente gris (#F3F4F6 → #E5E7EB)
- **Borde:** 1px #D1D5DB
- **Border-radius:** var(--radius-lg)
- **Padding:** var(--sp-md) var(--sp-lg) (vertical comprimido)
- **Altura:** min-height 100px
- **Tipografía:** 0.9rem semibold
- **Icono:** 1.5rem
- **Gap:** var(--sp-sm) entre icon y text
- **Hover:** Elevarse 4px, cambiar fondo a color específico del botón, border a color específico

**Variantes de color (hover):**
1. Azul: bg #DBEAFE → #BFDBFE, border #3B82F6
2. Verde: bg #D1FAE5 → #A7F3D0, border #10B981
3. Naranja: bg #FED7AA → #FDBA74, border #F97316
4. Púrpura: bg #E9D5FF → #D8B4FE, border #A855F7

**Margin-bottom:** var(--sp-xl)

**CSS Base:**
```css
.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-sm);
  margin-bottom: var(--sp-xl);
}

.action-btn {
  background: linear-gradient(135deg, #F3F4F6, #E5E7EB);
  border: 1px solid #D1D5DB;
  border-radius: var(--radius-lg);
  padding: var(--sp-md) var(--sp-lg);
  text-align: center;
  color: var(--pw-carbon);
  font-weight: 500;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 100px;
  justify-content: center;
}

.action-btn:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
```

**Dónde aparece:**
- Dashboard (4 acciones: Invitar Coach, Crear Programa, Añadir Cliente, Ver Org)
- Coaches (Invitar Coach, Ver Clientes)
- Clients (Añadir Cliente, Importar CSV)
- Programas (Crear Programa)
- Cualquier pantalla que necesite CTAs principales

---

## 4️⃣ Data Tables

**Propósito:** Mostrar listas de coaches, clientes, pagos, etc.

**Estructura:**
```
┌─ Nombre ─ Email ─ Estado ─ Acciones ─┐
├──────────────────────────────────────┤
│ Juan P. │ juan@  │ Activo  │ ⋮       │
│ María G.│ maria@ │ Inactiv │ ⋮       │
│ Carlos M│ carlos │ Activo  │ ⋮       │
└──────────────────────────────────────┘
```

**Especificación:**
- **Borde:** 1px solid --pw-niebla-1
- **Border-radius:** var(--radius-lg)
- **Fondo:** Blanco
- **Sombra:** var(--shadow-sm)
- **Header fondo:** var(--pw-niebla-1)
- **Tipografía header:** 0.75rem uppercase, --pw-neutral-600
- **Tipografía filas:** 0.9rem, --pw-carbon
- **Padding:** var(--sp-md)
- **Row height:** 48px mínimo (responsive)
- **Hover row:** Background var(--pw-niebla-1), cursor pointer
- **Responsive:** Tabla scrollable horizontal en mobile, tarjetas en tablet

**Elemento: Acciones Menu (⋮)**
- Botón discreto con 3 puntitos
- Abre menú contextual (Editar, Desactivar, Ver detalles, etc.)
- Posición: última columna

**CSS Base:**
```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--pw-niebla-1);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: white;
}

.data-table th {
  background: var(--pw-niebla-1);
  padding: var(--sp-md);
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--pw-neutral-600);
  border-bottom: 1px solid var(--pw-niebla-1);
}

.data-table td {
  padding: var(--sp-md);
  border-bottom: 1px solid var(--pw-niebla-1);
  font-size: 0.9rem;
}

.data-table tbody tr:hover {
  background: var(--pw-niebla-1);
}
```

**Dónde aparece:**
- Coaches (lista de coaches)
- Clients (lista de clientes)
- Programas (clientes en programa)
- Analytics (coaches, cohortes)
- Facturación (pagos)
- Configuración (usuarios, integraciones)

---

## 5️⃣ Activity Feed

**Propósito:** Timeline de eventos recientes (sesiones, cliente asignado, coach añadido, etc.).

**Formato:**
```
✅ Coach añadido        Hace 5 minutos
✅ Cliente reasignado   Hace 3 minutos
✅ Programa creado      Hace 2 minutos
```

**Especificación:**
- **Display:** flex column
- **Dot:** 10px círculo, color según tipo (success verde, warning naranja, alert rojo)
- **Dot position:** Izquierda con 5px margin-top
- **Content:** flex 1, min-width 0
- **Title:** 0.9rem semibold, --pw-carbon
- **Time:** 0.75rem, --pw-neutral-400, margin-top 2px
- **Item border:** 1px bottom --pw-niebla-1
- **Item padding:** var(--sp-md) bottom
- **Last item:** Sin border-bottom
- **Gap entre items:** var(--sp-md)

**CSS Base:**
```css
.timeline {
  display: flex;
  flex-direction: column;
  gap: var(--sp-md);
}

.timeline-item {
  display: flex;
  gap: var(--sp-md);
  padding-bottom: var(--sp-md);
  border-bottom: 1px solid var(--pw-niebla-1);
}

.timeline-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--pw-accent);
  margin-top: 5px;
  flex-shrink: 0;
}

.timeline-dot.success {
  background: var(--status-success);
}
```

**Dónde aparece:**
- Dashboard (actividad reciente: 4-5 eventos)
- Coach Detail (actividad del coach: sesiones, notas, cambios)
- Client Detail (actividad del cliente: subidas, cambios, notas)
- Analytics (si aplica, timeline de cambios)

---

## 6️⃣ Charts

**Propósito:** Visualizaciones de data (líneas, barras, pie, heatmap).

**Tipos permitidos:**
1. **Línea:** Performance 30 días
2. **Barras apiladas:** Documentos (CV sí/no, Carta sí/no)
3. **Pie:** Distribución (activo/completado/pausado)
4. **Heatmap:** Desempeño coach vs completitud

**Especificación:**
- **Container:** Panel (white bg, border, radius, shadow)
- **Height:** 300px mínimo
- **SVG viewBox:** 0 0 500 300 (aspect ratio consistente)
- **Padding container:** var(--sp-lg)
- **Title arriba:** Panel-title con icono
- **Leyenda:** Debajo del gráfico, si aplica
- **Responsive:** En mobile, simplificar a barra horizontal o tabla

**Colores de línea:**
- Gradiente: --pw-bosque → --pw-accent
- Fill bajo línea: Gradiente com opacity 0.3

**CSS Base:**
```css
.chart-container {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--sp-lg);
  border: 1px solid var(--pw-niebla-1);
  margin-bottom: var(--sp-xl);
}

.chart {
  width: 100%;
  height: 300px;
}
```

**Dónde aparece:**
- Dashboard (performance 30 días)
- Analytics (múltiples gráficos)
- Programas (progreso por semana)
- Facturación (ingresos timeline)

---

## 7️⃣ Organization Health Cards

**Propósito:** Mostrar métricas de salud de la organización de forma compacta.

**Formato:**
```
┌─────────────────┐
│ Estado          │
│ ✓ Operativa     │
├─────────────────┤
│ Planes          │
│ 12              │
├─────────────────┤
│ Ratio           │
│ 16 clientes/coach
├─────────────────┤
│ Capacidad       │
│ 74%             │
└─────────────────┘
```

**Especificación:**
- **Grid:** repeat(2, 1fr) en desktop
- **Fondo:** var(--pw-niebla-1)
- **Padding:** var(--sp-md)
- **Border-radius:** var(--radius-md)
- **Label:** 0.7rem uppercase, --pw-neutral-600, margin-bottom var(--sp-xs)
- **Value:** 1.1rem bold, --pw-carbon
- **Gap:** var(--sp-md)
- **Responsive:** 1 col en mobile

**CSS Base:**
```css
.org-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--sp-md);
}

.org-item {
  padding: var(--sp-md);
  background: var(--pw-niebla-1);
  border-radius: var(--radius-md);
}

.org-item-label {
  font-size: 0.7rem;
  color: var(--pw-neutral-600);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-weight: 600;
  margin-bottom: var(--sp-xs);
}

.org-item-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--pw-carbon);
}
```

**Dónde aparece:**
- Dashboard (salud de org: 4 items)
- Coach Detail (asignaciones del coach)
- Cualquier pantalla que muestre resumen rápido

---

## 8️⃣ Community Cards

**Propósito:** Feed de noticias, eventos, avisos de la comunidad empresarial.

**Formato:**
```
PRODUCTO
Nuevo sistema de reportes
Hace 2 días

EVENTO
Webinar: Escalando a 50+ coaches
Hace 4 días

SEGURIDAD
Actualizaciones de cumplimiento
Hace 1 semana
```

**Especificación:**
- **Display:** flex column
- **Item padding:** var(--sp-md) bottom
- **Item border:** 1px bottom --pw-niebla-1
- **Last item:** Sin border
- **Tag:** 0.6rem uppercase, font-weight 600, padding 3px 6px, bg var(--pw-niebla-1), color --pw-neutral-600, radius var(--radius-sm), margin-bottom var(--sp-xs), letter-spacing 0.3px
- **Title:** 0.9rem semibold, --pw-carbon, margin-bottom var(--sp-xs)
- **Date:** 0.75rem, --pw-neutral-400
- **Gap:** var(--sp-md)

**CSS Base:**
```css
.community-feed {
  display: flex;
  flex-direction: column;
  gap: var(--sp-md);
}

.community-item {
  padding-bottom: var(--sp-md);
  border-bottom: 1px solid var(--pw-niebla-1);
}

.community-item:last-child {
  border-bottom: none;
}

.community-tag {
  display: inline-block;
  font-size: 0.6rem;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  background: var(--pw-niebla-1);
  color: var(--pw-neutral-600);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: var(--sp-xs);
}

.community-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--pw-carbon);
  margin-bottom: var(--sp-xs);
}

.community-date {
  font-size: 0.75rem;
  color: var(--pw-neutral-400);
}
```

**Dónde aparece:**
- Dashboard (4-5 noticias recientes)
- Comunidad (feed completo)
- Cualquier "últimas noticias" sidebar

---

## 🔒 REGLAS OBLIGATORIAS

### Para Coaches (Pantalla 2)
- ✅ Usar KPI Cards (secondary) para coaches activos/inactivos
- ✅ Usar Data Table para lista de coaches
- ✅ Usar Quick Actions (Invitar Coach, etc.)
- ✅ Usar Activity Feed si hay eventos de coaches
- ✅ NO crear variantes de KPI Card
- ✅ NO crear tablas diferentes
- ✅ NO crear acciones con otro estilo

### Para Clients (Pantalla 4)
- ✅ Usar KPI Cards para métricas
- ✅ Usar Data Table para lista de clientes
- ✅ Usar Quick Actions
- ✅ Usar Alert Banner para clientes en riesgo
- ✅ NO crear nuevas variantes

### General
1. **Componentes son sagrados** — Una vez aprobados, NO se modifican sin documento de cambio
2. **Reutilización obligatoria** — Si existe un componente, usarlo
3. **Extensión prohibida** — Si necesitas una variante, abrir issue primero
4. **Consistencia = Calidad** — Todos usan los mismos componentes = mismo look & feel

---

## ✅ Checklist de Aprobación

- [x] KPI Cards (primary + secondary)
- [x] Alert Banner (3 variantes)
- [x] Quick Actions (4 botones, colores hover)
- [x] Data Tables (estructura base)
- [x] Activity Feed (timeline)
- [x] Charts (SVG, línea + fill)
- [x] Organization Health Cards (4 items grid)
- [x] Community Cards (feed)

**APROBADO POR:** Micaela Jairedin  
**FECHA:** 30 Jul 2026  
**ESTADO:** 🔒 OFICIAL — Implementación obligatoria en todas las pantallas  

**Próximo paso:** Coaches (owner-coaches.html) reutilizando TODOS estos 8 componentes. Cero variantes nuevas.
