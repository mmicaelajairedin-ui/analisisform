# Multicoach Roadmap 2026 — Estado Actual

**Última actualización**: 2026-07-30  
**Status**: Priority 2 (Programas) frontend ready, backend pending

---

## ✅ DONE (Producción)

### Backend (Supabase)
- [x] `organizaciones` table (dueños de redes)
- [x] `usuarios.org_id` (coaches por org)
- [x] `candidatos.org_id` (clientes por org)
- [x] `coach_client_assignments` (asignación explícita coach→cliente)
- [x] `eventos` (event store para auditoría)
- [x] RLS policies (isolación multi-tenant por org_id)
- [x] Edge functions: `mi-red`, `crear-coach`, `analytics-weekly`

### Frontend (multicoach.html)
- [x] **Dashboard** — KPIs, coaches grid, timeline (datos reales)
- [x] **Coaches** — tabla, search, filtros, ficha con tabs
- [x] **Clientes** — grid, ficha, 4 tabs, links WhatsApp/Email
- [x] **Agenda** — Día/Semana/Mes, Google Calendar sync
- [x] **Analytics** — KPIs semanales, charts, propuestas IA
- [x] **Cobros** — transacciones Stripe, suscripciones
- [x] **Config** — perfil, recursos, marca propia (white-label)
- [x] **Programas (Priority 2)** — tabla, KPIs dinámicos, search/filter
  - Buttons responden ✓
  - KPIs calculados ✓
  - Pendiente: `programas` table en backend

---

## ⏳ IN PROGRESS (Frontend Ready, Backend Pending)

### Priority 2: Programas Table
**Status**: Frontend complete (multicoach.html renderPrograms)  
**Blocking**: Backend table `programas` doesn't exist

**Needed**:
```sql
-- supabase/migrations/111_programas.sql
CREATE TABLE programas (
  id UUID PRIMARY KEY,
  org_id UUID FK → organizaciones,
  nombre TEXT,
  coach_id UUID FK → usuarios,
  clientes_inscritos INT,
  tasa_completitud INT (0-100),
  duracion_semanas INT,
  status VARCHAR (active|completed),
  created_at TIMESTAMPTZ
);
-- Indexes: org_id, coach_id, status
```

**Impact**: 6 programs will show real data per owner instead of template

**Timeline**: This week (user creating migrations)

---

## 🔴 TODO — PRIORITY ORDER

### P1: Backend Table Creation (This Week)
- [ ] `supabase/migrations/111_programas.sql` (programas table)
- [ ] `supabase/migrations/112_programas_rls.sql` (RLS + GRANT)
- [ ] Test in Supabase: owner can see their programs

### P2: Priority 3 Sections (Week 2)
Migrate these from `owner-*.html` into `multicoach.html` (same pattern as Programs):

#### P2a: Clientes Advanced
**Current**: Basic grid + ficha (4 tabs)  
**Needed**: Expand ficha to match panel-v2 structure
- [ ] Perfil tab: complete datos
- [ ] Progreso tab: mediciones, avance semanal
- [ ] Documentos tab: CV, carta, LinkedIn
- [ ] Notas tab: coach notes, plan personalizado

**Files to migrate from**: (none exist, ficha is already in multicoach)  
**Blocker**: none, just UX polish  
**Timeline**: 3-5 days

#### P2b: Coaches Advanced
**Current**: Table only  
**Needed**: Edit screen, assign availability, view performance
- [ ] Coach card: click → edit modal (nombre, foto, especialidad, teléfono)
- [ ] Availability: edit horarios/days disponibles para reservas
- [ ] Performance: sesiones dadas, clientes a cargo, rating

**Files to migrate from**: `owner-coaches.html` (if exists)  
**Blocker**: `usuarios.configuracion` needs new fields  
**Timeline**: 3-5 days

### P3: Comunidad (Week 3-4)
**What**: Revista/avisos/clases editable por owner → visible en portal cliente

**Current state**: Tabla `empresa_revista` existe, cliente.html muestra read-only  
**Needed in multicoach**:
- [ ] Section "Comunidad" en multicoach.html sidebar
- [ ] 3 tabs: Avisos (news), Revista (content), Clases (webinars)
- [ ] Editor modal para cada tipo
- [ ] Publish/unpublish, schedule
- [ ] Preview: "así lo ve el cliente"

**Files to migrate**: Content from `empresa-hub.html`  
**Backend**: Tablas existen (`empresa_revista`, etc.)  
**Timeline**: 5-7 days

### P4: Chat de la Red (Week 4)
**What**: 1-a-1 owner↔coach + canal grupal (equipo)

**Current state**: Edge functions exist (`mensaje-red`, `canal-red`), tables exist  
**Needed in multicoach**:
- [ ] "Mensajes" section
- [ ] Tab 1: Bandeja 1-a-1 por coach
- [ ] Tab 2: Canal grupal (equipo)
- [ ] Real-time updates (WebSocket o polling)

**Backend**: Ready (edge functions + RLS)  
**Timeline**: 3-5 days

### P5: Recursos Compartidos (Week 4)
**What**: Owner carga recursos → coaches/clientes los ven

**Current state**: Schema exists, no frontend  
**Needed**:
- [ ] "Recursos" section en multicoach
- [ ] Upload video/PDF/link
- [ ] Organize por categoría
- [ ] Visibility: solo coaches, solo clientes, todos

**Backend**: Needs migration? (check `recursos` table existence)  
**Timeline**: 2-3 days

### P6: Asignación Cliente→Coach (Week 5)
**What**: Owner puede reasignar clientes entre coaches

**Current state**: `coach_client_assignments` table exists, UI doesn't  
**Needed**:
- [ ] En ficha de cliente: dropdown "Coach asignado"
- [ ] Cambiar → guardarse en DB
- [ ] Mostrar histórico (quién tenía el cliente antes)
- [ ] Validar: "no más de N clientes por coach"

**Backend**: Ready (table + policies)  
**Timeline**: 2-3 days

---

## 🟡 NICE TO HAVE (Later)

### White-Label / Branding
- [ ] Owner customiza logo (ya existe, mejorar UI)
- [ ] Owner customiza colores (ya existe, mejorar)
- [ ] Owner elige dominio/subdominio (Pro plan only)
- [ ] Quitarse branding Pathway (white-label total)

### Analytics Avanzado
- [ ] Cohort analysis (clientes que entraron mes X, dónde están hoy)
- [ ] Churn prediction (IA: "este cliente en riesgo")
- [ ] Revenue dashboard (ingresos reales, desglose por coach)
- [ ] Export: reportes a PDF/Excel

### Pagos / Comisiones (Studio+)
- [ ] Owner cobra a clientes (Stripe integration)
- [ ] Automatizar reparto a coaches (comisión %)
- [ ] Dashboard: ingresos, egresos, cuentas por pagar

### Automatizaciones (Pro only)
- [ ] Welcome email cuando cliente ingresa
- [ ] Reminder automático antes de sesión
- [ ] Checklists automáticos (e.g., "semana 1: completar perfil")
- [ ] Survey post-sesión (feedback)

### Agenda Grupal (Pro only)
- [ ] Calendario central (todos los coaches)
- [ ] Bloqueo de horarios (disponibilidad)
- [ ] Auto-book: cliente reserva → sistema asigna coach con disponibilidad

---

## 🚫 BLOCKED (Waiting On)

| Blocker | Impact | ETA |
|---------|--------|-----|
| `programas` table | Programas section shows real data | This week |
| `usuarios.configuracion` needs fields | Edit coach details | TBD |
| IA agent check (analytics-weekly) | Weekly insights work | Already deployed |
| Stripe webhook for subscription | Owner trial → paid transition | Already done |

---

## 📊 Progress by Component

| Component | Code | Backend | UX | Status |
|-----------|------|---------|-----|--------|
| Dashboard | ✅ | ✅ | ✅ | Producción |
| Coaches | ✅ | ✅ | ⚠️ | Básico, sin edit |
| Clientes | ✅ | ✅ | ⚠️ | Básico, ficha simple |
| **Programas** | ✅ | ❌ | ✅ | **Waiting: DB table** |
| Agenda | ✅ | ✅ | ✅ | Producción |
| Analytics | ✅ | ✅ | ✅ | Producción |
| Cobros | ✅ | ✅ | ✅ | Producción |
| Config | ✅ | ✅ | ✅ | Producción |
| **Comunidad** | ❌ | ⚠️ | ❌ | P3: No frontend |
| **Chat** | ❌ | ✅ | ❌ | P4: Backend ready |
| **Recursos** | ❌ | ⚠️ | ❌ | P5: Needs review |
| **Asignación** | ❌ | ✅ | ❌ | P6: Backend ready |

---

## Risk / Tech Debt

### High Priority
- [ ] **Multi-user data leakage**: Verify RLS policies 100% (no accidental access)
- [ ] **Performance**: Big org (100+ coaches, 500+ clientes) → slow?
  - Need pagination, lazy load, indexes
- [ ] **Sync issues**: Coach edits client in panel-v2, owner views in multicoach → stale data?
  - Need WebSocket or polling strategy

### Medium Priority
- [ ] **Mobile**: multicoach.html untested on mobile
- [ ] **Internationalization**: Hardcoded Spanish, no i18n
- [ ] **Error messages**: Generic "No se pudo guardar" → confuse users
- [ ] **Empty states**: "Sin clientes aún" UX could be better (CTA, tips)

### Low Priority
- [ ] **Dark mode**: Not implemented
- [ ] **Accessibility**: WCAG A compliance needed
- [ ] **Export**: No PDF/Excel (requested but not urgent)

---

## Execution Strategy

### Parallel Work (What You Can Do Now)

**Backend** (you):
1. Create `111_programas.sql` → apply
2. Test: owner sees 6 programs
3. Create `112_programas_rls.sql` → apply

**Frontend** (me, when ready):
1. P2a: Enhance Clientes ficha
2. P2b: Coaches advanced (edit modal)
3. P3: Comunidad (copy from empresa-hub.html pattern)

### Weekly Cadence
- **Monday**: Pick P2/P3 section
- **Wed**: Code + test
- **Fri**: Review + merge to main
- **Next week**: Next section

---

## Definition of "Done" (Per Section)

✅ Section is done when:

**Backend**:
- [ ] Table exists in Supabase
- [ ] RLS policies protect data (no leaks)
- [ ] Edge function (if needed) works
- [ ] Owner can query their data (tested manually)

**Frontend**:
- [ ] Renders (no console errors)
- [ ] Buttons work (search, filter, edit)
- [ ] Data is real (not template hardcoded)
- [ ] Multi-user tested (Owner A ≠ Owner B data)
- [ ] Tested in demo mode (template data works)
- [ ] Logout works

**QA**:
- [ ] Run check-smoke.js (passes)
- [ ] Run check-guardrails.js (passes)
- [ ] Manual 15-min test (per docs/multicoach-testing.md)
- [ ] No regressions in other sections

**Documentation**:
- [ ] Code commented where non-obvious
- [ ] PR description explains changes
- [ ] CLAUDE.md or docs updated if needed

---

## Questions to Answer

**For Priority 3 (Clientes Advanced)**:
- Does `usuarios.configuracion` already have all fields needed? (especialidad, foto, rating, etc.)
  - If no: add migration to extend schema
- Should ficha match panel-v2 exactly or keep multicoach simpler?
  - Recommendation: Keep simpler (multicoach = overview, panel-v2 = detail)

**For Priority 4 (Chat)**:
- Real-time needed? (WebSocket) or polling OK?
  - Polling easier, WebSocket more expensive
- Should chat integrate with existing Pathway support chat or separate?
  - Current: separate channels (`mensajes_red_*` vs `mensajes_admin_coach`)

**For Priority 5 (Recursos)**:
- Can coaches add their own resources? (personal repository)
  - Recommendation: Yes, separate from company resources (column: `scope: 'company'|'coach'`)

**For Priority 6 (Asignación)**:
- Can owner reassign retroactively? (change old assignments)
  - Recommendation: Yes, keep history in table for audit
- Should there be "unassigned" pool?
  - Recommendation: Yes (`coach_id IS NULL`), like panel-v2 does

---

## Time Estimate (Total)

| Priority | Sections | Frontend | Backend | Total |
|----------|----------|----------|---------|-------|
| P1 | Programas table | Done | 2h | **2h** |
| P2 | Clientes + Coaches | 5d | 1h | **5d** |
| P3 | Comunidad | 5d | 2h | **5d** |
| P4 | Chat | 3d | Done | **3d** |
| P5 | Recursos | 2d | 2h | **2d** |
| P6 | Asignación | 2d | Done | **2d** |
| **TOTAL** | **All MVP** | **~19d** | **~7h** | **~20d** |

**Reality**: Actual probably 25-30 days (testing, fixes, edge cases)

**MVP cutoff**: After P3 (Comunidad) = Owner can manage full network + resources + team chat

---

## Deployment Strategy

### Phase A (This Week)
- Apply `111_programas.sql` + `112_programas_rls.sql`
- Test: Owner sees real programs
- Deploy: multicoach.html with Programas (already in main)

### Phase B (Weeks 2-3)
- Add P2 (Clientes advanced, Coaches advanced)
- Add P3 (Comunidad)
- Target: End of week 3

### Phase C (Week 4+)
- Add P4 (Chat), P5 (Recursos), P6 (Asignación)
- Optional nice-to-haves (white-label, analytics, payments)

### Go-Live Readiness
Before going live with multicoach:
- [ ] Load test: 100+ owners, 1000+ clientes
- [ ] Security audit: RLS policies + data isolation
- [ ] Backup strategy: daily snapshots
- [ ] Support docs: owner manual, troubleshooting
- [ ] Email campaign: notify owners → use panel

