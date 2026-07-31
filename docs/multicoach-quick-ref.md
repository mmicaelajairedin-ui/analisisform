# Multicoach Development — Quick Reference

**Keep this open when adding sections to multicoach.html**

## The 3 Commits Priority 2 Required (So You Don't Repeat Them)

### Commit 1: Extract Section + Add Routing
```javascript
// multicoach.html ~ line 865
else if(s==='programas')renderPrograms();

// multicoach.html ~ line 716
<a data-s="programas"><svg>...</svg>Programas</a>

// multicoach.html ~ line 3560+
// Copy-paste ENTIRE section from owner-programs.html:
// - CSS (lines X-Y)
// - HTML structure (renderPrograms template)
// - JS functions (loadPrograms, _mcProgFilterData, _mcProgRenderTable)
// Change function names: renderSectionName → ensure uniqueness
// Change MOCK data names: MOCK_PROGRAMS → MOCK_SECTION
```

**Result**: Section appears in sidebar, renders, but buttons/data might be broken.

---

### Commit 2: Fix Data Binding & KPI Calculation
```javascript
// THREE CHANGES:

// A) Store loaded data separately
var _mcSectionCurrentData=[...MOCK_SECTION];  // NEW line

// B) Calculate KPIs from data (not hardcoded)
var activeCount=data.filter(p=>p.status==='active').length;
var totalClients=data.reduce((s,p)=>s+(p.clients||0),0);
var avgMetric=data.length ? Math.round(...) : 0;
// USE THESE IN HTML: '+activeCount+', '+totalClients+', etc.

// C) Use loaded data for filter (not MOCK)
_mcSectionFilteredData=(_mcSectionCurrentData||MOCK_SECTION).filter(...);
```

**Result**: KPIs update per owner, filter works with real data.

---

### Commit 3: Fix HTML Building (Buttons Now Work)
```javascript
// FROM (BROKEN):
v.innerHTML='<header>...'
v.innerHTML+='<button>...'  // ← Each += breaks listeners
v.innerHTML+='<table>...'
// Then attach listeners (too late, DOM was destroyed)

// TO (FIXED):
var html='<header>...' + '<button>...' + '<table>...</table></div>';
v.innerHTML=html;  // ONE assignment
// NOW attach listeners (they work because DOM wasn't destroyed)
```

**Result**: Buttons/inputs/filters all respond to clicks.

---

## 5-Minute Sanity Check

Before you start, before you commit:

```javascript
// ✓ DO THIS:
v.innerHTML = completeHtmlString;  // Build once
document.querySelector('button').addEventListener('click', handler);  // Attach after

// ✓ DO THIS:
var count = data.filter(...).length;
html = '...' + count + '...';  // Calculate first, use in HTML

// ✓ DO THIS:
var _myCurrentData = MOCK_DATA;  // Module-level storage
loadData(cb => { _myCurrentData = data; cb(data); });  // Update on load
function filter() { _myCurrentData.filter(...); }  // Use updated

// ✗ DON'T DO THIS:
v.innerHTML += '<something>';  // Each += destroys DOM
v.innerHTML = '<x>6</x>';      // Hardcoded values
MOCK_DATA.filter(...);         // Filter from template when real data loaded
```

---

## Minimal Copy-Paste Template

```javascript
/* ===== NEW SECTION (copy owner-section.html into multicoach.html) ===== */

// 1. VARIABLES
var MOCK_SECTION = [{...}, {...}];  // From owner-section.html
var _mcSectionCurrentFilter = 'all';
var _mcSectionCurrentData = [...MOCK_SECTION];  // NEW: data storage
var _mcSectionFilteredData = [...MOCK_SECTION];

// 2. LOAD DATA
function loadSection(cb){
  if(!MC_REAL){ cb(MOCK_SECTION); return; }
  try{
    _hdr({'Content-Type':'application/json'}).then(h =>
      fetch(SB+'/rest/v1/section?select=*', {method:'GET', headers:h})
    ).then(r => r.json().catch(()=>null)).then(d => {
      if(d && Array.isArray(d) && d.length){ cb(d); }
      else{ cb(MOCK_SECTION); }
    }).catch(() => cb(MOCK_SECTION));
  }catch(e){ cb(MOCK_SECTION); }
}

// 3. FILTER
function _mcSectionFilterData(){
  var searchTerm = (document.getElementById('searchInput')?.value||'').toLowerCase();
  _mcSectionFilteredData = (_mcSectionCurrentData||MOCK_SECTION).filter(item => {
    var matchesSearch = item.name.toLowerCase().includes(searchTerm) || ...;
    var matchesFilter = _mcSectionCurrentFilter === 'all' || item.status === _mcSectionCurrentFilter;
    return matchesSearch && matchesFilter;
  });
  _mcSectionRenderTable(_mcSectionFilteredData);
}

// 4. RENDER TABLE
function _mcSectionRenderTable(data){
  var tbody = document.getElementById('sectionTableBody');
  if(!tbody) return;
  tbody.innerHTML = '';
  data.forEach(item => {
    var row = document.createElement('tr');
    row.innerHTML = '<td>'+_mcEsc(item.name)+'</td><td>'+item.count+'</td>...';
    tbody.appendChild(row);
  });
}

// 5. MAIN RENDER (THE CRITICAL ONE)
function renderSection(){
  var v = document.getElementById('vscroll');
  
  loadSection(data => {
    _mcSectionCurrentData = (data || [...MOCK_SECTION]);  // STORE HERE
    
    // CALCULATE (not hardcode)
    var count = data.length;
    var active = data.filter(i => i.status==='active').length;
    var metric = data.length ? Math.round(data.reduce((s,i)=>s+i.value,0)/data.length) : 0;
    
    // BUILD COMPLETE HTML
    var html = '<div>';
    html += '<header><h1>Section<span class="dot">.</span></h1></header>';
    html += '<div class="kpi-grid>';
    html += '<div class="kpi-card"><div class="kpi-label">Active</div><div class="kpi-value">'+active+'</div></div>';
    html += '<div class="kpi-card"><div class="kpi-label">Total</div><div class="kpi-value">'+count+'</div></div>';
    html += '<div class="kpi-card"><div class="kpi-label">Metric</div><div class="kpi-value">'+metric+'%</div></div>';
    html += '</div>';
    html += '<div class="controls-bar">';
    html += '<input type="text" id="searchInput" placeholder="Buscar...">';
    html += '<button class="filter-btn active" data-filter="all">Todos</button>';
    html += '<button class="filter-btn" data-filter="active">Activos</button>';
    html += '</div>';
    html += '<table><thead>...</thead><tbody id="sectionTableBody"></tbody></table>';
    html += '</div>';
    
    // ASSIGN ONCE
    v.innerHTML = html;
    
    // RENDER TABLE
    _mcSectionRenderTable(data);
    
    // NOW ATTACH LISTENERS
    var searchInput = document.getElementById('searchInput');
    if(searchInput){ searchInput.addEventListener('input', _mcSectionFilterData); }
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        _mcSectionCurrentFilter = e.target.dataset.filter;
        _mcSectionFilterData();
      });
    });
  });
}
```

---

## Checklist Before Commit

**Commit 1: Routing + Extract**
- [ ] Section appears in sidebar
- [ ] Click sidebar link → page renders (shows template data OK)
- [ ] No console errors

**Commit 2: Data + KPIs**
- [ ] KPIs NOT hardcoded (calculated from `data`)
- [ ] Different owners would see different KPI values
- [ ] Filter uses `_mcCurrentData`, not `MOCK_`
- [ ] Demo mode shows template values

**Commit 3: HTML Building**
- [ ] `v.innerHTML=` appears ONCE (not `+=`)
- [ ] All HTML built in `var html=` before assignment
- [ ] Event listeners attached AFTER `v.innerHTML=`
- [ ] Test: click button/input → responds

**All Commits**
- [ ] No `console.log` or `console.error`
- [ ] Multi-user tested (Owner A vs Owner B see different data)
- [ ] Logout works (`cerrarSesion()` → `/login.html`)
- [ ] Tested in demo (`MC_REAL=false`) and real (`MC_REAL=true`)

---

## Files to Read Before Coding

1. `docs/multicoach-modelo.md` — Architecture & data model
2. `docs/multicoach-testing.md` — Testing procedures
3. This file (`multicoach-quick-ref.md`) — Copy-paste templates & checklists

---

## Pro Tips

**Fast iteration**:
```bash
# 1. Add function skeleton (empty renderSection)
# 2. Make sidebar link
# 3. Test it loads (no errors)
# 4. Add MOCK data
# 5. Add HTML structure
# 6. Test it renders
# 7. Add buttons/inputs
# 8. Add event listeners (ONE AT A TIME, test each)
# 9. Connect to backend
# 10. Commit after each step

# This way, you catch errors early.
```

**Debugging buttons**:
```javascript
// In renderSection(), right after v.innerHTML=html:
console.log('Looking for button...');
var btn = document.querySelector('.filter-btn');
console.log('Found:', btn);
if(btn){
  btn.addEventListener('click', e => {
    console.log('Clicked!', e.target);
  });
  console.log('Listener attached');
}

// If "Listener attached" appears but "Clicked!" never does:
// → v.innerHTML+= was called after button rendered, destroying the listener
```

**Debugging KPIs**:
```javascript
// In loadSection callback:
console.log('Raw data:', data);
console.log('Count:', data.length);
console.log('Active:', data.filter(i=>i.status==='active').length);
console.log('Should render KPI with these values');
```

---

## When Things Break

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Buttons don't click | `v.innerHTML+=` used | Build HTML in var, assign once |
| KPIs always "6/187/87" | Hardcoded values | Calculate from `data` |
| Filter shows template data | Filters from MOCK | Store loaded data in `_mcCurrentData` |
| Owner A sees Owner B's data | Multi-tenant leakage | Check `org_id` filtering |
| Empty table, no error | Table render fails | Check `document.getElementById('tableBodyId')` |
| Search input doesn't respond | Listener not attached | Verify `v.innerHTML=` was once, listener was after |
| Demo mode broken | MOCK data undefined | Check MOCK array name, fallback logic |

