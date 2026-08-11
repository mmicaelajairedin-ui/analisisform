# OAuth Flows y Estrategia de Auth Multiplataforma

**Documento:** Bloque 4 - Documentación de Integración  
**Fecha:** Agosto 2026  
**Bloqueador:** Validar antes de activar pathwayplatforms.com

---

## 📋 Arquitectura Actual (Pathway Monodomain)

```
┌─ Pathway ─────────────────────────────────────────┐
│                                                    │
│  pathwaycareercoach.com                            │
│  ├─ index.html (landing pública)                   │
│  ├─ panel-v2.html (coach, autenticado)             │
│  ├─ cliente.html (cliente, autenticado)            │
│  ├─ formulario.html (intake, con JWT)              │
│  └─ auth-callback.html (OAuth redirect)            │
│                                                    │
│  Auth: Supabase Auth → JWT en localStorage         │
│  RLS: ✅ Row-Level Security por coach_id/org_id    │
│  Sesión: localStorage (origin-specific)            │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Flujos Activos (Pathway)

#### 1️⃣ Login Nativo (Email/Contraseña)
```
Usuario → login.html
  ↓
panel-v2.html: _signIn(email, pwd)
  ↓
Supabase Auth.signInWithPassword()
  ↓
JWT → localStorage['supabase.auth.token']
  ↓
panel-v2.html: PWAUTH.headers() injacta Authorization: Bearer JWT
  ↓
Queries a /rest/v1/* con JWT → RLS filtra por coach_id
```

**Archivo:** panel-v2.html líneas ~14800–15000 (`_signIn`, `_register`)  
**Estado:** ✅ Funcional  
**Seguridad:** ✅ JWT en localStorage (no XSS-safe pero no hay alternativa en vanilla)

#### 2️⃣ Google Sign-In (OAuth 2.0)
```
Usuario → login.html: "Continuar con Google"
  ↓
Supabase Auth.signInWithOAuth({ provider: 'google' })
  ↓
Redirect → Google OAuth consent
  ↓
Google → Callback: https://pathwaycareercoach.com/auth-callback.html?code=...
  ↓
auth-callback.html: PWAUTH.handleOAuthCallback(code)
  ↓
Supabase Auth.exchangeCodeForSession()
  ↓
JWT → localStorage['supabase.auth.token']
  ↓
Redirect → panel-v2.html (usuario autenticado)
```

**Archivo:** pw-auth.js líneas ~400–500 (handleOAuthCallback)  
**Estado:** ✅ Funcional  
**Google Console:** Callback URI = `https://pathwaycareercoach.com/auth-callback.html`  
**Seguridad:** ✅ Code exchange en backend (Supabase SDK)

#### 3️⃣ Apple Sign-In (OAuth 2.0 + Apple-specific)
```
Usuario → app iOS: "Sign in with Apple"
  ↓
AppleSDK.signIn() → ID token (JWT de Apple)
  ↓
Frontend → /auth/v1/callback con{ provider: 'apple', id_token: ... }
  ↓
Supabase valida ID token de Apple
  ↓
JWT → localStorage (o secure storage en app)
  ↓
Portal activa (cliente.html, panel-v2.html)
```

**Archivo:** pw-apple-signin.js líneas ~1–100  
**Estado:** ✅ Implementado (app iOS)  
**Apple Developer:** Configurado en identifiers + capabilities  
**Seguridad:** ✅ ID token validado en servidor

---

## 🟡 Bloqueador: Arquitectura de Dominio Dual

Cuando se active `multicoach.pathwayplatforms.com`:

```
┌─ Pathway (Monodomain) ──────────────────────┐    ┌─ MultiCoach (Nuevo) ─────────────────────────┐
│ pathwaycareercoach.com                      │    │ multicoach.pathwayplatforms.com              │
│ ├─ Coach: JWT org=1                         │    │ ├─ Coach: JWT org=N (dinámico)               │
│ ├─ Auth: Supabase local                     │    │ ├─ Auth: ???                                 │
│ ├─ localStorage: pathwaycareercoach.com     │    │ ├─ localStorage: pathwayplatforms.com (otro) │
│ └─ RLS: WHERE org_id = 1                    │    │ └─ RLS: WHERE org_id = user.org_id           │
└─────────────────────────────────────────────┘    └──────────────────────────────────────────────┘
           ↑ Origin A                                          ↑ Origin B
           └─ Separate storage ─────────────────────────────────┘
           PROBLEMA: JWT no viaja entre origins
```

### 🔴 CRÍTICO: localStorage es Origin-Specific

```javascript
// En pathwaycareercoach.com
localStorage.setItem('supabase.auth.token', jwt_pathway);

// En multicoach.pathwayplatforms.com
localStorage.getItem('supabase.auth.token'); // → null (otro origin)
```

**Consecuencia:** Usuario debe login 2 veces (una por dominio).

---

## 5️⃣ Opciones de Solución (Bloque 1 Auditoría)

### Opción 1: postMessage Bridge (Rápida, 4 horas)
```javascript
// En multicoach.pathwayplatforms.com
let popup = window.open('https://pathwaycareercoach.com/token-bridge.html');
popup.addEventListener('message', (e) => {
  localStorage.setItem('supabase.auth.token', e.data.jwt);
});
```
**Pro:** Rápido, usa origin pathwaycareercoach.com para almacenar  
**Con:** Requiere popup (bloqueado en algunos navegadores), mantener 2 logins

### Opción 2: Token en URL (Anti-patrón OAuth)
```
https://multicoach.pathwayplatforms.com/?token=eyJh...
```
**Pro:** Directo  
**Con:** ❌ URLs con tokens se logean en proxies, historial de navegador, Sentry, etc.

### ⭐ Opción 3: OAuth Centralizado en auth.pathwayplatforms.com (RECOMENDADA)
```
┌──────────────────────────────────────────────────────────┐
│ auth.pathwayplatforms.com (Central OAuth)                 │
│                                                           │
│  ├─ Token endpoint: /token (emite JWT)                   │
│  ├─ Refresh endpoint: /refresh                           │
│  ├─ Validate endpoint: /validate (check expiry)          │
│  └─ RLS: JWT contiene org_id + user_id (dinámico)        │
│                                                           │
│  Storage: postMessage Bridge                             │
│  └─ pathwaycareercoach.com localStorage ← shared store   │
│  └─ multicoach.pathwayplatforms.com localStorage ← idem  │
│                                                           │
└──────────────────────────────────────────────────────────┘
     ↑ Ambos dominios comparten sto
     ├─ Google OAuth redirects aquí
     ├─ Apple OAuth redirects aquí
     └─ Valida org_id, devuelve JWT multiorg
```

**Ventajas:**
- ✅ SSO unificado (un login = ambos dominios)
- ✅ Token multiorg (coach puede cambiar org sin logout)
- ✅ Refresh centralizado (sin round-trip)
- ✅ RLS automático (JWT lleva org_id)

**Desventajas:**
- 🟡 Requiere edge function nueva
- 🟡 Cambio de arquitectura de Supabase Auth

**Implementación (fase posterior):**
1. Crear Supabase Edge Function: `/functions/v1/oauth-central`
2. Reemplazar `Supabase Auth.signInWithOAuth()` con llamada a `oauth-central`
3. `oauth-central` retorna JWT con `org_id` + `user_id`
4. postMessage Bridge comparte token entre origins

### Opción 4: Service Worker (Intermedia)
Usar service worker para sincronizar localStorage entre origins.  
**Problema:** Service workers también son origin-specific.

### Opción 5: Supabase API Key Multi-Org
Mantener la key única pero RLS maneja dinámicamente en JWT.  
**Problema:** Ya implementado, pero localStorage sigue siendo origin-specific.

---

## 🔐 Seguridad: JWT Architecture

### JWT Payload (Actual)

```json
{
  "sub": "coach-uuid-123",
  "email": "coach@example.com",
  "aud": "authenticated",
  "iss": "https://ddxnrsnjdvtqhxunxnwj.supabase.co",
  "iat": 1723900000,
  "exp": 1723903600,
  "email_confirmed_at": "2026-01-01T00:00:00Z",
  "role": "authenticated"
}
```

**Gap:** No incluye `org_id`. RLS lo obtiene de tabla `usuarios` via `auth.uid()`.

### JWT Payload (Propuesto - MultiOrg)

```json
{
  "sub": "coach-uuid-123",
  "email": "coach@example.com",
  "org_id": "org-456",
  "aud": "authenticated",
  "iss": "https://auth.pathwayplatforms.com",
  "iat": 1723900000,
  "exp": 1723903600,
  "role": "authenticated"
}
```

**Ventaja:** RLS puede hacer `WHERE org_id = auth.jwt() ->> 'org_id'` directamente.

### RLS Policies (Actual)

```sql
-- Candidatos: solo visible para su coach
CREATE POLICY candidatos_coach_filter ON candidatos
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

-- Admin: ve todo
CREATE POLICY candidatos_admin ON candidatos
  FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin'
  );
```

### RLS Policies (Propuesto)

```sql
-- Candidatos: visible para su coach O administrador global
CREATE POLICY candidatos_multiorg ON candidatos
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR
    (auth.jwt() ->> 'org_id')::uuid = organizaciones.id
  );
```

---

## 🔄 Token Refresh Strategy (TTL 3600s)

### Actual: No hay refresh automático

```javascript
// Token emitido con exp: 3600 segundos (1 hora)
// Después de 1 hora:
// - Usuario hace una query → 401 Unauthorized
// - UI muestra "Sesión expirada"
// - Usuario debe login de nuevo
```

**Problema:** Después de 1 hora inactivo, usuario pierde sesión.

### Propuesto: Estrategia Híbrida (Bloque 2 Auditoría)

**Layer 1: Heartbeat (cada 50 minutos)**
```javascript
setInterval(() => {
  if (localStorage.getItem('supabase.auth.token')) {
    fetch('/functions/v1/keep-alive', {
      headers: { Authorization: `Bearer ${jwt}` }
    });
  }
}, 50 * 60 * 1000);
```

**Layer 2: Visibility Check**
```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && tokenExpiredSoon()) {
    refreshToken();
  }
});
```

**Layer 3: Lazy Refresh**
```javascript
async function _sbw_retry(...) {
  let res = await fetch(...);
  if (res.status === 401) {
    // Token expiró
    const newJwt = await PWAUTH.refreshToken();
    localStorage.setItem('supabase.auth.token', newJwt);
    res = await fetch(...); // retry con token nuevo
  }
  return res;
}
```

**Resultado:** Sesión dura hasta 12 horas (si el navegador está abierto).

---

## ✅ Checklist Pre-Activación (auth.pathwayplatforms.com)

- [ ] 1. Edge Function `/oauth-central` deployada
- [ ] 2. JWT payload incluye `org_id`
- [ ] 3. postMessage Bridge implementado
- [ ] 4. RLS policies actualizadas (multiorg)
- [ ] 5. Google OAuth: callback URIs incluyen `auth.pathwayplatforms.com`
- [ ] 6. Apple OAuth: redirect URIs incluyen `auth.pathwayplatforms.com`
- [ ] 7. Supabase Auth: redirect URLs en settings incluyen `multicoach.pathwayplatforms.com`
- [ ] 8. Heartbeat + Visibility API implementados
- [ ] 9. Test: login desde pathwaycareercoach → sesión en multicoach
- [ ] 10. Test: logout desde multicoach → logout en pathwaycareercoach
- [ ] 11. Test: refresh token cuando expira
- [ ] 12. Logging: audit trail de cambios de org_id

---

## 📊 OAuth Provider Configuration (Actual)

### Google Cloud Console
```
OAuth 2.0 Credentials
├─ Authorized JavaScript origins:
│  ├─ https://pathwaycareercoach.com
│  ├─ https://analisisform.pages.dev (fallback)
│  └─ http://localhost:3000 (dev)
│
└─ Authorized redirect URIs:
   └─ https://pathwaycareercoach.com/auth-callback.html
   └─ https://analisisform.pages.dev/auth-callback.html (fallback)
```

**Actualizar para multicoach:**
```
└─ Authorized redirect URIs:
   ├─ https://pathwaycareercoach.com/auth-callback.html (mantener)
   ├─ https://multicoach.pathwayplatforms.com/auth-callback.html (nuevo)
   └─ https://auth.pathwayplatforms.com/oauth/callback (futuro)
```

### Apple Developer
```
Sign in with Apple
├─ App ID: (app iOS)
├─ Return URLs:
│  ├─ https://pathwaycareercoach.com (actual)
│  └─ https://multicoach.pathwayplatforms.com (nuevo)
│
└─ Domains and Subdomains:
   ├─ pathwaycareercoach.com
   └─ pathwayplatforms.com
```

### Supabase Dashboard
```
Auth → Providers
├─ Google: ✅ Enabled
├─ Apple: ✅ Enabled
└─ Email: ✅ Enabled (nativo)

Auth → Redirect URLs
├─ https://pathwaycareercoach.com (actual)
├─ https://multicoach.pathwayplatforms.com (nuevo)
└─ https://auth.pathwayplatforms.com/oauth/callback (futuro)
```

---

## 🔐 Anti-Phishing: OAuth Redirect Validation

Todas las URLs de OAuth deben estar en **whitelist explícita**.

```javascript
// En auth-callback.html
const ALLOWED_ORIGINS = [
  'https://pathwaycareercoach.com',
  'https://multicoach.pathwayplatforms.com',
  'https://auth.pathwayplatforms.com',
  'https://analisisform.pages.dev', // fallback
];

const state = new URL(window.location).searchParams.get('state');
const redirectUrl = localStorage.getItem('oauth_redirect_' + state);

if (!ALLOWED_ORIGINS.includes(new URL(redirectUrl).origin)) {
  console.error('Phishing attempt detected');
  window.location.href = 'https://pathwaycareercoach.com';
}
```

---

## 📝 Próximos Pasos

1. **Hoy (Bloque 4):** Documentar arquitectura ← AQUÍ
2. **Bloque 5:** Preparar infraestructura (DNS, Cloudflare, Supabase config)
3. **Bloque 3 (después):** Centralizar URLs en `window.APP_CONFIG`
4. **Phase 2:** Implementar Opción 3 (OAuth centralizado) cuando Pathway esté congelado

