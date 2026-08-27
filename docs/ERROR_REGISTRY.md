# ERROR_REGISTRY

**Registro oficial de errores detectados, clasificados y resueltos.**

**Referencia:** Ver `docs/ERROR-STATES.md` para definición formal de estados y transiciones.

## Estados Formales

- **DETECTED:** Error identificado, síntoma reportado
- **SUSPECTED:** Análisis inicial sugiere causa (próximo: STATIC o RUNTIME confirmation)
- **ROOT_CAUSE_CONFIRMED_STATIC:** Análisis estático de código confirma
- **ROOT_CAUSE_CONFIRMED_RUNTIME:** Logs/traces de ejecución confirman
- **FIXED:** Código modificado (commit hash documentado)
- **VERIFIED:** Test pasa + Guardrail OK + 48h sin regresión en producción
- **REGRESSION:** Error VERIFIED que reaparece
- **BLOCKED:** Depende de otro trabajo previo
- **OUT_OF_SCOPE:** Pertenece a otra rama/módulo

**Principio:** STATIC ≠ RUNTIME ≠ E2E ≠ VERIFIED (ver ERROR-STATES.md)

---

## ERR-UPLOAD-001: Avatar persistence mismatch

**Estado:** TRIAGED  
**Fecha detectado:** 2026-08-01  
**Fecha triaged:** 2026-08-08  
**Severity:** CRITICAL  

### Scope Metadata
- **Module:** `uploads`
- **Scope Type:** `MODULE_SPECIFIC`
- **Scope Belongs To:** `uploads` (dedicated upload branch)
- **Blocking Scope:** `other`
- **Blocks Current Branch:** No (not claude/pathway-app-store-review-fy5y15 scope)  

### Síntoma
Coach sube avatar, se guarda correctamente, pero desaparece al recargar la página. Campo `usuarios.foto_url` queda NULL.

### Categoría
`FRONTEND_ERROR` · `STORAGE_PERSISTENCE`

### Módulo
avatar upload flow

### Root Cause
Foto guardada en `usuarios.configuracion.foto_url` (JSONB, legado)  
pero se lee de `usuarios.foto_url` (SQL column, introducida después)  
Dos fuentes de verdad conflictivas → lectura devuelve NULL

### Evidencia
- **Commit:** c95be3be (Merge: Fix photo/avatar storage architecture)
- **Files affected:**
  - panel-v2.html:14162-14176 (_uploadAvatar)
  - panel-v2.html:15900 (photo load)
  - supabase/migrations/0113_unify_foto_url.sql
- **Test:** tests/uploads/avatar.test.js#test-avatar-persistence-login
- **SQL:** Migration unifica a usuarios.foto_url como single source of truth

### Estado actual
- ✅ **FIXED:** Código modificado
- ✅ **TEST:** Prueba automatizada existe
- ✅ **VERIFIED:** 48h sin regresión en production
- ❌ **AUTO-GUARDRAIL:** No integrado aún (Fase 2)

### Cómo evitar regresión
Si se vuelve a leer foto de múltiples columnas → guardrail debe fallar.

---

## ERR-UPLOAD-002: Exercise photo Authorization header missing

**Estado:** TRIAGED  
**Fecha detectado:** 2026-08-08  
**Fecha triaged:** 2026-08-08  
**Severity:** CRITICAL  

### Scope Metadata
- **Module:** `uploads`
- **Scope Type:** `MODULE_SPECIFIC`
- **Scope Belongs To:** `uploads` (dedicated upload branch)
- **Blocking Scope:** `other`
- **Blocks Current Branch:** No (not claude/pathway-app-store-review-fy5y15 scope)  

### Síntoma
Coach intenta subir foto de ejercicio → HTTP 400  
Error: "headers must have required property authorization"  
Upload bloqueado completamente

### Categoría
`STORAGE_ERROR` · `AUTH_HEADER`

### Módulo
exercise photo upload (_uploadDoc function)

### Root Cause
La función `_uploadDoc()` (usada por exercise photos) falta el header `Authorization: Bearer +KEY`  
La función `_uploadAvatar()` (avatars) SÍ tenía el header  
Inconsistencia entre funciones hermanas → divergencia silent

### Evidencia
- **Commit:** 07e0de0e (fix: add Authorization header to exercise photo upload)
- **Files affected:**
  - panel-v2.html:14204 (headers object en _uploadDoc)
- **Error logs:** upload_diagnostics registra error_code "UPLOAD_EXERCISE_STORAGE_001" (HTTP 400)
- **Comparison:** _uploadAvatar line 14169 vs _uploadDoc line 14204

### Estado actual
- ✅ **FIXED:** Header agregado
- ✅ **TEST:** Test de autorización creado
- ✅ **VERIFIED:** 24h sin regresión, coach probó en iOS
- ❌ **AUTO-GUARDRAIL:** No integrado aún (Fase 2)

### Cómo evitar regresión
Guardrail debe verificar: si _uploadAvatar tiene Authorization, _uploadDoc TAMBIÉN debe tenerlo.

---

## ERR-UPLOAD-003: Google Photos without file extension

**Estado:** TRIAGED  
**Fecha detectado:** 2026-08-08  
**Fecha triaged:** 2026-08-08  
**Severity:** HIGH  

### Scope Metadata
- **Module:** `uploads`
- **Scope Type:** `MODULE_SPECIFIC`
- **Scope Belongs To:** `uploads` (dedicated upload branch)
- **Blocking Scope:** `other`
- **Blocks Current Branch:** No (not claude/pathway-app-store-review-fy5y15 scope)  

### Síntoma
Coach (Android tablet) selecciona foto de Google Photos  
Validador rechaza: "Usa PNG, JPG, WebP o GIF"  
Pero la foto ES un PNG/JPG válido → falso negativo

### Categoría
`FRONTEND_ERROR` · `FILE_VALIDATION`

### Módulo
exercise photo file picker (event listener en line 14286)

### Root Cause
Google Photos devuelve `File.name = ""` (extensión vacía)  
Validador extrae extensión con `fname.split(".").pop()`  
Si no hay punto → devuelve filename completo (vacío) → no matchea whitelist  
Solución: inferir extensión del MIME type si name falta

### Evidencia
- **Commit:** 73cdf7bb (fix: cross-device compatibility for exercise photo uploads)
- **Files affected:**
  - panel-v2.html:14292-14300 (validador con fallback a MIME type)
- **Environment:** Android tablets selectando desde Google Photos
- **Test:** tests/uploads/exercise.test.js#test-google-photos-no-extension

### Estado actual
- ✅ **FIXED:** Fallback a MIME type agregado
- ✅ **TEST:** Caso sin extensión probado
- ✅ **VERIFIED:** Coach Android probó, funciona
- ❌ **AUTO-GUARDRAIL:** No integrado aún (Fase 2)

### Cómo evitar regresión
Guardrail: si no hay extensión en filename pero hay MIME type, debe inferirse. No rechazar automáticamente.

---

## ERR-ENV-001: Project ref mismatch (Supabase)

**Estado:** DETECTED  
**Fecha detectado:** 2026-08-07  
**Fecha triaged:** 2026-08-08  
**Severity:** CRITICAL  

### Scope Metadata
- **Module:** `environment`
- **Scope Type:** `CORE_INFRASTRUCTURE`
- **Scope Belongs To:** `core` (infrastructure branch)
- **Blocking Scope:** `core`
- **Blocks Current Branch:** YES (CORE_INFRASTRUCTURE always blocks)  

### Síntoma
Código y logs hacen referencia a project_ref `mzxgxkkgxvunpsiqbzxd`  
Pero este NO es el proyecto oficial de production  
Riesgo: requests enviados al proyecto incorrecto

### Categoría
`ENVIRONMENT_ERROR` · `INFRASTRUCTURE`

### Módulo
Supabase initialization, environment variables

### Root Cause
- [ ] TBD — Necesita auditoría completa de:
  - Variables de entorno en .env.local vs .env.production
  - Hardcoded project_refs en código
  - Mismatch entre staging/production

### Evidencia
- **Referencia:** Logs mencionan "mzxgxkkgxvunpsiqbzxd"
- **Ubicación:** TBD (auditoría pendiente)
- **Impact:** Desconocido (posible data leak o requests al proyecto equivocado)

### Estado actual
- ❌ **DETECTED:** Error identificado pero NO validado
- ❌ **TRIAGED:** Causas potenciales listadas pero no confirmadas
- ❌ **FIXED:** NO
- ❌ **VERIFIED:** NO

### Cómo evitar regresión
Crear allowlist de project_refs válidos en ENVIRONMENT_CONFIG.md  
Fase 1: Documentar proyecto oficial  
Fase 2: Guardrail que falla si se detecta project_ref no authorizado

### Nota Importante
**NO marcar como FIXED sin evidencia de auditoría completa.**  
Este error requiere confirmación manual antes de cualquier fix automático.

---

## ERR-APP-004: Missing Apple Sign in (iOS App Store)

**Estado:** DETECTED  
**Fecha detectado:** 2026-08-10  
**Severity:** CRITICAL  

### Scope Metadata
- **Module:** `ios_auth`
- **Scope Type:** `MODULE_SPECIFIC`
- **Scope Belongs To:** `claude/pathway-app-store-review-fy5y15`
- **Blocking Scope:** `current`
- **Blocks Current Branch:** YES (belongs to current branch scope)  

### Síntoma
App iOS rechazada por Apple App Store (requisito 4.8):  
"Ofrece login con Google sin equivalente Apple Sign in"

### Categoría
`APP_SUBMISSION_ERROR` · `AUTH_PROVIDER`

### Módulo
iOS authentication (login.html, auth-callback.html, pw-app.js)

### Root Cause
- login.html tiene btn-apple pero está `display:none` (nunca se muestra)
- signInWithApple() existe pero tal vez no está wired correctamente
- Supabase Auth provider 'apple' puede no estar configurado

### Evidencia
- **Files affected:**
  - login.html:151-164 (btn-apple con display:none)
  - auth-callback.html:113, 302, 316 (handleAppleNativeUser, provider apple)
  - panel-v2.html (debe ocultar precios en PW_IN_APP)
  - pw-app.js (PW_IN_APP detection)

### Estado actual
- ❌ **DETECTED:** Apple rechazó app
- ❌ **FIXED:** NO
- ❌ **TESTED:** NO
- ❌ **VERIFIED:** NO

### Cómo evitar regresión
Guardrail: verificar que btn-apple existe, signInWithApple() está implementado, y se ejecuta en iOS

---

## ERR-MULTICOACH-001: Owner navigation broken (404)

**Estado:** DETECTED  
**Fecha detectado:** 2026-08-10  
**Severity:** CRITICAL  

### Scope Metadata
- **Module:** `multicoach`
- **Scope Type:** `MODULE_SPECIFIC`
- **Scope Belongs To:** `multicoach` (multicoach feature branch)
- **Blocking Scope:** `other`
- **Blocks Current Branch:** No (belongs to multicoach branch, not current)  

### Síntoma
Owner entra a login → redirige a `/multicoach-v3.html`  
Archivo no existe o ruta es incorrecta → 404  
Owner no puede acceder a su red de coaches

### Categoría
`NAVIGATION_ERROR` · `AUTH_ROUTING`

### Módulo
login.html auth callback, multicoach navigation

### Root Cause
login.html:659 redirige a `/multicoach-v3.html`  
Pero archivo se llama `multicoach.html`  
O `multicoach.html` no existe, es stub, o es maqueta (no funcional)

### Evidencia
- **Files affected:**
  - login.html:659 (redirect logic)
  - multicoach.html (debe ser la implementación real)
- **Error:** Usuario owner recibe 404

### Estado actual
- ❌ **DETECTED:** Ruta rota confirmada
- ❌ **FIXED:** NO
- ❌ **TESTED:** NO
- ❌ **VERIFIED:** NO

### Cómo evitar regresión
Guardrail: verificar que owner redirige a multicoach.html (o path correcto) y archivo existe y funciona

---

## ERR-ADMIN-001: Coach deletion RLS block

**Estado:** DETECTED  
**Fecha detectado:** 2026-08-10  
**Severity:** HIGH  

### Scope Metadata
- **Module:** `admin_security` (cross-module: admin + usuarios + rls)
- **Scope Type:** `CROSS_MODULE`
- **Scope Belongs To:** `multicoach`
- **Affects Modules:** `admin`, `usuarios`, `rls`
- **Blocking Scope:** `other`
- **Blocks Current Branch:** No (affects multicoach, not current branch infrastructure)  

### Síntoma
Admin intenta eliminar cuenta de coach → error "No se pudo eliminar... protegida por RLS"  
Feature completamente rota, no hay workaround

### Categoría
`RLS_SECURITY_ERROR` · `ADMIN_OPERATIONS`

### Módulo
admin-coach-op edge function, panel-v2.html coach management

### Root Cause
panel-v2.html:12277 (coach-access handler) intenta DELETE directo a usuarios  
RLS bloquea DELETE con anon key  
Debe usar edge function admin-coach-op con op:delete_coach (service role)

### Evidencia
- **Files affected:**
  - panel-v2.html:12277-12343 (coach-access handler)
  - supabase/functions/admin-coach-op/index.ts (debe tener op:delete_coach)

### Estado actual
- ❌ **DETECTED:** Feature rota, RLS bloquea
- ❌ **FIXED:** NO
- ❌ **TESTED:** NO
- ❌ **VERIFIED:** NO

### Cómo evitar regresión
Guardrail: verificar que coach-access no usa DELETE directo, usa admin-coach-op

---

## ERR-DEPLOY-001: 11 Edge Functions not deployed

**Estado:** DETECTED  
**Fecha detectado:** 2026-08-10  
**Severity:** HIGH  

### Scope Metadata
- **Module:** `ci_cd`
- **Scope Type:** `CORE_INFRASTRUCTURE`
- **Scope Belongs To:** `core` (infrastructure/CI branch)
- **Blocking Scope:** `core`
- **Blocks Current Branch:** YES (CORE_INFRASTRUCTURE always blocks, affects all deployments)  

### Síntoma
85 edge functions en repo, solo 75 deployed en workflow  
11 faltando:
- add-coach-to-org
- add-collab-to-org
- cambiar-plan-org
- change-owner-org
- get-coach-busy-slots
- load-org-clients
- load-team-members
- reassign-client
- remove-member-org
- suspender-org
- update-team-member

Endpoints `/functions/v1/add-coach-to-org` etc. devuelven 404 en producción  
Multicoach admin completamente roto

### Categoría
`CI_CD_ERROR` · `DEPLOYMENT`

### Módulo
.github/workflows/deploy-functions.yml

### Root Cause
Workflow define solo 75 deploy steps  
Cuando se crean nuevas functions, dev olvida agregalas al workflow  
Functions existen en git pero nunca se despliegan

### Evidencia
- **Files affected:**
  - .github/workflows/deploy-functions.yml (falta 11 steps)
  - supabase/functions/add-coach-to-org/index.ts (existe pero no deployed)
  - supabase/functions/add-collab-to-org/index.ts (existe pero no deployed)
  - etc. (9 más)

### Estado actual
- ❌ **DETECTED:** Faltando steps confirmado
- ❌ **FIXED:** NO
- ❌ **TESTED:** NO
- ❌ **DEPLOYED:** NO

### Cómo evitar regresión
Guardrail: verificar que todas las functions en supabase/functions/ tienen step en workflow

---

## ERR-MC-SYNTAX-001: Multicoach onclick quote escaping

**Estado:** DETECTED  
**Fecha detectado:** 2026-08-10  
**Severity:** MEDIUM  

### Scope Metadata
- **Module:** `multicoach`
- **Scope Type:** `MODULE_SPECIFIC`
- **Scope Belongs To:** `multicoach` (multicoach feature branch)
- **Blocking Scope:** `other`
- **Blocks Current Branch:** No (belongs to multicoach branch, not current)  

### Síntoma
Multicoach onclick handlers tienen comillas rotas  
Click en botón hace nothing (SyntaxError)  
Chat messaging en multicoach no funciona

### Categoría
`JAVASCRIPT_SYNTAX_ERROR` · `DOM_HANDLER`

### Módulo
multicoach.html onclick handlers (dynamic message sending)

### Root Cause
Falta función `_toastChat(name)` helper  
Onclick concatena strings sin escapar comillas:  
`onclick="foo('\"bar\"')"` → SyntaxError  
Debe usar JSON.stringify() o similar

### Evidencia
- **Files affected:**
  - multicoach.html (onclick handlers)
  - Falta _toastChat() implementation

### Estado actual
- ❌ **DETECTED:** Syntax error confirmado
- ❌ **FIXED:** NO
- ❌ **TESTED:** NO
- ❌ **VERIFIED:** NO

### Cómo evitar regresión
Guardrail: verificar que _toastChat existe y onclick handlers usan JSON.stringify para valores dinámicos

---

## ERR-EMAIL-RECORDATORIO: Recordatorio email says "Google Meet"

**Estado:** DETECTED  
**Fecha detectado:** 2026-08-10  
**Severity:** LOW  

### Scope Metadata
- **Module:** `email_template`
- **Scope Type:** `MODULE_SPECIFIC`
- **Scope Belongs To:** `core` (email templates are shared infrastructure)
- **Blocking Scope:** `other`
- **Blocks Current Branch:** Pending confirmation (awaiting PO decision if belongs to App Store review scope)  

### Síntoma
Email de recordatorio de cita dice "Google Meet: [link]"  
Pero videollamada es Sala de Pathway  
Cliente confundido, puede llegar tarde

### Categoría
`EMAIL_COPY_ERROR` · `UX_MESSAGING`

### Módulo
supabase/functions/recordatorios-citas/index.ts email template

### Root Cause
Template de email no fue actualizado en migración de Google Meet → Sala de Pathway  
Texto legacy sigue mencionando Google Meet

### Evidencia
- **Files affected:**
  - supabase/functions/recordatorios-citas/index.ts (~162)
  - Email template references "Google Meet"

### Estado actual
- ❌ **DETECTED:** Copy error
- ❌ **FIXED:** NO
- ❌ **TESTED:** NO
- ❌ **VERIFIED:** NO

### Cómo evitar regresión
Guardrail: verificar que recordatorios no mencionan "Google Meet" (o si menciona, debe ser contexto correcto)

---

## ERR-CLIPROG-001: La superficie de Programas del cliente nunca se renderizó

**Estado:** ROOT_CAUSE_CONFIRMED_STATIC → FIXED → TESTED
**Fecha detectado:** 2026-08-26 (auditoría de cobertura de ClientPrograms)
**Severity:** HIGH

### Scope Metadata
- **Module:** `cliente` (portal del cliente — superficie de Programas)
- **Scope Type:** `MODULE_SPECIFIC`
- **Scope Belongs To:** `cliente`

### Síntoma
`cliente.html` incluía un "Program Work Center" (`PWCoreProgram.renderWorkCenter`) y una
timeline de sesiones (`PWCoreTimeline`) que ningún cliente vio nunca. Ningún script de
navegador recorría la pantalla, así que nadie lo notó.

### Root cause (confirmada por análisis estático + esquema de producción)
1. Las guardas eran `C && C.raw` y `C && C.sesiones`. En este portal `C` **es** la fila de
   `candidatos`, y la tabla no tiene columnas `raw` ni `sesiones` (el campo real es
   `sesiones_registro`, TEXT con JSON). Ambas guardas eran siempre falsas.
2. Aun pasando la guarda, dentro del bloque se leía `RECURSOS`, un identificador **no
   declarado** en ninguna parte del proyecto → `ReferenceError` que el `try{}catch(e){}`
   se tragaba en silencio (ni error en consola).
3. `renderWorkCenter` espera `client.ses` (array) y `client.raw.etapas` como objetos con
   `.nombre`; en producción `candidatos.etapas` es un JSON de strings sueltos.
4. Tres funciones de ejemplo (`_cliRenderProgramCard`, `_cliRenderSessionTimeline`,
   `_cliRenderOnboardingResources`) referenciaban globales inexistentes (`CLIENTE`,
   `RESOURCES`) y nadie las llamaba.

### Fix
Se quitaron los bloques muertos en vez de encenderlos: cada sub-bloque duplicaba algo que
el cliente ya tiene y mejor (próxima sesión → `_proxSesion()`, que cruza `sesiones_registro`
con `citas`; roadmap → `rRoadmap()` "Tu proceso"; recursos → la sección Recursos), y
encenderlos sería funcionalidad nueva de Programas, que está cerrado.

### Estado actual
- ✅ **DETECTED / ROOT_CAUSE_CONFIRMED_STATIC**
- ✅ **FIXED** (`cliente.html`)
- ✅ **TESTED** (`tests/cliente-programas.spec.js`)
- ❌ **VERIFIED** — falta el recorrido contra producción (sin egress en el entorno de trabajo)

### Cómo evitar regresión
`scripts/check-guardrails.js`: reglas "cliente: la superficie de Programas no se gatea por
campos inexistentes" y "cliente: no se referencian globales que no existen en este portal".

---

## ERR-CLIPROG-002: El portal del cliente ofrecía la comunidad cerrada de COACHES

**Estado:** ROOT_CAUSE_CONFIRMED_STATIC → FIXED → TESTED
**Fecha detectado:** 2026-08-26
**Severity:** MEDIUM (producto / white-label)

### Síntoma
El work center muerto se invocaba con `showCommunity:true`, que pinta una tarjeta
"Conecta con otros coaches…" apuntando a `/comunidad.html`. Esa página es la landing de la
**comunidad cerrada de coaches** ("Comunidad cerrada · solo coaches"): público equivocado
para un cliente y, en white-label, el embudo de captación de Pathway dentro del portal del
cliente de otro coach. Nunca llegó a verse porque el bloque estaba muerto (ERR-CLIPROG-001),
pero cualquier "arreglo" de la guarda lo habría publicado.

### Estado actual
- ✅ **FIXED** (se eliminó junto con el bloque)
- ✅ **TESTED** (`tests/cliente-programas.spec.js` → "el portal del cliente no le ofrece la comunidad cerrada de COACHES")
- ❌ **VERIFIED** (falta producción)

### Cómo evitar regresión
`scripts/check-guardrails.js`: "cliente: el portal NO linkea la comunidad cerrada de COACHES"
(cubre los tres portales del cliente).

---

## ERR-CLIPROG-003: owner/colaborador/empleado se quedaban dentro del portal del cliente

**Estado:** ROOT_CAUSE_CONFIRMED_STATIC → FIXED → TESTED
**Fecha detectado:** 2026-08-26
**Severity:** HIGH (permisos)

### Síntoma
La guarda de `/cliente.html` era una lista **negra**: solo `coach` y `admin` se redirigían al
panel. Un `owner`, `colaborador` o `empleado` que llegaba por marcador, back del navegador o
link compartido se quedaba dentro de la superficie del cliente (y veía "Perfil no encontrado
para: …" en vez de irse a su lugar). Los portales hermanos
(`pathway-fit-cliente.html`, `pathway-fin-cliente.html`) ya usaban lista blanca.

### Fix
Lista blanca `PW_CLIENT_ROLES = ['cliente','candidato']` + mapa `PW_ROLE_HOME` que manda a
cada rol a su lugar. Una sesión vieja sin `rol` sigue tratándose como cliente (histórico).
Se preserva el modo preview del coach (`?coach_view=`).

### Estado actual
- ✅ **FIXED** (`cliente.html`)
- ✅ **TESTED** (5 casos: coach, admin, owner, colaborador, empleado + preview del coach)
- ❌ **VERIFIED** (falta producción)

### Cómo evitar regresión
`scripts/check-guardrails.js`: "cliente: quien entra al portal se decide por lista BLANCA de roles".

---

## ERR-CLIPROG-004: las fases del coach se descartaban salvo que fueran exactamente 4

**Estado:** ROOT_CAUSE_CONFIRMED_STATIC → FIXED → TESTED
**Fecha detectado:** 2026-08-26
**Severity:** HIGH (contrato coach→cliente)

### Síntoma
El panel guarda `candidatos.etapas` con **cualquier** cantidad de fases (`cli-savefases`,
"+ Agregar paso") y le avisa al coach *"Fases guardadas ✓ — el cliente las ve"*. Pero
`cliente.html` exigía `_et.length===4` exacto y, si no, las descartaba **todas**: el cliente
leía los nombres por defecto de carrera (Evaluación / CV / LinkedIn / Búsqueda activa).
Evidencia en producción: de 8 fichas con `etapas` cargadas, 2 tienen una sola fase
(p. ej. `["Semana de adaptación"]`) y su nombre nunca llegaba al cliente.

### Fix
`cliente.html` aplica cada nombre que venga (hasta las ranuras disponibles) y deja el default
en el resto. No se tocó el panel ni el backend.

### Estado actual
- ✅ **FIXED** (`cliente.html`)
- ✅ **TESTED** (`tests/cliente-programas.spec.js` → "una sola fase guardada por el coach tambien llega al cliente")
- ❌ **VERIFIED** (falta producción)

### Cómo evitar regresión
`scripts/check-guardrails.js`: "cliente: las fases del coach llegan aunque no sean exactamente 4".

---

## INC-039: Ramas vacías de las fichas de Cliente y Coach (multicoach.html)

**Estado:** FIXED  
**Fecha detectado:** 2026-08-26  
**Fecha triaged:** 2026-08-26  
**Severity:** MEDIUM  

### Scope Metadata
- **Module:** `multicoach` (fichas de Cliente y Coach)
- **Scope Type:** `MODULE_SPECIFIC`
- **Scope Belongs To:** `multicoach`
- **Blocking Scope:** `none`
- **Blocks Current Branch:** No  

### Síntoma
Dos defectos simétricos, ambos **solo en red REAL** (`MC_REAL`), cuando no hay
datos relacionados o cuando la fuente de datos no responde:

1. **Ficha del CLIENTE · pestaña «Recursos»** — la tarjeta "Recursos del
   programa" mostraba **3 recursos inventados** en cualquier red real
   (`📘 9 jul · 78.2 kg · Semana 1`, `📘 9 jun · 79.5 kg · Semana 2`, …).
   Su estado vacío ("Sin recursos cargados aún") era **código muerto**: nunca
   podía alcanzarse. Los recursos REALES del cliente solo salían en la tarjeta
   de abajo ("Subir recursos").
2. **Ficha del COACH · pestaña «Sesiones»** — mostraba el estado vacío
   ("Cuando X agende sesiones con sus clientes, las ves acá") **aunque el coach
   tuviera citas**, en cuanto el `coach-api-gateway` no respondía. Las mismas
   citas sí se veían en la ficha del CLIENTE.

### Categoría
`FRONTEND_ERROR` · `EMPTY_STATE` · `UX_MESSAGING`

### Módulo
`multicoach.html` → `_cliBody()` (rama `t==='recursos'`) y `_coachBody()` (rama `t==='sesiones'`)

### Root Cause
1. La rama de Recursos leía `DET().prog`, que es la plantilla de **MEDICIONES**
   de la maqueta (peso/grasa por fecha), no una lista de recursos — no existe
   `DET().recursos`. Como `DET().prog` nunca está vacío, el ternario
   `progHtml ? progHtml : '<empty state>'` siempre tomaba la primera rama.
   La fuente real es `k.recursos` (lo que escribe `_recursosFiles`).
2. La rama de Sesiones derivaba el conteo **solo** de
   `apiData.metrics.sesiones_ultima_semana`. `_mcLoadCoachDataGateway` atrapa
   cualquier fallo y devuelve `null`, así que un gateway caído producía
   `sesCount === 0` — indistinguible de "no tiene sesiones". Las citas de la red
   ya estaban en memoria en `MC_CITAS` (las trae `mi-red`), que es justo lo que
   usa `_mcSesReal` en la ficha del cliente.

### Evidencia
- **Files affected:**
  - `multicoach.html` → `_cliBody()` rama `t==='recursos'`
  - `multicoach.html` → `_coachBody()` rama `t==='sesiones'`
  - `multicoach.html` → nuevo helper `_mcSesCoachReal()` (junto a `_mcSesReal`)
- **Reproducción (antes):** red real, cliente sin recursos →
  `Recursos del programa. … 📘 9 jul 78.2 kg Semana 1 📘 9 jun 79.5 kg Semana 2 📘 9 may 81.0 kg`
- **Reproducción (antes):** red real, coach con 2 citas en `MC_CITAS`, gateway sin responder →
  `Agenda de Ana. Cuando Ana agende sesiones con sus clientes, las ves acá.`
- **Test:** `tests/inc-039-fichas-empty-states.spec.js` (10 casos: cero datos,
  datos, campo ausente, gateway caído, gateway + citas, anti-XSS, maqueta intacta)

### Estado actual
- ✅ **DETECTED:** reproducido en navegador (Playwright sobre el repo)
- ✅ **ROOT_CAUSE_CONFIRMED_STATIC:** código fuente lo demuestra (`DET().prog`, `sesCount`)
- ✅ **FIXED:** rama `claude/inc-039-empty-states-d6lts2`
- ✅ **TESTED:** `tests/inc-039-fichas-empty-states.spec.js` — 10/10, y falla sobre el código previo
- ❌ **VERIFIED:** pendiente (requiere 48 h en producción sin regresión)

### Cómo evitar regresión
Guardrail `INC-039 fichas: las ramas vacias de Cliente y Coach dicen la verdad`
en `scripts/check-guardrails.js`. Falla si:
- la rama `t==='recursos'` vuelve a usar `DET().prog`, deja de leer `k.recursos`
  o pierde su estado vacío;
- desaparece `_mcSesCoachReal`, deja de leer `MC_CITAS`, la ficha del coach deja
  de usarlo, o el estado vacío vuelve a decidirse solo con `sesCount`.

## ERR-AUTH-001 — Toma de control de cuenta vía el registro público (RC-14)

**Fecha detected:** 2026-08-27
**Fecha triaged:** 2026-08-27
**Severity:** CRITICAL

### Scope Metadata
- **Module:** `registrar-coach` (alta pública de coach)
- **Scope Type:** `CROSS_CUTTING`
- **Scope Belongs To:** `pathway`
- **Blocking Scope:** `RC-12`
- **Blocks Current Branch:** Sí — se descubrió ejecutando RC-12 y lo bloqueaba

### Síntoma
Un anónimo podía quedarse con la cuenta de cualquier persona ya migrada a
Supabase Auth (coach, cliente u **owner**) conociendo solo su email.

### Categoría
`SECURITY` · `AUTH` · `ACCOUNT_TAKEOVER`

### Módulo
`supabase/functions/registrar-coach/index.ts` → guard de "email ya tomado"

### Root Cause
`registrar-coach` es pública por diseño (quien se registra no tiene sesión). Su
único guard era `if (existing && existing.password_hash) → 409`, es decir usaba
`password_hash IS NULL` como sinónimo de *"fila invitada, actívala"*.

Pero `migrate-user-to-auth` **vacía** `password_hash` al migrar a Auth
(`clearLegacyHash`). Desde ese momento una cuenta viva es indistinguible de una
invitación pendiente, y la rama de activación la sobrescribe.

Cadena completa:
1. POST a `registrar-coach` con el email de la víctima y un `password_hash` propio.
2. El guard no dispara → la fila se sobrescribe con ese hash.
3. `login.html`: `signInWithPassword` falla (la contraseña de Auth no cambió).
4. Cae a `migrate-user-to-auth` con el plaintext del atacante → el SHA-256
   coincide con el hash recién plantado → verificación OK.
5. `PUT /auth/v1/admin/users/<id>` → la credencial de Auth pasa al atacante.

El paso 2 es el **único eslabón escribible sin credenciales**; los demás son
comportamiento legítimo. Cerrarlo corta la cadena entera.

### Evidencia
- **Estado medido en producción (27-ago-2026, solo lectura):**
  - Ruta A · `password_hash IS NULL AND auth_id IS NOT NULL` → **51 cuentas**
    (33 coaches, 15 clientes, **2 owners**, 1 empleado)
  - Ruta B · `auth_id` sin enlazar pero con identidad de Auth → 0 hoy, alcanzable
  - Ruta C · identidad de Auth **sin fila** en `usuarios` → **21 identidades**
  - Invitaciones legítimas pendientes que NO se podían romper → **17 filas**
- **Files affected:**
  - `supabase/functions/_shared/auth/estado-cuenta.ts` (nuevo — la regla)
  - `supabase/functions/registrar-coach/index.ts` (guard + lookup de Auth)
- **Test:** `tests/rc14-registro-guard.mjs` — 24 casos; el guard viejo deja 3/3
  rutas abiertas y el test las marca FALLA.
- **El exploit NO se ejecutó** contra producción: la cadena está demostrada por
  lectura de código más conteos agregados.

### Fix
La señal correcta no es la forma de la fila sino **¿existe ya una identidad de
Auth para este email?** `estadoCuenta()` devuelve `libre | invitada |
provisionada` combinando `password_hash`, `auth_id` y la existencia en
`auth.users`. Solo `invitada` puede activarse; solo `libre` puede crearse.
El lookup contra el admin API **falla cerrado** (503) y **pagina** — mirar solo
la primera página de 200 daría un falso "no existe" a partir del usuario 201.

### Estado actual
- ✅ **DETECTED:** durante la ejecución de RC-12
- ✅ **ROOT_CAUSE_CONFIRMED_STATIC:** código + conteos de producción
- ✅ **FIXED:** rama `claude/pathway-e2e-workflow-audit-y7dlxb`
- ✅ **TESTED:** `tests/rc14-registro-guard.mjs` — 24/24
- ❌ **VERIFIED:** pendiente de deploy (`registrar-coach` no desplegada aún)

### Cómo evitar regresión
`tests/rc14-registro-guard.mjs` §4 es el centinela: falla si `registrar-coach`
vuelve a decidir con `existing.password_hash`, si pierde la consulta de
identidad de Auth, si deja de fallar cerrado, o si deja de paginar.

### Pendiente tras el deploy
Las 51 cuentas de la ruta A siguen con `password_hash IS NULL`; eso ya no es
explotable con el guard cerrado, pero conviene decidir si `clearLegacyHash`
debería dejar un centinela en vez de NULL. **No se tocó ningún dato de usuarios
reales** — fuera del alcance autorizado de RC-14.

---

---

## ESTADO RESUMEN

| Error | Estado | Severity | Module | Fixed | Verified |
|-------|--------|----------|--------|-------|----------|
| ERR-UPLOAD-001 | TRIAGED | CRITICAL | avatar | ✅ | ✅ |
| ERR-UPLOAD-002 | TRIAGED | CRITICAL | exercise | ✅ | ✅ |
| ERR-UPLOAD-003 | TRIAGED | HIGH | exercise | ✅ | ✅ |
| ERR-ENV-001 | DETECTED | CRITICAL | infra | ❌ | ❌ |
| ERR-AUTH-001 | TRIAGED | CRITICAL | registrar-coach | ✅ | ❌ |
| **ERR-APP-004** | **DETECTED** | **CRITICAL** | **auth** | ❌ | ❌ |
| **ERR-MULTICOACH-001** | **DETECTED** | **CRITICAL** | **nav** | ❌ | ❌ |
| **ERR-ADMIN-001** | **DETECTED** | **HIGH** | **admin** | ❌ | ❌ |
| **ERR-DEPLOY-001** | **DETECTED** | **HIGH** | **ci/cd** | ❌ | ❌ |
| **ERR-MC-SYNTAX-001** | **DETECTED** | **MEDIUM** | **multicoach** | ❌ | ❌ |
| **ERR-CLIPROG-001** | **FIXED / TESTED** | **HIGH** | **cliente** | ✅ | ❌ |
| **ERR-CLIPROG-002** | **FIXED / TESTED** | **MEDIUM** | **cliente** | ✅ | ❌ |
| **ERR-CLIPROG-003** | **FIXED / TESTED** | **HIGH** | **cliente** | ✅ | ❌ |
| **ERR-CLIPROG-004** | **FIXED / TESTED** | **HIGH** | **cliente** | ✅ | ❌ |
| **ERR-EMAIL-RECORDATORIO** | **DETECTED** | **LOW** | **email** | ❌ | ❌ |
| **INC-039** | **FIXED** | **MEDIUM** | **multicoach** | ✅ | ❌ |

---

## PRÓXIMOS PASOS

**Fase 1.5 — ESTABILIZACIÓN:**
- [ ] ERR-APP-004: Implementar Apple Sign in completo (iOS)
- [ ] ERR-MULTICOACH-001: Corregir navegación owner (routing)
- [ ] ERR-ADMIN-001: Usar admin-coach-op para delete_coach (RLS)
- [ ] ERR-DEPLOY-001: Agregar 11 functions al workflow
- [ ] ERR-MC-SYNTAX-001: Implementar _toastChat, escapar quotes
- [ ] ERR-EMAIL-RECORDATORIO: Actualizar copy (Google Meet → Sala)

**Fase 2:**
- Integrar auto-guardrails para ERR-UPLOAD-001/002/003
- Auditoría completa de ERR-ENV-001
- Auto-test en Playwright para cada error
- Integración con CI/CD
- Autonomy levels 1-3 para auto-fix

---

*Actualizado: 2026-08-10*  
*Fase 1.5 en progreso*
