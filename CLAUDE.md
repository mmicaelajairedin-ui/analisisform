# Contexto del Proyecto — Career Pathway (Micaela Jairedin)

## Que es
Plataforma de soporte para un servicio de mentoria/coaching de transicion de carrera.
**No es una tienda ni landing de venta** — los clientes ya compraron la mentoria a traves de una agencia externa.
Micaela les envia acceso a esta plataforma como herramienta de soporte durante 4 semanas (renovable).

## Flujo del servicio
```
Landing publica (index.html) → Coach/candidato llega al sitio
Agencia (landing) → Cliente compra mentoria → Micaela le manda link al formulario
→ Cliente completa formulario (formulario.html) → Datos llegan al panel de Micaela
→ Micaela genera informe con IA → Le crea acceso (login) → Cliente usa el portal 4 semanas
```

## Stack tecnico
- HTML/CSS/JS vanilla (sin frameworks)
- Supabase (PostgreSQL + REST API)
- EmailJS (notificaciones)
- Uploadcare (subida de CVs)
- Anthropic Claude API via Supabase Edge Function `generar-informe` (generacion de informes)
- Deploy: Cloudflare Pages (proyecto `analisisform`) con dominio custom `pathwaycareercoach.com` (fallback: analisisform.pages.dev). Auto-deploy en push a `main`.

## Archivos principales
| Archivo | Que hace | Lineas |
|---------|----------|--------|
| `index.html` | **Landing publica** (marketing, FAQ, CTA) — la raiz del dominio | ~430 |
| `formulario.html` | Formulario de intake (7 pasos) — solo se comparte con clientes que pagaron | ~600 |
| `soy-candidato.html` | Pagina publica "Busco trabajo" | ~220 |
| `soy-coach.html` | Pagina publica "Soy coach" con pricing | ~240 |
| `registro.html` | Registro de coaches | ~250 |
| `panel.html` | Panel del coach (TODO el JS esta inline, NO usa panel.js) | ~2300 |
| `panel.js` | Archivo legacy con funciones duplicadas (panel.html no lo carga) |
| `cliente.html` | Portal del cliente (su espacio durante la mentoria) | ~2100 |
| `cv.html` | Editor de CV | ~850 |
| `carta.html` | Editor de carta de presentacion | ~420 |
| `login.html` | Login (coach y cliente) | ~110 |
| `hub.html` | Hub del coach (alternativo al panel) | ~370 |

### IMPORTANTE: rename index ↔ landing (abril 2026)
Lo que era `landing.html` ahora es `index.html` (se sirve en la raiz `/`).
Lo que era `index.html` (form de intake) ahora es `formulario.html`.
Si tocas URLs absolutas al form, usa: `https://pathwaycareercoach.com/formulario.html`.

### IMPORTANTE: URLs de preview de Cloudflare Pages estan detras de Access
Cloudflare Pages genera 3 tipos de URL para este proyecto:

| URL | Que es | Publica |
|-----|--------|---------|
| `<hash>.analisisform.pages.dev` (ej. `df051cd6.analisisform.pages.dev`) | Preview del deploy especifico | NO — Cloudflare Access pide login |
| `analisisform.pages.dev` | Alias de produccion | SI |
| `pathwaycareercoach.com` | Dominio custom de produccion | SI |

Si al abrir el sitio aparece una pantalla de login en `analisisform-pages.cloudflareaccess.com`, **no es un bug del codigo** — es porque se esta abriendo la URL del preview (la del hash del deployment) en vez de la de produccion. En el dashboard de Cloudflare hay que usar el boton "Visit" o el dominio custom, no el hash del commit.

Para diagnosticar: si la URL en la barra empieza con `<hash>.analisisform.pages.dev` o `analisisform-pages.cloudflareaccess.com`, redirigir al usuario a `pathwaycareercoach.com` o `analisisform.pages.dev`. No buscar URLs rotas en el HTML — los hrefs relativos no causan esto.

## IMPORTANTE: panel.html tiene todo el JS inline
El archivo `panel.js` existe pero **panel.html NO lo carga**. Todo el JavaScript del panel esta dentro de `<script>` en panel.html. Cualquier funcion nueva debe ir dentro de panel.html, no en panel.js.

## Bugs arreglados (ya en produccion)
1. Validacion por pasos en formulario (nombre, email, situacion, cargo, rol obligatorios)
2. XSS en tags de habilidades (innerHTML → createTextNode)
3. Campo f-litext fantasma eliminado
4. Candidatos duplicados prevenidos (upsert con merge-duplicates)
5. Race condition en subida de CV (flag done + timeout 15s)
6. EmailJS separado del guardado (email falla ≠ datos perdidos)
7. Email normalizado a lowercase en formulario
8. sbGet() verifica status HTTP
9. JSON.parse con try-catch en localStorage
10. Funciones verPass() y cambiarPass() implementadas en panel.html
11. Foto de candidato visible en panel (busca en foto_perfil, localStorage, cv_publicados._photo)
12. Foto se sincroniza de cv.html a candidatos.foto_perfil + localStorage
13. Scroll del panel arreglado (overflow:hidden removido)

## Mejoras de UX hechas (ya en produccion)
1. 9 tabs → 4 tabs: Perfil, Documentos, Sesion, Gestion
2. Data grid con tarjetas (igrid/ii/iil/iiv con CSS)
3. Cabecera de candidato con gradiente
4. Pagina Resumen con stat cards y filas de clientes
5. Pagina Links con tarjetas por cliente
6. Sidebar sin lista de clientes → navegacion limpia: Resumen, Clientes, Links, Pagos
7. Nueva pagina "Clientes" con grid de tarjetas, filtro Activos/Inactivos/Todos, toggle activo/inactivo
8. Click en cliente → ficha con 4 tabs + boton "Volver a Clientes"

### Nota: columna `activo` en candidatos
El toggle activo/inactivo usa el campo `activo` (boolean) en la tabla `candidatos`.
Si la columna no existe, crearla:
```sql
ALTER TABLE candidatos ADD COLUMN activo BOOLEAN DEFAULT true;
```

## Completado — Rediseno del panel

### Prioridad 2: Emails al cliente — HECHO
- 7 plantillas en tabMensajes: Bienvenida, Acceso, CV listo, Recordatorio, Nueva semana, Informe, Personalizado
- Toggle ES/EN, envio via WhatsApp, Email (mailto:) y Copiar

### Prioridad 3: Pagina de recursos — HECHO
- rRecursos() en cliente.html con material organizado por semana
- 12 recursos (3 por semana): CV, LinkedIn, Networking, Entrevistas
- Semana actual destacada con badge + borde accent
- Seccion de consejos generales

### Prioridad 4: Mas opciones de empleos — HECHO
- Barra de portales rapidos: Indeed, LinkedIn Jobs, InfoJobs, Glassdoor, CompuTrabajo
- Links pre-filtrados por sector y ubicacion del candidato
- Cada sugerencia IA con 3 botones de portal (Indeed, LinkedIn, InfoJobs)

### Prioridad 5: Visual general — HECHO
- Links: formulario con icono+gradiente, accesos con separador limpio
- Botones URL mas compactos, cards con hover sutil
- Sidebar 240px (antes 280px), stats cards con sombra suave

### Prioridad 6: UX SaaS — HECHO
- **Design system unificado**: color accent #8C7B80 en todas las paginas (antes panel usaba #8E7676), font Poppins unificado (antes Open Sans en panel)
- **Sistema de medallas**: Bronce (2 logros), Plata (4), Oro/Copa (6). Medalla visible en sidebar debajo de la foto con barra de progreso hacia la siguiente
- **6 logros con colores variados**: Formulario (rose), Diagnostico (blue), CV (green), Carta (orange), LinkedIn (brown), Semana 2+ (red)
- **Card de logros en dashboard**: track visual Bronce→Plata→Oro, lista de logros con checks
- **Medalla se actualiza al instante**: despues de analizar LinkedIn o guardar carta, sin recargar
- **Feed de actividad**: timeline "Tu timeline" en columna derecha con timeAgo()
- **Bottom nav mobile**: barra fija con 5 tabs (Inicio, Docs, LinkedIn, Empleos, Recursos), reemplaza hamburger
- **Onboarding primer login**: 5 pasos con overlay animado, solo se muestra una vez (mj_onboard_ en localStorage)
- **Skeleton loaders**: animacion shimmer en carga de empleos (skelCards helper)
- **Empty states con CTA**: mensajes descriptivos + boton WhatsApp en vez de "En camino..."
- **Cache de secciones**: LinkedIn/Empleos/Recursos no se regeneran al navegar entre tabs (_secCache)
- **Accesibilidad**: aria-labels en botones icono, role=navigation, font min 10px, skip-to-content
- **Cache-bust en login**: redirige con ?v=timestamp para forzar carga fresca

### IMPORTANTE: traducciones TX
El objeto TX en cliente.html NO debe usar t() dentro de su propia definicion (referencia circular). Todos los valores deben ser strings literales.

### IMPORTANTE: cache de secciones (_secCache)
El cache se guarda en goSec() ANTES de actualizar SEC. render() solo lee el cache. Si se mueve SEC=sec antes del save, el cache se guarda bajo la key incorrecta.

## PENDIENTE — Proximas mejoras
- Blog: crear /blog.html como hub + 4-5 posts SEO (coaching de carrera, CV con IA, etc.)
- Paginas por pais: /coaching-carrera-espana.html, /coaching-carrera-argentina.html
- Pagina About/Acerca de + Testimonios
- Video demo del producto (60-90s Loom del panel)
- Social proof en landing (testimonios, metricas, logos)
- Chrome extension para guardar empleos desde portales
- Networking tracker en portal del cliente
- AI chat assistant en portal del cliente (Claude conversacional)
- Sistema de notificaciones push o email automatico cuando el coach actualiza algo
- Dark mode

## Completado — Sesion UX + SEO (abril 2026)

### UX del cliente (cliente.html):
- **Sistema de medallas**: Bronce (2), Plata (4), Oro (7) con celebracion confetti
- **7 logros**: Formulario, Diagnostico, CV, Carta, LinkedIn, Sesion agendada, Semana 2+
- **Calendly en dashboard** + logro por sesion agendada
- **Sesiones compartidas coach↔cliente**: registro en Supabase (sesiones_registro), tareas interactivas que el cliente marca como hechas
- **Seccion "Sesiones"** en sidebar: Calendly CTA, preparacion, historial, tareas
- **Bottom nav mobile**: 5 tabs fijos (Inicio, Docs, LinkedIn, Empleos, Recursos)
- **Onboarding primer login**: 5 pasos con overlay animado (mj_onboard_)
- **Feed de actividad**: timeline "Tu timeline" con timeAgo()
- **Score de completitud documentos**: 4 items (CV, Carta, LinkedIn, Foto) con barra de progreso
- **Skeleton loaders**: animacion shimmer en carga de empleos
- **Empty states con CTA**: mensajes descriptivos + WhatsApp
- **Transiciones suaves**: fade-in 0.3s al cambiar de seccion
- **Cache de secciones**: LinkedIn/Empleos/Recursos no se regeneran (_secCache en goSec ANTES de SEC=sec)

### Panel del coach (panel.html):
- **Sesiones sincronizadas a Supabase** (no solo localStorage)
- **Dashboard analytics**: progreso agregado (informes, CVs, LinkedIn, cartas) con barras
- **Seccion Leads**: contactos del chatbot, solo visible para admin, boton WhatsApp directo

### Plataforma general:
- **Design system unificado**: #8C7B80 + Poppins en portal, verde Pathway en landing/public
- **Espanol neutro**: 0 voseo en toda la plataforma (emails, onboarding, placeholders)
- **URLs migradas**: todo apunta a pathwaycareercoach.com (no GitHub Pages)
- **SEO**: robots.txt, sitemap.xml, H1s con keywords, schema markup, checklist-linkedin en sitemap
- **H1s optimizados**: "Coaching de carrera profesional", "Tu proximo trabajo en 4 semanas", "Plataforma de coaching de carrera"
- **Accesibilidad**: labels con for, aria-labels, role=navigation, font min 10px, skip-to-content
- **Console.logs eliminados** de produccion
- **Errores con feedback claro**: "Sin conexion — guardado localmente"
- **Coach name configurable**: COACH_FULL/COACH_FIRST en cliente.html
- **Traducciones EN**: 173/173 keys completas
- **PDF colores**: print-color-adjust:exact en CV y carta
- **Cache-bust login**: redirige con ?v=timestamp

### Landing + marketing:
- **Chatbot guiado**: burbuja flotante verde, flujo candidato/coach con emojis, captura telefono → Supabase (contactos_chat)
- **Mockup compacto** en soy-candidato.html (browser frame con portal del cliente)
- **Hero copy**: "Un coach a tu lado, herramientas automatizadas, y un proceso que funciona"
- **Tutorial CV**: tutorial-cv.html visual con 3 pasos para descargar PDF

### Tablas Supabase agregadas:
```sql
ALTER TABLE candidatos ADD COLUMN sesiones_registro TEXT;
CREATE TABLE contactos_chat (id SERIAL PRIMARY KEY, contacto TEXT, pagina TEXT, fecha TIMESTAMPTZ DEFAULT now());
```

### IMPORTANTE: traducciones TX
El objeto TX en cliente.html NO debe usar t() dentro de su propia definicion (referencia circular). Todos los valores deben ser strings literales.

### IMPORTANTE: cache de secciones (_secCache)
El cache se guarda en goSec() ANTES de actualizar SEC. render() solo lee el cache. Si se mueve SEC=sec antes del save, el cache se guarda bajo la key incorrecta.

## Base de datos (Supabase)
### Tablas principales:
- `candidatos` — datos del formulario + foto_perfil, semana_activa, pago_*, notas_coach, carta_presentacion
- `informes` — informes generados (email, data JSON, prev)
- `cv_publicados` — CVs publicados (email, contenido JSON, codigo)
- `usuarios` — login (email, password_hash SHA-256, rol, nombre, activo)

### Nota sobre foto_perfil:
La columna `foto_perfil` puede no existir en la tabla `candidatos` de Supabase.
El codigo tiene fallback: busca en localStorage y luego parsea cv_publicados.contenido._photo.
Si se quiere que funcione directo, crear la columna:
```sql
ALTER TABLE candidatos ADD COLUMN foto_perfil TEXT;
```
