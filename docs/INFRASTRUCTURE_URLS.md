# Inventario de URLs de Infraestructura

**Documento:** Bloque 4 - Documentación de Integración  
**Fecha:** Agosto 2026  
**Estado:** Estable (referencias a las 450+ URLs encontradas en auditoría)

---

## 📋 Resumen

Inventario completo de URLs hardcodeadas en la plataforma. Distingue:
- **Críticas** (producción, datos, auth)
- **De soporte** (observabilidad, backups, funciones)
- **Públicas** (marketing, SEO)

**Total encontrado:** 450+ URLs en 34+ archivos  
**Refs críticos actuales:**
- ✅ Supabase directo: `https://ddxnrsnjdvtqhxunxnwj.supabase.co`
- ✅ Proxy custom: `https://api.pathwaycareercoach.com`
- ✅ Landing/dominio: `https://pathwaycareercoach.com`, `https://analisisform.pages.dev`

---

## 🔴 CRÍTICAS — Auth y Datos

### Supabase (API + Auth)
| Tipo | URL | Dónde | Alternativa |
|------|-----|-------|------------|
| **Proxy** | `https://api.pathwaycareercoach.com` | panel-v2, cliente.html, js (60+ refs) | ← **Usar esta en frontend** |
| **Directo** | `https://ddxnrsnjdvtqhxunxnwj.supabase.co` | Scripts, documentación | Solo scripts/docs |
| **Auth endpoint** | `/auth/v1/token` | EPIC_1_5_RLS_VALIDATION_PLAN.md | Endpoint estándar Supabase |
| **REST API** | `/rest/v1/` | Todas las queries | Estándar PostgREST |
| **Edge functions** | `/functions/v1/{name}` | 15+ funciones | Personalizable |

### Project Refs (NUNCA cambiar sin auditoría)
| Ref | Estado | Dónde |
|-----|--------|-------|
| `ddxnrsnjdvtqhxunxnwj` | ✅ Correcto (PRODUCCIÓN) | panel-v2, cliente, auth-callback, scripts |
| `ddxnrsnjdvtqhxunxbwj` | ❌ Typo (bwj) | Eliminado en Bloque 1 |
| `ddxnrsnjdvtqhxunxbnwj` | ❌ Typo (bnwj) | Eliminado en Bloque 1 |
| `mxkljqhlwiqavbjfjfov` | ⛔ Legacy | No usar |
| `mzxgxkkgxvunpsiqbzxd` | ⛔ Legacy | No usar |

### OAuth 2.0 Endpoints (Bloqueador: 12 URLs de callback)
| Proveedor | Endpoint | Callback URI | Estado |
|-----------|----------|--------------|--------|
| **Google** | `https://accounts.google.com/o/oauth2/v2/auth` | `https://pathwaycareercoach.com/auth-callback.html` | ✅ Activo |
| **Google** | `https://oauth2.googleapis.com/token` | (backend) | ✅ Activo |
| **Apple** | `https://appleid.apple.com/auth/authorize` | `https://pathwaycareercoach.com/auth-callback.html` | ✅ Activo |
| **Apple** | `https://appleid.apple.com/auth/token` | (backend) | ✅ Activo |
| **Supabase Auth** | `/auth/v1/authorize` | (SDK maneja) | ✅ Activo |
| **Supabase Auth** | `/auth/v1/callback` | (SDK maneja) | ✅ Activo |

---

## 🟡 SOPORTE — Observabilidad, Backups, Funciones

### Funciones de Borde (Edge Functions)
| Función | Endpoint | Uso | Requiere Auth |
|---------|----------|-----|---------------|
| `generar-informe` | `/functions/v1/generar-informe` | Claude API → Diagnóstico | ✅ JWT |
| `send-email` | `/functions/v1/send-email` | Brevo → Notificaciones | ✅ JWT |
| `send-push` | `/functions/v1/send-push` | Push notifications | ✅ JWT |
| `notif-new-client` | `/functions/v1/notif-new-client` | Trigger al nuevo cliente | ✅ Service role |
| `analytics-weekly` | `/functions/v1/analytics-weekly` | Cron: agente semanal | ✅ Secret |
| `coach-lifecycle` | `/functions/v1/coach-lifecycle` | Cron: emails renovación | ✅ Secret |
| `link-preview` | `/functions/v1/link-preview` | Preview URLs en chat | ✅ Anon key |

### Servicios Externos Integrados
| Servicio | URL | API | Dónde | Key |
|----------|-----|-----|-------|-----|
| **EmailJS** | `https://api.emailjs.com` | REST | cliente.html (legacy) | 🔴 Público (retire) |
| **Brevo** | `https://api.brevo.com` | REST | Edge function | ✅ Secreto |
| **Uploadcare** | `https://upload.uploadcare.com` | REST | cv.html, cliente.html | 🔴 Público (ok) |
| **Calendly** | `https://calendly.com/api/v1` | REST | panel-v2 (eventos) | ✅ Secreto |
| **Slack** | `https://hooks.slack.com` | Webhook | send-email (alertas) | ✅ Secreto |
| **Anthropic Claude** | `https://api.anthropic.com` | REST | generar-informe | ✅ Secreto |
| **Stripe** | `https://api.stripe.com` | REST | paywall, webhooks | ✅ Secreto |
| **Cloudflare** | `https://api.cloudflare.com` | GraphQL | analytics-weekly | ✅ Secreto |
| **Google Calendar** | `https://www.googleapis.com/calendar/v3` | REST | panel-v2 (sync) | ✅ Secreto |

### Observabilidad y Diagnóstico
| Herramienta | URL | Uso | Acceso |
|-------------|-----|-----|--------|
| **Client Errors** | `/rest/v1/client_errors` | pw-observe.js → Supabase | Anon RLS (INSERT) |
| **Sentry** (futuro) | `https://sentry.io` | Error tracking | N/A |
| **LogRocket** (futuro) | `https://logrocket.com` | Session replay | N/A |

---

## 🟢 PÚBLICAS — Landing, Marketing, SEO

### Dominios Primarios
| Dominio | Tipo | Cloudflare | Uso |
|---------|------|-----------|-----|
| `pathwaycareercoach.com` | Custom | Pages (SSL/redirect) | 🟢 Landing + portales |
| `micaelajairedin.com` | Custom | Pages (SSL) | 🟢 Landing coach (analytics) |
| `analisisform.pages.dev` | Fallback | Pages | 🟠 Preview (Access blocked) |

### Landing / Marketing
| URL | Página | Tipo |
|-----|--------|------|
| `https://pathwaycareercoach.com/` | index.html | Landing pública |
| `https://pathwaycareercoach.com/soy-coach.html` | soy-coach.html | Oferta para coaches |
| `https://pathwaycareercoach.com/soy-candidato.html` | soy-candidato.html | Oferta para candidatos |
| `https://pathwaycareercoach.com/blog` | blog.html | Blog SEO |
| `https://pathwaycareercoach.com/sitemap.xml` | Generado | SEO |
| `https://pathwaycareercoach.com/robots.txt` | Estático | SEO |

### Portales (Autenticados)
| URL | Usuario | Descripción |
|-----|---------|------------|
| `https://pathwaycareercoach.com/panel-v2.html` | Coach | Dashboard del coach (PRIVADO) |
| `https://pathwaycareercoach.com/cliente.html` | Cliente | Portal del cliente (PRIVADO) |
| `https://pathwaycareercoach.com/login.html` | Ambos | Login |
| `https://pathwaycareercoach.com/formulario.html` | Público | Intake (con token) |
| `https://pathwaycareercoach.com/registro.html` | Coach | Registro |
| `https://pathwaycareercoach.com/cv.html` | Cualquiera | Editor CV |
| `https://pathwaycareercoach.com/carta.html` | Cualquiera | Editor Carta |

---

## 🔗 OAuth Callbacks (CRÍTICO para phishing)

Configuradas en:
- **Google Cloud Console** → OAuth 2.0 credentials
- **Apple Developer** → Sign in with Apple configuration
- **Supabase Dashboard** → Auth → Redirect URLs

**Whitelist actual:**
```
https://pathwaycareercoach.com/auth-callback.html
https://analisisform.pages.dev/auth-callback.html (fallback)
```

**⚠️ Al cambiar dominio:**
1. Agregar nueva callback URI en Google/Apple/Supabase
2. Mantener URL anterior por ~30 días (compatibilidad)
3. Migrar auth_id en usuarios (mapeo email → auth.uid)
4. Activar RLS strict antes de permitir login cruzado

---

## 🚀 Estrategia de Dominio Dual (Pathways)

Cuando se active `pathwayplatforms.com` como dominio NUEVO (sin reemplazar):

| Dominio | Fase | Auth | RLS | Notas |
|---------|------|------|-----|-------|
| `pathwaycareercoach.com` | 🔴 Congelado | JWT org 1 | ✅ Sí | Pathway: producción actual |
| `multicoach.pathwayplatforms.com` | 🟡 Prep | JWT org N | ✅ Sí | Multicoach: laboratorio |
| `auth.pathwayplatforms.com` (futuro) | 🟢 Opción 3 | OAuth centralizado | ✅ Sí | SSO compartido |

**Callbacks a agregar (sin eliminar):**
```
https://multicoach.pathwayplatforms.com/auth-callback.html
https://auth.pathwayplatforms.com/auth-callback.html (futura)
```

---

## ✅ Checklist de Cambios de URL

Cuando se migre a nuevo dominio:

- [ ] 1. Agregar callback URI en Google OAuth Console
- [ ] 2. Agregar callback URI en Apple Developer
- [ ] 3. Agregar redirect URL en Supabase Auth settings
- [ ] 4. Sumar nuevo proxy en Cloudflare (CNAME)
- [ ] 5. Actualizar hardcoded URLs en HTML (app.html, links)
- [ ] 6. Verificar pw-auth.js headers usan API_KEY correcto
- [ ] 7. Correr `npm run verify` (validate-supabase-config.js)
- [ ] 8. Test manual: login con Google, login con Apple, login nativo
- [ ] 9. Verificar JWT carry-over (localStorage origin-specific)
- [ ] 10. Mantener URL antigua por 30 días (fallback)

---

## 📊 Distribución de URLs por Archivo

**Top 20 archivos con más URLs hardcodeadas:**
1. panel-v2.html (120+ URLs) — panel del coach
2. cliente.html (85+ URLs) — portal del cliente
3. index.html (40+ URLs) — landing pública
4. pw-auth.js (35+ URLs) — auth handler
5. multicoach.html (30+ URLs) — hub multicoach
6. pw-push.js (25+ URLs) — push notifications
7. login.html (20+ URLs) — login page
8. scripts/backup-export.js (15+ URLs) — backup tool
9. pw-ia-chat.js (12+ URLs) — chat IA
10. Otros (38 archivos, 70+ URLs) — config, docs, HTML

**Patrón encontrado:** URLs se distribuyen por función (auth, API, servicios), no centralizadas. **Solución (Bloque 3):** Migrar a `window.APP_CONFIG` con fallback.

---

## 🔐 Secretos Detectados (NO en el código)

Guardados en:
- ✅ **Supabase Secrets** → edge functions
- ✅ **GitHub Secrets** → workflows
- ✅ **Cloudflare Secrets** → Pages environment
- ✅ **Env variables** → scripts/GitHub Actions

**Nunca en:**
- ❌ HTML, CSS, JS inline
- ❌ README, documentación pública
- ❌ Git commits (search con `git log -p` para auditar)

