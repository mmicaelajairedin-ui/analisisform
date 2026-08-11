# Mapa de Dependencias — Integración pathwayplatforms.com

**Documento:** Bloque 4 - Documentación de Integración  
**Fecha:** Agosto 2026  
**Propósito:** Identificar cambios críticos y orden de aplicación

---

## 📋 Resumen de Dependencias

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: Infraestructura (Supabase, Auth, DNS)          │
│ ├─ Supabase project (ddxnrsnjdvtqhxunxnwj)              │
│ ├─ Project refs (bloquea todo si es incorrecto)         │
│ ├─ OAuth providers (Google, Apple)                      │
│ └─ DNS/Cloudflare (dominio + proxy)                     │
│                                                          │
│ LAYER 2: Auth & Session (JWT, localStorage)             │
│ ├─ pw-auth.js (PWAUTH global)                            │
│ ├─ oauth-callback.html (token exchange)                 │
│ ├─ localStorage (origin-specific)                       │
│ ├─ postMessage Bridge (future)                          │
│ └─ Heartbeat + Token Refresh                            │
│                                                          │
│ LAYER 3: Frontend (HTML, Config, Portals)               │
│ ├─ panel-v2.html (_signIn, _register)                   │
│ ├─ cliente.html (portal cliente)                        │
│ ├─ login.html (UI login)                                │
│ ├─ window.APP_CONFIG (URLs centralizadas)               │
│ └─ pw-*.js (helpers)                                    │
│                                                          │
│ LAYER 4: API & RLS (REST, Policies)                     │
│ ├─ /rest/v1/* endpoints                                 │
│ ├─ RLS policies (org_id filtering)                      │
│ ├─ Edge functions                                       │
│ └─ Logging (client_errors)                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
  ▲                   CRITICAL PATH:
  │                   1. Infraestructura OK
  │    ├─→ 2. Auth configured
  │    ├─→ 3. URLs centralized
  │    ├─→ 4. RLS updated
  │    └─→ 5. Test + Deploy
```

---

## 🔴 CRITICAL PATH — Bloqueadores en Orden

### 1️⃣ Infraestructura Supabase (BLOQUEADOR PRINCIPAL)

**Dependencias:**
- ✅ Project ref correcto: `ddxnrsnjdvtqhxunxnwj`
- ✅ Proxy URL: `https://api.pathwaycareercoach.com`
- ✅ Custom domain DNS: `CNAME api → supabase`
- 🟡 Tabla `usuarios` con `auth_id` (Fase 4 RLS)
- 🟡 RLS policies aplicadas

**Status:** ✅ DONE (Bloque 1 typo fixes aplicadas)

**Bloquea:**
- Cualquier cambio de URL/OAuth
- Inicialización de PWAUTH
- Queries a `/rest/v1/*`

**Checklist:**
```bash
✅ grep -r "ddxnrsnjdvtqhxunxnwj" scripts/ docs/
✅ Supabase Dashboard → Settings → General → Project ref = ddxnrsnjdvtqhxunxnwj
✅ Supabase Dashboard → Auth → Providers → Google, Apple habilitados
✅ Cloudflare → DNS → A record api → points to Supabase IP
✅ npm run verify (validate-supabase-config.js)
```

---

### 2️⃣ OAuth Providers Configurados (BLOQUEADOR DE AUTH)

**Dependencias:**
- ← Supabase project ref correcto
- Callback URIs registradas en Google/Apple/Supabase
- CORS habilitado

**Cambios requeridos:**

| Proveedor | Dónde | Cambio |
|-----------|-------|--------|
| **Google** | OAuth 2.0 Credentials | Agregar redirect URI: `https://multicoach.pathwayplatforms.com/auth-callback.html` |
| **Apple** | App ID Capabilities | Agregar return URL: `https://multicoach.pathwayplatforms.com` |
| **Supabase** | Auth → Redirect URLs | Agregar: `https://multicoach.pathwayplatforms.com` |

**Status:** 🟡 PENDING (agregar URLs nuevas sin remover antiguas)

**Bloquea:**
- Login con Google/Apple en multicoach
- postMessage Bridge
- OAuth centralizado (opción 3)

**Timeline:** 15 minutos (4 clicks por proveedor)

---

### 3️⃣ localStorage Origin-Specificity (BLOQUEADOR DE SESIÓN)

**Dependencias:**
- ← OAuth providers configurados
- ← pw-auth.js funcional en ambos dominios

**Problema actual:**
```javascript
// pathwaycareercoach.com
localStorage['supabase.auth.token'] = jwt;

// multicoach.pathwayplatforms.com
localStorage['supabase.auth.token'] // → undefined (otro origin)
```

**Soluciones en orden:**

| Opción | Timeline | Complejidad | Recomendación |
|--------|----------|-------------|---------------|
| **1. postMessage Bridge** | 4 horas | Media | Interim (~30 días) |
| **3. OAuth Centralizado** | 8-10 horas | Alta | Production (Phase 2) |
| **5. Token URL** | 1 hora | Baja | ❌ Anti-patrón OAuth |

**Status:** 🟡 PENDING (Opción 1 interim, Opción 3 después)

**Bloquea:**
- SSO sin double-login
- Token refresh automático
- Cambio de org_id sin reloguin

**Timeline:**
- Opción 1: Implementar hoy (4h) si necesario
- Opción 3: Fase 2 cuando Pathway congelado (8-10h)

---

### 4️⃣ RLS Policies Multiorg (BLOQUEADOR DE DATOS)

**Dependencias:**
- ← localStorage sesión funcionando
- JWT payload incluye `org_id` (propuesto)
- Tabla `usuarios` mapea user → org_id

**Cambios requeridos en SQL:**

```sql
-- RLS Fase 4: Actual (monodomain)
CREATE POLICY candidatos_coach ON candidatos
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

-- RLS Fase 5: Propuesto (multiorg)
CREATE POLICY candidatos_multiorg ON candidatos
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR
    (
      SELECT org_id FROM usuarios 
      WHERE id = auth.uid()
    ) = candidatos.org_id
  );
```

**Status:** 🟡 PENDING (SQL rewrite cuando JWT incluye org_id)

**Bloquea:**
- Coach multiorg ve solo sus clientes (no de otras orgs)
- Aislamiento de datos garantizado

**Timeline:** 2 horas (SQL + test)

---

### 5️⃣ Centralización de URLs en APP_CONFIG (BLOQUEADOR MENOR)

**Dependencias:**
- ← Infraestructura OK
- ← OAuth providers OK

**Cambios:**
- Migrar 70+ hardcoded `var SB = 'https://...'` a `window.APP_CONFIG`
- Actualizar 13+ HTML files
- Nueva función: `_getBaseUrl()` que detects `pathwaycareercoach.com` vs `pathwayplatforms.com`

**Status:** 🟡 DEFERRED (Bloque 3, después de Bloque 5)

**Bloquea:**
- Cambios de dominio simplificados (1 lugar, no 70+)
- Ambiente-aware config

**Timeline:** 3-4 horas (13 archivos × 10 min cada uno)

---

## 🟢 ORDEN DE IMPLEMENTACIÓN (RECOMENDADO)

```
Hoy (Pathway congelado):
│
├─ 1️⃣ Infraestructura ✅ DONE (Bloque 1)
│  └─ Guardrails ✅ DONE (Bloque 2)
│  └─ Documentación 🔄 EN PROGRESO (Bloque 4)
│
├─ 2️⃣ OAuth Providers 🟡 PENDING (15 min)
│  ├─ Google Console: agregar redirect URI
│  ├─ Apple Developer: agregar return URL
│  └─ Supabase Auth: agregar redirect URL
│
├─ 3️⃣ DNS & Cloudflare 🟡 PENDING (Bloque 5)
│  ├─ Crear CNAME: auth.pathwayplatforms.com
│  ├─ Crear CNAME: multicoach.pathwayplatforms.com
│  └─ Verificar SSL/TLS (auto con Cloudflare)
│
├─ 4️⃣ Infraestructura multicoach 🟡 PENDING (Bloque 5)
│  ├─ Supabase: RLS policies review
│  ├─ Supabase: auth_id mapping
│  └─ Edge functions: verificar (no cambios)
│
├─ 5️⃣ postMessage Bridge 🟡 PENDING (4h)
│  └─ Solo si necesario antes de Phase 2
│
└─ CONGELADO: Bloque 3 (APP_CONFIG)
   └─ Después de Bloque 5 ✓
   
  ┌─ PHASE 2 (cuando Pathway estable):
  │
  ├─ 6️⃣ OAuth Centralizado 🟡 PENDING (8-10h)
  │  ├─ Edge Function: /oauth-central
  │  ├─ JWT payload: agregar org_id
  │  └─ RLS: actualizar policies
  │
  ├─ 7️⃣ Token Refresh Strategy 🟡 PENDING (4h)
  │  ├─ Heartbeat (cada 50 min)
  │  ├─ Visibility check
  │  └─ Lazy refresh
  │
  └─ 8️⃣ Bloque 3: APP_CONFIG 🟡 PENDING (3-4h)
     └─ Centralizar URLs
```

---

## 📊 Tabla de Dependencias (Quién depende de quién)

```
pw-auth.js
  ├─ Depende de:
  │  ├─ Supabase Auth SDK (CDN)
  │  ├─ localStorage (origin-specific)
  │  ├─ oauth-callback.html (redirect)
  │  └─ PWAUTH.headers() (usado por _sbw)
  │
  └─ Es usado por:
     ├─ panel-v2.html (_signIn, _register)
     ├─ cliente.html (login)
     ├─ _sbw() (headers con JWT)
     └─ Edge functions (JWT validation)

panel-v2.html
  ├─ Depende de:
  │  ├─ pw-auth.js (PWAUTH global)
  │  ├─ Supabase REST API (/rest/v1/*)
  │  ├─ RLS policies (org_id filtering)
  │  └─ Edge functions (generar-informe, etc)
  │
  └─ Es usado por:
     ├─ login.html (redirect)
     └─ index.html (CTA "Dashboard")

cliente.html
  ├─ Depende de:
  │  ├─ pw-auth.js (PWAUTH global)
  │  ├─ Supabase REST API
  │  ├─ RLS policies
  │  └─ Edge functions (notificaciones)
  │
  └─ Es usado por:
     ├─ login.html (redirect)
     └─ formulario.html (link después de intake)

auth-callback.html
  ├─ Depende de:
  │  ├─ pw-auth.js (PWAUTH.handleOAuthCallback)
  │  ├─ OAuth provider (Google, Apple)
  │  └─ Supabase Auth (exchangeCodeForSession)
  │
  └─ Es usado por:
     └─ OAuth providers (redirect después de consent)

RLS Policies (Supabase)
  ├─ Depende de:
  │  ├─ Tabla `usuarios` (auth_id, org_id)
  │  ├─ JWT payload (auth.uid())
  │  └─ auth.jwt() ->> 'org_id' (propuesto)
  │
  └─ Es usado por:
     ├─ panel-v2.html (_sbw queries)
     ├─ cliente.html (queries)
     └─ Edge functions (select con RLS)

Edge Functions
  ├─ Depende de:
  │  ├─ Supabase Auth (JWT validation)
  │  ├─ RLS policies (SELECT con seguridad)
  │  └─ Secrets (API keys, etc)
  │
  └─ Es usado por:
     ├─ panel-v2.html (generar-informe, send-email)
     ├─ cliente.html (notificaciones)
     └─ Cron jobs (coach-lifecycle, analytics-weekly)
```

---

## 🔄 Cambio de Dominio: Ripple Effects

Cuando se cambia de `pathwaycareercoach.com` a `multicoach.pathwayplatforms.com`:

```
CHANGE: OAuth callback URL
  ↓
Google/Apple/Supabase rechaza redirect a URL no registrada
  ↓
auth-callback.html recibe 401 Unauthorized
  ↓
Usuario no puede autenticar
  ↓
panel-v2.html NO se carga
  ↓
IMPACT: ❌ Todos los coaches sin acceso

FIX: Agregar URL a Google/Apple/Supabase whitelist
```

```
CHANGE: localStorage origin
  ↓
multicoach.pathwayplatforms.com NO puede leer JWT de pathwaycareercoach.com
  ↓
pw-auth.js no encuentra token en localStorage
  ↓
Usuario logueado que navega entre dominios se desconecta
  ↓
IMPACT: 🟡 Double-login requerido

FIX: postMessage Bridge (Opción 1, interim)
     OAuth Centralizado (Opción 3, long-term)
```

```
CHANGE: RLS policies sin actualizar org_id
  ↓
Coach de org 456 ve candidatos de org 123 (data leak)
  ↓
IMPACT: ❌❌❌ CRITICIDAD MÁXIMA

FIX: Actualizar SQL policies ANTES de go-live multiorg
```

---

## ✅ Gating / Feature Flags (Propuesto)

Para activar dominio nuevo sin breaking changes:

```javascript
// En window.APP_CONFIG
const FEATURE_FLAGS = {
  MULTICOACH_ENABLED: false,        // flip cuando Bloque 5 terminado
  OAUTH_CENTRALIZED: false,         // flip cuando Phase 2 implementado
  TOKEN_REFRESH_ENABLED: false,     // flip cuando Layer 1-3 testeado
  RLS_MULTIORG: false,              // flip cuando SQL actualizado
};

// Uso:
if (FEATURE_FLAGS.MULTICOACH_ENABLED) {
  // postMessage Bridge: compartir token
  // RLS: aplicar multiorg
} else {
  // Legacy: monodomain
  // RLS: coach_id filtering
}
```

---

## 📝 Test Checklist (Pre-Go-Live)

- [ ] 1. Login nativo en pathwaycareercoach.com ✅
- [ ] 2. Login Google en pathwaycareercoach.com ✅
- [ ] 3. Login Apple en app iOS ✅
- [ ] 4. Login Google en multicoach.pathwayplatforms.com (NUEVO)
- [ ] 5. Login Apple en multicoach.pathwayplatforms.com (NUEVO)
- [ ] 6. Token refresh después de 1 hora (NUEVO)
- [ ] 7. Cambio de org_id sin logout (NUEVO)
- [ ] 8. Coach no ve clientes de otra org (NUEVO)
- [ ] 9. RLS: admin ve todo (NUEVO)
- [ ] 10. Logout en un dominio → logout en el otro (NUEVO)
- [ ] 11. postMessage Bridge: funciona cross-origin (NUEVO)
- [ ] 12. Phishing test: OAuth redirect rechaza URLs no-whitelist (NUEVO)

---

## 📞 Puntos de Escalamiento

Si algo falla:

| Falla | Debug | Fix |
|-------|-------|-----|
| Login rechazado en Google | Google Console → Redirect URIs | Agregar URL |
| localStorage vacío | DevTools → Application → Storage | Verificar origin |
| 401 en /rest/v1/* | Supabase SQL Editor → RLS policies | Verificar filtering |
| Token expirado | Verificar `exp` en JWT | Implementar refresh |
| Coach ve datos de otra org | Supabase logs | Actualizar RLS |

