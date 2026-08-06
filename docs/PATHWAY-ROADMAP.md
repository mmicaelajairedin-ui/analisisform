# Pathway Platform — Roadmap Maestro

**Horizonte:** 12 meses (2026-08 a 2027-08)  
**Estado:** Living document (actualizar después de cada sprint)  
**Objetivo:** Visibilidad de plataforma + dependencias + críticas

---

## Áreas Principales

### ✅ CORE (2026-01 a 2026-08)
**Estado:** CONGELADO  
**Incluye:**
- Equipo (coaches, colaboradores, ownership)
- Clientes (gestión, asignación a coaches)
- Permisos (17 acciones, 3 roles)
- Multi-tenant (org_id filtering, RLS)
- UI responsiva (480px, 768px, 1200px+)
- Action Bus architecture

**Dependencias:** Ninguna  
**Críticas:** ALTÍSIMA (foundation)  
**Acciones:** 15 (definidas en action-inventory.csv)

---

### ⏳ BILLING (2026-08 a 2026-10)
**Estado:** DISEÑO  
**Incluye:**
- Planes (Free, Pro, Boutique, Enterprise)
- Stripe integration
- Invoicing + receipts
- Usage tracking
- Upgrade/downgrade flows
- Trial period management

**Dependencias:** Core ✅  
**Plan mínimo:** Free (trial limitado)  
**Críticas:** ALTÍSIMA (monetización)  
**Acciones en inventario:** BILLING_UPGRADE_PLAN, BILLING_CANCEL_PLAN

**Plan enforcement:**
- TEAM_INVITE: Pro+ (no en Free)
- CLIENT_ASSIGN_COACH: Pro+ (no en Free)
- COLLABORATOR_*: Enterprise only

---

### ⏳ BRANDING (2026-09 a 2026-11)
**Estado:** DISEÑO  
**Incluye:**
- Logo custom (upload, crop)
- Colors custom (brand accent)
- Email template branding
- Portal white-label
- Custom domain support

**Dependencias:** Core ✅, Billing ✅ (Enterprise)  
**Plan mínimo:** Enterprise  
**Críticas:** MEDIA (diferenciador premium)  
**Acciones en inventario:** BRAND_CHANGE_LOGO, BRAND_CHANGE_COLORS, DOMAIN_CUSTOM

---

### ⏳ DOMINIOS (2026-10 a 2026-11)
**Estado:** DISEÑO  
**Incluye:**
- Custom domain setup
- SSL cert auto-renewal (Let's Encrypt)
- DNS validation
- Domain management dashboard

**Dependencias:** Core ✅, Branding ✅ (Enterprise)  
**Plan mínimo:** Enterprise  
**Críticas:** MEDIA (premium)  
**Acciones en inventario:** DOMAIN_CUSTOM, DOMAIN_VERIFY, DOMAIN_REMOVE

---

### ⏳ AGENDA (2026-10 a 2026-12)
**Estado:** ESPECIFICACIÓN  
**Incluye:**
- Calendario de sesiones (coach view)
- Scheduling (Calendly embed o API)
- Reminders (email/SMS)
- Post-sesión notas
- Rescheduling + cancellations
- Client calendar access

**Dependencias:** Core ✅  
**Plan mínimo:** Pro+  
**Niche:** All  
**Críticas:** ALTA (core para coaches)  
**Acciones en inventario:** SCHEDULE_CREATE, SCHEDULE_EDIT, SCHEDULE_CANCEL, SCHEDULE_RESCHEDULE

---

### ⏳ PROGRAMAS (2026-11 a 2027-02)
**Estado:** ESPECIFICACIÓN  
**Incluye:**
- Crear programas (templates por nicho)
- Enroll clientes a programas
- Tracking de progreso
- Certification al completar
- Programa-specific content/tasks
- Multiple cohorts

**Dependencias:** Core ✅, Agenda ✅ (sesiones + tracking)  
**Plan mínimo:** Pro+  
**Niche:** Career, Fitness, Finance (NO Healthcare/otros)  
**Críticas:** ALTA (crecimiento)  
**Acciones en inventario:** PROGRAM_CREATE, PROGRAM_EDIT, PROGRAM_ASSIGN, PROGRAM_ENROLL, PROGRAM_COMPLETE

**Niche enforcement:**
```
Career coach puede: PROGRAM_CREATE con niche=Career
Fitness coach puede: PROGRAM_CREATE con niche=Fitness
Healthcare coach NO puede: PROGRAM_CREATE (niche not supported)
```

---

### ⏳ ANALYTICS (2026-12 a 2027-01)
**Estado:** ESPECIFICACIÓN  
**Incluye:**
- Dashboard de KPIs (clientes, ingresos, sesiones)
- Reportes por coach
- Conversión funnel
- Retention metrics
- Export (CSV, PDF)

**Dependencias:** Core ✅, Billing ✅  
**Plan mínimo:** Pro+  
**Críticas:** MEDIA (insights, decisiones)  
**Acciones en inventario:** ANALYTICS_VIEW_REPORT, ANALYTICS_EXPORT, ANALYTICS_FILTER

---

### ⏳ COMUNIDAD (2027-01 a 2027-03)
**Estado:** CONCEPTO  
**Incluye:**
- Forum por nicho
- Peer coaching discussions
- Resource sharing
- Moderation tools
- Notifications

**Dependencias:** Core ✅, Billing ✅  
**Plan mínimo:** Pro+  
**Críticas:** BAJA (engagement, no core)  
**Acciones en inventario:** COMMUNITY_POST_MESSAGE, COMMUNITY_CREATE_THREAD, COMMUNITY_MODERATE

---

### ⏳ IA ASSISTANT (2027-02 a 2027-04)
**Estado:** CONCEPTO  
**Incluye:**
- Chat assistant (Claude API)
- Email draft suggestions
- Interview prep coaching
- Resume/CV analysis
- Cover letter generation

**Dependencias:** Core ✅, Agenda ✅  
**Plan mínimo:** Enterprise  
**Críticas:** MEDIA (diferenciador, premium)  
**Acciones en inventario:** AI_CHAT_MESSAGE, AI_GENERATE_DRAFT, AI_ANALYZE_DOCUMENT

---

### ⏳ AUTOMATIZACIONES (2027-03 a 2027-05)
**Estado:** CONCEPTO  
**Incluye:**
- Workflow builder (visual)
- Triggers (nueva sesión, cliente inactivo, etc.)
- Actions (enviar email, asignar tarea, etc.)
- Integrations (Slack, Webhooks, Zapier)
- Logs y error handling

**Dependencias:** Core ✅, Billing ✅, API ✅  
**Plan mínimo:** Pro+  
**Críticas:** MEDIA (power-user)  
**Acciones en inventario:** AUTOMATION_CREATE, AUTOMATION_EDIT, AUTOMATION_RUN, AUTOMATION_PAUSE

---

## Dependencias Críticas

```
Core (CONGELADO) ✅ 2026-08
  │
  ├─→ Billing (2026-08 a 2026-10)
  │    └─→ Branding (2026-09 a 2026-11)
  │         └─→ Dominios (2026-10 a 2026-11)
  │
  ├─→ Agenda (2026-10 a 2026-12)
  │    └─→ Programas (2026-11 a 2027-02)
  │
  ├─→ Analytics (2026-12 a 2027-01)
  │
  ├─→ Comunidad (2027-01 a 2027-03)
  │
  ├─→ IA (2027-02 a 2027-04)
  │
  └─→ Automatizaciones (2027-03 a 2027-05)
```

---

## Criterio de Entrada a Desarrollo

Antes de desarrollar un área:

1. ✅ Feature está en este roadmap
2. ✅ Acciones completamente documentadas en `action-inventory.csv`
3. ✅ Permisos definidos (quién puede qué)
4. ✅ Plan/Niche asignado (restricciones de negocio)
5. ✅ Dependencias resueltas (features anteriores listos)
6. ✅ Review de Product Owner

**No se desarrolla nada que no cumpla ↑**

---

## Actualización de Estado

Después de cada sprint:

- [ ] Cambiar estado: DISEÑO → ESPECIFICACIÓN → DESARROLLO → BETA → PRODUCTION
- [ ] Agregar acciones nuevas descubiertas
- [ ] Actualizar dependencias (si cambiaron)
- [ ] Revisar críticas y ajustar prioridades

---

## Total de Acciones por Feature

| Feature | Core | Billing | Branding | Agenda | Programas | Analytics | Comunidad | IA | Automatizaciones | TOTAL |
|---------|------|---------|----------|--------|-----------|-----------|-----------|----|----|-------|
| Acciones | 15 | 2 | 3 | 4 | 5 | 3 | 3 | 3 | 4 | **42** |

**Inventario completo:** 42 acciones documentadas  
**Cobertura:** Core 100%, futuro 100%

---

**Living Document — Última actualización: 2026-08-05**
