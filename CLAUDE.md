# Contexto del Proyecto — Career Pathway (Micaela Jairedin)

## Que es
Plataforma de soporte para un servicio de mentoria/coaching de transicion de carrera.
**No es una tienda ni landing de venta** — los clientes ya compraron la mentoria a traves de una agencia externa.
Micaela les envia acceso a esta plataforma como herramienta de soporte durante 4 semanas (renovable).

## Flujo del servicio
```
Agencia (landing) → Cliente compra mentoria → Micaela le manda link al formulario
→ Cliente completa formulario (index.html) → Datos llegan al panel de Micaela
→ Micaela genera informe con IA → Le crea acceso (login) → Cliente usa el portal 4 semanas
```

## Stack tecnico
- HTML/CSS/JS vanilla (sin frameworks)
- Supabase (PostgreSQL + REST API)
- EmailJS (notificaciones)
- Uploadcare (subida de CVs)
- Anthropic Claude API via Netlify Edge Function (generacion de informes)
- Deploy: GitHub Pages (mmicaelajairedin-ui.github.io/analisisform)

## Archivos principales
| Archivo | Que hace | Lineas |
|---------|----------|--------|
| `index.html` | Formulario de intake (7 pasos) | ~600 |
| `panel.html` | Panel del coach (TODO el JS esta inline, NO usa panel.js) | ~2300 |
| `panel.js` | Archivo legacy con funciones duplicadas (panel.html no lo carga) |
| `cliente.html` | Portal del cliente (su espacio durante la mentoria) | ~2100 |
| `cv.html` | Editor de CV | ~850 |
| `carta.html` | Editor de carta de presentacion | ~420 |
| `login.html` | Login (coach y cliente) | ~110 |
| `hub.html` | Hub del coach (alternativo al panel) | ~370 |
| `links.html` | Pagina de links para compartir | ~275 |

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
- Logro por sesion agendada (Calendly: https://calendly.com/mmicaela-jairedin/career-strategy-session)
- Calendly integrado en el dashboard del cliente (al lado de logros, para que agenda despues de ver progreso)
- Mas contenido real en recursos (links a articulos, videos, templates descargables)
- Sistema de notificaciones push o email automatico cuando el coach actualiza algo
- Dashboard analytics: metricas de progreso agregadas

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
