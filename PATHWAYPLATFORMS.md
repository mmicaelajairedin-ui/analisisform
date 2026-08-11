# 🚀 Pathway Platforms — Arquitectura Base

**Fecha:** 11 de agosto de 2026  
**Rama:** `claude/pathwayplatforms-base-setup-14nn9d`  
**Estado:** Base de desarrollo (sin Auth, sin dominio productivo)

---

## 📋 Resumen

Se ha creado la estructura base de **Pathway Platforms** (`pathwayplatforms.com`) como nueva plataforma SaaS para gestionar equipos de coaching (Multi-Coach). La arquitectura **reutiliza** la aplicación MultiCoach existente sin duplicarla, y mantiene `pathwaycareercoach.com` completamente intacto.

### Principios clave:
- ✅ **Una sola base de código** — `multicoach/pages/` se comparten ambos dominios
- ✅ **Configuración centralizada** — `pw-config.js` detecta dominio automáticamente
- ✅ **Sin tocar producción** — pathwaycareercoach.com sigue 100% operativo
- ✅ **Auth pendiente** — `authMode: "pending"` en pathwayplatforms (OAuth/SSO en desarrollo)
- ✅ **Supabase compartido** — Ambos dominios usan el mismo proyecto Supabase (por ahora)

---

## 📁 Estructura de archivos creados

```
├── pw-config.js                      # 🆕 Configuración centralizada (dominio, auth, branding)
├── pathwayplatforms-index.html       # 🆕 Landing de Pathway Platforms
├── pathwayplatforms-multicoach.html  # 🆕 Shell de MultiCoach para pathwayplatforms
├── multicoach/
│   ├── pages/                        # Reutilizado por ambas plataformas
│   │   ├── owner-dashboard.html
│   │   ├── owner-coaches.html
│   │   ├── owner-clients.html
│   │   ├── owner-schedule.html
│   │   ├── owner-programs.html
│   │   ├── owner-analytics.html
│   │   ├── owner-billing.html
│   │   ├── owner-brand.html
│   │   └── ... (otros módulos)
│   ├── js/                           # Scripts compartidos
│   └── styles/                       # Estilos compartidos
└── PATHWAYPLATFORMS.md               # 🆕 Este archivo
```

### Archivos **NO modificados** (producción intacta):
- ✅ `multicoach.html` — La shell histórica sigue funcionando
- ✅ `panel-v2.html` — Portal del coach en pathwaycareercoach
- ✅ `cliente.html` — Portal del cliente
- ✅ Todas las migrations de Supabase
- ✅ Edge Functions
- ✅ RLS policies

---

## 🌐 Mapeo de dominios

### `pathwaycareercoach.com` (Histórico — SIN CAMBIOS)
```
Configuración: pw-config.js
  domain: 'pathwaycareercoach.com'
  platform: 'pathwaycareercoach'
  authMode: 'legacy'
  features: {
    whiteLabelPortal: true,
    coachPanel: true,
    clientPortal: true,
    multiCoach: false
  }

Redirige a: /panel-v2.html (después de login)
API: https://api.pathwaycareercoach.com
```

### `pathwayplatforms.com` (Nuevo — EN DESARROLLO)
```
Configuración: pw-config.js
  domain: 'pathwayplatforms.com'
  platform: 'pathwayplatforms'
  authMode: 'pending'  ⚠️
  features: {
    whiteLabelPortal: false,
    coachPanel: false,
    clientPortal: false,
    multiCoach: true  ✨
  }

Redirige a: /multicoach.html o /pathwayplatforms-multicoach.html
API: https://api.pathwaycareercoach.com (compartido por ahora)
Favicon: /favicon-platforms.svg (diferente)
```

### Localhost / Preview
```
Por defecto apunta a: pathwayplatforms (desarrollo)
authMode: 'pending'
```

---

## 🔐 Sistema de Configuración (`pw-config.js`)

### Cómo funciona:
1. Se carga **primero** en el `<head>` de cada página
2. Detecta automáticamente el dominio (`window.location.hostname`)
3. Expone `window.APP_CONFIG` con toda la configuración

### Uso en código:
```javascript
// En cualquier script (después de pw-config.js):
console.log(window.APP_CONFIG.domain);        // 'pathwaycareercoach.com'
console.log(window.APP_CONFIG.platform);      // 'pathwaycareercoach'
console.log(window.APP_CONFIG.authMode);      // 'legacy' | 'pending'
console.log(window.APP_CONFIG.apiUrl);        // Endpoint de Supabase
console.log(window.APP_CONFIG.features);      // {multiCoach: true, ...}
```

### Agregar dominio nuevo:
1. Editar `pw-config.js` → agregar entrada en `configs = {}`
2. Especificar: `domain`, `name`, `apiUrl`, `branding`, `features`, `authMode`
3. Commit y deploy

---

## 📄 Landing de Pathway Platforms

**Archivo:** `pathwayplatforms-index.html`

Es la página principal de la plataforma que:
- ✅ Explica qué es Pathway Platforms
- ✅ Muestra características y módulos
- ✅ CTAs hacia MultiCoach
- ✅ Diseño profesional y responsive
- ✅ Sin requerir autenticación

**URL:** `https://pathwayplatforms.com/` (cuando dominio esté configurado)  
**En desarrollo:** `http://localhost:3000/pathwayplatforms-index.html`

### Secciones:
1. **Hero** — Presentación y CTAs
2. **Características** — 6 puntos clave (Multi-Coach, Agenda, Facturación, etc.)
3. **Módulos** — Grid de 12 módulos disponibles
4. **CTA** — Sección final "¿Listo para escalar?"
5. **Footer** — Links, legal, social

---

## 🎮 Shell de MultiCoach (`pathwayplatforms-multicoach.html`)

**Archivo:** `pathwayplatforms-multicoach.html`

Es el "shell" o contenedor principal de la aplicación MultiCoach:
- ✅ Sidebar con navegación a todos los módulos
- ✅ Top bar con búsqueda y botón crear
- ✅ Área de contenido principal
- ✅ Sidebar de comunidad (derecha)
- ✅ Placeholder para módulos (próximas implementaciones)

**URL:** `https://pathwayplatforms.com/multicoach.html` (cuando dominio esté configurado)  
**En desarrollo:** `http://localhost:3000/pathwayplatforms-multicoach.html`

### Módulos incluidos (navegación):
1. **Dashboard** ✅ Base creada
2. **Coaches** ⏳ Próxima
3. **Clientes** ⏳ Próxima
4. **Agenda** ⏳ Próxima
5. **Programas** ⏳ Próxima
6. **Analytics** ⏳ Próxima
7. **Facturación** ⏳ Próxima
8. **Comunidad** ⏳ Próxima

Cada módulo se carga desde `multicoach/pages/owner-*.html`

### Navegación:
- Click en nav item → Carga la sección correspondiente
- Script `pathwayplatforms-multicoach.html` maneja cambios de vista
- **Nota:** Auth está pendiente (`authMode: "pending"`), por ahora todo es preview

---

## 🔑 Estado de Autenticación

### Actual: `authMode: "pending"`
- ✅ Detecta cuando usuario intenta acceder
- ✅ Redirige a `/login` (no implementado aún para pathwayplatforms)
- ⏳ OAuth/SSO en desarrollo (Google, Microsoft, etc.)
- ⏳ No usa Supabase Auth (pathwayplatforms)

### Producción (`pathwaycareercoach.com`): `authMode: "legacy"`
- ✅ Usa Supabase Auth + JWT
- ✅ Password hash en Supabase
- ✅ RLS estricto
- ✅ **Sin cambios**

### Roadmap Auth:
1. **Fase 1:** Preparar OAuth (Google, Microsoft)
2. **Fase 2:** Integrar con Supabase Auth
3. **Fase 3:** SSO para equipos
4. **Fase 4:** Migrar pathwaycareercoach a OAuth (futuro)

---

## 🎨 Branding

### Colors (compartido):
- **Primary:** `#1B4332` (verde Pathway)
- **Secondary:** `#E0AA69` (dorado)
- **Logo:** `P` en cuadrado verde

### Assets necesarios:
```
✅ Logo:
   - /pathwayplatforms-logo-dark.svg     (versión oscura para landing)
   - /pathwayplatforms-logo-light.svg    (versión clara)

✅ Favicon:
   - /favicon-platforms.svg              (diferente de pathwaycareercoach)

✅ Ilustraciones:
   - dashboard-mockup.svg                (para landing hero)
   - feature-icons/                      (multicoach, agenda, etc.)
```

### Diseño responsivo:
- ✅ Desktop: Sidebar + Main + Community
- ✅ Tablet: Sidebar + Main (community oculta)
- ✅ Mobile: Sidebar colapsable + Full width main

---

## 🧪 Testing — ¿Qué funciona sin Auth?

### ✅ Funciona sin autenticación:
- Landing: `pathwayplatforms-index.html` → Página pública completa
- Shell: `pathwayplatforms-multicoach.html` → Navegación y placeholders
- Configuración: `pw-config.js` → Detecta dominio y carga config
- Branding: `pw-brand.js` → Aplica colores (cuando esté implementado)

### ⏳ Requiere Auth (no funciona aún):
- Guardado de datos (Dashboard, KPIs en tiempo real)
- Acceso a módulos con datos reales
- Sincronización con Supabase
- Crear/editar coaches, clientes, etc.
- Facturación y analytics

### Cómo probar en desarrollo:
```bash
# Opción 1: Abrir archivos directamente
http://localhost:3000/pathwayplatforms-index.html
http://localhost:3000/pathwayplatforms-multicoach.html

# Opción 2: Ver en production preview
https://analisisform.pages.dev/pathwayplatforms-index.html
```

---

## 📋 Checklist de Implementación

### ✅ COMPLETADO
- [x] Sistema de configuración (`pw-config.js`)
- [x] Landing (`pathwayplatforms-index.html`)
- [x] Shell de MultiCoach (`pathwayplatforms-multicoach.html`)
- [x] Mapeo de dominios
- [x] Documentación

### ⏳ PRÓXIMAS FASES

**Fase 2: Configuración de Dominio**
- [ ] Registrar dominio `pathwayplatforms.com`
- [ ] Configurar DNS en Cloudflare
- [ ] Configurar redirect `pathwayplatforms.com` → Cloudflare Pages
- [ ] Aplicar SSL/TLS

**Fase 3: Autenticación**
- [ ] Implementar OAuth (Google, Microsoft)
- [ ] Crear página `/pathwayplatforms-login.html`
- [ ] Integrar con `pw-auth.js`
- [ ] Guardar tokens en localStorage/sessionStorage

**Fase 4: Módulos**
- [ ] Crear `multicoach/pages/owner-dashboard.html` funcional
- [ ] Conectar con Supabase (coaches, clientes, sesiones)
- [ ] Implementar módulo Coaches
- [ ] Implementar módulo Clientes
- [ ] Implementar módulo Agenda
- [ ] ... (resto de módulos)

**Fase 5: Datos**
- [ ] Migrations en Supabase (nueva estructura multi-tenant)
- [ ] RLS para aislar datos por organización
- [ ] Edge Functions para operaciones complejas

**Fase 6: Payments**
- [ ] Integración Stripe
- [ ] Facturación automática
- [ ] Webhooks de suscripción

---

## 🚨 Reglas Estrictas

### ❌ NUNCA:
- Modificar `panel-v2.html` ni `cliente.html` en esta rama
- Cambiar URLs de producción (`https://api.pathwaycareercoach.com`)
- Tocar migrations de Supabase sin testing
- Duplicar `multicoach.html` (reutilizar, no duplicar)
- Cambiar RLS policies sin documentar

### ✅ SIEMPRE:
- Cargar `pw-config.js` primero
- Detectar dominio antes de hacer requests
- Usar `window.APP_CONFIG` para decisiones de flujo
- Testear en ambos dominios (localhost)
- Documentar cambios de arquitectura

---

## 🔧 Ambiente Actual

| Concepto | Valor |
|----------|-------|
| **Plataforma** | `pathwayplatforms` |
| **Dominio** | `localhost` / preview |
| **Auth Mode** | `pending` |
| **API URL** | `https://api.pathwaycareercoach.com` |
| **Supabase Project** | `ddxnrsnjdvtqhxunxnwj` |
| **Favicon** | `/favicon-platforms.svg` |

---

## 📞 Contacto / Próximos Pasos

1. **Revisar** esta documentación
2. **Testear** landing y shell en localhost
3. **Aprobar** diseño y estructura
4. **Registrar** dominio `pathwayplatforms.com`
5. **Implementar** OAuth/SSO
6. **Conectar** módulos a Supabase

---

**Última actualización:** 11 de agosto de 2026  
**Rama:** `claude/pathwayplatforms-base-setup-14nn9d`
