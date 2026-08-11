# Environment Detection System — pw-environment.js

**Documento:** Bloque 5 - Preparación de pathwayplatforms.com  
**Archivo:** pw-environment.js  
**Fecha:** Agosto 2026

---

## 📋 Propósito

Detectar automáticamente en qué dominio/entorno se ejecuta la app e inyectar configuración apropiada:
- **Detecta:** Dominio actual, tier (prod/staging/dev/preview)
- **Inyecta:** URLs de API, OAuth callbacks, feature flags
- **Valida:** Anti-phishing (solo dominios conocidos)
- **Expone:** `window.PWENV` y `window.PWFEATURES`

**Sin cambios en:** HTML, no requiere pre-compilación, carga con `<script>` antes de otros scripts.

---

## 🎯 Entornos Soportados

| Entorno | Hostname | Tier | API URL | Auth | Multiorg |
|---------|----------|------|---------|------|----------|
| **Pathway (Prod)** | `pathwaycareercoach.com` | production | `api.pathwaycareercoach.com` | `pathwaycareercoach.com` | ❌ No |
| **MultiCoach (Lab)** | `multicoach.pathwayplatforms.com` | staging | `api.pathwaycareercoach.com` | `pathwayplatforms.com` | ✅ Sí |
| **Auth Central (Future)** | `auth.pathwayplatforms.com` | staging | `auth.pathwayplatforms.com` | `auth.pathwayplatforms.com` | ✅ Sí |
| **Development** | `localhost:*` | local | `http://localhost:3000` | `localhost` | ✅ Sí |
| **Preview** | `*.pages.dev` (no analisisform) | preview | `api.pathwaycareercoach.com` | `pathwaycareercoach.com` | ❌ No |
| **Fallback** | `analisisform.pages.dev` | production | `api.pathwaycareercoach.com` | `pathwaycareercoach.com` | ❌ No |

---

## 📦 API: window.PWENV

### Propiedades de Detección

```javascript
PWENV.is.production    // true si tier === 'production'
PWENV.is.staging       // true si tier === 'staging'
PWENV.is.preview       // true si tier === 'preview'
PWENV.is.development   // true si tier === 'local'

PWENV.is.pathway       // true si pathwaycareercoach.com
PWENV.is.multicoach    // true si multicoach.pathwayplatforms.com
PWENV.is.authCentral   // true si auth.pathwayplatforms.com
```

### Configuración

```javascript
PWENV.config.name              // Nombre legible: "Pathway (Monodomain)"
PWENV.config.tier              // production | staging | preview | local
PWENV.config.apiUrl            // Base URL de Supabase API
PWENV.config.projectRef        // Supabase project ID
PWENV.config.webDomain         // Dominio de la web
PWENV.config.authDomain        // Dominio para OAuth
PWENV.config.oauthCallbackUrl  // Callback URL exacta
PWENV.config.analyticsId       // ID para telemetría
PWENV.config.environment       // production | staging | development | preview
```

### Métodos

```javascript
PWENV.getApiUrl()              // → apiUrl
PWENV.getAuthDomain()          // → authDomain
PWENV.getOAuthCallbackUrl()    // → oauthCallbackUrl
PWENV.isMultiOrgSupported()    // → true/false
PWENV.getAnalyticsId()         // → analyticsId

PWENV.isKnownDomain()          // Anti-phishing: ¿dominio whitelisted?
PWENV.log(msg)                 // Console log condicional
PWENV.logError(msg)            // Console error
```

---

## 🚀 Uso en HTMLs

### 1️⃣ Incluir en `<head>` (ANTES de otros scripts)

```html
<!DOCTYPE html>
<html>
<head>
  <script src="pw-environment.js"></script>
  <!-- Otros scripts aquí pueden usar window.PWENV -->
</head>
<body>
  ...
</body>
</html>
```

### 2️⃣ Usar en pw-auth.js

```javascript
// Reemplazar URLs hardcodeadas con:
const apiUrl = PWENV.getApiUrl();              // en lugar de 'https://...'
const oauthCallback = PWENV.getOAuthCallbackUrl();

// Verificar if multiorg:
if (PWENV.isMultiOrgSupported()) {
  // Lógica multiorg (login con org_id)
} else {
  // Lógica monodomain (login simple)
}
```

### 3️⃣ Usar en panel-v2.html

```javascript
// En _signIn() o _register():
const SB = PWENV.getApiUrl();
const headers = PWAUTH.headers();

// Logging ambiente-aware:
PWENV.log('Usuario ' + email + ' autenticando en ' + PWENV.config.name);
```

### 4️⃣ Usar en cliente.html

```javascript
// Determinar si mostrar opciones multiorg:
if (PWENV.isMultiOrgSupported()) {
  // Mostrar selector "cambiar organización"
} else {
  // Ocultar selector
}

// Analytics:
let analyticsId = PWENV.getAnalyticsId();
window.ga?.('config', analyticsId);
```

### 5️⃣ Usar en CSS (data attributes)

```css
/* Estilos condicionales por entorno */
html[data-pw-env="development"] .demo-banner {
  display: block; /* Mostrar "esto es un demo" en dev */
}

html[data-pw-env="production"] .demo-banner {
  display: none;
}

html[data-pw-tier="staging"] header {
  background: orange; /* Advertencia visual en staging */
}
```

---

## 🎛️ Feature Flags: window.PWFEATURES

Activados automáticamente según entorno:

```javascript
PWFEATURES.MULTICOACH_ENABLED      // true en multicoach.pathwayplatforms.com
PWFEATURES.OAUTH_CENTRALIZED       // false (activar en Phase 2)
PWFEATURES.TOKEN_REFRESH_ENABLED   // true (activar cuando heartbeat implementado)
PWFEATURES.RLS_MULTIORG            // true en multicoach (cuando SQL actualizado)
PWFEATURES.PHISHING_PROTECTION     // true siempre
PWFEATURES.ANALYTICS_ENABLED       // false en dev, true en prod/staging/preview
```

### Uso

```javascript
if (PWFEATURES.OAUTH_CENTRALIZED) {
  // Usar oauth-central endpoint
  // (fase futura)
} else {
  // Usar Supabase Auth directo
}

if (PWFEATURES.TOKEN_REFRESH_ENABLED) {
  // Ejecutar heartbeat cada 50 min
  // (implementar en pw-auth.js)
}
```

---

## 🔐 Anti-Phishing

### Validación de Dominio

```javascript
// En pw-environment.js:
if (!PWENV.isKnownDomain()) {
  console.error('Dominio desconocido detectado:', hostname);
  console.error('Posible ataque de phishing o dominio mal configurado');
  // No bloquear, pero alertar
}
```

### Whitelist de Dominios Conocidos

```javascript
const knownDomains = [
  'pathwaycareercoach.com',          // Pathway prod
  'multicoach.pathwayplatforms.com', // MultiCoach lab
  'auth.pathwayplatforms.com',       // Auth central (futuro)
  'analisisform.pages.dev',          // Fallback
  'localhost',                       // Dev
  '127.0.0.1',                       // Dev
];
```

**Agregar nuevos dominios aquí cuando se creen.**

---

## 📊 Logging

### Console Output

```
// En pathway:
[pw-environment] ✓ Entorno: Pathway (Monodomain) (production)
                   Origin: https://pathwaycareercoach.com

// En multicoach:
[pw-environment] ✓ Entorno: MultiCoach (Nuevo) (staging)
                   Origin: https://multicoach.pathwayplatforms.com

// En dev:
[pw-environment] ✓ Entorno: Development (Local) (local)
                   Origin: http://localhost:3000
```

### Logging en Código

```javascript
// En lugar de console.log():
PWENV.log('User logged in');          // Solo en dev/staging
PWENV.logError('Auth failed');        // Siempre

// O forzar log específico:
console.log('[pw-environment] Custom message');
```

---

## 🔄 Flujo de Carga

```
1. Browser carga HTML
   ↓
2. <script src="pw-environment.js"></script> ejecuta
   ↓
3. window.PWENV inyectado
   ↓
4. window.PWFEATURES inyectado
   ↓
5. document.documentElement.setAttribute('data-pw-env', ...) aplicado
   ↓
6. Otros scripts se cargan (pw-auth.js, panel-v2.js, etc)
   ↓
7. Usan window.PWENV.getApiUrl() en lugar de hardcoded URLs
```

---

## ✅ Checklist de Integración

Para integrar pw-environment.js en un HTML:

- [ ] 1. Agregar `<script src="pw-environment.js"></script>` en `<head>`
- [ ] 2. Reemplazar `var SB = 'https://...'` con `var SB = PWENV.getApiUrl()`
- [ ] 3. Reemplazar URLs de OAuth callback con `PWENV.getOAuthCallbackUrl()`
- [ ] 4. Agregar conditional logic: `if (PWENV.isMultiOrgSupported()) { ... }`
- [ ] 5. Reemplazar console.log con `PWENV.log()` en auth-related code
- [ ] 6. Agregar estilos condicionales con `html[data-pw-env]` si necesario
- [ ] 7. Verificar en console que PWENV está disponible
- [ ] 8. Probar login en ambos dominios (pathway + multicoach si aplica)

---

## 🐛 Debugging

Si algo no funciona:

```javascript
// En console:
console.log(PWENV);                // Ver configuración completa
console.log(PWENV.config.apiUrl);  // Ver URL de API actual
console.log(PWENV.is);             // Ver detección de entorno
console.log(PWFEATURES);           // Ver feature flags

// Verificar anti-phishing:
PWENV.isKnownDomain()              // ¿dominio whitelisted?

// Detectar entorno:
location.hostname                   // Ver hostname real
PWENV.config.name                  // Ver nombre detectado
PWENV.config.tier                  // Ver tier detectado
```

---

## 🚀 Phase 2: OAuth Centralizado (Futuro)

Cuando se implemente Opción 3 (OAuth centralizado):

```javascript
// En pw-environment.js, activar:
PWFEATURES.OAUTH_CENTRALIZED = true;

// En pw-auth.js:
if (PWFEATURES.OAUTH_CENTRALIZED) {
  // Usar: fetch(PWENV.getApiUrl() + '/functions/v1/oauth-central')
  // En lugar de: Supabase Auth.signInWithOAuth()
}
```

---

## 📝 Cambios Futuros

- [ ] **Phase 2:** Activar OAUTH_CENTRALIZED cuando edge function esté lista
- [ ] **Phase 2:** Implementar TOKEN_REFRESH_ENABLED (heartbeat + visibility)
- [ ] **Cuando RLS actualizado:** Activar RLS_MULTIORG
- [ ] **Cuando dominios adicionales:** Agregar a whitelist en isKnownDomain()

