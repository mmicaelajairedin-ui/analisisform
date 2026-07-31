# Contexto del Proyecto — Career Pathway (Micaela Jairedin)

## ⚡ MODO ASISTENTE DE VENTAS — LEER PRIMERO

Si Micaela escribe un **nombre + lo que le preguntó/dijo un lead**, actuá como
su asistente de ventas en vivo (NO como dev). Ella habla con gente, les ofrece
la plataforma, le hacen preguntas, y después tiene la demo. Flujo:

1. **Identificá el tipo de lead:**
   - **Coach** → se le vende la plataforma. Próximo paso: trial 14 días gratis o demo de 11 min.
   - **Candidato** (busca trabajo) → próximo paso: llamada gratis de 30 min.
2. **Dale 2-3 opciones de respuesta** listas para copiar/pegar. Tono según
   canal: WhatsApp/IG = cercano, email = más formal. Cada opción apunta al
   próximo paso.
3. **Marcá lo importante que NO debe dejar pasar** en esa conversación y, si
   aplica, anticipá la objeción que probablemente venga después.
4. **Guardá/actualizá la ficha** en `leads/<nombre>.md` (plantilla:
   `leads/_PLANTILLA.md`): datos de la persona, herramientas que usa hoy,
   contexto/situación, bitácora con fecha, y notas para la demo.
5. **Prep de demo/reunión:** si lo pide, armá un resumen con lo de esa persona
   (qué le importa, sus dudas, objeciones a anticipar, qué cerrar).

Mínimo que necesita darte: **nombre · coach o candidato · canal · qué te dijo ·
su duda/objeción**. Si falta algo clave, preguntá UNA cosa puntual y seguí.

Las respuestas y el manejo de objeciones salen de
`docs/pathway-guion-ventas.md`. Las fichas de `leads/` quedan SOLO en la rama
de trabajo (no se mergean a `main` = no quedan públicas).

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

## 🎨 REGLA DE DISENO — emojis del panel SIEMPRE en gris
En **el panel del coach** (panel-v2.html, multi-nicho) los emojis de la
interfaz van en **gris**, no a color
(se ve mas profesional y unificado). Usar la clase `.cp-emo`
(`filter:grayscale(1)`) en vez de repetir el filtro inline:
- Inline (emoji + texto): `<span class='cp-emo'>⚙️</span> Módulos`
- Contenedores que SOLO tienen un emoji (`.mi`, `.ni`): ya quedan grises por CSS.
- La clase vive en `pathway-panel.css` (paneles de nicho) y en el `<style>` de
  `panel-v2.html`. **Una sola fuente de verdad** — al sumar un emoji nuevo,
  envolverlo en `.cp-emo`. Excepciones a color (contenido, NO chrome): los iconos
  del calendario fitness (💪⭐🍎), banderas de país, medallas de logro y el **emoji
  del tipo de evento en la agenda** (lo elige la coach por cita: en `_agRenderDay`
  el avatar muestra la foto real del cliente si existe, si no el emoji del tipo a color).

## 🎨 REGLA DE COLOR — neutro por defecto, marca SOLO en lo white-label (julio 2026)
Los colores base de la plataforma son **neutros: blancos y cremas** (`--pw-niebla*`,
`#EFE9DD`, `--pw-carbon`). El **color de marca** (`--accent`, white-label del coach;
y el verde fijo Pathway `--pw-bosque`) se usa **SOLO en elementos white-label**
(perfil público, acentos que el coach quiere que reflejen su marca).
- **El chrome que NO es white-label va neutro**: burbujas del chat, fondos de
  emojis, paneles, tarjetas. **Nunca** el color de marca.
- **Por qué:** si un coach pone su marca en rojo, el panel se pone rojo pero el
  chat/tarjetas deben seguir neutros. Si el chat usara el verde fijo o el accent,
  quedaría "panel rojo + chat verde" (o rojo) — inconsistente. Neutro = siempre
  combina, con cualquier marca.
- **Burbujas de chat**: la propia (`.*me`) va en **crema** (`#EFE9DD` + texto
  `--pw-carbon` + borde sutil), NO en `--pw-bosque`/`--accent`. La del otro va en
  crema más claro (`--pw-niebla-2`). Blindado por `check-guardrails.js`.

## 🎨 ICON SYSTEM — Lucide, una sola librería para TODA la plataforma (julio 2026)
Antes cada pantalla tenía pequeñas diferencias de iconos (emojis mezclados con
SVGs, tamaños 16/18/20, colores distintos). Ahora hay **un solo sistema**:
- **Solo iconos [Lucide](https://lucide.dev/icons)** — NO se mezcla con otra
  librería ni con emojis del sistema en el chrome.
- **Outline · stroke 2px · 20px (18px en botones chicos) · color `#1F4030`**
  (token `--pw-icon`; hereda `currentColor` dentro de botones de color).
- **Fuente única de verdad:** `pw-icons.js` (mapa `window.PWI.IC` + API
  `PWI.svg()`/`PWI.chip()`/`PWI.mount()`) y `pw-icons.css` (el estilo). Sumar un
  icono nuevo = agregarlo UNA vez a `pw-icons.js` y usarlo por nombre. **Nunca**
  pegar un `<svg>` suelto en una pantalla.
- Uso: `<i data-ic="calendar" data-sm></i>` en HTML estático; `PWI.svg('calendar',{sm:true})`
  en HTML que se inyecta por JS (ojo: si pasa por `esc()`, el SVG se escaparía).
- `panel-v2.html` ya usa `var IC = window.PWI.IC` (no duplica el mapa). El chat
  (`pw-ia-chat.js`) comparte el mismo set/estilo.
- **La regla `.cp-emo` (emoji gris) queda como paso intermedio legacy**; lo nuevo
  y lo que se vaya migrando va a Lucide. Emojis siguen permitidos SOLO como
  contenido (medallas, banderas, mascota, agenda fitness) y en emails/WhatsApp.
- **REGLA DE CONSISTENCIA — un concepto = UN icono, en TODA la plataforma.** El
  mismo concepto NO puede tener dos iconos distintos entre pantallas (cliente vs
  coach, panel vs multicoach, etc.). **Tabla canónica:**
  
  **Sidebar (multicoach):**
  dashboard=`layoutGrid` · clientes=`users` · personas=`users` · coaches=`briefcase`
  · colaboradores=`user` · programas=`graduation` · agenda=`calendar` · comunidad=`chat`
  · analytics=`barChart` · cobros=`creditCard` · configuración=`settings`
  
  **Portal del cliente (panel-v2):**
  perfil=`user` · plan=`clipboard` · rutina/gym=`dumbbell` · antropometría=`ruler`
  · nutrición=`apple` · sesiones=`calendar` · finanzas=`dollar` · gestión=`settings`
  · avance/progreso=`trendUp` · documentos=`fileText` · **mensajes/chat=`chat`**
  (globo, NO `mail`/sobre — el sobre es SOLO para email real).
  
  El `dumbbell` es la barra horizontal (idéntica en el nav del cliente y en el coach).
  Al iconizar un concepto nuevo, buscá si ya existe en la tabla y reusá ese nombre;
  si es nuevo, agregalo a la tabla. **Nunca** el mismo concepto con dos iconos.
- Doc completo: `docs/icon-system.md`. Blindado por `scripts/check-icons.js`
  (falla si aparece otra librería, se rompe el spec/fuente única, o se rompe la
  consistencia concepto→icono de la tabla canónica).

## 🛡️ Blindaje del codigo — tests que no pueden mentir (junio 2026)
Red de seguridad para que NO vuelvan bugs ya resueltos. Corren en CI en cada
push/PR (`.github/workflows/syntax-check.yml`). **Antes de commitear, correr:**
`node scripts/check-syntax.js && node scripts/check-smoke.js && node scripts/check-guardrails.js && node scripts/check-parity.js && node scripts/check-icons.js`
- **`scripts/check-syntax.js`** — valida el JS inline de cada .html (un error
  rompe la pagina entera).
- **`scripts/check-smoke.js`** — verifica que cada handler (`onclick`...) llame a
  una funcion que EXISTE y que cada asset local referenciado EXISTA. Atrapa
  botones e imagenes rotas. Si agrega falsos positivos, tunear los allowlists.
- **`scripts/check-guardrails.js`** — "vacuna" bugs resueltos: cada arreglo suma
  una regla. **Al arreglar un bug nuevo, agregar una regla aca** para que no vuelva.
- **`scripts/check-parity.js`** — la "base que se replica": verifica que las
  pantallas del mismo tipo (familias: portales/paneles/formularios/editores)
  tengan el mismo CABLEADO, que los contratos transversales (chat) se respeten,
  y los INVARIANTES (chat merge-safe, anti-XSS, sesión vencida, dedup). Doc:
  `docs/base-plataforma.md`. Dos niveles: `enforce` (falla) y `report` (lista
  huecos). Al cerrar un hueco, subirlo de `report` a `enforce`.
- **`scripts/check-icons.js`** — blinda el **Icon System** (Lucide, una sola
  librería): falla si aparece otra librería de iconos, si se rompe el spec
  (`#1F4030`/20/18px/2px) o la fuente única (`pw-icons.js`/`pw-icons.css`), o si
  `panel-v2` vuelve a duplicar el mapa. Reporta (sin frenar) el chrome emoji que
  falta convertir. Doc: `docs/icon-system.md`.
- **`pw-observe.js`** (observabilidad) — incluido en las 10 paginas clave.
  Registra en la tabla `client_errors` los errores reales de produccion:
  guardados a Supabase que fallan (intercepta `fetch`, atrapa los `.catch`
  silenciosos), errores de JS y promesas rechazadas. Migration:
  `supabase/migrations/client_errors.sql` (RLS: anon solo INSERT, nadie lee).
  Ver errores: `SELECT ts,kind,email,page,detail FROM client_errors ORDER BY ts DESC LIMIT 100;`

### Ola de 403 en client_errors — telemetría best-effort sin GRANT (julio 2026)
Un reporte del tester mostró ~195 "errores de guardado" que en realidad eran
**falsos positivos por permisos** (RLS/GRANT), no pérdida de datos. Dos causas,
misma familia que `usuarios_gamif_grant.sql` (guardados best-effort que daban 403
y ensuciaban `client_errors`):
1. **~127× `PATCH /rest/v1/usuarios` 403** (panel): `coachBeat` (heartbeat →
   `last_seen`) y `_gameSyncServer` (`game_pts`/`game_medal`) escriben la propia
   fila best-effort. **Causa REAL** (descubierta al persistir tras el 1er intento):
   `_sbw` hace los PATCH con `Prefer:return=representation` SIN `&select`, así que
   PostgREST intenta devolver la fila ENTERA con `password_hash` (revocado para
   anon/authenticated por RLS Fase 4) → **403 aunque el UPDATE sea válido**. **Fix
   (código):** `_sbw` fuerza `&select=id` en los PATCH/DELETE a `usuarios`. Además
   se sumó el GRANT UPDATE(last_seen,game_pts,game_medal) a anon por si el JWT no
   se adjuntó en el boot. (El 1er intento —solo el GRANT— no alcanzó: la falla era
   la lectura de vuelta, no el permiso de escritura.)
   **~30× `GET /rest/v1/usuarios` 403**: `game_pts`/`game_medal`/`last_seen` se
   agregaron DESPUÉS de `usuarios_protect_password`, cuyo re-grant de SELECT por
   columna no las cubrió → `select=game_pts` daba 403. **Fix (SQL):**
   `usuarios_gamif_grant.sql` ahora también hace `GRANT SELECT (...)` de esas
   columnas a anon,authenticated. **⚠️ Re-correr el archivo.**
2. **~23× `POST /rest/v1/notificaciones` 403** (cliente/fit): la policy
   `notif_anon_all` era `to anon` solo, pero los clientes/coaches migrados a
   Supabase Auth mandan JWT (rol `authenticated`) → sin policy que matchee → 403.
   **Fix:** GRANT + policy ahora cubren `anon, authenticated` (igual que
   `informes_guardados.sql`).

⚠️ **Deploy:** re-aplicar en el SQL Editor de Supabase (idempotentes)
`usuarios_gamif_grant.sql` y `notificaciones.sql`. El fix vive en el SQL: sin
correrlo, los 403 siguen. Blindado por 2 reglas nuevas en `check-guardrails.js`.
(El resto del reporte —`neterror`/"Failed to fetch"— son cortes de red del
navegador del cliente, transitorios; y `informes_guardados` 404 = falta aplicar
esa migración en esa cuenta.)

## Calendario unificado del cliente (fitness) — junio 2026
Widget compacto en el dashboard de `pathway-fit-cliente.html` (arriba del de
habitos). Iconos = logros del cliente (💪 gym, ⭐ habitos, 🍎 nutricion); dia
RESALTADO = medicion/sesion (evento del coach). Datos REALES: `fit_habitos` por
fecha (`WDATA[date].gym/.nutri/.agua/.sueno/.pasos`) + `sesiones_registro` +
`fit_antro`. Funciones: `renderFitCal()`, `_calData()`, `_ymd()`, `fitCalNav()`.
CSS `.pwcal-*` en `pathway-portal.css` (reusable para finanzas). Pendiente:
reusar en `pathway-fin-cliente.html` y version simple en el panel del coach.

## Archivos principales
| Archivo | Que hace | Lineas |
|---------|----------|--------|
| `index.html` | **Landing publica** (marketing, FAQ, CTA) — la raiz del dominio | ~430 |
| `formulario.html` | Formulario de intake (7 pasos) — solo se comparte con clientes que pagaron | ~600 |
| `soy-candidato.html` | Pagina publica "Busco trabajo" | ~220 |
| `soy-coach.html` | Pagina publica "Soy coach" con pricing | ~240 |
| `registro.html` | Registro de coaches | ~250 |
| `panel-v2.html` | **Panel del coach (EL QUE SE USA)** — TODO el JS inline. El login redirige aca | ~4500 |
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

## IMPORTANTE: el panel vivo es panel-v2.html (panel.html fue borrado)
El panel del coach es **`panel-v2.html`** y el login redirige ahi. Todo su
JavaScript esta inline dentro de `<script>` en `panel-v2.html`; cualquier
funcion nueva del panel va ahi.

> **Limpieza junio 2026 — archivos eliminados (ya no existen):**
> `panel.html` (reemplazado por `panel-v2.html`), `panel.js` (legacy sin uso),
> `perfil-publico-editor.js` (su funcion ya esta inline en panel-v2.html) y
> `gestion-leads.html` (pantalla de Leads del panel viejo, en desuso).
> En las secciones de mas abajo donde dice `panel.html`, leer `panel-v2.html`.

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

## Agente semanal de analytics (mayo 2026)

Reporte automatizado los lunes 8:00 UTC con metricas de Cloudflare + analisis IA + email.

**Componentes:**
- `supabase/functions/analytics-weekly/index.ts` — pulls Cloudflare GraphQL, llama Claude, guarda en Supabase, manda email
- `.github/workflows/weekly-analytics.yml` — cron lunes 8:00 UTC, hace POST a la edge function
- `supabase/migrations/analytics_reports.sql` — tabla `analytics_reports` (memoria semana a semana)

**Setup (una sola vez):**
1. Aplicar migration: `analytics_reports.sql`
2. Crear API token en Cloudflare con permiso "Zone Analytics: Read" para ambas zonas (micaelajairedin.com y pathwaycareercoach.com). Anotar zone IDs.
3. Configurar secrets en Supabase (Edge Functions → Secrets):
   - `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_MJ`, `CLOUDFLARE_ZONE_PW`, `REPORT_EMAIL_TO`, `AGENT_TRIGGER_SECRET`
4. Configurar secrets en GitHub (Settings → Secrets → Actions):
   - `SUPABASE_PROJECT_URL`, `AGENT_TRIGGER_SECRET` (mismo valor que en Supabase)
5. Deploy: `supabase functions deploy analytics-weekly --no-verify-jwt`
6. Test manual: Actions → Weekly Analytics Agent → Run workflow

**Flujo:**
```
GH Actions cron lunes 8am UTC
  → POST /functions/v1/analytics-weekly (con X-Trigger-Secret header)
  → Cloudflare GraphQL (datos 7 dias para ambas zonas)
  → Lee reporte anterior de analytics_reports (memoria)
  → Claude API (analisis + hipotesis + acciones)
  → Guarda nuevo reporte en analytics_reports
  → send-email (Brevo) → llega al REPORT_EMAIL_TO
```

**Iterar el prompt:** el system prompt esta en `analytics-weekly/index.ts` constante `SYSTEM_ANALYTICS`. Editarlo, redesplegar, y disparar manualmente desde GH Actions para testear.

### Vista Web Analytics en panel.html (mayo 2026)

Seccion privada del panel, **solo visible para `ME.rol==='admin'`**. Acceso: sidebar → **🔒 Web Analytics** (badge amarillo). URL directa: `panel.html#webanalytics`.

**3 tabs:**
- **📊 Pathway** — KPIs, graficos (Chart.js via CDN) y analisis de Claude para pathwaycareercoach.com
- **📊 Micaela** — lo mismo para micaelajairedin.com (negocio independiente, no se mezcla con Pathway)
- **⚙️ Contexto** — la coach configura objetivos, audiencia, paginas clave y conversiones de cada sitio. Esto se inyecta al prompt de Claude cada lunes para que las hipotesis sean ESPECIFICAS, no genericas

**Tabla nueva:** `site_context` (zone PK, display_name, objetivo_principal, audiencia, paginas_clave JSONB, conversiones JSONB, notas). Migration en `supabase/migrations/site_context.sql` (incluye seed inicial para ambas zonas).

**Cambios al agente:**
- `analytics-weekly` ahora analiza CADA sitio por separado (1 llamada a Claude por zona) — no cruza narrativas
- Lee las **ultimas 4 semanas** de histórico (no solo 1) para detectar tendencias
- Lee `site_context` y lo inyecta al prompt
- **Datos de conversion para Pathway**: cuenta filas en `candidatos`, `usuarios` (rol=coach), `cv_express`, `contactos_chat`, `leads_pricing` (trial_iniciado_at + pago_at) en el periodo. Se inyectan al prompt y se guardan en `raw_metrics.conversions`. Distingue funnel: leads → trials → ventas reales
- **Datos de conversion para Micaela**: pulls Calendly API (`/scheduled_events`) para contar llamadas exploratorias agendadas/activas/canceladas en el periodo. Necesita secrets `CALENDLY_API_TOKEN_MJ` y opcionalmente `CALENDLY_USER_URI_MJ`.
- Email corto con boton al panel + linea con conversiones de Pathway
- **System prompt expandido** pide:
  - `oportunidades_no_obvias` (outsider lens)
  - `quick_wins` vs `acciones_estrategicas` (separacion por horizonte)
  - `pruebas_ab_propuestas` con prediccion cuantitativa
  - `verificacion_pruebas_ab_previas` (mide si las predicciones se cumplieron)
  - `experimento_estrella`

**Action tracker (mayo 2026):**
Cada quick win, accion estrategica y prueba A/B en el panel tiene un checkbox para marcar como completada. El estado se guarda en `analytics_reports.actions_done` JSONB (indexado por categoria + position). La proxima semana el agente lee este campo y verifica en `verificacion_acciones_previas` si los datos muestran impacto.

**Setup adicional (post-deploy):**
1. Aplicar migration `site_context.sql` (crea tabla + abre RLS de `analytics_reports` para lectura desde panel)
2. Aplicar migration `actions_tracking.sql` (agrega columna `actions_done` + permiso de UPDATE)
3. Re-deployar `analytics-weekly` con la nueva version
4. Entrar al panel como admin → Web Analytics → ⚙️ Contexto → revisar/editar el contexto seedeado
5. Disparar el agente manualmente para probar el reporte nuevo
6. Marcar acciones como completadas con los checkboxes a medida que las hagas. El reporte siguiente las verifica.

## SECURITY MODEL — multi-tenant aislamiento por coach_id (mayo 2026)

Cada coach ve solo sus candidatos/informes/CVs. Estado actual del aislamiento:

### Capa 1 — Frontend filtering (HECHO)
`panel.html` filtra todas las queries de listas por `coach_id = ME.id`:
- `candFilter` (linea ~1344) para `candidatos`
- `repFilter` para `informes`
- `cvFilter` para `cv_publicados`
- `msgFilter` y `badgeFilter` para mensajes/badges

Admin (`ME.rol==='admin'`) ve los suyos + huerfanos (`coach_id IS NULL`).

### Capa 2 — Defense-in-depth con cg()/coachGuard() (HECHO)
Helper `cg()` en panel-v2 (y `coachGuard()` en el panel viejo) devuelve
`&coach_id=eq.<ME.id>` para no-admin, `""` para admin. **Aplicado de forma
CENTRALIZADA en `_sbw()`**: todo PATCH/DELETE a `candidatos?id=eq.` recibe
`+cg()` automaticamente (una sola fuente, cubre los ~30 sitios). Si un coach
intenta escribir con un `id` ajeno (p.ej. devtools + UUID conocido), la query
no matchea ninguna fila y no escribe nada. Guardrail lo protege.
(Antes cg() estaba definido pero NUNCA aplicado — fuga real, ya cerrada.)

### Capa 3 — RLS estricto en Supabase (✅ CERRADO — Fase 4)
**YA NO ES UN GAP.** El login se migró a **Supabase Auth (Fase 4)** — ya NO se
lee `password_hash` con la anon key; la contraseña se valida contra Supabase
Auth (JWT con `auth.uid()`). El **RLS estricto está aplicado** en las tablas
sensibles. Migraciones que lo cierran (en `supabase/migrations/`):
`rls_strict.sql`, `informes_rls.sql`, `rls_close_informes_cv_leak.sql`,
`usuarios_protect_password.sql`, `rls_cleanup_open_policies.sql`,
`rls_mensajes_admin_coach.sql`, `auth_id_on_usuarios.sql`.

Ya NO aplica el viejo ataque `fetch('/rest/v1/candidatos?select=*')` sin filtro:
las policies filtran por `coach_id`/`auth.uid()` y `password_hash` está revocado
para anon/authenticated. **Se puede escalar a 5+ coaches sin este pendiente.**
(Las escrituras best-effort desde el navegador quedan acotadas por columna —
ver `usuarios_gamif_grant.sql`.)

### Reglas para nuevas queries
- Toda nueva query a `candidatos`/`informes`/`cv_publicados`:
  - Si es lista: usar pattern de `candFilter` (filtro por `coach_id` con admin override)
  - Si es individual: agregar `+coachGuard()` al final del query string
- Test mental: si un atacante con devtools cambia el `id` por un UUID ajeno, ¿que ve/escribe?

## Ciclo de vida del coach — vencimiento + renovacion (julio 2026)

Cuando a un coach se le vence la prueba (cada uno tiene SU `fecha_fin_prueba`:
14, 15 o 30 dias segun como se dio de alta), ahora hay dos cosas:

1. **Estado real en el panel** (`panel-v2.html`, seccion Coaches): el badge de
   estado deriva de `fecha_fin_prueba` + `estado_sub`, no solo de `estado_sub`.
   Muestra **Pagó / Prueba · quedan N d / Vencida hace N d / Inactiva** (con
   color). Antes un coach vencido sin pagar salia "Prueba" (amarillo) para
   siempre — parecia activo. Un coach sin `fecha_fin_prueba` (cuentas viejas)
   sigue como "Prueba" neutro.

2. **Emails de renovacion automaticos** (`supabase/functions/coach-lifecycle`,
   cron diario ya existente). Solo a coaches que NO pagaron:
   - `trial_por_vencer` (faltan ≤3 d), `trial_vencido` (el dia), `trial_vencido_2`
     (~3 d despues). Prioridad: renovacion > onboarding > retencion.
   - El CTA va **DIRECTO al Stripe del plan que ya tenia** (Basic $29 / Pro $59)
     con `?prefilled_email=` → paga en 1 clic y el **webhook reactiva su MISMA
     cuenta** (match por email en `handleCoachSubscription`), nunca crea una nueva.
   - `trial_vencido` tambien dispara un aviso interno a Micaela (`admin_trial_vencido`).
   - Registro anti-spam en `coach_nudges` (1 empujon / 3 dias, cada plantilla 1 vez).
   - **Requiere:** el webhook de suscripcion de Stripe (`customer.subscription.*`)
     configurado para que "Pagó" se refleje solo. El paywall del panel
     (`_paywallCheck`) tambien lleva ahora al Stripe del plan correcto.
   - Deploy: `supabase functions deploy coach-lifecycle --no-verify-jwt`.

## PENDIENTE — Proximas mejoras
- ✅ ~~Cerrar gap de seguridad RLS en Supabase~~ — **HECHO** (Fase 4: Supabase Auth + RLS estricto; ver seccion "SECURITY MODEL · Capa 3").
- Paginas por pais: /coaching-carrera-espana.html, /coaching-carrera-argentina.html
- Pagina About/Acerca de
- Chrome extension para guardar empleos desde portales
- Networking tracker en portal del cliente
- AI chat assistant en portal del cliente (Claude conversacional)
- Dark mode

### Ya hechos (sacados de pendientes — junio 2026)
- ✅ Testimonios en landing (seccion `#testimonios`, cargada via `testimonios.js`)
- ✅ Video demo del producto en landing (`.demo-section` con iframe + boton play)
- ✅ Blog: `blog.html` como hub + posts SEO (cv-con-ia-2026, primeros-10-clientes-coaching, 7-preguntas-entrevista, checklist-linkedin, rechazo-entrevista-final, etc.)
- ✅ Notificaciones push (migration `push_subscriptions.sql`, edge functions `send-push` + `notif-new-client`, `pw-push.js`)

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
