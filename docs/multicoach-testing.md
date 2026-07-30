# Multicoach Testing Guide

**Para cada sección nueva** (Programas, Clientes, Coaches, etc.)

## Pre-Deployment Checklist

### 1. UI Responsiveness (Botones + Inputs)

```bash
# Start: npm start (o dev server)
# Login: cualquier coach
# Navega a la sección nueva

# Test cada elemento interactivo:
☐ Botones (click → cambio visual + acción)
☐ Inputs (typing → filtra tabla)
☐ Selects/dropdowns (open/close)
☐ Toggle buttons (activo/inactivo state)
☐ Links (href o onclick funciona)
```

**Common failures**:
- Button click → nada pasa (ver: ¿múltiples `v.innerHTML+=`?)
- Search input funciona pero tabla no actualiza (ver: ¿filtro usa datos correctos?)
- Buttons se ven pero no responden (ver: event listeners después del DOM render)

### 2. Data Correctness (Modo Demo)

```bash
# En demo (sin backend = MC_REAL=false):

☐ Datos template se muestran (MOCK_PROGRAMS, MOCK_COACHES, etc.)
☐ Nicho selector funciona (Fitness → Carrera → Finanzas)
☐ KPIs correctos para el nicho seleccionado
☐ Botones filtran desde MOCK data
☐ No hay errores en console
```

### 3. Data Correctness (Modo Real)

**Setup**: Crear un coach test con datos reales en Supabase

```bash
# Login como owner real
# Navigate to new section

# Test con datos reales:
☐ Data real carga (no template)
☐ KPIs calculados desde data (no hardcoded: 6/187/87%)
☐ Filtro usa data real, no MOCK
☐ Búsqueda filtra data real
☐ Si no hay backend table → degrada a MOCK (no crash)
```

### 4. Multi-User Switching

```bash
# Logout → Login as Owner A
☐ Owner A ve SUS datos (no template, no data de Owner B)
☐ KPIs reflejan Owner A

# Logout → Login as Owner B
☐ Owner B ve SUS datos (distintos de A)
☐ KPIs actualizados
☐ Cero data leakage entre owners

# Logout funciona (button → /login.html)
☐ Sidebar "Cerrar sesión" → redirige a login.html
```

### 5. Edge Cases

```bash
# Owner sin datos
☐ ¿Qué muestra? (empty state con CTA, no error silencioso)
☐ KPIs = 0 (no divide by zero)
☐ Tabla vacía (no crash)

# Datos nulos/undefined
☐ Photo falta → fallback avatar
☐ Email vacío → mostrar ID
☐ Completion null → "sin calificar"

# Backend lento/down
☐ Skeleton loaders (si existen)
☐ Fallback a MOCK (graceful degrade)
☐ Timeout (no espera 30s)
```

### 6. Accessibility + UX

```bash
☐ Inputs tienen labels/placeholders
☐ Buttons tienen aria-labels o texto claro
☐ Tabindex orden lógico
☐ Font size ≥10px
☐ Color contrast OK (para links, badges)
☐ Mensajes de error claros (no "Error 403")
```

---

## Manual Testing Script (15 min)

### Setup
```bash
# 1. Start dev server
npm start

# 2. Open browser
open http://localhost:5173

# 3. Login with test coach
Email: test@pathway.com
Password: ****
```

### Test Sequence

**Section: Programas (Priority 2 example)**

```
1. [UI] Click "Programas" in sidebar
   → Section loads (header + KPIs + table visible)
   
2. [Demo Mode] Verify template data
   → "6 Programas Activos", "187 Clientes", "87% Finalización"
   → 6 programs listed (María García, Alex Chen, etc.)
   
3. [Search] Type "María" in search box
   → Table updates, shows only María's program
   → Clear search → shows all 6 again
   
4. [Filter] Click "Activos" button
   → Button highlights green
   → Table shows only active programs (4 of 6)
   → Click "Completados"
   → Table shows only completed (2 of 6)
   → Click "Todos"
   → Back to 6 programs
   
5. [Links] Click "Ver Detalles"
   → Toast: "Detalle de programa — próximamente"
   
6. [Logout] Click avatar → "Cerrar sesión"
   → Redirects to login.html ✓
```

**Expected console output**:
```
(no errors)
(no warnings)
(no red marks)
```

---

## Automated Smoke Test (if applicable)

```bash
# scripts/check-smoke.js already validates:
☐ onclick handlers reference existing functions
☐ data-* attributes match handlers
☐ HTML closes properly (no syntax errors)

# Add to check-guardrails.js if you introduce NEW anti-patterns
```

---

## Regression Testing (Before Merge)

**After fixing a section, re-test ALL sections to ensure no crosstalk**:

```bash
☐ Dashboard → loads (KPIs, coaches grid, timeline)
☐ Coaches → loads (table, search, filters)
☐ Clientes → loads (grid, client card, tabs)
☐ Programas → loads (new section, all buttons work)
☐ Agenda → loads (week view, events)
☐ Analytics → loads (charts, propositions)
☐ Cobros → loads (transaction list)
☐ Config → loads (profile, branding, resources)

# If any section fails:
→ Likely cause: shared global state corruption
→ Check: DB object, MOCK data overwrites, CSS conflicts
```

---

## Post-Launch Monitoring

### Error Tracking
- `client_errors` table in Supabase (pw-observe.js)
- Watch for patterns:
  - `kind:'error'` on new section → JS bug
  - `kind:'fetch'` 403 → RLS issue (but shouldn't happen, it's demo)
  - `kind:'fetch'` 404 → backend endpoint missing

### User Feedback
- Test with real coach (get feedback on UX)
- Check: "buttons confusing?", "data correct?", "speed OK?"

---

## Common Debugging Steps

### Problem: "Buttons don't respond"

```bash
# 1. Check HTML was built correctly
→ Open DevTools → Elements
→ Do the buttons exist in the DOM? 
  ✓ If yes → step 2
  ✗ If no → code didn't render, check loadData() callback

# 2. Check v.innerHTML was assigned (not +=)
→ Open source code (multicoach.html)
→ Search for renderSectionName()
→ Grep: v.innerHTML= should appear ONCE
→ Grep: v.innerHTML+= should NOT appear
  ✓ If v.innerHTML= only → event listeners may have attached wrong
  ✗ If v.innerHTML+= → THIS IS THE BUG, use fix from multicoach-modelo.md

# 3. Check event listeners were attached
→ DevTools → Console
→ Manually click button: does it fire handler?
→ Check: document.querySelector('button-id').addEventListener(...)
  ✓ If listener exists → test click, check handler runs
  ✗ If no listener → attachment code never ran, check callback scoping
```

### Problem: "KPIs show fake values"

```bash
# Check: are KPI values calculated?
→ Search renderSectionName() in code
→ Look for: var activeCount = data.filter(...)
  ✓ If calculation exists → check if it's used in v.innerHTML
  ✗ If no calculation → KPIs are hardcoded, use fix from multicoach-modelo.md

# Verify data loaded
→ DevTools → Network
→ Look for fetch to /rest/v1/programs (or table)
→ Check response: is it data or error?
  ✓ If data → KPI calculation may be wrong, add console.log()
  ✗ If error 404 → table doesn't exist in backend
```

### Problem: "Filter shows wrong data"

```bash
# Check: what data is being filtered?
→ Open DevTools → Console
→ Type: _mcProgCurrentData (or whatever variable)
→ Is it MOCK or real data?
  ✓ Real data → filter function may be wrong logic
  ✗ MOCK data → filter is hardcoded to MOCK, use fix from multicoach-modelo.md

# Check: where is filter source defined?
→ Search: function filterData() or _mcProgFilterData()
→ Look for: MOCK_PROGRAMS.filter (BAD) vs _mcProgCurrentData.filter (GOOD)
  ✓ If using _mcProgCurrentData → loading may have failed, check fetch
  ✗ If using MOCK_PROGRAMS → use fix from multicoach-modelo.md
```

---

## Performance Baselines

**Acceptable thresholds** (on localhost):

| Metric | Target | Common | Slow |
|--------|--------|--------|------|
| Section load | <500ms | <200ms | >1s |
| Search/filter | <100ms | <50ms | >300ms |
| Table re-render | <300ms | <100ms | >500ms |

If slow:
- Check: large data arrays being filtered 6+ times
- Check: console.log inside loop (remove!)
- Check: unnecessary re-renders of unrelated sections

---

## Before Pushing to `main`

```bash
# 1. Run syntax check
node scripts/check-syntax.js
→ Should pass (no inline JS errors)

# 2. Run smoke tests
node scripts/check-smoke.js
→ Should pass (buttons, links, assets exist)

# 3. Manual test (this guide)
→ 15 min, all steps pass

# 4. Run guardrails
node scripts/check-guardrails.js
→ Check if new section introduces known anti-patterns

# 5. Verify git status
git status
→ Only modified files are intended changes (no accidental console.logs)

# 6. Commit + Push
git commit -m "..."
git push origin branch-name
```

