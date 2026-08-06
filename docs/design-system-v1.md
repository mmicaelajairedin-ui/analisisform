# Design System v1 — Component Library

**Locked:** Sprint Consolidación. Reference for all future modules (Agenda, Programas, Analytics, Comunidad).

---

## Overview

Design System v1 is the canonical component library for all Pathway MultiCoach platforms. It defines:
- **63 reusable components** (HTML structure + CSS + JavaScript)
- **Responsive breakpoints**: Desktop (1200px+), Tablet (768px), Mobile (480px)
- **Accessibility standards**: WCAG 2.1 AA, touch targets ≥44px
- **Permission-aware rendering**: Components respect user role & capabilities
- **Single source of truth**: Each component defined ONCE, reused everywhere

---

## 1. Layout Components

### 1.1 Header
**Purpose**: Navigation bar with title and account controls.
**CSS Classes**: `.header`
**HTML Structure**:
```html
<header>
  <h1>MultiCoach v3 — Pathway</h1>
  <div>
    <button class="logout-btn">Cerrar sesión</button>
  </div>
</header>
```
**Props**:
- `title` (string): Page title
- `actions` (array): Right-aligned action buttons

**Usage**:
- Global header, every page
- Background: `#fff`
- Border-bottom: `1px solid #e0e0e0`
- Padding: `20px`

**Responsive**:
- Desktop: Full horizontal layout
- Tablet: Same
- Mobile: Stack title + buttons vertically if needed

---

### 1.2 Tabs Navigation
**Purpose**: Switch between sections (Equipo, Coaches, Clientes).
**CSS Classes**: `.tabs`, `.tab-btn`, `.tab-btn.active`
**HTML Structure**:
```html
<nav class="tabs">
  <button class="tab-btn active" onclick="switchTab('equipo')">Equipo</button>
  <button class="tab-btn" onclick="switchTab('coaches')">Coaches</button>
  <button class="tab-btn" onclick="switchTab('clientes')">Clientes</button>
</nav>
```
**Props**:
- `tabs` (array): `[{label, id, onclick}]`
- `activeTab` (string): Current tab ID

**Styling**:
- Background: `#fff`
- Padding: `16px 20px`
- Active border-bottom: `2px solid #333`
- Hover: color `#666`

**Accessibility**:
- `role="tablist"` on nav
- `role="tab"` on buttons
- `aria-selected="true"` on active tab
- Keyboard: Arrow keys navigate, Enter activates

---

### 1.3 Main Container
**Purpose**: Max-width content centering.
**CSS Classes**: `main`
**HTML Structure**:
```html
<main>
  <!-- Content sections -->
</main>
```
**Styling**:
- Max-width: `1400px`
- Margin: `0 auto`
- Padding: `20px`
- Background: `#f5f5f5`

---

### 1.4 Section / Tab Content
**Purpose**: Display/hide tab content.
**CSS Classes**: `section`, `section.active`
**HTML Structure**:
```html
<section id="equipo" class="active">
  <!-- Equipo content -->
</section>
<section id="coaches">
  <!-- Coaches content -->
</section>
```
**Behavior**:
- Only `section.active` displays (`display: block`)
- Others hidden (`display: none`)
- Switch with `switchTab(id)` function

---

## 2. Data Display Components

### 2.1 Card
**Purpose**: Elevated container for related content.
**CSS Classes**: `.card`
**HTML Structure**:
```html
<div class="card">
  <div class="card-header">
    <!-- Title, actions -->
  </div>
  <div class="card-content">
    <!-- Content -->
  </div>
</div>
```
**Styling**:
- Background: `#fff`
- Border-radius: `8px`
- Box-shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Overflow: `hidden`

**Responsive**:
- Desktop: Full-width or side-by-side
- Tablet: Stack if needed
- Mobile: Full-width, reduced padding

---

### 2.2 Controls Bar (Search + Filters)
**Purpose**: Search, filter, and action buttons above tables.
**CSS Classes**: `.controls`
**HTML Structure**:
```html
<div class="controls">
  <input type="search" placeholder="Buscar por nombre, email..." onkeyup="filterEquipo()">
  <select onchange="filterEquipo()">
    <option value="">Todos los roles</option>
    <option value="owner">Owner</option>
    <option value="coach">Coach</option>
    <option value="colaborador">Colaborador</option>
  </select>
  <button class="btn-primary" onclick="openAddPersonModal()">+ Agregar</button>
</div>
```
**Styling**:
- Background: `#fff`
- Padding: `16px`
- Border-bottom: `1px solid #f0f0f0`
- Display: `flex`
- Gap: `12px`
- Flex-wrap: `wrap`

**Responsive**:
- Desktop: Flex row, search flex:1
- Tablet: Same
- Mobile: Stack vertically (flex-direction: column)

**Accessibility**:
- Labels with `<label for="search">` or `aria-label`
- Keyboard: Tab navigates all controls
- Search input gets focus on page load

---

### 2.3 Tables
**Purpose**: Display lists of team members, clients, coaches.
**CSS Classes**: `table`, `thead`, `tbody`, `th`, `td`
**HTML Structure**:
```html
<table>
  <thead>
    <tr>
      <th>Nombre</th>
      <th>Email</th>
      <th>Rol</th>
      <th>Capacidad</th>
      <th>Estado</th>
    </tr>
  </thead>
  <tbody>
    <tr onclick="openEquipoDrawer(member.id)">
      <td>Name</td>
      <td>email@test.com</td>
      <td>Coach</td>
      <td>
        <div class="capacity-bar">
          <div class="capacity-progress">
            <div class="capacity-fill" style="width: 70%;"></div>
          </div>
          <span>70%</span>
        </div>
      </td>
      <td><span class="badge active">Activo</span></td>
    </tr>
  </tbody>
</table>
```
**Styling**:
- Width: `100%`
- Border-collapse: `collapse`
- `th`: Background `#f9f9f9`, padding `12px`, text-align `left`, font-weight `500`
- `td`: Padding `12px`, border-bottom `1px solid #f0f0f0`
- Row hover: Background `#f9f9f9` (optional)
- Clickable row: `cursor: pointer`

**Responsive**:
- Desktop (1200px+): Full table, font-size `14px`
- Tablet (768px): Font-size `12px`, padding `8px`
- Mobile (480px): 
  - Stack table as cards per row, OR
  - Horizontal scroll in container with `overflow-x: auto`
  - Minimum column widths to prevent squashing

**Accessibility**:
- `<th scope="col">` for column headers
- Clickable rows have `role="button"` or are actual buttons
- Color not only indicator (badges + icons)

---

### 2.4 Badge (Status Indicator)
**Purpose**: Inline status label (Activo/Inactivo/Atrasado).
**CSS Classes**: `.badge`, `.badge.active`, `.badge.inactive`, `.badge.warning`, `.badge.danger`
**HTML Structure**:
```html
<span class="badge active">Activo</span>
<span class="badge inactive">Inactivo</span>
<span class="badge warning">Atrasado</span>
<span class="badge danger">Error</span>
```
**Styling**:
```css
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.badge.active { background: #e8f5e9; color: #2e7d32; }
.badge.inactive { background: #f3e5f5; color: #7b1fa2; }
.badge.warning { background: #fff3e0; color: #e65100; }
.badge.danger { background: #ffebee; color: #d32f2f; }
```
**Usage**:
- Team member state (Activo/Inactivo)
- Client state
- Task status
- Alert state

---

### 2.5 States & Loading

#### 2.5.1 Loading State
**CSS Classes**: `.loading`
**HTML Structure**:
```html
<div class="loading">
  <p>Cargando datos...</p>
</div>
```
**Styling**:
- Padding: `40px`
- Text-align: `center`
- Color: `#999`

#### 2.5.2 Empty State
**CSS Classes**: `.empty`
**HTML Structure**:
```html
<div class="empty">
  <p style="font-size: 40px;">👥</p>
  <h3>Aún no tienes equipo</h3>
  <p>Invita a tu primer coach para comenzar.</p>
  <button class="btn-primary" onclick="openAddPersonModal()">Invitar coach</button>
</div>
```
**Styling**:
- Padding: `40px`
- Text-align: `center`
- Color: `#999`

#### 2.5.3 Error State
**CSS Classes**: `.error`
**HTML Structure**:
```html
<div class="error">
  <p>❌ Error al cargar equipo. Intenta nuevamente.</p>
</div>
```
**Styling**:
- Padding: `16px`
- Background: `#ffebee`
- Color: `#d32f2f`
- Border-left: `4px solid #d32f2f`

---

## 3. Statistics & Metrics Components

### 3.1 Stats Row
**Purpose**: Display KPIs for a section.
**CSS Classes**: `.stats`
**HTML Structure**:
```html
<div class="stats">
  <div class="stat-card">
    <div class="stat-label">Miembros</div>
    <div class="stat-value">12</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Coaches</div>
    <div class="stat-value">5</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Clientes</div>
    <div class="stat-value">34</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Carga Total</div>
    <div class="stat-value">85%</div>
  </div>
</div>
```
**Styling**:
```css
.stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.stat-card {
  flex: 1;
  min-width: 200px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.stat-label {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}
```
**Responsive**:
- Desktop (1200px+): 4 cards per row (flex: 1 1 22%)
- Tablet (768px): 2 cards per row (flex: 1 1 48%)
- Mobile (480px): 1 card per row (flex: 1 1 100%)

---

## 4. Capacity & Progress Components

### 4.1 Capacity Bar
**Purpose**: Visual progress indicator with color coding.
**CSS Classes**: `.capacity-bar`, `.capacity-progress`, `.capacity-fill`, `.capacity-indicator`
**HTML Structure**:
```html
<div class="capacity-bar">
  <div class="capacity-progress">
    <div class="capacity-fill" id="fill-coach-123" style="width: 70%;"></div>
  </div>
  <span class="capacity-indicator">🟢 70%</span>
</div>
```
**Styling**:
```css
.capacity-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.capacity-progress {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}
.capacity-fill {
  height: 100%;
  background: #2e7d32; /* Green */
  transition: background-color 0.3s, width 0.3s;
}
.capacity-fill.warning {
  background: #f57c00; /* Orange: 80-99% */
}
.capacity-fill.danger {
  background: #d32f2f; /* Red: ≥100% */
}
.capacity-indicator {
  font-size: 12px;
  font-weight: 500;
  min-width: 50px;
  text-align: right;
}
```
**Color Rules**:
- Green (🟢): 0-79% → Coach has capacity
- Orange (🟡): 80-99% → Coach near capacity limit
- Red (🔴): ≥100% → Coach over capacity

**Usage**: Anywhere coach/team capacity is displayed (Equipo drawer, Clientes coach card, Coach Cartera).

---

## 5. Form & Input Components

### 5.1 Text Input
**CSS Classes**: (inline styling or `.input-text`)
**HTML Structure**:
```html
<label for="name">Nombre</label>
<input type="text" id="name" placeholder="Ingresa nombre" value="">
```
**Styling**:
```css
input[type="text"],
input[type="email"],
input[type="search"] {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}
input:focus {
  outline: none;
  border-color: #333;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
}
```
**Responsive**:
- Desktop: Full-width
- Tablet: Full-width
- Mobile: Full-width, min-height `44px` (touch target)

**Accessibility**:
- Always paired with `<label for="id">`
- Placeholder is NOT a substitute for label
- Error messages with `aria-describedby="error-id"`

---

### 5.2 Select Dropdown
**HTML Structure**:
```html
<label for="role-select">Rol</label>
<select id="role-select" onchange="submitChangeRole()">
  <option value="">Selecciona un rol</option>
  <option value="owner">Owner</option>
  <option value="coach">Coach</option>
  <option value="colaborador">Colaborador</option>
</select>
```
**Styling**:
```css
select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
}
select:focus {
  outline: none;
  border-color: #333;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
}
```

---

### 5.3 Search Input
**HTML Structure**:
```html
<input type="search" placeholder="Buscar por nombre, email..." onkeyup="filterEquipo()">
```
**Styling**:
```css
input[type="search"] {
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  flex: 1;
  min-width: 200px;
}
```
**Behavior**:
- Triggers filter on keyup (real-time search)
- Applies to multiple fields: name, email, specialty
- Case-insensitive match

---

## 6. Button Components

### 6.1 Primary Button
**CSS Classes**: `.btn-primary`
**HTML Structure**:
```html
<button class="btn-primary" onclick="openAddPersonModal()">+ Agregar</button>
```
**Styling**:
```css
.btn-primary {
  padding: 10px 20px;
  background: #333;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover {
  background: #1a1a1a;
}
.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```
**Usage**:
- Primary actions (Create, Save, Add)
- High contrast for visibility

---

### 6.2 Secondary Button
**CSS Classes**: `.btn-secondary`
**HTML Structure**:
```html
<button class="btn-secondary" onclick="closeDrawer()">Cancelar</button>
```
**Styling**:
```css
.btn-secondary {
  padding: 10px 20px;
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover {
  background: #e0e0e0;
}
```
**Usage**:
- Cancel, Back, Secondary actions
- Lower visual weight than primary

---

### 6.3 Danger Button
**CSS Classes**: `.btn-danger` or `.drawer-btn.danger`
**HTML Structure**:
```html
<button class="drawer-btn danger" onclick="removeEquipoMember()">Quitar de la organización</button>
```
**Styling**:
```css
.drawer-btn.danger {
  color: #d32f2f;
  border-color: #ffcdd2;
  background: #fff;
}
.drawer-btn.danger:hover {
  background: #ffebee;
}
```
**Usage**:
- Destructive actions (Delete, Remove)
- Red text on light background
- Confirmation dialog recommended

---

### 6.4 Logout Button
**CSS Classes**: `.logout-btn`
**HTML Structure**:
```html
<button class="logout-btn" onclick="logout()">Cerrar sesión</button>
```
**Styling**:
```css
.logout-btn {
  padding: 8px 16px;
  background: #f0f0f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}
.logout-btn:hover {
  background: #e0e0e0;
}
```

---

## 7. Drawer & Modal Components

### 7.1 Drawer (Side Panel)
**Purpose**: Detail panel sliding from right, for viewing/editing entity data.
**CSS Classes**: `.drawer-overlay`, `.drawer`, `.drawer.open`, `.drawer-header`, `.drawer-content`, `.drawer-footer`
**HTML Structure**:
```html
<div class="drawer-overlay" id="equipo-drawer-overlay" onclick="closeEquipoDrawer()"></div>
<div class="drawer" id="equipo-drawer">
  <div class="drawer-header">
    <h2>Detalles del Coach</h2>
    <button class="drawer-close" onclick="closeEquipoDrawer()">✕</button>
  </div>
  
  <div class="drawer-content">
    <div class="drawer-section">
      <div class="drawer-field">
        <div class="drawer-label">Nombre</div>
        <div class="drawer-value" id="drawer-name">John Doe</div>
      </div>
    </div>
    
    <div class="drawer-section">
      <div class="drawer-section-title">Capacidad</div>
      <div class="drawer-field">
        <div class="capacity-bar">
          <div class="capacity-progress">
            <div class="capacity-fill" id="drawer-capacity-fill" style="width: 70%;"></div>
          </div>
          <span id="drawer-capacity-text">70%</span>
        </div>
      </div>
    </div>
  </div>
  
  <div class="drawer-footer">
    <button class="drawer-btn" onclick="editEquipoMember()">Editar</button>
    <button class="drawer-btn" onclick="closeEquipoDrawer()">Cerrar</button>
  </div>
</div>
```
**Styling**:
```css
.drawer-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}
.drawer-overlay.open {
  display: block;
}

.drawer {
  display: none;
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: #fff;
  z-index: 1000;
  flex-direction: column;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
}
.drawer.open {
  display: flex;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
}
.drawer-header h2 {
  margin: 0;
  font-size: 18px;
}
.drawer-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  transition: color 0.2s;
}
.drawer-close:hover {
  color: #333;
}

.drawer-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
.drawer-section {
  margin-bottom: 24px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 20px;
}
.drawer-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}
.drawer-section-title {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  font-weight: 500;
  margin-bottom: 12px;
}
.drawer-field {
  margin-bottom: 20px;
}
.drawer-field:last-child {
  margin-bottom: 0;
}
.drawer-label {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.drawer-value {
  font-size: 14px;
  color: #333;
}

.drawer-footer {
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 8px;
}
```
**Behavior**:
- Opens when `.open` class added to overlay + drawer
- Closes with overlay click or close button
- Scrollable content if overflow
- Fixed position, slides in from right

**Responsive**:
- Desktop (1200px+): 400px width
- Tablet (768px): 360px width or 90vw
- Mobile (480px): 100vw (full width), covers entire screen

---

### 7.2 Modal (Dialog)
**Purpose**: Centered dialog for focused interactions (forms, confirmations).
**CSS Classes**: Same as drawer (`.drawer-overlay`, `.drawer`)
**Structure**: Identical to drawer (header, content, footer)
**Differences from Drawer**:
- Centered on screen (not fixed-right)
- Smaller max-width (e.g., 500px)
- Typically modal (requires action before closing)

**Responsive Modal Sizing**:
- Desktop: max-width `500px`, centered
- Tablet: max-width `90vw`, centered
- Mobile: max-width `100vw`, full screen with margins

---

## 8. Form & Input Sections (Inside Drawer)

### 8.1 Drawer Input Section
**HTML Structure**:
```html
<div class="drawer-section">
  <div class="drawer-field">
    <label class="drawer-label" for="edit-name">Nombre</label>
    <input type="text" id="edit-name" value="John Doe">
  </div>
  <div class="drawer-field">
    <label class="drawer-label" for="edit-email">Email</label>
    <input type="email" id="edit-email" value="john@test.com">
  </div>
</div>
```
**Styling**:
```css
.drawer input[type="text"],
.drawer input[type="email"],
.drawer select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}
```

---

## 9. Responsive Behavior

### 9.1 Breakpoints

| Breakpoint | Name | Use Case | Width |
|-----------|------|----------|-------|
| Mobile | XS | Phones | < 480px |
| Tablet | MD | Tablets | 480px - 767px |
| Desktop | LG | Monitors | ≥ 768px |

### 9.2 Media Query Template
```css
/* Desktop (default styles above) */

@media (max-width: 768px) {
  /* Tablet: 768px and below */
  .stats { flex-direction: row; /* 2 per row */ }
  .drawer { width: 360px; }
  table { font-size: 12px; }
  .controls { flex-direction: column; }
}

@media (max-width: 480px) {
  /* Mobile: 480px and below */
  .stats { flex-direction: column; /* 1 per row */ }
  .drawer { width: 100vw; }
  .drawer-overlay { background: rgba(0, 0, 0, 0.7); }
  table { overflow-x: auto; font-size: 11px; }
  .controls { flex-direction: column; gap: 8px; }
  .btn-primary, .btn-secondary { width: 100%; }
}
```

### 9.3 Touch Targets (Mobile Accessibility)
- Minimum size: 44px × 44px (44px recommended)
- Buttons: `padding: 12px 20px` (min 44px height)
- Clickable elements: min-width `44px`

### 9.4 Typography Scaling
| Device | Body | Labels | Headings |
|--------|------|--------|----------|
| Desktop | 14px | 12px | 18px/20px |
| Tablet | 13px | 11px | 16px |
| Mobile | 13px | 10px | 14px |

---

## 10. Accessibility Standards

### 10.1 WCAG 2.1 AA Compliance
- **Color contrast**: Text ≥ 4.5:1 ratio
- **Focus visible**: Keyboard outline on inputs/buttons
- **Semantic HTML**: Use `<label>`, `<button>`, `<table>`, etc.
- **ARIA labels**: For icon-only buttons
- **Keyboard navigation**: Tab, Shift+Tab, Enter, Escape

### 10.2 Implementation Checklist
- [ ] All inputs have `<label>`
- [ ] Buttons have accessible names
- [ ] Color not only indicator (e.g., badges + text)
- [ ] Focus outline visible (min 2px)
- [ ] Touch targets ≥ 44px × 44px
- [ ] Text size readable (min 12px, 13px mobile)
- [ ] Images have alt text
- [ ] Tables have `<thead>` + `<th scope="col">`

---

## 11. Color Palette

| Use | Hex | RGB | Name |
|-----|-----|-----|------|
| **Text** | `#333` | 51,51,51 | Dark Gray |
| **Text secondary** | `#999` | 153,153,153 | Medium Gray |
| **Background** | `#fff` | 255,255,255 | White |
| **Background light** | `#f5f5f5` | 245,245,245 | Off-White |
| **Border** | `#e0e0e0` | 224,224,224 | Light Border |
| **Primary button** | `#333` | 51,51,51 | Dark Gray |
| **Success/Active** | `#2e7d32` | 46,125,50 | Green |
| **Warning** | `#f57c00` | 245,124,0 | Orange |
| **Error/Danger** | `#d32f2f` | 211,47,47 | Red |

---

## 12. Typography

| Use | Font | Size | Weight | Line-height |
|-----|------|------|--------|-------------|
| **Body text** | System stack | 14px | 400 | 1.5 |
| **Labels** | System stack | 12px | 500 | 1.4 |
| **Heading H1** | System stack | 20px | 600 | 1.3 |
| **Heading H2** | System stack | 18px | 600 | 1.3 |
| **Heading H3** | System stack | 16px | 600 | 1.3 |
| **Small text** | System stack | 12px | 400 | 1.4 |

**Font Stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

---

## 13. Spacing Scale

| Token | Value | Use Cases |
|-------|-------|-----------|
| xs | 4px | Micro-spacing (gap between icons) |
| sm | 8px | Small gap (button padding) |
| md | 12px | Standard gap (control spacing) |
| lg | 16px | Large gap (section padding) |
| xl | 20px | Extra large (main padding) |
| xxl | 24px | Huge (section separation) |

---

## 14. Shadow System

| Elevation | Shadow | Use |
|-----------|--------|-----|
| None | `none` | Flat elements (buttons, inputs) |
| Raised | `0 1px 3px rgba(0,0,0,0.1)` | Cards, drawers |
| Floating | `0 4px 8px rgba(0,0,0,0.15)` | Modals |
| Overlay | `0 8px 16px rgba(0,0,0,0.2)` | Dropdown menus |

---

## 15. Component Checklist for Future Modules

When implementing a new module (Agenda, Programas, Analytics), verify:

- [ ] Use only components from this library
- [ ] Reuse `.btn-primary`, `.btn-secondary`, not inline styles
- [ ] Use `.stat-card` for metrics (not custom)
- [ ] Use `.badge` for status (not inline spans)
- [ ] Use `.capacity-bar` for progress (not custom)
- [ ] Use `.drawer` template for side panels (not custom modals)
- [ ] Use `.card` for containers (not custom divs)
- [ ] Use color palette (no new colors)
- [ ] Responsive: Test at 480px, 768px, 1200px+
- [ ] Accessibility: WCAG 2.1 AA compliance
- [ ] Follow naming: `.kebab-case` for classes
- [ ] Single source of truth: Register reusable functions in helpers

---

## 16. Helper Functions (JavaScript)

All future modules should use these helpers:

### 16.1 Rendering Helpers
```javascript
// Create reusable stat card
renderStats(data)  
// { label, value, icon? }

// Create empty state
renderEmptyState(emoji, title, description, ctaText, ctaHandler)

// Create badge
renderBadge(status)  
// Returns HTML: <span class="badge ...">

// Populate select with options
_populateCoachSelect(selectId)

// Update capacity bar visuals
_updateCapacityBar(fillId, textId, coachId)

// Get coach capacity object
getCoachCapacity(coachId)

// Get capacity percentage
getCapacity(member)

// Get capacity color (green/orange/red)
getCapacityColor(percent)

// Get capacity indicator emoji
getCapacityIndicator(percent)
```

### 16.2 Utility Helpers
```javascript
// HTML escape (XSS prevention)
esc(str)

// Show error message in section
showError(section, message)

// Logout (clear localStorage + redirect)
logout()
```

---

## 17. Frozen Status

**This Design System v1 is LOCKED and canonical for all future development.**

- ✅ **No modifications** unless approved by Product Owner
- ✅ **All new modules** must use ONLY these components
- ✅ **Custom components** are not permitted without design review
- ✅ **Color palette** is fixed (no new brand colors in chrome)
- ✅ **Responsive breakpoints** are 480px / 768px / 1200px+ (no additional breakpoints)

**To add a new component:**
1. Create GitHub issue with business case
2. Design review by Product Owner
3. Add to v1.1 or v2 release
4. Document in this file
5. Update version number

---

**Version**: 1.0  
**Last Updated**: 2026-08  
**Locked by**: Product Owner (Sprint Consolidación)
