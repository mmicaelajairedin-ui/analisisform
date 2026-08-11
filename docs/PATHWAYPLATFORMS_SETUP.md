# Setup de pathwayplatforms.com — Infraestructura y DNS

**Documento:** Bloque 5 - Preparación de pathwayplatforms.com  
**Fecha:** Agosto 2026  
**Estado:** 🟡 PENDING (checklist, sin activar todavía)  
**Constrasta:** No tocar Auth/OAuth/Supabase/RLS todavía. Solo preparar.

---

## 📋 Resumen de Setup

Configurar `pathwayplatforms.com` como dominio NUEVO (sin reemplazar `pathwaycareercoach.com`):
- ✅ Registrar dominio (si no existe)
- ✅ Agregar a Cloudflare (SSL/TLS, DNS)
- ✅ Crear subdominio `multicoach.pathwayplatforms.com`
- ✅ Crear proxy `api.pathwayplatforms.com` (futuro, por ahora compartir API)
- ✅ Verificar URLs de callback OAuth (sin cambiar todavía)
- ✅ Preparar Supabase (revisar RLS, no cambiar)
- ❌ NO cambiar Auth todavía
- ❌ NO migrar datos
- ❌ NO eliminar pathwaycareercoach.com

**Timeline:** 2-3 horas (mostly DNS/Cloudflare clicks)  
**Rollback:** Fácil (eliminar DNS records, Cloudflare rules)

---

## 🟢 Bloque 5.1: Registrar Dominio

### Si `pathwayplatforms.com` ya existe

✅ **SKIP** — Confirmación necesaria de Micaela.

### Si hay que registrar

1. **Registrador de dominios** (GoDaddy, Namecheap, Google Domains, etc)
2. **Registrar:** `pathwayplatforms.com`
3. **Configurar nameservers** → Cloudflare (ver siguiente sección)

---

## 🟡 Bloque 5.2: Agregar a Cloudflare

### Paso 1: Agregar sitio

```
Cloudflare Dashboard
  → + Add a site
  → Enter: pathwayplatforms.com
  → Free plan (suficiente por ahora)
  → Next
```

### Paso 2: Actualizar Nameservers

Cloudflare proporciona 2 nameservers (ej):
```
ns1.cloudflare.com
ns2.cloudflare.com
```

En tu registrador (GoDaddy, Namecheap, etc):
```
Nameservers:
  → ns1.cloudflare.com
  → ns2.cloudflare.com
```

**Tiempo:** Puede tomar 24-48 horas para propagación completa.

### Paso 3: Verificar Propagación

```bash
# En terminal:
nslookup pathwayplatforms.com ns1.cloudflare.com
# Debe retornar la IP de Cloudflare

# Alternativa:
dig pathwayplatforms.com
# Status debe ser NOERROR
```

---

## 🟢 Bloque 5.3: Crear Subdominio multicoach

En Cloudflare Dashboard:

### 1. Crear Record A (raíz)

| Campo | Valor |
|-------|-------|
| Type | CNAME |
| Name | pathwayplatforms.com |
| Target | analisisform.pages.dev |
| Proxy | Proxied (naranja) |
| TTL | Auto |

**Propósito:** Redirigir raíz a Cloudflare Pages (futuro landing)

### 2. Crear Record CNAME (multicoach)

| Campo | Valor |
|-------|-------|
| Type | CNAME |
| Name | multicoach |
| Target | analisisform.pages.dev |
| Proxy | Proxied (naranja) |
| TTL | Auto |

**Resultado:** `multicoach.pathwayplatforms.com` → `analisisform.pages.dev`

### 3. Crear Record CNAME (api — futuro)

| Campo | Valor |
|-------|-------|
| Type | CNAME |
| Name | api |
| Target | (vacío por ahora) |
| Proxy | Proxied |
| TTL | Auto |

**Nota:** Rellenar cuando se configure proxy de API centralizado (Phase 2).

---

## 🟠 Bloque 5.4: Configurar SSL/TLS

En Cloudflare:

### SSL/TLS Mode

```
Cloudflare Dashboard → SSL/TLS → Overview
  → Edge Certificates: Full
  → Auto HTTPS Rewrites: ON
  → Minimum TLS Version: 1.2
```

### DNS CNAME Flattening (requerido para raíz)

```
Cloudflare Dashboard → DNS → Records
  → Si name = "@" (raíz) y type = CNAME:
     Cloudflare auto-convierte a ANAME (flattening)
```

**Resultado:** `https://pathwayplatforms.com/` funciona sin errores SSL.

---

## 🔵 Bloque 5.5: Crear Cloudflare Pages Project

Crear proyecto Pages vinculado a repo:

### En Cloudflare

```
Cloudflare Dashboard → Pages
  → Create a project
  → Connect to Git
  → Select: mmicaelajairedin-ui/analisisform
  → Production branch: main (o actual)
  → Build settings:
     - Framework: None (vanilla HTML/JS)
     - Build command: (vacío)
     - Build output directory: / (raíz del repo)
     - Environment variables: (ninguno por ahora)
```

### Configurar Custom Domain

```
Cloudflare Pages project → Settings → Domains
  → Custom domains
  → Add custom domain: multicoach.pathwayplatforms.com
  → Nameserver configuration (auto, ya en Cloudflare)
```

**Resultado:** `https://multicoach.pathwayplatforms.com` → analisisform Pages + tu HTML/JS

---

## 🟢 Bloque 5.6: Verificar URLs OAuth (Sin Cambiar)

### Checklist — Revisar pero NO modificar todavía

#### Google Cloud Console

```
https://console.cloud.google.com
  → APIs & Services
  → Credentials
  → OAuth 2.0 Client IDs
  → Edit
    → Authorized JavaScript origins:
       ✓ https://pathwaycareercoach.com
       ✓ https://analisisform.pages.dev
       (NO AGREGAR multicoach.pathwayplatforms.com todavía)
    
    → Authorized redirect URIs:
       ✓ https://pathwaycareercoach.com/auth-callback.html
       ✓ https://analisisform.pages.dev/auth-callback.html
       (NO AGREGAR multicoach.pathwayplatforms.com todavía)
```

**Nota:** Cambios de OAuth requieren sincronización con RLS/auth updates. Diferir a Bloque 1 de Phase 2.

#### Apple Developer

```
https://developer.apple.com/account
  → Certificates, Identifiers & Profiles
  → Identifiers → App IDs
  → Sign in with Apple capabilities
    → Return URLs:
       ✓ https://pathwaycareercoach.com
       (NO AGREGAR pathwayplatforms.com todavía)
```

#### Supabase Dashboard

```
https://supabase.com/dashboard/project/ddxnrsnjdvtqhxunxnwj
  → Authentication
  → Redirect URLs
    ✓ https://pathwaycareercoach.com
    ✓ https://analisisform.pages.dev
    (NO AGREGAR pathwayplatforms.com todavía)
```

**Acción:** Revisar que estén exactas. Si falta una, avisar a Micaela.

---

## 🔵 Bloque 5.7: Revisar RLS Policies (Sin Cambiar)

En Supabase SQL Editor:

```sql
-- Revisar que las policies existan (no modificar):
SELECT * FROM pg_policies WHERE tablename = 'candidatos';
SELECT * FROM pg_policies WHERE tablename = 'usuarios';
SELECT * FROM pg_policies WHERE tablename = 'informes';

-- Verificar que filtren por coach_id (monodomain actual):
-- Esperado: WHERE coach_id = auth.uid()
-- NO esperado: WHERE org_id = ... (eso es Phase 2)
```

**Output esperado:**
```
policy_name                | tablename   | qual
───────────────────────────┼─────────────┼────────────────────
candidatos_coach_select    | candidatos  | (coach_id = auth.uid())
informes_coach_select      | informes    | (coach_id = auth.uid())
usuarios_protect_password  | usuarios    | (...password_hash revoked...)
```

**Acción:** Si hay policies rotas, reportar a Micaela. NO tocar SQL.

---

## 🟢 Bloque 5.8: Preparar Supabase Auth Settings

En Supabase Dashboard (revisar, no cambiar):

### Auth → Providers

```
Google:        ✓ Enabled
Apple:         ✓ Enabled
Email:         ✓ Enabled (nativo)
```

### Auth → JWT Secret

```
Should already be configured.
DO NOT CHANGE.
```

### Auth → Redirect URLs

```
Current:
✓ https://pathwaycareercoach.com
✓ https://analisisform.pages.dev

Not yet:
⏳ https://multicoach.pathwayplatforms.com
   (agregar cuando Phase 2 auth)
```

---

## 🔵 Bloque 5.9: Preparar Edge Functions

Verificar que existan (sin modificar):

```bash
# En Supabase Functions:
✓ generar-informe
✓ send-email
✓ send-push
✓ notif-new-client
✓ analytics-weekly
✓ coach-lifecycle
✓ link-preview

# Todos deben estar DEPLOYADOS (no en draft)
# Para verificar:
supabase functions list
```

**Acción:** Si alguna falta, deployar. Si todas existen, OK.

---

## 🟡 Bloque 5.10: Verificar DNS Propagation

Antes de cualquier auth change:

```bash
# Terminal:
nslookup multicoach.pathwayplatforms.com
# Esperado:
# Name:    multicoach.pathwayplatforms.com
# Address: <IP de Cloudflare>

# O en dig:
dig multicoach.pathwayplatforms.com
# Status: NOERROR
# ANSWER section debe tener CNAME record
```

**Esperar:** Hasta 48 horas para propagación completa.

---

## ✅ Checklist Final — Bloque 5

**Antes de considerar Bloque 5 "DONE":**

- [ ] 1. Dominio `pathwayplatforms.com` registrado (GoDaddy, etc)
- [ ] 2. Nameservers apuntando a Cloudflare (ns1/ns2.cloudflare.com)
- [ ] 3. Cloudflare verifica CNAME `multicoach.pathwayplatforms.com` → `analisisform.pages.dev`
- [ ] 4. Cloudflare Pages project vinculado a repo
- [ ] 5. SSL/TLS en Cloudflare configurado (Full, auto-rewrite, 1.2+)
- [ ] 6. `https://multicoach.pathwayplatforms.com` retorna HTML (valida DNS/Pages)
- [ ] 7. Google OAuth: URLs revisadas (sin cambiar)
- [ ] 8. Apple OAuth: URLs revisadas (sin cambiar)
- [ ] 9. Supabase Auth: redirect URLs revisadas (sin cambiar)
- [ ] 10. RLS policies verificadas (sin cambiar)
- [ ] 11. Edge functions todas deployed
- [ ] 12. DNS propagation completa (nslookup funciona)
- [ ] 13. `npm run verify` pasa (validate-supabase-config.js)
- [ ] 14. pw-environment.js cargando correctamente
- [ ] 15. Commit con cambios de Bloque 5

---

## 🚫 QUÉ NO HACER (PENDIENTE PHASE 2)

❌ **NO cambiar OAuth URLs en Google/Apple/Supabase** (Phase 2)  
❌ **NO actualizar RLS policies** (Phase 2, cuando JWT tenga org_id)  
❌ **NO activar OAuth centralizado** (Phase 2, cuando edge function listo)  
❌ **NO cambiar Supabase Auth settings** (Phase 2)  
❌ **NO migrar datos entre proyectos** (decidir en Phase 2)  
❌ **NO eliminar pathwaycareercoach.com** (mantener por 30+ días)  
❌ **NO hacer login en multicoach todavía** (va a fallar sin auth update)  

---

## 🔄 Rollback (Si Algo Sale Mal)

Si Cloudflare/DNS se rompe:

```
1. Cloudflare Dashboard → DNS
   → Eliminar CNAME multicoach
   → Eliminar CNAME pathwayplatforms.com (si es necesario)

2. En registrador:
   → Cambiar nameservers de vuelta a anterior

3. Esperar ~1 hora para propagación

4. https://pathwaycareercoach.com sigue funcionando (no tocada)
```

---

## 📞 Puntos de Contacto

Si hay errores:

| Problema | Dónde revisar |
|----------|---------------|
| DNS no resuelve | `nslookup multicoach.pathwayplatforms.com` |
| Cloudflare error | Cloudflare Dashboard → Analytics → Status |
| SSL/TLS falla | Cloudflare → SSL/TLS → Edge Certificates |
| Pages no saca HTML | Cloudflare Pages → Deployments → Latest |
| OAuth URLs falta | Google/Apple/Supabase consoles |
| RLS policies rotas | Supabase SQL Editor |

---

## 🎉 Post-Bloque 5

Cuando todo esté OK:

1. ✅ Commit con pw-environment.js + documentación
2. ✅ Esperar confirmación de Micaela
3. 🟡 **Bloque 3 (deferred):** Centralizar URLs en APP_CONFIG
4. 🟡 **Phase 2:** Activar OAuth, actualizar RLS, implementar postMessage Bridge

