# Pathway Platforms — Arquitectura Detallada

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                   TWO PLATFORMS, ONE CODEBASE                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  pathwaycareercoach.com          pathwayplatforms.com       │
│  (Single Coach Portal)           (Multi-Coach SaaS)         │
│  ─────────────────────           ──────────────────         │
│  ✅ panel-v2.html                ✨ pathwayplatforms-index  │
│  ✅ cliente.html                 ✨ pathwayplatforms-...    │
│  ✅ formulario.html              ✨ (reutiliza multicoach/) │
│  ✅ multicoach.html              ✨                         │
│                                                               │
│  pw-config.js → Detecta dominio                             │
│                → Carga configuración correcta                │
│                → Aplica branding                             │
│                → Redirige después de auth                    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                  SHARED COMPONENTS (Reutilizados)            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  multicoach/pages/owner-*.html     (todos los módulos)      │
│  multicoach/js/                    (lógica compartida)       │
│  multicoach/styles/                (estilos compartidos)     │
│  pw-brand.js                       (branding centralizado)   │
│  pw-icons.js, pw-design-tokens.css (design system)          │
│  pw-auth.js                        (auth común)             │
│  pw-observe.js                     (telemetría)             │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                   SUPABASE (Compartido)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Proyecto: ddxnrsnjdvtqhxunxnwj (SIN "bwj")                │
│  Uso dual:                                                   │
│    - pathwaycareercoach: datos de coaches individuales       │
│    - pathwayplatforms: datos multi-tenant (org_id)          │
│  RLS: Aisla por coach_id (v1) / org_id (v2 en desarrollo)   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Estructura de Directorios

```
analisisform/
├── 📄 pw-config.js                    (Detección de dominio + config)
├── 📄 pathwayplatforms-index.html     (Landing pública de platforms)
├── 📄 pathwayplatforms-multicoach.html (Shell de MultiCoach)
├── 📄 multicoach.html                 (Shell histórica — intacta)
│
├── 🗂️  multicoach/                     (Compartido por ambas plataformas)
│   ├── pages/
│   │   ├── 📄 owner-dashboard.html    (Dashboard del organizador)
│   │   ├── 📄 owner-coaches.html      (Gestión de coaches)
│   │   ├── 📄 owner-clients.html      (Base de clientes)
│   │   ├── 📄 owner-coach-detail.html (Detalle de coach)
│   │   ├── 📄 owner-client-detail.html (Detalle de cliente)
│   │   ├── 📄 owner-schedule.html     (Agenda integrada)
│   │   ├── 📄 owner-programs.html     (Programas de coaching)
│   │   ├── 📄 owner-analytics.html    (Analytics y reportes)
│   │   ├── 📄 owner-billing.html      (Facturación)
│   │   ├── 📄 owner-brand.html        (Branding/white-label)
│   │   └── 📄 owner-identidad.html    (Configuración org)
│   │
│   ├── js/
│   │   ├── 📄 components.js           (Componentes reutilizables)
│   │   ├── 📄 utils.js                (Utilidades)
│   │   └── 📄 mock-data.js            (Datos de prueba)
│   │
│   └── styles/
│       ├── 📄 base.css                (Estilos base)
│       ├── 📄 components.css          (Componentes)
│       └── 📄 layout.css              (Layout grid)
│
├── 🗂️  docs/
│   ├── 📄 pathwayplatforms-architecture.md (Este archivo)
│   ├── 📄 icon-system.md
│   ├── 📄 error-registry.md
│   └── 📄 base-plataforma.md
│
└── 📄 PATHWAYPLATFORMS.md             (Resumen general)
```

---

## 🔄 Flujo de Carga

### Landing (sin auth):
```
Usuario abre: https://pathwayplatforms.com/
                    ↓
1. pw-config.js carga
   → Detecta dominio "pathwayplatforms.com"
   → Expone window.APP_CONFIG = {platform: 'pathwayplatforms', ...}
   
2. pathwayplatforms-index.html se renderiza
   → Hero + Features + Modules + CTA
   → Botón "Acceder a MultiCoach" → /multicoach.html
   
3. No requiere auth para ver landing
```

### MultiCoach (requiere auth futuro):
```
Usuario click en "Acceder a MultiCoach"
                    ↓
1. pathwayplatforms-multicoach.html carga
   → pw-config.js detecta dominio
   → pw-auth.js verifica si hay sesión
   
   SI hay sesión:
     → Carga shell (sidebar + nav)
     → Importa js/components.js
     → Renderiza módulos según permisos
   
   SI NO hay sesión:
     → Redirige a /login (a implementar)

2. Usuario selecciona módulo (ej: Dashboard)
   → Carga multicoach/pages/owner-dashboard.html
   → Sincroniza con Supabase
   → Renderiza KPIs, tabla de coaches, etc.
```

---

## 🎯 Cómo se Reutiliza `multicoach/pages/`

### Ambos dominios comparten las mismas páginas:

```javascript
// En pathwayplatforms-multicoach.html (línea ~X)
document.getElementById('content').innerHTML = /* llamar a: */
fetch('multicoach/pages/owner-dashboard.html')
  .then(r => r.text())
  .then(html => {
    // Inyectar HTML
    // Ejecutar scripts internos
    // Sincronizar con Supabase usando window.APP_CONFIG
  });
```

### Clave: Cada página en `multicoach/pages/` debe:

1. ✅ Detectar dominio:
   ```javascript
   const platform = window.APP_CONFIG.platform; // 'pathwaycareercoach' | 'pathwayplatforms'
   const authMode = window.APP_CONFIG.authMode;  // 'legacy' | 'pending'
   ```

2. ✅ Ajustar comportamiento según plataforma:
   ```javascript
   if (window.APP_CONFIG.platform === 'pathwayplatforms') {
     // Mostrar UI multi-tenant
     // Usar org_id en queries
   } else {
     // Mostrar UI single-coach (legacy)
     // Usar coach_id
   }
   ```

3. ✅ Usar datos compartidos de Supabase:
   ```javascript
   const apiUrl = window.APP_CONFIG.apiUrl;
   const supabaseRef = window.APP_CONFIG.supabaseProjectRef;
   // Queries con RLS correcta
   ```

---

## 🔐 Autenticación (Roadmap)

### Fase Actual: `authMode: "pending"`
```
Estado: ❌ No implementado
└─ pathwayplatforms-multicoach.html es preview (sin seguridad)
└─ Datos son mockeados (mock-data.js)
└─ No conecta a Supabase (solo formularios)
```

### Fase 1: Login local
```html
<!-- /pathwayplatforms-login.html (a crear) -->
<form onsubmit="handleLogin(email, password)">
  <input type="email" placeholder="Email">
  <input type="password" placeholder="Password">
  <button>Iniciar sesión</button>
</form>

<script>
async function handleLogin(email, pwd) {
  const result = await fetch(window.APP_CONFIG.apiUrl + '/auth/login', {
    method: 'POST',
    body: JSON.stringify({email, password: pwd})
  });
  
  if (result.ok) {
    const {token, user} = await result.json();
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    window.location.href = '/multicoach.html'; // redirect
  }
}
</script>
```

### Fase 2: OAuth (Google, Microsoft)
```javascript
// pw-auth.js (a extender)
window.PWAuth = {
  loginWithGoogle: async function() {
    // Redirigir a Google OAuth
    // Callback en /auth/callback
    // Intercambiar código por JWT
  },
  loginWithMicrosoft: async function() {
    // Ídem con Microsoft
  }
};
```

### Fase 3: SSO para organizaciones
```
pathwayplatforms.com/invite?token=xxx
  → User no tiene sesión
  → Sistema detecta: "invitación para empresa ABC"
  → Login SSO de empresa ABC
  → Redirect a dashboard de ABC
```

---

## 🧪 Testing por Módulo

### Dashboard (`owner-dashboard.html`)
- ✅ Mockea KPIs (coaches activos, clientes, sesiones, ingresos)
- ✅ Gráficos estáticos (Chart.js)
- ⏳ Conexión Supabase (cuando auth esté lista)
- ⏳ Actualización en tiempo real (sockets)

### Coaches (`owner-coaches.html`)
- ✅ Tabla estática con datos mock
- ⏳ CRUD (crear, editar, eliminar)
- ⏳ Bulk actions (activar/desactivar)
- ⏳ Filtros y búsqueda

### Clientes (`owner-clients.html`)
- ✅ Tabla/grid con datos mock
- ⏳ CRUD
- ⏳ Filtros por estado (activos, inactivos, etc.)
- ⏳ Sincronización con módulo Agenda

---

## 🔗 Integraciones Futuras

### 1. Calendario (Calendly, Google Calendar, Outlook)
```javascript
// En owner-schedule.html
window.PWSchedule = {
  syncCalendly: async function(token) {
    const events = await fetch('calendly.com/v1/scheduled_events', {
      headers: {Authorization: `Bearer ${token}`}
    }).then(r => r.json());
    // Guardar en supabase.sesiones_coaching
  }
};
```

### 2. Pagos (Stripe)
```javascript
// En owner-billing.html
window.PWBilling = {
  createPlan: async function(name, price) {
    const stripe = await fetch(window.APP_CONFIG.apiUrl + '/billing/create-plan', {
      method: 'POST',
      headers: {Authorization: 'Bearer ' + localStorage.getItem('auth_token')},
      body: JSON.stringify({name, price})
    }).then(r => r.json());
  }
};
```

### 3. Email (Brevo, SendGrid)
```javascript
// pw-notify.js (a crear)
window.PWNotify = {
  sendEmail: async function(to, template, data) {
    // Disparar email templated
  }
};
```

---

## 📊 Supabase Schema (Multi-Tenant)

### Tablas nuevas (para pathwayplatforms):
```sql
-- Organizaciones (empresas de coaching)
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Membresía de equipo
CREATE TABLE org_members (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  role TEXT DEFAULT 'member', -- 'admin', 'coach', 'member'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clientes de la org (distintos de usuarios)
CREATE TABLE org_clients (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  email TEXT,
  name TEXT,
  program_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sesiones de coaching
CREATE TABLE coaching_sessions (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  coach_id UUID REFERENCES users(id),
  client_id UUID REFERENCES org_clients(id),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS por organización:
```sql
-- Coaches solo ven sus clientes
CREATE POLICY "coaches_view_own_clients" ON org_clients
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
    )
  );

-- Admins ven todo de su org
CREATE POLICY "admins_full_access" ON org_clients
  FOR ALL USING (
    (auth.uid())::text = (SELECT owner_id FROM organizations WHERE id = org_id)
  );
```

---

## 🚀 Deployment

### 1. Local development:
```bash
npm run dev
# Accede a:
#   http://localhost:3000/pathwayplatforms-index.html
#   http://localhost:3000/pathwayplatforms-multicoach.html
```

### 2. Preview (Cloudflare Pages):
```bash
git push origin claude/pathwayplatforms-base-setup-14nn9d
# Builds automatically
# URL: https://<hash>.analisisform.pages.dev/pathwayplatforms-*
```

### 3. Producción (cuando dominio esté configurado):
```bash
# Cambiar Cloudflare DNS para pathwayplatforms.com
# → Points to analisisform.pages.dev
# → Automático con deploy a main

# Acceder en: https://pathwayplatforms.com/
```

---

## 📋 Checklist de Code Review

- [ ] `pw-config.js` detecta ambos dominios correctamente
- [ ] `pathwayplatforms-index.html` se renderiza sin errores
- [ ] `pathwayplatforms-multicoach.html` carga shell completo
- [ ] Navegación entre módulos funciona
- [ ] No hay conflictos con `multicoach.html` histórico
- [ ] `panel-v2.html` sigue intacto (sin cambios)
- [ ] Console limpia (sin warnings de assets)
- [ ] Responsive en mobile (sidebar colapsable)
- [ ] Branding coherente (colores, tipografía)
- [ ] URLs de API correctas (sin hardcoding)

---

**Última actualización:** 11 de agosto de 2026
